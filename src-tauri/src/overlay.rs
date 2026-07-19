use crate::input;
use crate::settings;
use crate::settings::OverlayPosition;
use std::sync::atomic::{AtomicU64, AtomicU8, Ordering};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize};

#[cfg(not(target_os = "macos"))]
use log::debug;

#[cfg(not(target_os = "macos"))]
use tauri::WebviewWindowBuilder;

#[cfg(target_os = "macos")]
use tauri::WebviewUrl;

#[cfg(target_os = "macos")]
use tauri_nspanel::{tauri_panel, CollectionBehavior, PanelBuilder, PanelLevel};

#[cfg(target_os = "linux")]
use gtk_layer_shell::{Edge, KeyboardMode, Layer, LayerShell};
#[cfg(target_os = "linux")]
use std::env;

#[cfg(target_os = "macos")]
tauri_panel! {
    panel!(RecordingOverlayPanel {
        config: {
            can_become_key_window: false,
            is_floating_panel: true
        }
    })
}

const ACTIVE_OVERLAY_WIDTH: f64 = 196.0;
const ACTIVE_OVERLAY_HEIGHT: f64 = 34.0;
const IDLE_OVERLAY_WIDTH: f64 = 172.0;
const IDLE_OVERLAY_HEIGHT: f64 = 58.0;
static OVERLAY_VISIBILITY_GENERATION: AtomicU64 = AtomicU64::new(0);
static CURRENT_OVERLAY_STATE: AtomicU8 = AtomicU8::new(0);

// Margin between a side-docked flow bar and the screen edge.
const OVERLAY_SIDE_OFFSET: f64 = 10.0;

#[cfg(target_os = "macos")]
const OVERLAY_TOP_OFFSET: f64 = 46.0;
#[cfg(any(target_os = "windows", target_os = "linux"))]
const OVERLAY_TOP_OFFSET: f64 = 4.0;

#[cfg(target_os = "macos")]
const OVERLAY_BOTTOM_OFFSET: f64 = 15.0;

// Clearance above the Windows/Linux taskbar so the resting capsule isn't
// clipped by auto-hide bars or overlapping tray icons (Wispr-style).
#[cfg(any(target_os = "windows", target_os = "linux"))]
const OVERLAY_BOTTOM_OFFSET: f64 = 60.0;

#[cfg(target_os = "linux")]
fn update_gtk_layer_shell_anchors(overlay_window: &tauri::webview::WebviewWindow) {
    let window_clone = overlay_window.clone();
    let _ = overlay_window.run_on_main_thread(move || {
        // Try to get the GTK window from the Tauri webview
        if let Ok(gtk_window) = window_clone.gtk_window() {
            let settings = settings::get_settings(window_clone.app_handle());
            gtk_window.set_anchor(Edge::Left, false);
            gtk_window.set_anchor(Edge::Right, false);
            match settings.overlay_position {
                OverlayPosition::Top => {
                    gtk_window.set_anchor(Edge::Top, true);
                    gtk_window.set_anchor(Edge::Bottom, false);
                }
                OverlayPosition::Left => {
                    gtk_window.set_anchor(Edge::Left, true);
                    gtk_window.set_anchor(Edge::Top, false);
                    gtk_window.set_anchor(Edge::Bottom, false);
                }
                OverlayPosition::Right => {
                    gtk_window.set_anchor(Edge::Right, true);
                    gtk_window.set_anchor(Edge::Top, false);
                    gtk_window.set_anchor(Edge::Bottom, false);
                }
                OverlayPosition::Bottom | OverlayPosition::None => {
                    gtk_window.set_anchor(Edge::Bottom, true);
                    gtk_window.set_anchor(Edge::Top, false);
                }
            }
        }
    });
}

/// Initializes GTK layer shell for Linux overlay window
/// Returns true if layer shell was successfully initialized, false otherwise
#[cfg(target_os = "linux")]
fn init_gtk_layer_shell(overlay_window: &tauri::webview::WebviewWindow) -> bool {
    // On KDE Wayland, layer-shell init has shown protocol instability.
    // Fall back to regular always-on-top overlay behavior (as in v0.7.1).
    let is_wayland = env::var("WAYLAND_DISPLAY").is_ok()
        || env::var("XDG_SESSION_TYPE")
            .map(|v| v.eq_ignore_ascii_case("wayland"))
            .unwrap_or(false);
    let is_kde = env::var("XDG_CURRENT_DESKTOP")
        .map(|v| v.to_uppercase().contains("KDE"))
        .unwrap_or(false)
        || env::var("KDE_SESSION_VERSION").is_ok();
    if is_wayland && is_kde {
        debug!("Skipping GTK layer shell init on KDE Wayland");
        return false;
    }

    if !gtk_layer_shell::is_supported() {
        return false;
    }

    // Try to get the GTK window from the Tauri webview
    if let Ok(gtk_window) = overlay_window.gtk_window() {
        // Initialize layer shell
        gtk_window.init_layer_shell();
        gtk_window.set_layer(Layer::Overlay);
        gtk_window.set_keyboard_mode(KeyboardMode::None);
        gtk_window.set_exclusive_zone(0);

        update_gtk_layer_shell_anchors(overlay_window);

        return true;
    }
    false
}

/// Forces a window to be topmost using Win32 API (Windows only)
/// This is more reliable than Tauri's set_always_on_top which can be overridden.
/// Calls SetWindowPos directly (no run_on_main_thread) so sync Tauri commands
/// that touch the overlay cannot deadlock the UI thread.
#[cfg(target_os = "windows")]
fn force_overlay_topmost(overlay_window: &tauri::webview::WebviewWindow) {
    use windows::Win32::UI::WindowsAndMessaging::{
        SetWindowPos, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW,
    };

    if let Ok(hwnd) = overlay_window.hwnd() {
        unsafe {
            let _ = SetWindowPos(
                hwnd,
                Some(HWND_TOPMOST),
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
            );
        }
    }
}

/// Cursor position in the OS virtual-desktop coordinate space.
///
/// On Windows this is always physical pixels from `GetCursorPos` (reliable
/// across mixed-DPI multi-monitor setups). Elsewhere we use Enigo, which
/// returns logical points on macOS.
#[cfg(target_os = "windows")]
fn get_cursor_position_for_monitors(_app_handle: &AppHandle) -> Option<(i32, i32)> {
    use windows::Win32::Foundation::POINT;
    use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

    let mut point = POINT::default();
    unsafe {
        if GetCursorPos(&mut point).is_ok() {
            Some((point.x, point.y))
        } else {
            // Fall back to Enigo if the Win32 call fails for any reason.
            input::get_cursor_position(_app_handle)
        }
    }
}

#[cfg(target_os = "windows")]
fn get_foreground_window_center() -> Option<(i32, i32)> {
    use windows::Win32::Foundation::RECT;
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowRect};

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }
        let mut rect = RECT::default();
        if GetWindowRect(hwnd, &mut rect).is_ok() {
            return Some(((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2));
        }
    }
    None
}

#[cfg(not(target_os = "windows"))]
fn get_cursor_position_for_monitors(app_handle: &AppHandle) -> Option<(i32, i32)> {
    input::get_cursor_position(app_handle)
}

fn get_monitor_with_cursor(app_handle: &AppHandle) -> Option<tauri::Monitor> {
    #[cfg(target_os = "windows")]
    let target_location =
        get_foreground_window_center().or_else(|| get_cursor_position_for_monitors(app_handle));
    #[cfg(not(target_os = "windows"))]
    let target_location = get_cursor_position_for_monitors(app_handle);

    if let Some(mouse_location) = target_location {
        if let Ok(monitors) = app_handle.available_monitors() {
            for monitor in monitors {
                #[cfg(target_os = "windows")]
                {
                    // Windows: cursor + monitor geometry are both physical.
                    // Comparing in physical space avoids the mixed-DPI trap
                    // where dividing by scale_factor shifts secondary monitors
                    // and the hit-test misses every display.
                    let pos = monitor.position();
                    let size = monitor.size();
                    if is_mouse_within_monitor(mouse_location, &pos, &size) {
                        return Some(monitor);
                    }
                }

                #[cfg(not(target_os = "windows"))]
                {
                    // macOS/Linux: Enigo returns logical coordinates; normalize
                    // Tauri's physical monitor geometry to logical for the test.
                    let scale = monitor.scale_factor();
                    let pos = PhysicalPosition::new(
                        (monitor.position().x as f64 / scale) as i32,
                        (monitor.position().y as f64 / scale) as i32,
                    );
                    let size = PhysicalSize::new(
                        (monitor.size().width as f64 / scale) as u32,
                        (monitor.size().height as f64 / scale) as u32,
                    );
                    if is_mouse_within_monitor(mouse_location, &pos, &size) {
                        return Some(monitor);
                    }
                }
            }
        }
    }

    app_handle.primary_monitor().ok().flatten()
}

fn is_mouse_within_monitor(
    mouse_pos: (i32, i32),
    monitor_pos: &PhysicalPosition<i32>,
    monitor_size: &PhysicalSize<u32>,
) -> bool {
    let (mouse_x, mouse_y) = mouse_pos;
    let PhysicalPosition {
        x: monitor_x,
        y: monitor_y,
    } = *monitor_pos;
    let PhysicalSize {
        width: monitor_width,
        height: monitor_height,
    } = *monitor_size;

    mouse_x >= monitor_x
        && mouse_x < (monitor_x + monitor_width as i32)
        && mouse_y >= monitor_y
        && mouse_y < (monitor_y + monitor_height as i32)
}

fn overlay_dimensions(position: OverlayPosition, state: &str) -> (f64, f64) {
    let (width, height) = if state == "idle" {
        (IDLE_OVERLAY_WIDTH, IDLE_OVERLAY_HEIGHT)
    } else {
        (ACTIVE_OVERLAY_WIDTH, ACTIVE_OVERLAY_HEIGHT)
    };

    match position {
        OverlayPosition::Left | OverlayPosition::Right => (height, width),
        _ => (width, height),
    }
}

/// Overlay origin on the selected monitor for the configured dock edge.
///
/// On Windows the return value is **physical** pixels (fed to `SetWindowPos`).
/// On other platforms it is **logical** points (fed to Tauri `LogicalPosition`).
fn calculate_overlay_position(
    app_handle: &AppHandle,
    overlay_width: f64,
    overlay_height: f64,
) -> Option<(f64, f64, f64)> {
    let monitor = get_monitor_with_cursor(app_handle)?;
    let settings = settings::get_settings(app_handle);

    #[cfg(target_os = "windows")]
    {
        // Physical-space math: scale logical overlay size/offsets by the
        // target monitor's DPI so the pill lands correctly on secondary
        // displays (including mixed 100%/150%/200% setups).
        let scale = monitor.scale_factor();
        let monitor_x = monitor.position().x as f64;
        let monitor_y = monitor.position().y as f64;
        let monitor_width = monitor.size().width as f64;
        let monitor_height = monitor.size().height as f64;
        let width = overlay_width * scale;
        let height = overlay_height * scale;
        let top_offset = OVERLAY_TOP_OFFSET * scale;
        let bottom_offset = OVERLAY_BOTTOM_OFFSET * scale;
        let side_offset = OVERLAY_SIDE_OFFSET * scale;

        let (x, y) = match settings.overlay_position {
            OverlayPosition::Top => (
                monitor_x + (monitor_width - width) / 2.0,
                monitor_y + top_offset,
            ),
            OverlayPosition::Left => (
                monitor_x + side_offset,
                monitor_y + (monitor_height - height) / 2.0,
            ),
            OverlayPosition::Right => (
                monitor_x + monitor_width - width - side_offset,
                monitor_y + (monitor_height - height) / 2.0,
            ),
            OverlayPosition::Bottom | OverlayPosition::None => (
                monitor_x + (monitor_width - width) / 2.0,
                monitor_y + monitor_height - height - bottom_offset,
            ),
        };

        return Some((x, y, scale));
    }

    #[cfg(not(target_os = "windows"))]
    {
        let scale = monitor.scale_factor();
        let monitor_x = monitor.position().x as f64 / scale;
        let monitor_y = monitor.position().y as f64 / scale;
        let monitor_width = monitor.size().width as f64 / scale;
        let monitor_height = monitor.size().height as f64 / scale;

        let (x, y) = match settings.overlay_position {
            OverlayPosition::Top => (
                monitor_x + (monitor_width - overlay_width) / 2.0,
                monitor_y + OVERLAY_TOP_OFFSET,
            ),
            OverlayPosition::Left => (
                monitor_x + OVERLAY_SIDE_OFFSET,
                monitor_y + (monitor_height - overlay_height) / 2.0,
            ),
            OverlayPosition::Right => (
                monitor_x + monitor_width - overlay_width - OVERLAY_SIDE_OFFSET,
                monitor_y + (monitor_height - overlay_height) / 2.0,
            ),
            OverlayPosition::Bottom | OverlayPosition::None => (
                monitor_x + (monitor_width - overlay_width) / 2.0,
                monitor_y + monitor_height - overlay_height - OVERLAY_BOTTOM_OFFSET,
            ),
        };

        Some((x, y, scale))
    }
}

/// Apply overlay geometry atomically. Windows receives physical pixels so a
/// move between mixed-DPI monitors also updates the HWND size.
fn apply_overlay_geometry(
    overlay_window: &tauri::webview::WebviewWindow,
    x: f64,
    y: f64,
    logical_width: f64,
    logical_height: f64,
    scale: f64,
) {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::WindowsAndMessaging::{
            SetWindowPos, HWND_TOPMOST, SWP_NOACTIVATE, SWP_SHOWWINDOW,
        };

        let px = x.round() as i32;
        let py = y.round() as i32;
        let width = (logical_width * scale).round() as i32;
        let height = (logical_height * scale).round() as i32;
        // Only force-show when the webview is already meant to be visible;
        // otherwise a position sync would flash the idle/recording pill early.
        let already_visible = overlay_window.is_visible().unwrap_or(false);
        if let Ok(hwnd) = overlay_window.hwnd() {
            let mut flags = SWP_NOACTIVATE;
            if already_visible {
                flags |= SWP_SHOWWINDOW;
            }
            unsafe {
                let _ = SetWindowPos(hwnd, Some(HWND_TOPMOST), px, py, width, height, flags);
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = overlay_window.set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: logical_width,
            height: logical_height,
        }));
        let _ =
            overlay_window.set_position(tauri::Position::Logical(tauri::LogicalPosition { x, y }));
    }
}

/// Creates the recording overlay window and keeps it hidden by default
#[cfg(not(target_os = "macos"))]
pub fn create_recording_overlay(app_handle: &AppHandle) {
    if app_handle.get_webview_window("recording_overlay").is_some() {
        return;
    }

    // Position starts unset — update_overlay_position() sets the correct
    // coordinates before the overlay is shown. Always create the window even
    // when monitor detection fails at boot (common on multi-monitor wake);
    // positioning is retried every show.
    let mut builder = WebviewWindowBuilder::new(
        app_handle,
        "recording_overlay",
        tauri::WebviewUrl::App("src/overlay/index.html".into()),
    )
    .title("Recording")
    .resizable(false)
    .inner_size(IDLE_OVERLAY_WIDTH, IDLE_OVERLAY_HEIGHT)
    .shadow(false)
    .maximizable(false)
    .minimizable(false)
    .closable(false)
    .accept_first_mouse(true)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .transparent(true)
    .focused(false)
    .visible(false);

    if let Some(data_dir) = crate::portable::data_dir() {
        builder = builder.data_directory(data_dir.join("webview"));
    }

    #[allow(unused_variables)]
    match builder.build() {
        Ok(window) => {
            #[cfg(target_os = "linux")]
            {
                // Try to initialize GTK layer shell, ignore errors if compositor doesn't support it
                if init_gtk_layer_shell(&window) {
                    debug!("GTK layer shell initialized for overlay window");
                } else {
                    debug!("GTK layer shell not available, falling back to regular window");
                }
            }

            debug!("Recording overlay window created successfully (hidden)");
        }
        Err(e) => {
            debug!("Failed to create recording overlay window: {}", e);
        }
    }
}

/// Creates the recording overlay panel and keeps it hidden by default (macOS)
#[cfg(target_os = "macos")]
pub fn create_recording_overlay(app_handle: &AppHandle) {
    if app_handle.get_webview_window("recording_overlay").is_some() {
        return;
    }

    let (x, y, _) = calculate_overlay_position(app_handle, IDLE_OVERLAY_WIDTH, IDLE_OVERLAY_HEIGHT)
        .unwrap_or((0.0, 0.0, 1.0));
    // PanelBuilder creates a Tauri window then converts it to NSPanel.
    // The window remains registered, so get_webview_window() still works.
    match PanelBuilder::<_, RecordingOverlayPanel>::new(app_handle, "recording_overlay")
        .url(WebviewUrl::App("src/overlay/index.html".into()))
        .title("Recording")
        .position(tauri::Position::Logical(tauri::LogicalPosition { x, y }))
        .level(PanelLevel::Status)
        .size(tauri::Size::Logical(tauri::LogicalSize {
            width: IDLE_OVERLAY_WIDTH,
            height: IDLE_OVERLAY_HEIGHT,
        }))
        .has_shadow(false)
        .transparent(true)
        .no_activate(true)
        .corner_radius(0.0)
        .with_window(|w| w.decorations(false).transparent(true))
        .collection_behavior(
            CollectionBehavior::new()
                .can_join_all_spaces()
                .full_screen_auxiliary(),
        )
        .build()
    {
        Ok(panel) => {
            let _ = panel.hide();
        }
        Err(e) => {
            log::error!("Failed to create recording overlay panel: {}", e);
        }
    }
}

fn ensure_overlay_window(app_handle: &AppHandle) -> Option<tauri::webview::WebviewWindow> {
    if let Some(window) = app_handle.get_webview_window("recording_overlay") {
        return Some(window);
    }
    // Recreate if the window was never built (monitor probe failed at boot)
    // or was destroyed somehow — otherwise show paths silently no-op.
    create_recording_overlay(app_handle);
    app_handle.get_webview_window("recording_overlay")
}

fn show_overlay_state(app_handle: &AppHandle, state: &str) {
    // Check if overlay should be shown based on position setting
    let settings = settings::get_settings(app_handle);
    if settings.overlay_position == OverlayPosition::None {
        return;
    }

    OVERLAY_VISIBILITY_GENERATION.fetch_add(1, Ordering::SeqCst);
    CURRENT_OVERLAY_STATE.store(if state == "idle" { 0 } else { 1 }, Ordering::Relaxed);

    if let Some(overlay_window) = ensure_overlay_window(app_handle) {
        // Let the webview lock idle hover before the native window grows into
        // its larger resting hit area. The frontend also keeps an exit-to-arm
        // guard, so synthetic pointer events from SetWindowPos cannot reveal
        // controls after transcription.
        let _ = overlay_window.emit("show-overlay", state);
        update_overlay_geometry_for_state(app_handle, &overlay_window, state);
        let _ = overlay_window.show();

        // On Windows, aggressively re-assert "topmost" in the native Z-order after showing
        #[cfg(target_os = "windows")]
        force_overlay_topmost(&overlay_window);
    }
}

/// Shows the recording overlay window with fade-in animation
pub fn show_recording_overlay(app_handle: &AppHandle) {
    show_overlay_state(app_handle, "recording");
}

/// Shows the transcribing overlay window
pub fn show_transcribing_overlay(app_handle: &AppHandle) {
    show_overlay_state(app_handle, "transcribing");
}

/// Shows the processing overlay window
pub fn show_processing_overlay(app_handle: &AppHandle) {
    show_overlay_state(app_handle, "processing");
}

/// Shows the flow bar in its idle (persistent) state.
pub fn show_idle_overlay(app_handle: &AppHandle) {
    show_overlay_state(app_handle, "idle");
}

/// Reconcile flow bar visibility with the "show at all times" setting.
/// Shows the idle bar when enabled, hides the window when disabled.
/// Never called mid-dictation (the lifecycle show/hide paths own that).
pub fn sync_flowbar_visibility(app_handle: &AppHandle) {
    let settings = settings::get_settings(app_handle);
    if settings.show_flowbar_always && settings.overlay_position != OverlayPosition::None {
        show_idle_overlay(app_handle);
    } else if let Some(overlay_window) = app_handle.get_webview_window("recording_overlay") {
        let generation = OVERLAY_VISIBILITY_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
        let _ = overlay_window.emit("hide-overlay", ());
        let window_clone = overlay_window.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(300));
            if OVERLAY_VISIBILITY_GENERATION.load(Ordering::SeqCst) == generation {
                let _ = window_clone.hide();
            }
        });
    }
}

/// Notify the flow bar webview that settings it renders from (position,
/// creator mode, shortcut bindings) changed, so it refetches them.
pub fn notify_flowbar_config_changed(app_handle: &AppHandle) {
    if let Some(overlay_window) = app_handle.get_webview_window("recording_overlay") {
        let _ = overlay_window.emit("flowbar-config-changed", ());
    }
}

fn update_overlay_geometry_for_state(
    app_handle: &AppHandle,
    overlay_window: &tauri::webview::WebviewWindow,
    state: &str,
) {
    #[cfg(target_os = "linux")]
    {
        update_gtk_layer_shell_anchors(overlay_window);
    }

    let settings = settings::get_settings(app_handle);
    let (width, height) = overlay_dimensions(settings.overlay_position, state);
    if let Some((x, y, scale)) = calculate_overlay_position(app_handle, width, height) {
        apply_overlay_geometry(overlay_window, x, y, width, height, scale);
    }
}

/// Updates overlay geometry after a position/configuration change.
pub fn update_overlay_position(app_handle: &AppHandle) {
    if let Some(overlay_window) = ensure_overlay_window(app_handle) {
        let state = if CURRENT_OVERLAY_STATE.load(Ordering::Relaxed) == 0 {
            "idle"
        } else {
            "recording"
        };
        update_overlay_geometry_for_state(app_handle, &overlay_window, state);
    }
}

/// Hides the recording overlay window with fade-out animation.
/// When the flow bar is set to always show, falls back to the idle state
/// instead of hiding the window.
pub fn hide_recording_overlay(app_handle: &AppHandle) {
    let settings = settings::get_settings(app_handle);
    if settings.show_flowbar_always && settings.overlay_position != OverlayPosition::None {
        show_idle_overlay(app_handle);
        return;
    }

    // Always hide the overlay regardless of settings - if setting was changed while recording,
    // we still want to hide it properly
    if let Some(overlay_window) = app_handle.get_webview_window("recording_overlay") {
        let generation = OVERLAY_VISIBILITY_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
        // Emit event to trigger fade-out animation
        let _ = overlay_window.emit("hide-overlay", ());
        // Hide the window after a short delay to allow animation to complete
        let window_clone = overlay_window.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(300));
            if OVERLAY_VISIBILITY_GENERATION.load(Ordering::SeqCst) == generation {
                let _ = window_clone.hide();
            }
        });
    }
}

pub fn emit_levels(app_handle: &AppHandle, levels: &Vec<f32>) {
    // emit levels to main app
    let _ = app_handle.emit("mic-level", levels);

    // also emit to the recording overlay if it's open
    if let Some(overlay_window) = app_handle.get_webview_window("recording_overlay") {
        let _ = overlay_window.emit("mic-level", levels);
    }
}
