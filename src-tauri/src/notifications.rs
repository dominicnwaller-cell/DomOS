use serde::{Deserialize,Serialize};
use serde_json::{json,Value};
use std::{sync::Mutex,time::{Duration,SystemTime,UNIX_EPOCH}};
use tauri::{Emitter,Manager};
use crate::commands::DataState;
type Result<T>=std::result::Result<T,String>;
fn now()->i64{SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as i64}
#[derive(Clone,Debug,Deserialize,Serialize)]
#[serde(rename_all="camelCase")]
pub struct Candidate {pub id:String,pub profile_id:String,pub kind:String,pub source_id:String,pub title:String,pub due:i64,pub end:i64,pub urgency:String}
#[derive(Clone,Default,Deserialize,Serialize)]
#[serde(rename_all="camelCase")]
pub struct DeliveryPreferences {pub enabled:bool,pub sound:bool,pub private_content:bool,pub priority_repeats:u32,pub repeat_minutes:u32,pub quiet_intervals:Vec<(i64,i64)>}
#[derive(Clone,Default,Deserialize,Serialize)]
#[serde(rename_all="camelCase")]
pub struct BackgroundPreferences {pub close_to_tray:bool,pub minimize_to_tray:bool}
#[derive(Default)]
struct Coordinator {active:Option<String>,revision:i64,candidates:Vec<Candidate>,prefs:DeliveryPreferences,background:BackgroundPreferences,last_tick:i64,pending_link:Option<String>}
pub struct NotificationState(Mutex<Coordinator>);
fn primary(window:&tauri::WebviewWindow)->Result<()> {if window.label()!="main"{Err("Only the primary window owns reminder delivery".into())}else{Ok(())}}
#[tauri::command]
pub fn notification_activate(window:tauri::WebviewWindow,profile_id:Option<String>,state:tauri::State<NotificationState>)->Result<()> {primary(&window)?;let mut c=state.0.lock().map_err(|_|"Coordinator unavailable")?;c.active=profile_id;c.candidates.clear();c.last_tick=now()-60001;Ok(())}
#[tauri::command]
pub fn notification_sync(app:tauri::AppHandle,window:tauri::WebviewWindow,profile_id:String,revision:i64,candidates:Vec<Candidate>,preferences:DeliveryPreferences,state:tauri::State<NotificationState>,db:tauri::State<DataState>)->Result<()> {
 primary(&window)?;let mut c=state.0.lock().map_err(|_|"Coordinator unavailable")?;
 if c.active.as_deref()!=Some(&profile_id){return Err("Reminder profile is not active".into())}
 if candidates.len()>5000||candidates.iter().any(|x|x.profile_id!=profile_id||!x.id.starts_with("n-")||x.id.len()>20000||x.end<x.due||!matches!(x.urgency.as_str(),"informational"|"standard"|"priority")){return Err("Invalid reminder candidates".into())}
 let snapshot=db.0.lock().map_err(|_|"Database unavailable")?.snapshot(&profile_id)?;
 if snapshot.profile.revision!=revision{return Err("Source data changed; reconcile before delivering".into())}
 if candidates.iter().any(|x|!source_exists(x,&snapshot.data))||preferences.priority_repeats>3||!(5..=120).contains(&preferences.repeat_minutes)||preferences.quiet_intervals.len()>24||preferences.quiet_intervals.iter().any(|(a,b)|a>=b){return Err("Reminder source or preferences are invalid".into())}
 c.revision=revision;c.candidates=candidates;c.prefs=preferences;let pending=c.pending_link.take();drop(c);if let Some(uri)=pending{activation_args(&app,&[uri]);}Ok(())
}
#[tauri::command]
pub fn notification_background(app:tauri::AppHandle,window:tauri::WebviewWindow,preferences:Option<BackgroundPreferences>,launch_with_windows:Option<bool>,state:tauri::State<NotificationState>)->Result<Value>{
 primary(&window)?;use tauri_plugin_autostart::ManagerExt;
 if let Some(value)=launch_with_windows{if value{app.autolaunch().enable()}else{app.autolaunch().disable()}.map_err(|e|e.to_string())?}
 let mut c=state.0.lock().map_err(|_|"Coordinator unavailable")?;if let Some(p)=preferences {let root=app.path().app_data_dir().map_err(|e|e.to_string())?;std::fs::create_dir_all(&root).map_err(|e|e.to_string())?;std::fs::write(root.join("background.json"),serde_json::to_vec(&p).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;c.background=p;}
 Ok(json!({"background":c.background,"launchWithWindows":app.autolaunch().is_enabled().map_err(|e|e.to_string())?}))
}
pub fn focus(app:&tauri::AppHandle){if let Some(w)=app.get_webview_window("main"){let _=w.show();let _=w.unminimize();let _=w.set_focus();}}
#[cfg(windows)]
fn native_status(app:&tauri::AppHandle)->Result<String>{use windows::{core::HSTRING,UI::Notifications::ToastNotificationManager};let notifier=ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(app.config().identifier.as_str())).map_err(|e|e.to_string())?;let setting=notifier.Setting().map_err(|e|e.to_string())?;Ok(match setting.0{0=>"Windows permits notifications for this app; Do Not Disturb may still suppress delivery.",1=>"Notifications are disabled for this app in Windows.",2=>"Windows notifications are disabled for this user.",3=>"Notifications are disabled by Windows policy.",4=>"Notifications are disabled by the application manifest.",_=>"Windows notification permission status is unknown."}.into())}
#[cfg(not(windows))]
fn native_status(_: &tauri::AppHandle)->Result<String>{Err("Windows notification delivery is unavailable on this platform".into())}
#[tauri::command]
pub fn notification_diagnostics(app:tauri::AppHandle)->Value{json!({"identity":app.config().identifier,"status":native_status(&app).unwrap_or_else(|e|e),"dndDetection":"Unknown: Windows owns automatic sound in foreground and background and applies its notification suppression settings.","physicalDelivery":"A successful API request does not establish that an alert was seen or heard."})}
fn activation_scheme(identity:&str)->String{format!("domos-reminder-{}",identity.replace('.',"-"))}
fn occurrence_hash(id:&str)->String{use sha2::{Digest,Sha256};format!("{:x}",Sha256::digest(id.as_bytes()))}
fn parse_activation<'a>(identity:&str,uri:&'a str)->Option<(&'a str,&'a str)>{
 if uri.len()>256{return None}let prefix=format!("{}://reminder/",activation_scheme(identity));let rest=uri.strip_prefix(&prefix)?;let (profile,target)=rest.split_once('/')?;
 if uuid::Uuid::parse_str(profile).ok()?.to_string()!=profile{return None}
 if target!="centre"&&(target.len()!=64||!target.bytes().all(|x|x.is_ascii_hexdigit()&&!x.is_ascii_uppercase())){return None}Some((profile,target))
}
fn activation_ids(active:Option<&str>,profile:&str,target:&str,candidates:&[Candidate])->Option<Vec<String>>{
 if active!=Some(profile){return None}if target=="centre"{return Some(vec![])}
 Some(vec![candidates.iter().find(|x|x.profile_id==profile&&occurrence_hash(&x.id)==target).map(|x|x.id.clone()).unwrap_or_else(||"expired-windows-reminder".into())])
}
fn trace_activation(app:&tauri::AppHandle,phase:&str,data:Value){
 // Isolated acceptance diagnostics only: no command text, titles or personal data.
 if app.config().identifier!="com.dom.os.notificationtest"{return}
 let Ok(root)=app.path().document_dir()else{return};let root=root.join("DOMOS-Notifications").join("6.2-notifications");
 let _=std::fs::create_dir_all(&root);use std::io::Write;
 if let Ok(mut file)=std::fs::OpenOptions::new().create(true).append(true).open(root.join("activation-diagnostics.jsonl")){let _=writeln!(file,"{}",json!({"timestamp":now(),"phase":phase,"data":data}));}
}
pub fn activation_args(app:&tauri::AppHandle,args:&[String]){
 trace_activation(app,"arguments",json!({"count":args.len(),"validLinks":args.iter().filter(|x|parse_activation(&app.config().identifier,x).is_some()).count()}));
 let Some(uri)=args.iter().find(|x|parse_activation(&app.config().identifier,x).is_some())else{trace_activation(app,"focus-only",json!({}));focus(app);return};
 let Some(state)=app.try_state::<NotificationState>()else{return};let Ok(mut c)=state.0.lock()else{return};
 if c.active.is_none(){trace_activation(app,"deferred",json!({}));c.pending_link=Some(uri.clone());return}
 let (profile,target)=parse_activation(&app.config().identifier,uri).unwrap();let ids=activation_ids(c.active.as_deref(),profile,target,&c.candidates);drop(c);
 trace_activation(app,"resolved",json!({"profileId":profile,"sameProfile":ids.is_some(),"targetHash":target,"ids":ids}));
 focus(app);if let Some(ids)=ids{let result=app.emit_to("main","domos-notification-open",json!({"profileId":profile,"ids":ids}));trace_activation(app,"emitted",json!({"success":result.is_ok()}));}
}
fn toast_xml(uri:&str,body:&str,sound:bool,priority:bool)->String{
 let esc=|s:&str|s.replace('&',"&amp;").replace('<',"&lt;").replace('>',"&gt;").replace('\"',"&quot;").replace('\'',"&apos;");
 let audio=if !sound{r#"<audio silent="true"/>"#}else if priority{r#"<audio src="ms-winsoundevent:Notification.Reminder"/>"#}else{r#"<audio src="ms-winsoundevent:Notification.Default"/>"#};
 format!(r#"<toast activationType="protocol" launch="{}" duration="short"><visual><binding template="ToastGeneric"><text>DOM.OS</text><text>{}</text></binding></visual>{audio}</toast>"#,esc(uri),esc(body))
}
#[cfg(windows)]
fn native_toast(app:&tauri::AppHandle,profile:&str,ids:Vec<String>,body:String,sound:bool,priority:bool)->Result<()> {
 use windows::{core::HSTRING,Data::Xml::Dom::XmlDocument,UI::Notifications::{ToastNotification,ToastNotificationManager}};
 let uri=format!("{}://reminder/{profile}/{}",activation_scheme(&app.config().identifier),ids.first().map(|x|occurrence_hash(x)).unwrap_or_else(||"centre".into()));
 let document=XmlDocument::new().map_err(|e|e.to_string())?;document.LoadXml(&HSTRING::from(toast_xml(&uri,&body,sound,priority))).map_err(|e|e.to_string())?;
 let toast=ToastNotification::CreateToastNotification(&document).map_err(|e|e.to_string())?;
 ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(app.config().identifier.as_str())).and_then(|notifier|notifier.Show(&toast)).map_err(|e|e.to_string())
}
#[cfg(not(windows))]
fn native_toast(_: &tauri::AppHandle,_:&str,_:Vec<String>,_:String,_:bool,_:bool)->Result<()>{Err("Windows notifications unavailable".into())}
#[tauri::command]
pub fn notification_test(app:tauri::AppHandle,window:tauri::WebviewWindow,state:tauri::State<NotificationState>)->Result<Value>{primary(&window)?;let c=state.0.lock().map_err(|_|"Coordinator unavailable")?;let profile=c.active.clone().ok_or("Open a profile first")?;drop(c);native_toast(&app,&profile,vec![],"Test notification · Your reminder system is ready to check.".into(),true,false)?;Ok(json!({"message":"Windows notification requested. Check Windows for display and sound.","diagnostics":notification_diagnostics(app)}))}
#[tauri::command]
pub fn notification_quit(app:tauri::AppHandle,window:tauri::WebviewWindow)->Result<()>{primary(&window)?;app.exit(0);Ok(())}
pub fn setup(app:&mut tauri::App)->Result<()> {
 let root=app.path().app_data_dir().map_err(|e|e.to_string())?;let background=std::fs::read(root.join("background.json")).ok().and_then(|b|serde_json::from_slice(&b).ok()).unwrap_or_default();
 let pending_link=std::env::args().find(|x|parse_activation(&app.config().identifier,x).is_some());
 trace_activation(app.handle(),"startup",json!({"hasLink":pending_link.is_some()}));
 app.manage(NotificationState(Mutex::new(Coordinator{background,pending_link,..Default::default()})));
 #[cfg(windows)]{use tauri_plugin_deep_link::DeepLinkExt;app.deep_link().register(&activation_scheme(&app.config().identifier)).map_err(|e|e.to_string())?;}
 use tauri::{menu::{Menu,MenuItem},tray::TrayIconBuilder};
 let open=MenuItem::with_id(app,"open","Open DOM.OS",true,None::<&str>).map_err(|e|e.to_string())?;let quit=MenuItem::with_id(app,"quit","Quit DOM.OS",true,None::<&str>).map_err(|e|e.to_string())?;let menu=Menu::with_items(app,&[&open,&quit]).map_err(|e|e.to_string())?;
 let mut tray=TrayIconBuilder::with_id("domos").tooltip("DOM.OS · Reminders run while the app stays open").menu(&menu).on_menu_event(|app,event|match event.id.as_ref(){"open"=>focus(app),"quit"=>{let _=app.emit_to("main","domos-quit-request",());},_=>{}});
 if let Some(icon)=app.default_window_icon(){tray=tray.icon(icon.clone())}tray.build(app).map_err(|e|e.to_string())?;
 let handle=app.handle().clone();std::thread::spawn(move || loop{std::thread::sleep(Duration::from_secs(5));let _=handle.emit_to("main","domos-reminder-pulse",now());if let Err(e)=tick(&handle){let _=handle.emit_to("main","domos-reminder-error",e);}});Ok(())
}
pub fn window_event(window:&tauri::Window,event:&tauri::WindowEvent){if window.label()!="main"{return}let s=window.state::<NotificationState>();let background=match s.0.lock(){Ok(c)=>c.background.clone(),Err(_)=>return};match event {tauri::WindowEvent::CloseRequested{api,..}=>{api.prevent_close();if background.close_to_tray{let _=window.hide();}else{let _=window.emit("domos-quit-request",());}},tauri::WindowEvent::Resized(_)if background.minimize_to_tray&&window.is_minimized().unwrap_or(false)=>{let _=window.hide();},_=>{}}}
fn read_array(data:&std::collections::BTreeMap<String,String>,key:&str)->Vec<Value>{data.get(key).and_then(|s|serde_json::from_str(s).ok()).unwrap_or_default()}
fn source_exists(candidate:&Candidate,data:&std::collections::BTreeMap<String,String>)->bool {
 if candidate.kind=="bill" {if let Some(raw)=data.get("lifeos4.financeDomain"){return serde_json::from_str::<serde_json::Value>(raw).ok().map(|s|crate::finance_validation::bill_source(&s,&candidate.source_id)).unwrap_or(false)}}
 let key=match candidate.kind.as_str(){"task"=>"tasks","event"=>"events","routine"=>"routines","habit"=>"habits","bill"=>"financeBills","work"=>"workSessions","review"=>return matches!(candidate.source_id.as_str(),"daily"|"weekly"),_=>return false};read_array(data,&format!("lifeos4.{key}")).iter().any(|x|x["id"].as_str()==Some(&candidate.source_id))}
// Each attempt slot is claimed durably before either presentation API is called.
fn slot(candidate:&Candidate,state:Option<&Value>,prefs:&DeliveryPreferences,now:i64)->Option<(String,i64,u32)> {
 let snooze=state.and_then(|x|x["snoozeUntil"].as_i64());if state.and_then(|x|x["dismissedAt"].as_i64()).is_some()&&snooze.is_none(){return None}
 let due=snooze.unwrap_or(candidate.due).max(candidate.due);if due>now||candidate.end<now&&!matches!(candidate.kind.as_str(),"task"|"bill"|"work"){return None}
 let repeat=if candidate.urgency=="priority"&&prefs.priority_repeats>0 {((now-due)/(prefs.repeat_minutes.max(5) as i64*60000)).min(prefs.priority_repeats.min(3) as i64) as u32}else{0};
 Some((format!("{}.{}.{}",candidate.id,snooze.unwrap_or(0),repeat),due,repeat))
}
// Retry only an explicit failure, once. An uncertain claimed/requested attempt
// may already have reached Windows and must never be replayed after a crash.
fn attempt_id(base_id:&str,delivered:&[Value],time:i64)->Option<(String,u32)> {
 let existing=delivered.iter().find(|x|x["id"].as_str()==Some(base_id));
 match existing {
  None=>Some((base_id.to_owned(),1)),
  Some(x) if x["status"]=="failed" && x["finishedAt"].as_i64().is_some_and(|finished|time-finished>=60000)=>{
   let retry=format!("{base_id}.retry1");
   if delivered.iter().any(|x|x["id"].as_str()==Some(&retry)){None}else{Some((retry,2))}
  },
  _=>None
 }
}
struct Presentation {status:&'static str,detail:String,error:Option<String>}
// An accepted native request must never be retried just because the visual failed.
// Explicit native failures retain the existing single bounded retry and a silent fallback.
fn present_reminder(focused:bool,sound:bool,native:impl FnOnce()->Result<()>,visual:impl FnOnce(Option<&str>)->Result<()>)->Presentation {
 let native_required=!focused||sound;
 let native_result=if native_required{Some(native())}else{None};
 let warning=native_result.as_ref().and_then(|r|r.as_ref().err());
 let visual_result=if focused||warning.is_some(){Some(visual(warning.map(String::as_str)))}else{None};
 let error=warning.cloned().or_else(||if native_result.is_none(){visual_result.as_ref().and_then(|r|r.as_ref().err()).cloned()}else{None});
 let status=if error.is_some(){"failed"}else if native_required{"native-requested"}else{"in-app-requested"};
 let detail=format!("Request only; display and hearing are not established. Native: {}; silent in-app: {}",
  match &native_result{None=>"not required".into(),Some(Ok(()))=>"accepted".into(),Some(Err(e))=>format!("failed: {e}")},
  match &visual_result{None=>"not required".into(),Some(Ok(()))=>"accepted".into(),Some(Err(e))=>format!("failed: {e}")});
 Presentation{status,detail,error}
}
fn tick(app:&tauri::AppHandle)->Result<()> {
 let focused=app.get_webview_window("main").is_some_and(|w|w.is_focused().unwrap_or(false)&&w.is_visible().unwrap_or(false)&&!w.is_minimized().unwrap_or(true));
 let state=app.state::<NotificationState>();let mut c=state.0.lock().map_err(|_|"Coordinator unavailable")?;let profile=match c.active.clone(){Some(p)=>p,None=>return Ok(())};let time=now();let inactivity=c.last_tick>0&&time-c.last_tick>60000;c.last_tick=time;
 if !c.prefs.enabled{return Ok(())}let data=app.state::<DataState>();let mut db=data.0.lock().map_err(|_|"Database unavailable")?;let snapshot=db.snapshot(&profile)?;
 // A canonical revision mismatch cancels delivery until the primary regenerates the read model.
 if snapshot.profile.revision!=c.revision{return Ok(())}
 let states=read_array(&snapshot.data,"lifeos4.notificationStates");let delivered=read_array(&snapshot.data,"lifeos4.notificationDeliveries");let mut batch=Vec::new();
 for candidate in &c.candidates{let state=states.iter().find(|x|x["id"].as_str()==Some(&candidate.id));if let Some((base_id,due,repeat))=slot(candidate,state,&c.prefs,time){let Some((id,attempt))=attempt_id(&base_id,&delivered,time)else{continue};let retry=attempt==2;let missed=time-due>90000;let status=if missed&&!retry&&(!inactivity||repeat>0){"missed-silent"}else{"claimed"};if db.claim_delivery(&profile,&id,json!({"id":id,"occurrenceId":candidate.id,"timestamp":time,"due":due,"status":status,"attempt":attempt,"repeat":repeat}))?&&status=="claimed"{batch.push((candidate.clone(),id,missed));}}}
 if batch.is_empty(){return Ok(())}let quiet=c.prefs.quiet_intervals.iter().any(|(start,end)|time>=*start&&time<*end);let informational=batch.iter().all(|(x,_,_)|x.urgency=="informational");let catchup=batch.iter().any(|(_,_,m)|*m);
 if quiet||informational{for (_,id,_) in batch{db.finish_delivery(&profile,&id,if quiet{"quiet-silent"}else{"informational-silent"},time,"Available in Attention Centre; no popup or sound")?;}return Ok(())}
 let ids=batch.iter().map(|(x,_,_)|x.id.clone()).collect::<Vec<_>>();let priority=batch.iter().any(|(x,_,_)|x.urgency=="priority");let sound=c.prefs.sound&&!quiet&&!informational&&!catchup;
 let body=if catchup{format!("Welcome back. {} commitments are ready to review.",batch.len())}else if batch.len()>1{format!("You have {} things scheduled now.",batch.len())}else if c.prefs.private_content&&batch[0].0.kind!="bill"{batch[0].0.title.clone()}else{"A scheduled commitment needs your attention.".into()};
 // Windows may invoke callbacks during delivery. Never hold SQLite or coordinator locks across OS calls.
 drop(db);drop(c);
 // Windows is the only automatic sound owner, including while the app is focused.
 let outcome=present_reminder(focused,sound,
  ||native_toast(app,&profile,ids.clone(),body.clone(),sound,priority),
  |warning|app.emit_to("main","domos-reminder-alert",json!({"profileId":profile,"ids":ids,"body":body,"priority":priority,"sound":false,"quiet":quiet,"catchup":catchup,"deliveryWarning":warning})).map_err(|e|e.to_string()));
 let data=app.state::<DataState>();let mut db=data.0.lock().map_err(|_|"Database unavailable")?;
 for (_,id,_) in batch{db.finish_delivery(&profile,&id,outcome.status,time,&outcome.detail)?;}
 drop(db);let _=app.emit("profile-updated",json!({"profileId":profile,"revision":snapshot.profile.revision}));
 outcome.error.map_or(Ok(()),Err)
}
#[cfg(test)]mod tests{use super::*;fn candidate()->Candidate{Candidate{id:"n-test".into(),profile_id:"p".into(),kind:"task".into(),source_id:"t".into(),title:"Task".into(),due:1000,end:2000,urgency:"standard".into()}}
 #[test]fn snooze_and_dismiss_slots_do_not_change_schedule(){let r=candidate();let p=DeliveryPreferences::default();assert!(slot(&r,Some(&json!({"dismissedAt":1100})),&p,1200).is_none());assert!(slot(&r,Some(&json!({"snoozeUntil":3000})),&p,1200).is_none());assert_eq!(slot(&r,Some(&json!({"snoozeUntil":3000})),&p,3100).unwrap().1,3000);assert_eq!(r.due,1000);}
 #[test]fn priority_repeats_are_opt_in_and_bounded(){let mut r=candidate();r.urgency="priority".into();let p=DeliveryPreferences{priority_repeats:2,repeat_minutes:5,..Default::default()};assert_eq!(slot(&r,None,&p,9999999).unwrap().2,2);assert_eq!(slot(&r,None,&DeliveryPreferences::default(),9999999).unwrap().2,0);}
 #[test]fn obsolete_event_is_not_replayed(){let mut r=candidate();r.kind="event".into();assert!(slot(&r,None,&DeliveryPreferences::default(),5000).is_none());}
 #[test]fn explicit_failures_retry_once_after_backoff(){let failed=json!({"id":"slot","status":"failed","finishedAt":1000});assert!(attempt_id("slot",&[failed.clone()],60999).is_none());assert_eq!(attempt_id("slot",&[failed.clone()],61000),Some(("slot.retry1".into(),2)));assert!(attempt_id("slot",&[failed,json!({"id":"slot.retry1","status":"failed","finishedAt":61000})],999999).is_none());}
 #[test]fn uncertain_delivery_is_not_replayed_after_restart(){for status in ["claimed","native-requested","in-app-requested","quiet-silent","missed-silent"]{assert!(attempt_id("slot",&[json!({"id":"slot","status":status,"finishedAt":1000})],999999).is_none());}assert!(attempt_id("slot",&[json!({"id":"slot","status":"failed"})],999999).is_none());assert_eq!(attempt_id("new",&[],1000),Some(("new".into(),1)));}
 #[test]fn candidates_require_canonical_source_in_the_same_snapshot(){let mut data=std::collections::BTreeMap::new();data.insert("lifeos4.tasks".into(),r#"[{"id":"t"}]"#.into());let mut r=candidate();assert!(source_exists(&r,&data));r.source_id="other-profile-task".into();assert!(!source_exists(&r,&data));r.kind="unknown".into();assert!(!source_exists(&r,&data));}
 #[test]fn stale_snooze_never_delivers_before_the_canonical_due_time(){let r=candidate();let p=DeliveryPreferences::default();assert!(slot(&r,Some(&json!({"snoozeUntil":500})),&p,999).is_none());assert_eq!(slot(&r,Some(&json!({"snoozeUntil":500})),&p,1000).unwrap().1,1000);}
 #[test]fn foreground_has_one_native_audio_owner_and_a_silent_visual(){let native=std::cell::Cell::new(0);let visual=std::cell::Cell::new(0);let o=present_reminder(true,true,||{native.set(native.get()+1);Ok(())},|warning|{assert!(warning.is_none());visual.set(visual.get()+1);Ok(())});assert_eq!((native.get(),visual.get()),(1,1));assert_eq!(o.status,"native-requested");}
 #[test]fn disabled_sound_and_catchup_use_only_foreground_visual(){let o=present_reminder(true,false,||panic!("No native sound route"),|warning|{assert!(warning.is_none());Ok(())});assert_eq!(o.status,"in-app-requested");}
 #[test]fn background_uses_native_only(){let o=present_reminder(false,true,||Ok(()),|_|panic!("No duplicate presentation"));assert_eq!(o.status,"native-requested");}
 #[test]fn native_failure_surfaces_silent_fallback_and_bounded_retry(){let o=present_reminder(false,true,||Err("Unavailable".into()),|warning|{assert_eq!(warning,Some("Unavailable"));Ok(())});assert_eq!(o.status,"failed");assert!(o.error.is_some());assert_eq!(attempt_id("slot",&[json!({"id":"slot","status":o.status,"finishedAt":1000})],61000),Some(("slot.retry1".into(),2)));}
 #[test]fn visual_failure_never_replays_an_accepted_windows_request(){let o=present_reminder(true,true,||Ok(()),|_|Err("Visual unavailable".into()));assert_eq!(o.status,"native-requested");assert!(o.error.is_none());assert!(o.detail.contains("Visual unavailable"));assert!(attempt_id("slot",&[json!({"id":"slot","status":o.status})],999999).is_none());}

 #[test]fn activation_routes_only_registered_identity_and_valid_navigation_targets(){let p="12345678-1234-4234-8234-123456789012";let uri=format!("{}://reminder/{p}/{}",activation_scheme("com.dom.os.notificationtest"),occurrence_hash("n-test"));assert!(parse_activation("com.dom.os.notificationtest",&uri).is_some());assert!(parse_activation("com.dom.os",&uri).is_none());for bad in [format!("{uri}/delete"),uri.replace(p,"not-a-profile"),uri.replace("reminder/","complete/")]{assert!(parse_activation("com.dom.os.notificationtest",&bad).is_none());}}
 #[test]fn activation_never_switches_profiles_and_stale_sources_have_explicit_fallback(){let r=candidate();let hash=occurrence_hash(&r.id);assert_eq!(activation_ids(Some("p"),"p",&hash,&[r.clone()]),Some(vec![r.id.clone()]));assert_eq!(activation_ids(Some("foreign"),"p",&hash,&[r.clone()]),None);assert_eq!(activation_ids(Some("p"),"p",&hash,&[]),Some(vec!["expired-windows-reminder".into()]));let mut foreign=r;foreign.profile_id="foreign".into();assert_eq!(activation_ids(Some("p"),"p",&hash,&[foreign]),Some(vec!["expired-windows-reminder".into()]));}
 #[test]fn protocol_toast_preserves_windows_audio_and_escapes_untrusted_content(){let xml=toast_xml("test://reminder/x","A < B & \"private\"",true,false);assert!(xml.contains("activationType=\"protocol\""));assert!(xml.contains("Notification.Default"));assert!(xml.contains("&lt;"));assert!(xml.contains("&amp;"));assert!(xml.contains("&quot;"));let silent=toast_xml("test://x","Reminder",false,true);assert!(silent.contains("silent=\"true\""));assert!(!silent.contains("Notification.Reminder"));assert_eq!(xml.matches("<audio").count(),1);}

}
