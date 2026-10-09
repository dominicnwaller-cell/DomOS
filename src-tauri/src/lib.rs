mod finance_validation;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _| notifications::activation_args(app, &args)))
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .on_window_event(notifications::window_event)
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let root = app.path().app_data_dir()?.join("life-tracking-core");
            let db = database::Database::open(&root.join("domos.sqlite"),root.join("backups"))
                .map_err(std::io::Error::other)?;
            app.manage(commands::DataState(std::sync::Mutex::new(db)));
            notifications::setup(app).map_err(std::io::Error::other)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![notifications::notification_quit,notifications::notification_activate,notifications::notification_sync,notifications::notification_background,notifications::notification_diagnostics,notifications::notification_test,commands::native_verification_report,commands::profiles_list,commands::profile_create,
            commands::profile_snapshot,commands::legacy_backup,commands::legacy_migrate,commands::profile_commit,
            commands::profile_export,commands::profile_import,commands::profile_update,commands::profile_restore])
        .run(tauri::generate_context!())
        .expect("error while running DOM.OS");
}
mod database;
use tauri::Manager;
mod commands;

mod notifications;
