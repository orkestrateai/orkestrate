use once_cell::sync::OnceCell;
use std::path::PathBuf;

pub static APP_DATA_DIR: OnceCell<PathBuf> = OnceCell::new();

pub fn get_app_data_dir() -> PathBuf {
    APP_DATA_DIR.get().cloned().unwrap_or_else(|| PathBuf::from("."))
}
