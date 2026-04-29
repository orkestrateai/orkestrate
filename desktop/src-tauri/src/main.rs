// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::io::Write;
use std::panic;
use std::path::PathBuf;

fn crash_dump_path() -> PathBuf {
    if let Ok(dir) = std::env::var("ORKESTRATE_APP_DATA") {
        return PathBuf::from(dir).join("crashes");
    }
    let local_appdata = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(local_appdata)
        .join("com.orkestrate.app")
        .join("crashes")
}

fn main() {
    let crash_dir = crash_dump_path();
    let _ = fs::create_dir_all(&crash_dir);

    panic::set_hook(Box::new(move |info| {
        let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
        let file_path = crash_dir.join(format!("crash_{}.txt", timestamp));

        let payload = if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown panic payload".to_string()
        };

        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "unknown location".to_string());

        let dump = format!(
            "Crash at {}\nLocation: {}\nPayload: {}\n",
            chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
            location,
            payload,
        );

        if let Ok(mut f) = fs::File::create(&file_path) {
            let _ = f.write_all(dump.as_bytes());
        }
        eprintln!("{}", dump);
    }));

    orkestrate_lib::run()
}
