use std::time::Duration;

use raw_window_handle::{HasRawWindowHandle, RawWindowHandle};
use tauri::Window;

use crate::data::Point;

#[derive(Debug)]
pub enum KeyMode {
    Press,
    Hold,
    Release,
}

// For visual recognition: Avoids mouse clicks outside the window by ignoring monster names that are too close to the bottom of the GUI
pub const IGNORE_AREA_BOTTOM: u32 = 110;
//>100 <230 where we get the red announcement for already targetted mob
/// Get the native window id.
pub fn get_window_id(window: &Window) -> Option<u64> {
    #[allow(unused_variables)]
    match window.raw_window_handle() {
        RawWindowHandle::Xlib(handle) => Some(handle.window as u64),
        RawWindowHandle::Win32(handle) => Some(handle.hwnd as u64),
        RawWindowHandle::AppKit(handle) => {
            #[cfg(target_os = "macos")]
            unsafe {
                use std::ffi::c_void;
                let ns_window_ptr = handle.ns_window as *const c_void;
                libscreenshot::platform::macos::macos_helper::ns_window_to_window_id(ns_window_ptr)
                    .map(|id| id as u64)
            }
            #[cfg(not(target_os = "macos"))]
            unreachable!()
        }
        _ => Some(0_u64),
    }
}

pub fn eval_send_key(window: &Window, key: &str, mode: KeyMode) {
    match mode {
        KeyMode::Press => {
            drop(window.eval(format!("keyboardEvent('press', '{0}');", key).as_str()))
        }

        KeyMode::Hold => drop(window.eval(format!("keyboardEvent('hold', '{0}');", key).as_str())),

        KeyMode::Release => {
            drop(window.eval(format!("keyboardEvent('release', '{0}');", key).as_str()))
        }
    }
}

pub fn send_slot_eval(window: &Window, slot_bar_index: usize, k: usize) {
    drop(window.eval(format!("sendSlot({0}, {1})", slot_bar_index, k).as_str()))
}

pub fn eval_mob_click(window: &Window, pos: Point, check_mob: bool) {
    // check_mob=true 时走 eval.js 的 isMob() 门控：mousemove 后等 50ms 让游戏
    // 更新悬停光标，只有光标是"攻击光标"（悬停在怪上）才真正按下——杜绝点到
    // 地面导致角色乱走（0.16.20/0.16.22 乱跑的根源）。false 为无条件点击，
    // 仅用于首次选怪与周期性兜底（防止光标判定失灵时永远站桩）。
    drop(
        window.eval(
            format!(
                "mouseEvent('moveClick', {0}, {1}, {{checkMob: {2}}});",
                pos.x, pos.y, check_mob
            )
            .as_str(),
        ),
    );
}

pub fn eval_simple_click(window: &Window, pos: Point) {
    drop(window.eval(format!("mouseEvent('moveClick', {0}, {1});", pos.x, pos.y).as_str()));
}

/// 开关 game 页面里的调试叠层（绘制怪物框与点击点）。debug=true 时
/// eval.js 会把 window.__NEUZ_DEBUG 置真，addTargetMarker / drawMobBox 才绘制。
pub fn set_debug_overlay(window: &Window, debug: bool) {
    drop(window.eval(format!("window.__NEUZ_DEBUG = {}", debug).as_str()));
}

pub fn eval_send_message(window: &Window, text: &str) {
    // The message is embedded into a JS expression, so it has to be encoded as a
    // string literal. Without this, any message containing a space (or quotes,
    // or a `)`) produces invalid JS and the whole eval silently fails.
    let encoded = serde_json::to_string(text).unwrap_or_else(|_| "\"\"".to_string());
    drop(window.eval(format!("setInputChat({})", encoded).as_str()));
}
