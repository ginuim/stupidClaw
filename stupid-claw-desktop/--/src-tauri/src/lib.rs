use std::process::Stdio;
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime, State,
};
use tauri_plugin_notification::NotificationExt as _;
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use dotenv;

fn get_resource_path() -> std::path::PathBuf {
    if cfg!(debug_assertions) {
        std::path::PathBuf::from("/Users/tao/Workspace/tutorial/stupidClaw")
    } else {
        // macOS .app 结构：xxx.app/Contents/MacOS/<exe>
        // current_exe().parent() => xxx.app/Contents/MacOS
        // 再 parent() => xxx.app/Contents
        // 再 parent() => xxx.app
        // Resources 在 xxx.app/Contents/Resources
        std::env::current_exe()
            .unwrap()
            .parent() // MacOS/
            .unwrap()
            .parent() // Contents/
            .unwrap()
            .join("Resources")
    }
}

fn get_stupidclaw_dist_path() -> std::path::PathBuf {
    let resource_path = get_resource_path();
    if cfg!(debug_assertions) {
        resource_path.join("dist")
    } else {
        resource_path.join("stupidclaw_dist")
    }
}

fn get_env_path() -> std::path::PathBuf {
    let resource_path = get_resource_path();
    if cfg!(debug_assertions) {
        resource_path.join(".env")
    } else {
        resource_path.join("stupidclaw_env")
    }
}

// 查找 node 可执行文件路径
fn find_node_path() -> String {
    // 常见的 node 安装位置（优先 Homebrew Apple Silicon）
    let candidates = [
        "/opt/homebrew/bin/node",   // Homebrew (Apple Silicon)
        "/usr/local/bin/node",      // Homebrew (Intel) / nvm
        "/usr/bin/node",            // 系统自带
        "/opt/homebrew/opt/node/bin/node",
        "/usr/local/opt/node/bin/node",
    ];
    for path in &candidates {
        if std::path::Path::new(path).exists() {
            return path.to_string();
        }
    }
    // 尝试通过 which 查找（可能在某些环境下有效）
    if let Ok(output) = std::process::Command::new("which")
        .arg("node")
        .env("PATH", "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin")
        .output()
    {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() && std::path::Path::new(&path).exists() {
            return path;
        }
    }
    // 兜底：返回 "node"，依赖系统 PATH
    "node".to_string()
}

// StupidClaw 后端进程管理
pub struct StupidClawProcess(Arc<Mutex<Option<Child>>>, Arc<Mutex<u16>>);

impl StupidClawProcess {
    fn new() -> Self {
        Self(Arc::new(Mutex::new(None)), Arc::new(Mutex::new(0)))
    }

    async fn start(&self) -> Result<u16, String> {
        let mut child_guard = self.0.lock().await;
        let mut port_guard = self.1.lock().await;

        // 如果已经在运行，直接返回当前端口，避免重复启动导致 lock file 冲突
        if child_guard.is_some() && *port_guard > 0 {
            return Ok(*port_guard);
        }

        if let Some(mut child) = child_guard.take() {
            let _ = child.kill().await;
        }

        let dist_path = get_stupidclaw_dist_path();
        let env_path = get_env_path();
        let index_js = dist_path.join("index.js");

        if !index_js.exists() {
            return Err(format!("StupidClaw dist not found at: {}", dist_path.display()));
        }

        if env_path.exists() {
            let _ = dotenv::from_path(&env_path);
        }

        // 在打包后的 .app 中没有完整 PATH，需要手动找到 node 可执行文件
        let node_path = find_node_path();
        // 以 dist 目录的父目录（即包根目录）作为工作目录，确保相对路径的 .env 能被找到
        let working_dir = dist_path.parent().unwrap_or(&dist_path);
        let child = Command::new(&node_path)
            .arg(index_js.display().to_string())
            // 明确传递 --config 参数，让 node 进程直接读到正确的 .env
            .arg("--config")
            .arg(env_path.display().to_string())
            .current_dir(working_dir)
            .env("PORT", "8080")
            // 补充常见 node 安装路径到 PATH，避免 .app 环境中找不到
            .env("PATH", "/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:/opt/homebrew/sbin")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start StupidClaw (node path: {}): {}", node_path, e))?;

        let _pid = child.id().unwrap_or(0);
        *child_guard = Some(child);
        *port_guard = 8080;

        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        Ok(8080)
    }

    async fn stop(&self) {
        let mut child_guard = self.0.lock().await;
        let mut port_guard = self.1.lock().await;
        if let Some(mut child) = child_guard.take() {
            // 先发 SIGTERM，让 node 进程有机会自己清理 lock file
            #[cfg(unix)]
            {
                use std::os::unix::process::ExitStatusExt;
                if let Some(pid) = child.id() {
                    unsafe { libc::kill(pid as i32, libc::SIGTERM); }
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                }
            }
            let _ = child.kill().await;
        }
        *port_guard = 0;
        // 备用清理：万一 node 没来得及删除 lock file，主动清理
        let lock_path = get_stupidclaw_dist_path()
            .parent()
            .unwrap_or(&get_stupidclaw_dist_path())
            .join(".stupidClaw/polling.lock");
        let _ = std::fs::remove_file(&lock_path);
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

// Tauri 命令：启动后端
#[tauri::command]
async fn start_backend(process: State<'_, StupidClawProcess>) -> Result<String, String> {
    let port = process.start().await?;

    // 从 .env 文件读取 STUPID_IM_TOKEN
    let stupid_im_token = std::env::var("STUPID_IM_TOKEN")
        .unwrap_or_else(|_| "stupid-claw-desktop-token".to_string());

    let chat_id = format!("desktop_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs());
    let ws_url = format!("ws://localhost:{}", port);
    let im_url = format!("http://localhost:{}/?token={}&chatId={}&url={}", port, stupid_im_token, chat_id, ws_url);
    Ok(im_url)
}

// Tauri 命令：重启后端
#[tauri::command]
async fn restart_backend(process: State<'_, StupidClawProcess>) -> Result<String, String> {
    let port = process.start().await?;
    let stupid_im_token = std::env::var("STUPID_IM_TOKEN")
        .unwrap_or_else(|_| "stupid-claw-desktop-token".to_string());
    let chat_id = format!("desktop_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs());
    let ws_url = format!("ws://localhost:{}", port);
    let im_url = format!("http://localhost:{}/?token={}&chatId={}&url={}", port, stupid_im_token, chat_id, ws_url);
    Ok(im_url)
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
            start_backend,
            restart_backend,
            stop_backend
        ])
        .setup(|app| {
            let env_path = get_env_path();
            if env_path.exists() {
                let _ = dotenv::from_path(&env_path);
            } else {
                let fallback_paths = [
                    std::path::PathBuf::from("/Users/tao/Workspace/tutorial/stupidClaw/.env"),
                    std::path::PathBuf::from(".env"),
                ];
                for path in &fallback_paths {
                    if path.exists() {
                        let _ = dotenv::from_path(path);
                        break;
                    }
                }
            }

            create_tray(&app.handle())?;

            // setup 里预先启动后端，这样前端 invoke("start_backend") 时可直接复用已启动的进程
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let process = app_handle.state::<StupidClawProcess>();
                match process.start().await {
                    Ok(port) => println!("StupidClaw backend started on port {}", port),
                    Err(e) => eprintln!("Failed to start backend: {}", e),
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
