use crate::actions::process_transcription_output;
use crate::managers::{
    history::{CorrectionPair, HistoryEntry, HistoryManager, PaginatedHistory, ScratchpadNote},
    stats::DashboardStats,
    transcription::TranscriptionManager,
};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::sync::Arc;
use tauri::{AppHandle, State};

#[tauri::command]
#[specta::specta]
pub async fn get_history_entries(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    cursor: Option<i64>,
    limit: Option<usize>,
) -> Result<PaginatedHistory, String> {
    history_manager
        .get_history_entries(cursor, limit)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn toggle_history_entry_saved(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    id: i64,
) -> Result<(), String> {
    history_manager
        .toggle_saved_status(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_audio_file_path(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    file_name: String,
) -> Result<String, String> {
    let path = history_manager.get_audio_file_path(&file_name);
    path.to_str()
        .ok_or_else(|| "Invalid file path".to_string())
        .map(|s| s.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_history_entry(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    id: i64,
) -> Result<(), String> {
    history_manager
        .delete_entry(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn retry_history_entry_transcription(
    app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    transcription_manager: State<'_, Arc<TranscriptionManager>>,
    id: i64,
) -> Result<(), String> {
    let entry = history_manager
        .get_entry_by_id(id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("History entry {} not found", id))?;

    let audio_path = history_manager.get_audio_file_path(&entry.file_name);
    let samples = crate::audio_toolkit::read_wav_samples(&audio_path)
        .map_err(|e| format!("Failed to load audio: {}", e))?;

    if samples.is_empty() {
        return Err("Recording has no audio samples".to_string());
    }

    transcription_manager.initiate_model_load();

    let tm = Arc::clone(&transcription_manager);
    let transcription = tauri::async_runtime::spawn_blocking(move || tm.transcribe(samples))
        .await
        .map_err(|e| format!("Transcription task panicked: {}", e))?
        .map_err(|e| e.to_string())?;

    if transcription.is_empty() {
        return Err("Recording contains no speech".to_string());
    }

    let processed =
        process_transcription_output(&app, &transcription, entry.post_process_requested).await;
    history_manager
        .update_transcription(
            id,
            transcription,
            processed.post_processed_text,
            processed.post_process_prompt,
        )
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_dashboard_stats(
    history_manager: State<'_, Arc<HistoryManager>>,
) -> Result<DashboardStats, String> {
    history_manager
        .get_dashboard_stats()
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn search_history(
    history_manager: State<'_, Arc<HistoryManager>>,
    query: String,
    limit: u32,
) -> Result<Vec<HistoryEntry>, String> {
    history_manager
        .search_entries(&query, limit as usize)
        .map_err(|e| e.to_string())
}

#[derive(Clone, Debug, Serialize, Deserialize, Type)]
pub struct UpdateEntryTextResult {
    pub entry: HistoryEntry,
    /// Words newly learned into the custom dictionary from this correction
    /// (empty unless auto-add to dictionary is enabled).
    pub added_words: Vec<String>,
}

/// Extract candidate dictionary words that appear in `edited` but not in
/// `original`: alphabetic tokens (apostrophes/hyphens allowed), 3+ chars.
fn new_words_from_correction(original: &str, edited: &str) -> Vec<String> {
    let normalize = |text: &str| -> Vec<String> {
        text.split_whitespace()
            .map(|token| {
                token
                    .trim_matches(|c: char| !c.is_alphanumeric())
                    .to_string()
            })
            .filter(|t| !t.is_empty())
            .collect()
    };
    let original_set: std::collections::HashSet<String> = normalize(original)
        .into_iter()
        .map(|w| w.to_lowercase())
        .collect();

    let mut seen = std::collections::HashSet::new();
    normalize(edited)
        .into_iter()
        .filter(|w| {
            w.chars().count() >= 3
                && w.chars()
                    .all(|c| c.is_alphabetic() || c == '\'' || c == '-')
                && !original_set.contains(&w.to_lowercase())
                && seen.insert(w.to_lowercase())
        })
        .take(8)
        .collect()
}

fn changed_phrase(original: &str, edited: &str) -> Option<(String, String)> {
    let original_words = original.split_whitespace().collect::<Vec<_>>();
    let edited_words = edited.split_whitespace().collect::<Vec<_>>();
    let mut prefix = 0;
    while prefix < original_words.len()
        && prefix < edited_words.len()
        && original_words[prefix].eq_ignore_ascii_case(edited_words[prefix])
    {
        prefix += 1;
    }
    let mut suffix = 0;
    while suffix + prefix < original_words.len()
        && suffix + prefix < edited_words.len()
        && original_words[original_words.len() - 1 - suffix]
            .eq_ignore_ascii_case(edited_words[edited_words.len() - 1 - suffix])
    {
        suffix += 1;
    }
    let original_end = original_words.len().saturating_sub(suffix);
    let edited_end = edited_words.len().saturating_sub(suffix);
    let heard = original_words[prefix..original_end].join(" ");
    let corrected = edited_words[prefix..edited_end].join(" ");
    if heard.is_empty() || corrected.is_empty() || heard.eq_ignore_ascii_case(&corrected) {
        None
    } else {
        Some((heard, corrected))
    }
}

#[tauri::command]
#[specta::specta]
pub async fn update_history_entry_text(
    app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    id: i64,
    text: String,
) -> Result<UpdateEntryTextResult, String> {
    let original = history_manager
        .get_entry_by_id(id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("History entry {} not found", id))?;
    let original_text = original
        .post_processed_text
        .as_deref()
        .unwrap_or(&original.transcription_text)
        .to_string();

    let entry = history_manager
        .update_entry_text(id, text.clone())
        .map_err(|e| e.to_string())?;

    // Learn corrected words into the custom dictionary when enabled.
    let mut added_words = Vec::new();
    let mut settings = crate::settings::get_settings(&app);
    if settings.auto_add_to_dictionary {
        let existing: std::collections::HashSet<String> = settings
            .custom_words
            .iter()
            .map(|w| w.to_lowercase())
            .collect();
        for word in new_words_from_correction(&original_text, &text) {
            if !existing.contains(&word.to_lowercase()) {
                settings.custom_words.push(word.clone());
                added_words.push(word);
            }
        }
        if !added_words.is_empty() {
            crate::settings::write_settings(&app, settings);
        }
    }
    // Reviewed edits are always learned as correction pairs. The dictionary
    // toggle only controls prompt enrichment, not the correction memory.
    if let Some((heard, corrected)) = changed_phrase(&original_text, &text) {
        history_manager
            .record_correction_pair(Some(id), &heard, &corrected, "history", true)
            .map_err(|e| e.to_string())?;
    }

    Ok(UpdateEntryTextResult { entry, added_words })
}

#[tauri::command]
#[specta::specta]
pub async fn teach_epos_correction(
    app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    heard_text: String,
    corrected_text: String,
) -> Result<CorrectionPair, String> {
    let corrected = corrected_text.trim();
    if corrected.chars().count() <= 80
        && corrected
            .chars()
            .all(|character| character.is_alphanumeric() || " '-".contains(character))
    {
        let mut settings = crate::settings::get_settings(&app);
        if !settings
            .custom_words
            .iter()
            .any(|word| word.eq_ignore_ascii_case(corrected))
        {
            settings.custom_words.push(corrected.to_string());
            crate::settings::write_settings(&app, settings);
        }
    }

    history_manager
        .record_correction_pair(None, &heard_text, &corrected_text, "explicit_teach", true)
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn list_correction_pairs(
    history_manager: State<'_, Arc<HistoryManager>>,
) -> Result<Vec<CorrectionPair>, String> {
    history_manager
        .list_correction_pairs(false)
        .map_err(|e| e.to_string())
}

// ---- Scratchpad ----

#[tauri::command]
#[specta::specta]
pub async fn list_scratchpad_notes(
    history_manager: State<'_, Arc<HistoryManager>>,
) -> Result<Vec<ScratchpadNote>, String> {
    history_manager
        .list_scratchpad_notes()
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_scratchpad_note(
    history_manager: State<'_, Arc<HistoryManager>>,
) -> Result<ScratchpadNote, String> {
    history_manager
        .create_scratchpad_note()
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn update_scratchpad_note(
    history_manager: State<'_, Arc<HistoryManager>>,
    id: i64,
    title: String,
    content: String,
) -> Result<ScratchpadNote, String> {
    history_manager
        .update_scratchpad_note(id, title, content)
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_scratchpad_note(
    history_manager: State<'_, Arc<HistoryManager>>,
    id: i64,
) -> Result<(), String> {
    history_manager
        .delete_scratchpad_note(id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn update_history_limit(
    app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    limit: usize,
) -> Result<(), String> {
    let mut settings = crate::settings::get_settings(&app);
    settings.history_limit = limit;
    crate::settings::write_settings(&app, settings);

    history_manager
        .cleanup_old_entries()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn update_recording_retention_period(
    app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    period: String,
) -> Result<(), String> {
    use crate::settings::RecordingRetentionPeriod;

    let retention_period = match period.as_str() {
        "never" => RecordingRetentionPeriod::Never,
        "preserve_limit" => RecordingRetentionPeriod::PreserveLimit,
        "days3" => RecordingRetentionPeriod::Days3,
        "weeks2" => RecordingRetentionPeriod::Weeks2,
        "months3" => RecordingRetentionPeriod::Months3,
        _ => return Err(format!("Invalid retention period: {}", period)),
    };

    let mut settings = crate::settings::get_settings(&app);
    settings.recording_retention_period = retention_period;
    crate::settings::write_settings(&app, settings);

    history_manager
        .cleanup_old_entries()
        .map_err(|e| e.to_string())?;

    Ok(())
}
