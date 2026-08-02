//! Orchestrates a locally-installed Ollama instance for free, private,
//! GPU-accelerated AI post-processing — no API key, no cloud round trip.
//!
//! Epos does not embed its own LLM inference engine. Instead this manager
//! detects/installs Ollama, drives its native pull API to download models
//! with progress reporting, and reports GPU vs. CPU execution. Actual chat
//! completions then go through the existing generic OpenAI-compatible
//! client (`llm_client.rs`) against Ollama's `/v1` surface, exactly like the
//! "Custom" provider already does — this manager only owns model lifecycle.

use futures_util::StreamExt;
use log::{debug, info, warn};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub const OLLAMA_PROVIDER_ID: &str = "ollama";
pub const OLLAMA_BASE_URL: &str = "http://localhost:11434";

/// Curated, non-reasoning instruct models that fit a dictation-cleanup task.
/// Deliberately excludes hybrid-reasoning models (e.g. Qwen3.x) — without an
/// extra `"think": false` field our generic OpenAI-compatible client doesn't
/// send, they emit `<think>...</think>` traces that would leak into pasted
/// text.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct OllamaModelOption {
    /// Settings-safe identifier (used as the model value Epos stores).
    pub id: String,
    /// Exact `ollama pull` tag.
    pub tag: String,
    pub name: String,
    pub description: String,
    pub size_mb: u64,
    pub is_recommended: bool,
    /// Populated at call time by cross-referencing installed models.
    pub is_downloaded: bool,
    pub is_downloading: bool,
}

fn model_catalog() -> Vec<OllamaModelOption> {
    vec![
        OllamaModelOption {
            id: "granite4-1b".to_string(),
            tag: "granite4:1b-h".to_string(),
            name: "Granite 4 Micro".to_string(),
            description: "Smallest and fastest. Good for quick cleanup on modest hardware."
                .to_string(),
            size_mb: 1600,
            is_recommended: false,
            is_downloaded: false,
            is_downloading: false,
        },
        OllamaModelOption {
            id: "granite4-3b".to_string(),
            tag: "granite4:3b".to_string(),
            name: "Granite 4".to_string(),
            description: "Best balance of speed and instruction-following for dictation cleanup."
                .to_string(),
            size_mb: 2100,
            is_recommended: true,
            is_downloaded: false,
            is_downloading: false,
        },
        OllamaModelOption {
            id: "llama3-2-3b".to_string(),
            tag: "llama3.2:3b-instruct-q4_K_M".to_string(),
            name: "Llama 3.2".to_string(),
            description: "Reliable general-purpose fallback.".to_string(),
            size_mb: 2000,
            is_recommended: false,
            is_downloaded: false,
            is_downloading: false,
        },
        OllamaModelOption {
            id: "gemma3-4b".to_string(),
            tag: "gemma3:4b-it-q4_K_M".to_string(),
            name: "Gemma 3".to_string(),
            description: "Largest option here. Higher quality if you have the RAM/VRAM to spare."
                .to_string(),
            size_mb: 3300,
            is_recommended: false,
            is_downloaded: false,
            is_downloading: false,
        },
    ]
}

#[derive(Debug, Clone, Serialize, Type)]
pub struct OllamaPullProgress {
    pub model_id: String,
    pub status: String,
    pub completed: u64,
    pub total: u64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum OllamaGpuStatus {
    Gpu,
    Cpu,
    Partial,
    Unknown,
    /// Nothing currently loaded — status is unknown until first use.
    NotLoaded,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum OllamaAvailability {
    /// Reachable at localhost:11434 right now.
    Running,
    /// Binary found on disk but the server isn't answering.
    InstalledNotRunning,
    /// Not found at all — needs installing.
    NotInstalled,
}

#[derive(Debug, Clone, Serialize, Type)]
pub struct OllamaStatus {
    pub availability: OllamaAvailability,
    pub version: Option<String>,
}

/// Ollama's own accounting from `cmd/cmd.go`: `size_vram == 0` is 100% CPU,
/// `size_vram == size` is 100% GPU, anything else is a CPU/GPU split.
fn classify_gpu(size: u64, size_vram: u64) -> OllamaGpuStatus {
    if size == 0 || size_vram > size {
        OllamaGpuStatus::Unknown
    } else if size_vram == 0 {
        OllamaGpuStatus::Cpu
    } else if size_vram == size {
        OllamaGpuStatus::Gpu
    } else {
        OllamaGpuStatus::Partial
    }
}

pub struct OllamaManager {
    app_handle: AppHandle,
    client: reqwest::Client,
    cancel_flags: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
    pulling: Arc<Mutex<std::collections::HashSet<String>>>,
}

impl OllamaManager {
    pub fn new(app_handle: &AppHandle) -> Self {
        Self {
            app_handle: app_handle.clone(),
            // Short connect timeout: localhost either answers almost instantly
            // or isn't running at all — no point hanging the UI on it.
            client: reqwest::Client::builder()
                .connect_timeout(Duration::from_millis(800))
                .build()
                .unwrap_or_default(),
            cancel_flags: Arc::new(Mutex::new(HashMap::new())),
            pulling: Arc::new(Mutex::new(std::collections::HashSet::new())),
        }
    }

    /// Path to the Ollama binary if we can find one, without requiring the
    /// server to be running.
    fn binary_path() -> Option<PathBuf> {
        #[cfg(target_os = "windows")]
        {
            let path = std::env::var_os("LOCALAPPDATA")
                .map(PathBuf::from)?
                .join("Programs")
                .join("Ollama")
                .join("ollama.exe");
            if path.exists() {
                return Some(path);
            }
            None
        }

        #[cfg(target_os = "macos")]
        {
            for candidate in [
                "/usr/local/bin/ollama",
                "/opt/homebrew/bin/ollama",
                "/Applications/Ollama.app/Contents/Resources/ollama",
            ] {
                let path = PathBuf::from(candidate);
                if path.exists() {
                    return Some(path);
                }
            }
            None
        }

        #[cfg(target_os = "linux")]
        {
            for candidate in ["/usr/local/bin/ollama", "/usr/bin/ollama"] {
                let path = PathBuf::from(candidate);
                if path.exists() {
                    return Some(path);
                }
            }
            None
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        None
    }

    /// Cheap liveness probe — hits the version endpoint with the manager's
    /// short connect timeout so an absent server fails fast, not after a
    /// multi-second default reqwest timeout.
    async fn probe_version(&self) -> Option<String> {
        let resp = self
            .client
            .get(format!("{}/api/version", OLLAMA_BASE_URL))
            .send()
            .await
            .ok()?;
        if !resp.status().is_success() {
            return None;
        }
        let json: serde_json::Value = resp.json().await.ok()?;
        json.get("version")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    }

    pub async fn status(&self) -> OllamaStatus {
        if let Some(version) = self.probe_version().await {
            return OllamaStatus {
                availability: OllamaAvailability::Running,
                version: Some(version),
            };
        }

        let availability = if Self::binary_path().is_some() {
            OllamaAvailability::InstalledNotRunning
        } else {
            OllamaAvailability::NotInstalled
        };

        OllamaStatus {
            availability,
            version: None,
        }
    }

    /// Starts the Ollama server as a detached background process. Only
    /// useful when the binary is present but the tray app/service isn't
    /// running (e.g. the user quit it manually).
    pub async fn start_server(&self) -> Result<(), String> {
        let binary = Self::binary_path().ok_or_else(|| "Ollama is not installed".to_string())?;

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            std::process::Command::new(&binary)
                .arg("serve")
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map_err(|e| format!("Failed to start Ollama server: {}", e))?;
        }

        #[cfg(not(target_os = "windows"))]
        {
            std::process::Command::new(&binary)
                .arg("serve")
                .spawn()
                .map_err(|e| format!("Failed to start Ollama server: {}", e))?;
        }

        // Poll for readiness rather than assuming an arbitrary sleep is enough.
        for _ in 0..20 {
            tokio::time::sleep(Duration::from_millis(300)).await;
            if self.probe_version().await.is_some() {
                return Ok(());
            }
        }

        Err("Ollama server did not respond after starting".to_string())
    }

    /// Downloads and silently installs Ollama (Windows only — the installer
    /// is a per-user Inno Setup EXE with documented silent flags). On
    /// macOS/Linux there's no equivalent one-shot silent installer we can
    /// verify from here, so the frontend instead opens ollama.com/download
    /// and polls `status()` until the user finishes installing manually.
    #[cfg(target_os = "windows")]
    pub async fn install(&self) -> Result<(), String> {
        let _ = self
            .app_handle
            .emit("ollama-install-progress", "downloading");

        let installer_url =
            "https://github.com/ollama/ollama/releases/latest/download/OllamaSetup.exe";
        let response = self
            .client
            .get(installer_url)
            .timeout(Duration::from_secs(120))
            .send()
            .await
            .map_err(|e| format!("Failed to download Ollama installer: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Failed to download Ollama installer: HTTP {}",
                response.status()
            ));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("Failed to read installer download: {}", e))?;

        let temp_dir = std::env::temp_dir();
        let installer_path = temp_dir.join("OllamaSetup.exe");
        std::fs::write(&installer_path, &bytes)
            .map_err(|e| format!("Failed to write installer to disk: {}", e))?;

        let _ = self
            .app_handle
            .emit("ollama-install-progress", "installing");

        // /VERYSILENT + /SUPPRESSMSGBOXES: no UI at all. /NORESTART: this
        // installer never needs one, but the flag is harmless to include.
        // The installer's own [Run] step launches the Ollama tray app (which
        // starts the server) once setup finishes.
        let status = std::process::Command::new(&installer_path)
            .args(["/VERYSILENT", "/NORESTART", "/SUPPRESSMSGBOXES"])
            .status()
            .map_err(|e| format!("Failed to run Ollama installer: {}", e))?;

        let _ = std::fs::remove_file(&installer_path);

        if !status.success() {
            return Err(format!(
                "Ollama installer exited with status: {:?}",
                status.code()
            ));
        }

        let _ = self
            .app_handle
            .emit("ollama-install-progress", "waiting_for_server");

        // The installer's post-install launch takes a moment to bring the
        // API up. Fall back to starting it ourselves if it doesn't appear —
        // covers the (documented, still-open) case where the auto-launch is
        // suppressed by an existing install state.
        for _ in 0..30 {
            tokio::time::sleep(Duration::from_millis(500)).await;
            if self.probe_version().await.is_some() {
                let _ = self.app_handle.emit("ollama-install-progress", "ready");
                return Ok(());
            }
        }

        self.start_server().await
    }

    #[cfg(not(target_os = "windows"))]
    pub async fn install(&self) -> Result<(), String> {
        Err(
            "Automatic install is only available on Windows. Opening the download page instead."
                .to_string(),
        )
    }

    /// Locally-pulled model tags, from Ollama's native tag list (this is the
    /// only surface that can enumerate them — the OpenAI-compatible
    /// `/v1/models` only lists the same set anyway, and only that).
    pub async fn list_local_tags(&self) -> Result<Vec<String>, String> {
        let resp = self
            .client
            .get(format!("{}/api/tags", OLLAMA_BASE_URL))
            .send()
            .await
            .map_err(|e| format!("Failed to reach Ollama: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Ollama returned HTTP {}", resp.status()));
        }

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

        let tags = json
            .get("models")
            .and_then(|m| m.as_array())
            .map(|models| {
                models
                    .iter()
                    .filter_map(|m| m.get("name").and_then(|n| n.as_str()))
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        Ok(tags)
    }

    /// The curated catalog, with `is_downloaded`/`is_downloading` filled in
    /// against the current local tag list. Returns the catalog with
    /// everything marked not-downloaded if Ollama isn't reachable, so the UI
    /// can still show what's available to pull once it is.
    pub async fn recommended_models(&self) -> Vec<OllamaModelOption> {
        let local_tags = self.list_local_tags().await.unwrap_or_default();
        let pulling = self.pulling.lock().unwrap().clone();

        model_catalog()
            .into_iter()
            .map(|mut model| {
                model.is_downloaded = local_tags.iter().any(|t| t == &model.tag);
                model.is_downloading = pulling.contains(&model.id);
                model
            })
            .collect()
    }

    /// Streams `POST /api/pull`, emitting `ollama-pull-progress` events
    /// (throttled to ~10/sec, matching the ASR download pattern) until a
    /// `{"status":"success"}` line arrives. Ollama keeps HTTP 200 for
    /// mid-stream errors — they arrive as a line with an `"error"` key
    /// instead of a non-2xx response, so every line has to be inspected.
    pub async fn pull_model(&self, model_id: &str) -> Result<(), String> {
        let model = model_catalog()
            .into_iter()
            .find(|m| m.id == model_id)
            .ok_or_else(|| format!("Unknown model: {}", model_id))?;

        {
            let mut pulling = self.pulling.lock().unwrap();
            if pulling.contains(model_id) {
                return Err("Already downloading this model".to_string());
            }
            pulling.insert(model_id.to_string());
        }

        let cancel_flag = Arc::new(AtomicBool::new(false));
        self.cancel_flags
            .lock()
            .unwrap()
            .insert(model_id.to_string(), cancel_flag.clone());

        let result = self.pull_model_inner(&model, &cancel_flag).await;

        self.pulling.lock().unwrap().remove(model_id);
        self.cancel_flags.lock().unwrap().remove(model_id);

        result
    }

    async fn pull_model_inner(
        &self,
        model: &OllamaModelOption,
        cancel_flag: &Arc<AtomicBool>,
    ) -> Result<(), String> {
        let response = self
            .client
            .post(format!("{}/api/pull", OLLAMA_BASE_URL))
            .json(&serde_json::json!({ "model": model.tag, "stream": true }))
            .send()
            .await
            .map_err(|e| format!("Failed to start pull: {}", e))?;

        if !response.status().is_success() {
            let text = response.text().await.unwrap_or_default();
            return Err(format!("Failed to start pull: {}", text));
        }

        let mut stream = response.bytes_stream();
        let mut line_buf = Vec::<u8>::new();
        let mut last_emit = std::time::Instant::now();
        let throttle = Duration::from_millis(100);
        let mut succeeded = false;

        while let Some(chunk) = stream.next().await {
            if cancel_flag.load(Ordering::Relaxed) {
                info!("Ollama pull cancelled for: {}", model.tag);
                return Ok(());
            }

            let chunk = chunk.map_err(|e| format!("Stream error: {}", e))?;
            line_buf.extend_from_slice(&chunk);

            // NDJSON: drain every complete line currently in the buffer.
            while let Some(pos) = line_buf.iter().position(|&b| b == b'\n') {
                let line: Vec<u8> = line_buf.drain(..=pos).collect();
                let line = &line[..line.len().saturating_sub(1)];
                if line.trim_ascii().is_empty() {
                    continue;
                }

                let parsed: serde_json::Value = match serde_json::from_slice(line) {
                    Ok(v) => v,
                    Err(e) => {
                        warn!("Failed to parse Ollama pull line: {}", e);
                        continue;
                    }
                };

                if let Some(err) = parsed.get("error").and_then(|e| e.as_str()) {
                    return Err(err.to_string());
                }

                let status = parsed
                    .get("status")
                    .and_then(|s| s.as_str())
                    .unwrap_or("")
                    .to_string();

                if status == "success" {
                    succeeded = true;
                }

                let total = parsed.get("total").and_then(|t| t.as_u64()).unwrap_or(0);
                let completed = parsed
                    .get("completed")
                    .and_then(|c| c.as_u64())
                    .unwrap_or(0);
                let percentage = if total > 0 {
                    (completed as f64 / total as f64) * 100.0
                } else {
                    0.0
                };

                if last_emit.elapsed() >= throttle || status == "success" {
                    let _ = self.app_handle.emit(
                        "ollama-pull-progress",
                        &OllamaPullProgress {
                            model_id: model.id.clone(),
                            status,
                            completed,
                            total,
                            percentage,
                        },
                    );
                    last_emit = std::time::Instant::now();
                }
            }
        }

        if succeeded {
            info!("Successfully pulled Ollama model: {}", model.tag);
            Ok(())
        } else {
            Err("Pull stream ended before reporting success".to_string())
        }
    }

    pub fn cancel_pull(&self, model_id: &str) -> Result<(), String> {
        let flags = self.cancel_flags.lock().unwrap();
        if let Some(flag) = flags.get(model_id) {
            flag.store(true, Ordering::Relaxed);
            Ok(())
        } else {
            Err("No active download for this model".to_string())
        }
    }

    pub async fn delete_model(&self, model_id: &str) -> Result<(), String> {
        let model = model_catalog()
            .into_iter()
            .find(|m| m.id == model_id)
            .ok_or_else(|| format!("Unknown model: {}", model_id))?;

        let resp = self
            .client
            .delete(format!("{}/api/delete", OLLAMA_BASE_URL))
            .json(&serde_json::json!({ "model": model.tag }))
            .send()
            .await
            .map_err(|e| format!("Failed to delete model: {}", e))?;

        if !resp.status().is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Failed to delete model: {}", text));
        }

        Ok(())
    }

    /// GPU/CPU split for a model. `/api/ps` only lists currently *loaded*
    /// models, so this reports `NotLoaded` until the model has actually run
    /// once (Ollama loads lazily on first chat request).
    pub async fn gpu_status(&self, model_id: &str) -> OllamaGpuStatus {
        let Some(model) = model_catalog().into_iter().find(|m| m.id == model_id) else {
            return OllamaGpuStatus::Unknown;
        };

        let Ok(resp) = self
            .client
            .get(format!("{}/api/ps", OLLAMA_BASE_URL))
            .send()
            .await
        else {
            return OllamaGpuStatus::Unknown;
        };

        let Ok(json) = resp.json::<serde_json::Value>().await else {
            return OllamaGpuStatus::Unknown;
        };

        let Some(models) = json.get("models").and_then(|m| m.as_array()) else {
            return OllamaGpuStatus::NotLoaded;
        };

        let Some(entry) = models
            .iter()
            .find(|m| m.get("model").and_then(|n| n.as_str()) == Some(model.tag.as_str()))
        else {
            return OllamaGpuStatus::NotLoaded;
        };

        let size = entry.get("size").and_then(|s| s.as_u64()).unwrap_or(0);
        let size_vram = entry.get("size_vram").and_then(|s| s.as_u64()).unwrap_or(0);
        debug!(
            "Ollama model {} loaded: size={} size_vram={}",
            model.tag, size, size_vram
        );

        classify_gpu(size, size_vram)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_gpu_all_cpu() {
        assert_eq!(classify_gpu(1000, 0), OllamaGpuStatus::Cpu);
    }

    #[test]
    fn classify_gpu_all_gpu() {
        assert_eq!(classify_gpu(1000, 1000), OllamaGpuStatus::Gpu);
    }

    #[test]
    fn classify_gpu_partial() {
        assert_eq!(classify_gpu(1000, 400), OllamaGpuStatus::Partial);
    }

    #[test]
    fn classify_gpu_unknown_when_vram_exceeds_size() {
        assert_eq!(classify_gpu(1000, 1200), OllamaGpuStatus::Unknown);
    }

    #[test]
    fn classify_gpu_unknown_when_size_zero() {
        assert_eq!(classify_gpu(0, 0), OllamaGpuStatus::Unknown);
    }

    #[test]
    fn catalog_ids_are_unique_and_tags_nonempty() {
        let catalog = model_catalog();
        let mut ids = std::collections::HashSet::new();
        for model in &catalog {
            assert!(!model.tag.is_empty());
            assert!(ids.insert(model.id.clone()), "duplicate id: {}", model.id);
        }
    }
}
