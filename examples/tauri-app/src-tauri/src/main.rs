// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::WebviewWindow;
#[cfg(feature = "e2e-wdio")]
use tauri_plugin_window_decorations::DecorationStatus;
use tauri_plugin_window_decorations::WebviewWindowExt;

#[cfg(feature = "e2e-wdio")]
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct E2eDecorationState {
    lifecycle: &'static str,
    decorated: bool,
}

async fn restore_and_show(
    window: &WebviewWindow,
    activation_error: impl std::fmt::Display,
) -> Result<&'static str, String> {
    let restore_error = window.restore_decoration().await.err();
    let show_error = window.show().err();
    match (restore_error, show_error) {
        (None, None) => Ok("native"),
        (Some(restore), None) => Err(format!(
            "custom decoration failed ({activation_error}); native frame restoration failed ({restore}), but the window was revealed"
        )),
        (None, Some(show)) => Err(format!(
            "custom decoration failed ({activation_error}); native fallback could not be revealed ({show})"
        )),
        (Some(restore), Some(show)) => Err(format!(
            "custom decoration failed ({activation_error}); native frame restoration failed ({restore}); revealing the fallback also failed ({show})"
        )),
    }
}

#[tauri::command]
async fn activate_and_show(window: WebviewWindow) -> Result<&'static str, String> {
    if let Err(error) = window.activate_decoration().await {
        return restore_and_show(&window, error).await;
    }

    #[cfg(target_os = "macos")]
    if let Err(error) = window.set_traffic_lights_inset(16.0, 20.0).await {
        return restore_and_show(&window, error).await;
    }

    match window.show() {
        Ok(()) => Ok("custom"),
        Err(error) => restore_and_show(&window, error).await,
    }
}

#[cfg(feature = "e2e-wdio")]
#[tauri::command]
fn set_e2e_fullscreen(window: WebviewWindow, fullscreen: bool) -> Result<(), String> {
    window
        .set_fullscreen(fullscreen)
        .map_err(|error| error.to_string())
}

#[cfg(feature = "e2e-wdio")]
#[tauri::command]
fn e2e_decoration_state(window: WebviewWindow) -> Result<E2eDecorationState, String> {
    let lifecycle = match window.decoration_status().map_err(|error| error.to_string())? {
        DecorationStatus::Native => "native",
        DecorationStatus::Preparing => "preparing",
        DecorationStatus::Active => "active",
        DecorationStatus::Recovering => "recovering",
        DecorationStatus::Failed => "failed",
        _ => "unknown",
    };
    let decorated = window.is_decorated().map_err(|error| error.to_string())?;
    Ok(E2eDecorationState {
        lifecycle,
        decorated,
    })
}

#[cfg(feature = "e2e-wdio")]
#[tauri::command]
fn e2e_window_state(window: WebviewWindow) -> Result<(bool, bool), String> {
    Ok((
        window
            .is_maximized()
            .map_err(|error| error.to_string())?,
        window
            .is_fullscreen()
            .map_err(|error| error.to_string())?,
    ))
}

#[cfg(feature = "e2e-wdio")]
type E2eWindowMetrics = (i32, i32, u32, u32, f64, bool, bool);

#[cfg(feature = "e2e-wdio")]
#[tauri::command]
fn e2e_window_metrics(window: WebviewWindow) -> Result<E2eWindowMetrics, String> {
    let position = window
        .outer_position()
        .map_err(|error| error.to_string())?;
    let size = window.outer_size().map_err(|error| error.to_string())?;
    Ok((
        position.x,
        position.y,
        size.width,
        size.height,
        window.scale_factor().map_err(|error| error.to_string())?,
        window.is_minimized().map_err(|error| error.to_string())?,
        window.is_visible().map_err(|error| error.to_string())?,
    ))
}

#[cfg(feature = "e2e-wdio")]
#[tauri::command]
fn e2e_minimize(window: WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|error| error.to_string())
}

#[cfg(feature = "e2e-wdio")]
#[tauri::command]
fn e2e_unminimize(window: WebviewWindow) -> Result<(), String> {
    window.unminimize().map_err(|error| error.to_string())
}

fn main() -> Result<(), tauri::Error> {
    let builder = tauri::Builder::default().plugin(tauri_plugin_window_decorations::init());

    #[cfg(feature = "e2e-wdio")]
    let builder = builder.plugin(tauri_plugin_wdio::init());

    #[cfg(feature = "e2e-wdio")]
    let builder = builder.plugin(tauri_plugin_wdio_webdriver::init());

    #[cfg(feature = "e2e-wdio")]
    let builder = builder.invoke_handler(tauri::generate_handler![
        activate_and_show,
        e2e_decoration_state,
        e2e_minimize,
        e2e_unminimize,
        e2e_window_metrics,
        e2e_window_state,
        set_e2e_fullscreen
    ]);
    #[cfg(not(feature = "e2e-wdio"))]
    let builder = builder.invoke_handler(tauri::generate_handler![activate_and_show]);

    builder
        .run(tauri::generate_context!())
}
