use crate::database::{Database,ImportReceipt,Profile,Snapshot};
use serde_json::Value;
use std::{collections::BTreeMap,sync::Mutex};
use tauri::{Emitter,State};
pub struct DataState(pub Mutex<Database>);
type Result<T> = std::result::Result<T,String>;
#[tauri::command]
pub fn native_verification_report(app:tauri::AppHandle,report:Value)->Result<String>{
 use tauri::Manager;
 if app.config().identifier!="com.dom.os.nativeverify"{return Err("Available only in the isolated native verification build".into())}
 let path=app.path().app_data_dir().map_err(|e|e.to_string())?.join("native-verification.json");
 let bytes=serde_json::to_vec_pretty(&report).map_err(|e|e.to_string())?;
 std::fs::write(&path,&bytes).map_err(|e|e.to_string())?;
 if std::fs::read(&path).map_err(|e|e.to_string())?!=bytes{return Err("Report verification failed".into())}
 Ok(path.to_string_lossy().into())
}
#[tauri::command]
pub fn profiles_list(state:State<DataState>)->Result<Vec<Profile>>{state.0.lock().map_err(|_|"Database lock failed")?.profiles()}
#[tauri::command]
pub fn profile_create(name:String,preferences:Value,changes:Option<BTreeMap<String,Option<String>>>,state:State<DataState>)->Result<Profile>{state.0.lock().map_err(|_|"Database lock failed")?.create_initialized_profile(&name,preferences,changes.unwrap_or_default())}
#[tauri::command]
pub fn profile_snapshot(profile_id:String,state:State<DataState>)->Result<Snapshot>{state.0.lock().map_err(|_|"Database lock failed")?.snapshot(&profile_id)}
#[tauri::command]
pub fn legacy_migrate(name:String,data:BTreeMap<String,String>,state:State<DataState>)->Result<ImportReceipt>{state.0.lock().map_err(|_|"Database lock failed")?.import_legacy(&name,data)}
#[tauri::command]
pub fn legacy_backup(data:BTreeMap<String,String>,state:State<DataState>)->Result<String>{state.0.lock().map_err(|_|"Database lock failed")?.archive_legacy(data)}
#[tauri::command]
pub fn profile_commit(app:tauri::AppHandle,profile_id:String,expected_revision:i64,changes:BTreeMap<String,Option<String>>,state:State<DataState>)->Result<i64>{
 let revision=state.0.lock().map_err(|_|"Database lock failed")?.commit(&profile_id,expected_revision,changes)?;
 let _=app.emit("profile-updated",serde_json::json!({"profileId":profile_id,"revision":revision}));Ok(revision)
}
#[tauri::command]
pub fn profile_export(profile_id:String,state:State<DataState>)->Result<Value>{state.0.lock().map_err(|_|"Database lock failed")?.export(&profile_id)}
#[tauri::command]
pub fn profile_import(name:String,payload:Value,state:State<DataState>)->Result<Profile>{state.0.lock().map_err(|_|"Database lock failed")?.import_backup(&name,payload)}
#[tauri::command]
pub fn profile_update(app:tauri::AppHandle,profile_id:String,name:String,preferences:Value,expected_revision:i64,changes:Option<BTreeMap<String,Option<String>>>,state:State<DataState>)->Result<Profile>{let profile=state.0.lock().map_err(|_|"Database lock failed")?.update_profile_with_state(&profile_id,&name,preferences,expected_revision,changes.unwrap_or_default())?;let _=app.emit("profile-updated",serde_json::json!({"profileId":profile_id,"revision":profile.revision}));Ok(profile)}
#[tauri::command]
pub fn profile_restore(app:tauri::AppHandle,profile_id:String,payload:Value,state:State<DataState>)->Result<()> {
 let mut db=state.0.lock().map_err(|_|"Database lock failed")?;db.restore(&profile_id,payload)?;
 let revision=db.snapshot(&profile_id)?.profile.revision;
 let _=app.emit("profile-updated",serde_json::json!({"profileId":profile_id,"revision":revision}));Ok(())
}
