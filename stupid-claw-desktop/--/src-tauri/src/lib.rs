use std::process::Stdio;
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime, State,
};
use tauri_plugin_notification::NotificationExt;
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

// StupidClaw 后端进程管理
pub struct StupidClawProcess(Arc<Mutex<Option<Child>>>);

impl StupidClawProcess {
    fn new() -> Self {
        Self(Arc::new(Mutex::new(None)))
    }

    async fn start(&self) -> Result<u16, String> {
        let mut child_guard = self.0.lock().await;

        // 如果已经有进程在运行，先停止
        if let Some(mut child) = child_guard.take() {
            let _ = child.kill().await;
        }

        // 启动 StupidClaw Node.js 后端
        // 在生产环境中，这会是打包后的可执行文件
        let child = Command::new("node")
            .arg("dist/index.js")
            .current_dir("/Users/tao/Workspace/tutorial/stupidClaw")
            .env("PORT", "8080")
            .env("STUPID_IM_TOKEN", "stupid-claw-desktop-token")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start StupidClaw: {}", e))?;

        let _pid = child.id().unwrap_or(0);
        *child_guard = Some(child);

        // 等待服务启动并获取端口
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        // 这里简化处理，实际应该从进程输出中解析端口
        // 或者使用固定端口
        Ok(8080)
    }

    async fn stop(&self) {
        let mut child_guard = self.0.lock().await;
        if let Some(mut child) = child_guard.take() {
            let _ = child.kill().await;
        }
    }
}

// Tauri 命令：获取后端状态
#[tauri::command]
async fn get_backend_status(process: State<'_, StupidClawProcess>) -> Result<String, String> {
    let guard = process.0.lock().await;
    if guard.is_some() {
        Ok("running".to_string())
    } else {
        Ok("stopped".to_string())
    }
}

// Tauri 命令：重启后端
#[tauri::command]
async fn restart_backend(process: State<'_, StupidClawProcess>) -> Result<u16, String> {
    process.start().await
}

// Tauri 命令：停止后端
#[tauri::command]
async fn stop_backend(process: State<'_, StupidClawProcess>) -> Result<(), String> {
    process.stop().await;
    Ok(())
}

// 创建系统托盘
fn create_tray<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let show_i = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => {
                app.exit(0);
            }
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .manage(StupidClawProcess::new())
        .invoke_handler(tauri::generate_handler![
            get_backend_status,
            restart_backend,
            stop_backend
        ])
        .setup(|app| {
            // 创建系统托盘
            create_tray(&app.handle())?;

            // 启动时自动启动后端
            // 克隆 AppHandle 用于异步任务
            let app_handle = app.handle().clone();
            
            // 在异步块中获取 process
            tauri::async_runtime::spawn(async move {
                // 从 app_handle 获取状态
                let process = app_handle.state::<StupidClawProcess>();
                
                match process.start().await {
                    Ok(port) => {
                        println!("StupidClaw backend started on port {}", port);

                        // 发送通知
                        let _ = app_handle
                            .notification()
                            .builder()
                            .title("StupidClaw")
                            .body("AI 助手已就绪")
                            .show();
                    }
                    Err(e) => {
                        eprintln!("Failed to start backend: {}", e);
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|app, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // 点击关闭按钮时隐藏窗口而不是退出
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
