use crate::managers::ollama::{OllamaGpuStatus, OllamaManager, OllamaModelOption, OllamaStatus};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

#[tauri::command]
#[specta::specta]
pub async fn get_ollama_status(
    ollama_manager: State<'_, Arc<OllamaManager>>,
) -> Result<OllamaStatus, String> {
    Ok(ollama_manager.status().await)
}

#[tauri::command]
#[specta::specta]
pub async fn install_ollama(
    app_handle: AppHandle,
    ollama_manager: State<'_, Arc<OllamaManager>>,
) -> Result<(), String> {
    let result = ollama_manager.install().await;
    if let Err(ref error) = result {
        let _ = app_handle.emit("ollama-install-failed", error);
    }
    result
}

#[tauri::command]
#[specta::specta]
pub async fn start_ollama_server(
    ollama_manager: State<'_, Arc<OllamaManager>>,
) -> Result<(), String> {
    ollama_manager.start_server().await
}

#[tauri::command]
#[specta::specta]
pub async fn get_ollama_recommended_models(
    ollama_manager: State<'_, Arc<OllamaManager>>,
) -> Result<Vec<OllamaModelOption>, String> {
    Ok(ollama_manager.recommended_models().await)
}

#[tauri::command]
#[specta::specta]
pub async fn pull_ollama_model(
    app_handle: AppHandle,
    ollama_manager: State<'_, Arc<OllamaManager>>,
    model_id: String,
) -> Result<(), String> {
    let result = ollama_manager.pull_model(&model_id).await;
    if let Err(ref error) = result {
        let _ = app_handle.emit(
            "ollama-pull-failed",
            serde_json::json!({ "model_id": &model_id, "error": error }),
        );
    }
    result
}

#[tauri::command]
#[specta::specta]
pub async fn cancel_ollama_pull(
    ollama_manager: State<'_, Arc<OllamaManager>>,
    model_id: String,
) -> Result<(), String> {
    ollama_manager.cancel_pull(&model_id)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_ollama_model(
    ollama_manager: State<'_, Arc<OllamaManager>>,
    model_id: String,
) -> Result<(), String> {
    ollama_manager.delete_model(&model_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_ollama_gpu_status(
    ollama_manager: State<'_, Arc<OllamaManager>>,
    model_id: String,
) -> Result<OllamaGpuStatus, String> {
    Ok(ollama_manager.gpu_status(&model_id).await)
}
