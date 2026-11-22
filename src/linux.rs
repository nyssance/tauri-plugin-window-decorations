use crate::frontend::{ControlLayout, FrontendOptions};
use crate::DecorationError;
use std::collections::HashSet;
use tauri::{Runtime, WebviewWindow};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum Backend {
    Wayland,
}

pub(crate) fn backend_from_type_name(type_name: &str) -> Result<Backend, String> {
    match type_name {
        "GdkWaylandDisplay" => Ok(Backend::Wayland),
        _ => Err(format!(
            "custom Linux decorations require a GdkWaylandDisplay, found {type_name:?}"
        )),
    }
}

pub(crate) fn bounded_scale(scale: i32) -> i32 {
    scale.clamp(1, 4)
}

pub(crate) fn parse_decoration_layout(
    value: Option<&str>,
    available: &[&'static str],
) -> Result<ControlLayout, String> {
    let Some(value) = value else {
        return Ok(ControlLayout {
            left: Vec::new(),
            right: available.to_vec(),
        });
    };

    let mut sections = value.split(':');
    let left = sections.next().unwrap_or_default();
    let Some(right) = sections.next() else {
        return Err("GTK decoration layout must contain exactly one ':' separator".to_owned());
    };
    if sections.next().is_some() {
        return Err("GTK decoration layout must contain exactly one ':' separator".to_owned());
    }

    let mut seen = HashSet::new();
    let mut parse_side = |side: &str| {
        side.split(',')
            .filter_map(|raw| {
                let control = match raw.trim() {
                    "minimize" => "minimize",
                    "maximize" => "maximize",
                    "close" => "close",
                    _ => return None,
                };
                (available.contains(&control) && seen.insert(control)).then_some(control)
            })
            .collect::<Vec<_>>()
    };
    let left = parse_side(left);
    let right = parse_side(right);
    Ok(ControlLayout { left, right })
}

pub(crate) fn frontend_options<R: Runtime>(
    window: &WebviewWindow<R>,
) -> Result<FrontendOptions, DecorationError> {
    let mut controls = Vec::new();
    if window
        .is_minimizable()
        .map_err(|error| DecorationError::native_apply(error.to_string()))?
    {
        controls.push("minimize");
    }
    if window
        .is_maximizable()
        .map_err(|error| DecorationError::native_apply(error.to_string()))?
        && window
            .is_resizable()
            .map_err(|error| DecorationError::native_apply(error.to_string()))?
    {
        controls.push("maximize");
    }
    if window
        .is_closable()
        .map_err(|error| DecorationError::native_apply(error.to_string()))?
    {
        controls.push("close");
    }

    Ok(FrontendOptions {
        controls,
        ..FrontendOptions::default()
    })
}

#[cfg(test)]
mod tests {
    use super::{backend_from_type_name, bounded_scale, parse_decoration_layout, Backend};
    use crate::frontend::ControlLayout;

    const ALL_CONTROLS: &[&str] = &["minimize", "maximize", "close"];

    #[test]
    fn effective_layout_preserves_left_and_right_sides() {
        assert_eq!(
            parse_decoration_layout(Some("close:minimize,maximize"), ALL_CONTROLS).unwrap(),
            ControlLayout {
                left: vec!["close"],
                right: vec!["minimize", "maximize"],
            }
        );
        assert_eq!(
            parse_decoration_layout(Some("close,minimize,maximize:"), ALL_CONTROLS).unwrap(),
            ControlLayout {
                left: vec!["close", "minimize", "maximize"],
                right: vec![],
            }
        );
    }

    #[test]
    fn layout_ignores_menu_tokens_filters_unavailable_controls_and_deduplicates() {
        assert_eq!(
            parse_decoration_layout(
                Some("menu,close:minimize,maximize,close,appmenu"),
                &["minimize", "close"],
            )
            .unwrap(),
            ControlLayout {
                left: vec!["close"],
                right: vec!["minimize"],
            }
        );
    }

    #[test]
    fn missing_layout_uses_a_deterministic_right_side_fallback() {
        assert_eq!(
            parse_decoration_layout(None, &["minimize", "close"]).unwrap(),
            ControlLayout {
                left: vec![],
                right: vec!["minimize", "close"],
            }
        );
    }

    #[test]
    fn valid_control_free_layouts_are_preserved_after_filtering() {
        for layout in [":", "menu,appmenu:", "maximize:"] {
            assert_eq!(
                parse_decoration_layout(Some(layout), &["close"]).unwrap(),
                ControlLayout::default(),
            );
        }
    }

    #[test]
    fn malformed_layout_still_fails() {
        assert!(parse_decoration_layout(Some("close:minimize:extra"), ALL_CONTROLS).is_err());
    }

    #[test]
    fn only_a_real_wayland_display_enables_custom_linux_decorations() {
        assert_eq!(
            backend_from_type_name("GdkWaylandDisplay").unwrap(),
            Backend::Wayland
        );
        for unsupported in [
            "GdkX11Display",
            "GdkBroadwayDisplay",
            "GdkQuartzDisplay",
            "FutureDisplay",
        ] {
            assert!(backend_from_type_name(unsupported).is_err());
        }
    }

    #[test]
    fn icon_scale_is_bounded_before_theme_rasterization() {
        assert_eq!(bounded_scale(-1), 1);
        assert_eq!(bounded_scale(1), 1);
        assert_eq!(bounded_scale(2), 2);
        assert_eq!(bounded_scale(99), 4);
    }
}
