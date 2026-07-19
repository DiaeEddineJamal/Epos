//! Dictation statistics: lifetime word totals, speaking pace, and day streaks.
//!
//! Stats live in their own tables (`daily_stats`, `lifetime_stats`) inside
//! history.db because history rows are pruned by retention settings — lifetime
//! totals must survive that cleanup. All day bucketing uses the LOCAL date so
//! streaks roll over at the user's midnight.

use anyhow::Result;
use chrono::{Duration, Local, NaiveDate};
use log::error;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::AppHandle;
use tauri_specta::Event;

/// Word-count milestones, in dictated-words-lifetime order.
const WORD_MILESTONES: &[i64] = &[
    100, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000,
    2_000_000, 5_000_000, 10_000_000,
];

/// Day-streak milestones.
const STREAK_MILESTONES: &[i64] = &[3, 7, 14, 30, 60, 100, 365];

/// How many trailing days of activity ship with the dashboard snapshot.
const RECENT_DAYS: i64 = 14;

#[derive(Clone, Debug, Serialize, Deserialize, Type)]
pub struct DailyStat {
    /// Local date, formatted YYYY-MM-DD.
    pub day: String,
    pub words: i64,
    pub duration_ms: i64,
    pub dictations: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize, Type)]
pub struct DashboardStats {
    pub total_words: i64,
    pub total_dictations: i64,
    pub total_duration_ms: i64,
    /// Words per minute of retained speech audio (VAD-gated), lifetime average.
    pub average_wpm: f64,
    pub today_words: i64,
    pub current_streak: i64,
    pub best_streak: i64,
    pub last_milestone: i64,
    /// Next word milestone ahead of the current total (0 when maxed out).
    pub next_milestone: i64,
    /// Last `RECENT_DAYS` local days, oldest first, gaps filled with zeros.
    pub recent_days: Vec<DailyStat>,
}

/// Emitted after every recorded dictation so dashboards update live and the
/// main window can surface milestone toasts.
#[derive(Clone, Debug, Serialize, Deserialize, Type, tauri_specta::Event)]
pub struct DictationStatsEvent {
    pub stats: DashboardStats,
    /// Word milestone crossed by this dictation, if any.
    pub new_word_milestone: Option<i64>,
    /// Streak milestone reached today (fires on the first dictation of the day).
    pub new_streak_milestone: Option<i64>,
}

/// Count words the way a person would: whitespace-separated tokens, plus one
/// word per CJK ideograph/kana character (scripts that don't use spaces).
pub fn count_words(text: &str) -> i64 {
    let mut words: i64 = 0;
    let mut in_token = false;
    for ch in text.chars() {
        let is_cjk = matches!(
            ch as u32,
            0x3040..=0x30FF | 0x3400..=0x4DBF | 0x4E00..=0x9FFF | 0xF900..=0xFAFF | 0xAC00..=0xD7AF
        );
        if is_cjk {
            words += 1;
            in_token = false;
        } else if ch.is_whitespace() {
            in_token = false;
        } else if !in_token {
            words += 1;
            in_token = true;
        }
    }
    words
}

fn today_local() -> NaiveDate {
    Local::now().date_naive()
}

fn fmt_day(day: NaiveDate) -> String {
    day.format("%Y-%m-%d").to_string()
}

/// Consecutive active days ending today, or ending yesterday when the user
/// hasn't dictated yet today (the streak is still "alive" until midnight).
fn compute_streak(conn: &Connection, today: NaiveDate) -> Result<i64> {
    let mut stmt =
        conn.prepare("SELECT day FROM daily_stats WHERE words > 0 ORDER BY day DESC LIMIT 1000")?;
    let days: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    let mut expected = today;
    let mut streak: i64 = 0;
    for (i, day_str) in days.iter().enumerate() {
        let Ok(day) = NaiveDate::parse_from_str(day_str, "%Y-%m-%d") else {
            continue;
        };
        if i == 0 && day == today - Duration::days(1) {
            // No dictation yet today; streak counts back from yesterday.
            expected = day;
        }
        if day == expected {
            streak += 1;
            expected -= Duration::days(1);
        } else if day < expected {
            break;
        }
    }
    Ok(streak)
}

fn read_lifetime(conn: &Connection) -> Result<(i64, i64, i64, i64, i64)> {
    Ok(conn.query_row(
        "SELECT total_words, total_duration_ms, total_dictations, best_streak, last_milestone
         FROM lifetime_stats WHERE id = 1",
        [],
        |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        },
    )?)
}

fn recent_days(conn: &Connection, today: NaiveDate) -> Result<Vec<DailyStat>> {
    let start = today - Duration::days(RECENT_DAYS - 1);
    let mut stmt = conn.prepare(
        "SELECT day, words, duration_ms, dictations FROM daily_stats WHERE day >= ?1 ORDER BY day ASC",
    )?;
    let rows: Vec<DailyStat> = stmt
        .query_map(params![fmt_day(start)], |row| {
            Ok(DailyStat {
                day: row.get(0)?,
                words: row.get(1)?,
                duration_ms: row.get(2)?,
                dictations: row.get(3)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    // Fill gaps so the dashboard sparkline has a fixed-width window.
    let mut filled = Vec::with_capacity(RECENT_DAYS as usize);
    let mut iter = rows.into_iter().peekable();
    for offset in 0..RECENT_DAYS {
        let day = fmt_day(start + Duration::days(offset));
        if iter.peek().is_some_and(|r| r.day == day) {
            filled.push(iter.next().unwrap());
        } else {
            filled.push(DailyStat {
                day,
                words: 0,
                duration_ms: 0,
                dictations: 0,
            });
        }
    }
    Ok(filled)
}

/// Assemble the full dashboard snapshot from the stats tables.
pub fn dashboard_stats(conn: &Connection) -> Result<DashboardStats> {
    let today = today_local();
    let (total_words, total_duration_ms, total_dictations, best_streak, last_milestone) =
        read_lifetime(conn)?;

    let today_words: i64 = conn
        .query_row(
            "SELECT words FROM daily_stats WHERE day = ?1",
            params![fmt_day(today)],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let current_streak = compute_streak(conn, today)?;
    let minutes = total_duration_ms as f64 / 60_000.0;
    let average_wpm = if minutes > 0.0 {
        (total_words as f64 / minutes * 10.0).round() / 10.0
    } else {
        0.0
    };
    let next_milestone = WORD_MILESTONES
        .iter()
        .copied()
        .find(|m| *m > total_words)
        .unwrap_or(0);

    Ok(DashboardStats {
        total_words,
        total_dictations,
        total_duration_ms,
        average_wpm,
        today_words,
        current_streak,
        best_streak: best_streak.max(current_streak),
        last_milestone,
        next_milestone,
        recent_days: recent_days(conn, today)?,
    })
}

/// Record one completed dictation and emit a [`DictationStatsEvent`].
/// Returns the updated snapshot.
pub fn record_dictation(
    app_handle: &AppHandle,
    conn: &Connection,
    words: i64,
    duration_ms: i64,
) -> Result<DashboardStats> {
    if words <= 0 {
        return dashboard_stats(conn);
    }
    let today = fmt_day(today_local());

    conn.execute(
        "INSERT INTO daily_stats (day, words, duration_ms, dictations) VALUES (?1, ?2, ?3, 1)
         ON CONFLICT(day) DO UPDATE SET
            words = words + excluded.words,
            duration_ms = duration_ms + excluded.duration_ms,
            dictations = dictations + 1",
        params![today, words, duration_ms],
    )?;

    let (prev_total, _, _, prev_best, prev_milestone) = read_lifetime(conn)?;

    conn.execute(
        "UPDATE lifetime_stats SET
            total_words = total_words + ?1,
            total_duration_ms = total_duration_ms + ?2,
            total_dictations = total_dictations + 1
         WHERE id = 1",
        params![words, duration_ms],
    )?;

    // Word milestone: highest threshold crossed by this dictation.
    let new_total = prev_total + words;
    let new_word_milestone = WORD_MILESTONES
        .iter()
        .copied()
        .filter(|m| *m > prev_milestone && prev_total < *m && new_total >= *m)
        .max();
    if let Some(m) = new_word_milestone {
        conn.execute(
            "UPDATE lifetime_stats SET last_milestone = ?1 WHERE id = 1",
            params![m],
        )?;
    }

    let mut stats = dashboard_stats(conn)?;

    if stats.current_streak > prev_best {
        conn.execute(
            "UPDATE lifetime_stats SET best_streak = ?1 WHERE id = 1",
            params![stats.current_streak],
        )?;
        stats.best_streak = stats.current_streak;
    }

    // Streak milestone: fires once, on the first dictation of the day that
    // brings the streak to a milestone length.
    let today_dictations: i64 = conn
        .query_row(
            "SELECT dictations FROM daily_stats WHERE day = ?1",
            params![today],
            |row| row.get(0),
        )
        .unwrap_or(0);
    let new_streak_milestone = (today_dictations == 1)
        .then(|| {
            STREAK_MILESTONES
                .iter()
                .copied()
                .find(|m| *m == stats.current_streak)
        })
        .flatten();

    let event = DictationStatsEvent {
        stats: stats.clone(),
        new_word_milestone,
        new_streak_milestone,
    };
    if let Err(e) = event.emit(app_handle) {
        error!("Failed to emit dictation-stats event: {}", e);
    }

    Ok(stats)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        conn.execute_batch(
            "CREATE TABLE daily_stats (
                day TEXT PRIMARY KEY,
                words INTEGER NOT NULL DEFAULT 0,
                duration_ms INTEGER NOT NULL DEFAULT 0,
                dictations INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE lifetime_stats (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                total_words INTEGER NOT NULL DEFAULT 0,
                total_duration_ms INTEGER NOT NULL DEFAULT 0,
                total_dictations INTEGER NOT NULL DEFAULT 0,
                best_streak INTEGER NOT NULL DEFAULT 0,
                last_milestone INTEGER NOT NULL DEFAULT 0
            );
            INSERT INTO lifetime_stats (id) VALUES (1);",
        )
        .expect("create stats tables");
        conn
    }

    #[test]
    fn count_words_handles_whitespace_and_cjk() {
        assert_eq!(count_words(""), 0);
        assert_eq!(count_words("   "), 0);
        assert_eq!(count_words("hello world"), 2);
        assert_eq!(count_words("  spaced   out  tokens "), 3);
        assert_eq!(count_words("你好世界"), 4);
        assert_eq!(count_words("meeting 明天 at ten"), 5);
    }

    #[test]
    fn streak_counts_consecutive_days_ending_today() {
        let conn = setup_conn();
        let today = today_local();
        for offset in 0..3 {
            conn.execute(
                "INSERT INTO daily_stats (day, words, duration_ms, dictations) VALUES (?1, 10, 1000, 1)",
                params![fmt_day(today - Duration::days(offset))],
            )
            .unwrap();
        }
        assert_eq!(compute_streak(&conn, today).unwrap(), 3);
    }

    #[test]
    fn streak_alive_from_yesterday_without_today() {
        let conn = setup_conn();
        let today = today_local();
        for offset in 1..4 {
            conn.execute(
                "INSERT INTO daily_stats (day, words, duration_ms, dictations) VALUES (?1, 10, 1000, 1)",
                params![fmt_day(today - Duration::days(offset))],
            )
            .unwrap();
        }
        assert_eq!(compute_streak(&conn, today).unwrap(), 3);
    }

    #[test]
    fn streak_breaks_on_gap() {
        let conn = setup_conn();
        let today = today_local();
        for offset in [0i64, 1, 3, 4] {
            conn.execute(
                "INSERT INTO daily_stats (day, words, duration_ms, dictations) VALUES (?1, 10, 1000, 1)",
                params![fmt_day(today - Duration::days(offset))],
            )
            .unwrap();
        }
        assert_eq!(compute_streak(&conn, today).unwrap(), 2);
    }

    #[test]
    fn dashboard_stats_computes_wpm_and_next_milestone() {
        let conn = setup_conn();
        conn.execute(
            "UPDATE lifetime_stats SET total_words = 300, total_duration_ms = 120000, total_dictations = 4 WHERE id = 1",
            [],
        )
        .unwrap();
        let stats = dashboard_stats(&conn).unwrap();
        assert_eq!(stats.total_words, 300);
        assert!((stats.average_wpm - 150.0).abs() < f64::EPSILON);
        assert_eq!(stats.next_milestone, 500);
        assert_eq!(stats.recent_days.len(), RECENT_DAYS as usize);
    }
}
