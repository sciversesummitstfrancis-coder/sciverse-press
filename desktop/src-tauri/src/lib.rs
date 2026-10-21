#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Auto-update support: the app checks a release manifest for a newer
      // version, downloads it, verifies the minisign signature against the
      // public key baked into tauri.conf.json, and installs it in place —
      // the user never has to uninstall or re-download the app manually.
      #[cfg(desktop)]
      app.handle()
        .plugin(tauri_plugin_updater::Builder::new().build())?;
      // Used to relaunch the app after an update has been installed.
      #[cfg(desktop)]
      app.handle().plugin(tauri_plugin_process::init())?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
