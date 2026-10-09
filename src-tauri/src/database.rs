use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, fs::{self, OpenOptions}, io::Write, path::{Path, PathBuf}, time::Duration};
use uuid::Uuid;

pub type Result<T> = std::result::Result<T, String>;
pub const COLLECTIONS: &[(&str, &str)] = &[
 ("tasks","tasks"),("events","events"),("calendarTemplates","calendar_templates"),
 ("routines","routines"),("routineExceptions","routine_exceptions"),("transactions","finance_transactions"),
 ("financeAccounts","finance_accounts"),("financeBudgets","finance_budgets"),("financeBills","finance_bills"),
 ("financeSavings","finance_savings"),("goals","goals"),("notes","notes"),
 ("lifeAreas","life_areas"),("objectives","objectives"),("history","history"),
 ("workSessions","work_sessions"),("habits","habits"),("habitLogs","habit_logs"),
 ("trackers","trackers"),("trackerEntries","tracker_entries"),("dailyCheckins","daily_checkins"),
 ("weeklyReviews","weekly_reviews"),("weeklyFocus","weekly_focus"),("reminders","reminders")
];

fn error(e: impl std::fmt::Display)->String {e.to_string()}
fn hash(bytes:&[u8])->String {format!("{:x}",Sha256::digest(bytes))}
fn valid_profile(id:&str)->Result<()> {Uuid::parse_str(id).map(|_|()).map_err(|_|"Invalid profile ID".into())}
const ASSISTANT_COLLECTIONS:&[(&str,&str)]=&[("assistantAudit","assistant_audit"),("actionUndo","action_undo")];
fn all_collections()->impl Iterator<Item=&'static (&'static str,&'static str)>{COLLECTIONS.iter().chain(ASSISTANT_COLLECTIONS.iter()).chain(GOAL_COLLECTIONS.iter()).chain(TRACKING_COLLECTIONS.iter()).chain(REVIEW_COLLECTIONS.iter()).chain(NOTIFICATION_COLLECTIONS.iter())}
fn table_for(key:&str)->Option<&'static str> {let name=key.strip_prefix("lifeos4.")?;all_collections().find(|(k,_)|*k==name).map(|(_,t)|*t)}
const ASSISTANT_SCHEMA:&str="CREATE TABLE assistant_audit(profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,id TEXT NOT NULL,data TEXT NOT NULL CHECK(json_valid(data)),PRIMARY KEY(profile_id,id));CREATE TABLE action_undo(profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,id TEXT NOT NULL,data TEXT NOT NULL CHECK(json_valid(data)),PRIMARY KEY(profile_id,id));";

const GOAL_COLLECTIONS:&[(&str,&str)]=&[("lifeAreaCheckins","life_area_checkins"),("goalActionLinks","goal_action_links"),("goalRelatedAreas","goal_related_area_links"),("goalMilestones","goal_milestones"),("goalActivity","goal_activity")];
const TRACKING_COLLECTIONS:&[(&str,&str)]=&[("habitPausePeriods","habit_pause_periods"),("habitLinks","habit_links"),("trackerPins","tracker_pins")];
const REVIEW_COLLECTIONS:&[(&str,&str)]=&[("dailyReviews","daily_reviews"),("reviewAcknowledgements","review_acknowledgements")];
const NOTIFICATION_COLLECTIONS:&[(&str,&str)]=&[("notificationStates","notification_states"),("notificationOverrides","notification_overrides"),("notificationDeliveries","notification_deliveries")];
fn notification_schema()->String {let mut sql=String::new();for (key,table) in NOTIFICATION_COLLECTIONS {sql.push_str(&format!("CREATE TABLE {table}(profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,id TEXT NOT NULL,data TEXT NOT NULL CHECK(json_valid(data)),PRIMARY KEY(profile_id,id));INSERT INTO {table}(profile_id,id,data) SELECT s.profile_id,json_extract(j.value,'$.id'),j.value FROM profile_state s,json_each(s.value) j WHERE s.key='lifeos4.{key}';DELETE FROM profile_state WHERE key='lifeos4.{key}';"));}sql}
fn review_schema()->String {
 let mut sql=String::new();
 for (key,table) in REVIEW_COLLECTIONS {
  sql.push_str(&format!("CREATE TABLE {table}(profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,id TEXT NOT NULL,data TEXT NOT NULL CHECK(json_valid(data)),PRIMARY KEY(profile_id,id));"));
  sql.push_str(&format!("INSERT INTO {table}(profile_id,id,data) SELECT s.profile_id,json_extract(j.value,'$.id'),j.value FROM profile_state s,json_each(s.value) j WHERE s.key='lifeos4.{key}';DELETE FROM profile_state WHERE key='lifeos4.{key}';"));
 }
 sql.push_str("CREATE UNIQUE INDEX daily_review_date_once ON daily_reviews(profile_id,json_extract(data,'$.localDate')) WHERE json_extract(data,'$.localDate') IS NOT NULL;CREATE UNIQUE INDEX weekly_review_period_once ON weekly_reviews(profile_id,json_extract(data,'$.periodKey')) WHERE json_extract(data,'$.periodKey') IS NOT NULL;");
 sql
}
fn tracking_schema()->String {
 let mut sql=String::new();
 for (key,table) in TRACKING_COLLECTIONS {
  sql.push_str(&format!("CREATE TABLE {table}(profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,id TEXT NOT NULL,data TEXT NOT NULL CHECK(json_valid(data)),PRIMARY KEY(profile_id,id));"));
  sql.push_str(&format!("INSERT INTO {table}(profile_id,id,data) SELECT s.profile_id,json_extract(j.value,'$.id'),j.value FROM profile_state s,json_each(s.value) j WHERE s.key='lifeos4.{key}';DELETE FROM profile_state WHERE key='lifeos4.{key}';"));
 }
 sql.push_str("CREATE UNIQUE INDEX habit_source_once ON habit_logs(profile_id,json_extract(data,'$.habitId'),json_extract(data,'$.source'),json_extract(data,'$.sourceReference')) WHERE json_extract(data,'$.sourceReference') IS NOT NULL;CREATE UNIQUE INDEX tracker_pin_once ON tracker_pins(profile_id,json_extract(data,'$.trackerId'));");
 sql
}
fn goal_schema()->String {
 let mut sql=String::new();
 for (key,table) in GOAL_COLLECTIONS {
  sql.push_str(&format!("CREATE TABLE {table}(profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,id TEXT NOT NULL,data TEXT NOT NULL CHECK(json_valid(data)),PRIMARY KEY(profile_id,id));"));
  // Promote any previously retained extension data atomically, without changing v1/v2 checksums.
  sql.push_str(&format!("INSERT INTO {table}(profile_id,id,data) SELECT s.profile_id,json_extract(j.value,'$.id'),j.value FROM profile_state s,json_each(s.value) j WHERE s.key='lifeos4.{key}';DELETE FROM profile_state WHERE key='lifeos4.{key}';"));
 }
 sql
}

fn schema()->String {
 let mut sql=String::from("CREATE TABLE profiles(id TEXT PRIMARY KEY,name TEXT NOT NULL CHECK(length(trim(name))>0),preferences TEXT NOT NULL CHECK(json_valid(preferences)),revision INTEGER NOT NULL DEFAULT 0);CREATE TABLE profile_state(profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,key TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(profile_id,key));CREATE TABLE legacy_imports(fingerprint TEXT PRIMARY KEY,profile_id TEXT NOT NULL REFERENCES profiles(id),backup_path TEXT NOT NULL,counts TEXT NOT NULL CHECK(json_valid(counts))); ");
 for (_,table) in COLLECTIONS {sql.push_str(&format!("CREATE TABLE {table}(profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,id TEXT NOT NULL,data TEXT NOT NULL CHECK(json_valid(data)),PRIMARY KEY(profile_id,id));"));}
 sql
}

pub fn apply_migrations(conn:&mut Connection, migrations:&[(i64,&str)])->Result<()> {
 conn.execute_batch("PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,checksum TEXT NOT NULL);").map_err(error)?;
 let current:i64=conn.query_row("SELECT COALESCE(MAX(version),0) FROM schema_migrations",[],|r|r.get(0)).map_err(error)?;
 if current>migrations.last().map(|m|m.0).unwrap_or(0){return Err("Database schema is newer than this app; no changes made".into())}
 let tx=conn.transaction().map_err(error)?;
 for (version,sql) in migrations {
  let expected=hash(sql.as_bytes());
  let applied:Option<String>=tx.query_row("SELECT checksum FROM schema_migrations WHERE version=?1",[version],|r|r.get(0)).optional().map_err(error)?;
  if let Some(actual)=applied {if actual!=expected{return Err(format!("Schema migration {version} checksum mismatch"))}}
  else {tx.execute_batch(sql).map_err(error)?;tx.execute("INSERT INTO schema_migrations(version,checksum) VALUES(?1,?2)",params![version,expected]).map_err(error)?;}
 }
 tx.commit().map_err(error)
}

#[derive(Clone,Debug,Serialize,Deserialize)]
pub struct Profile {pub id:String,pub name:String,pub preferences:Value,pub revision:i64}
#[derive(Clone,Debug,Serialize,Deserialize)]
pub struct Snapshot {pub profile:Profile,pub data:BTreeMap<String,String>}
#[derive(Clone,Debug,Serialize,Deserialize)]
pub struct ImportReceipt {pub profile_id:String,pub backup_path:String,pub counts:BTreeMap<String,usize>,pub fingerprint:String}

pub struct Database {conn:Connection,backups:PathBuf}
impl Database {
 pub fn claim_delivery(&mut self,profile:&str,id:&str,metadata:Value)->Result<bool>{
  valid_profile(profile)?;let tx=self.conn.transaction().map_err(error)?;
  let count=tx.execute("INSERT OR IGNORE INTO notification_deliveries(profile_id,id,data) VALUES(?1,?2,?3)",params![profile,id,metadata.to_string()]).map_err(error)?;tx.commit().map_err(error)?;Ok(count==1)
 }
 pub fn finish_delivery(&mut self,profile:&str,id:&str,status:&str,at:i64,detail:&str)->Result<()> {
  self.conn.execute("UPDATE notification_deliveries SET data=json_set(data,'$.status',?3,'$.finishedAt',?4,'$.detail',?5) WHERE profile_id=?1 AND id=?2",params![profile,id,status,at,detail]).map_err(error)?;Ok(())
 }
 pub fn open(path:&Path,backups:PathBuf)->Result<Self>{
  if let Some(parent)=path.parent(){fs::create_dir_all(parent).map_err(error)?;}
  let mut conn=Connection::open(path).map_err(error)?;conn.busy_timeout(Duration::from_secs(5)).map_err(error)?;
  conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;").map_err(error)?;
  // VACUUM INTO includes committed WAL data and creates a consistent standalone backup.
  let has_schema:i64=conn.query_row("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='schema_migrations'",[],|r|r.get(0)).map_err(error)?;
  if has_schema!=0 {let current:i64=conn.query_row("SELECT COALESCE(MAX(version),0) FROM schema_migrations",[],|r|r.get(0)).map_err(error)?;
   if current>0&&current<6 {fs::create_dir_all(&backups).map_err(error)?;let copy=backups.join(format!("pre-schema-{current}-{}.sqlite",Uuid::new_v4()));
    conn.execute("VACUUM INTO ?1",[copy.to_string_lossy().as_ref()]).map_err(error)?;
    let verified=Connection::open_with_flags(&copy,rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(error)?;
    let integrity:String=verified.query_row("PRAGMA quick_check",[],|r|r.get(0)).map_err(error)?;
    let version:i64=verified.query_row("SELECT MAX(version) FROM schema_migrations",[],|r|r.get(0)).map_err(error)?;
    if integrity!="ok"||version!=current{return Err("Pre-migration database backup verification failed; migration not started".into())}
   }
  }
  let sql=schema();let goals=goal_schema();let tracking=tracking_schema();let reviews=review_schema();let notifications=notification_schema();apply_migrations(&mut conn,&[(1,sql.as_str()),(2,ASSISTANT_SCHEMA),(3,goals.as_str()),(4,tracking.as_str()),(5,reviews.as_str()),(6,notifications.as_str())])?;
  Ok(Self{conn,backups})
 }
 pub fn profiles(&self)->Result<Vec<Profile>>{
  let mut q=self.conn.prepare("SELECT id,name,preferences,revision FROM profiles ORDER BY rowid").map_err(error)?;
  let rows=q.query_map([],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,r.get::<_,i64>(3)?))).map_err(error)?;
  rows.map(|r|{let (id,name,p,revision)=r.map_err(error)?;Ok(Profile{id,name,preferences:serde_json::from_str(&p).map_err(error)?,revision})}).collect()
 }
 pub fn update_profile_with_state(&mut self,id:&str,name:&str,preferences:Value,expected_revision:i64,changes:BTreeMap<String,Option<String>>)->Result<Profile>{
  if changes.keys().any(|k|["lifeos4.financeDomain","lifeos4.transactions","lifeos4.financeAccounts","lifeos4.financeBudgets","lifeos4.financeBills","lifeos4.financeSavings"].contains(&k.as_str())){return Err("Profile settings cannot write financial records".into())}
  valid_profile(id)?;if name.trim().is_empty()||name.chars().count()>80||!preferences.is_object(){return Err("Invalid profile settings".into())}
  let tx=self.conn.transaction().map_err(error)?;let changed=tx.execute("UPDATE profiles SET name=?2,preferences=?3,revision=revision+1 WHERE id=?1 AND revision=?4",params![id,name.trim(),preferences.to_string(),expected_revision]).map_err(error)?;
  if changed!=1{return Err("Profile settings changed in another window; reload before saving".into())}
  replace_state(&tx,id,changes)?;validate_goal_links(&tx,id)?;tx.commit().map_err(error)?;
  self.profiles()?.into_iter().find(|p|p.id==id).ok_or("Profile not found".into())
 }
 #[cfg(test)]
 pub fn create_profile(&mut self,name:&str,preferences:Value)->Result<Profile>{
  self.create_initialized_profile(name,preferences,BTreeMap::new())
 }
 pub fn create_initialized_profile(&mut self,name:&str,preferences:Value,changes:BTreeMap<String,Option<String>>)->Result<Profile>{
  if name.trim().is_empty()||name.chars().count()>80{return Err("Profile name must contain 1–80 characters".into())}
  if !preferences.is_object(){return Err("Profile preferences must be an object".into())}
  let id=Uuid::new_v4().to_string();let tx=self.conn.transaction().map_err(error)?;
  tx.execute("INSERT INTO profiles(id,name,preferences) VALUES(?1,?2,?3)",params![id,name.trim(),preferences.to_string()]).map_err(error)?;
  for (key,value) in changes {
   if key.is_empty()||key.len()>512||key.contains('\0'){return Err("Invalid profile key".into())}
   if let Some(table)=table_for(&key){let records=validate_records(&key,value.as_deref().unwrap_or("[]"))?;write_records(&tx,&id,table,&records)?;}
   else if let Some(value)=value {tx.execute("INSERT INTO profile_state(profile_id,key,value) VALUES(?1,?2,?3)",params![id,key,value]).map_err(error)?;}
  }
  validate_goal_links(&tx,&id)?;tx.commit().map_err(error)?;
  Ok(Profile{id,name:name.trim().into(),preferences,revision:0})
 }
 fn backup(&self,label:&str,value:&Value)->Result<PathBuf>{
  fs::create_dir_all(&self.backups).map_err(error)?;
  let bytes=serde_json::to_vec(value).map_err(error)?;
  let path=self.backups.join(format!("{label}-{}.domosbackup",hash(&bytes)));
  match OpenOptions::new().write(true).create_new(true).open(&path){
   Ok(mut file)=>{file.write_all(&bytes).map_err(error)?;file.sync_all().map_err(error)?;},
   Err(e) if e.kind()==std::io::ErrorKind::AlreadyExists=>{},Err(e)=>return Err(error(e))
  }
  if fs::read(&path).map_err(error)?!=bytes{return Err("Backup verification failed; no data migrated".into())}
  Ok(path)
 }
 pub fn snapshot(&self,profile_id:&str)->Result<Snapshot>{
  valid_profile(profile_id)?;
  let profile=self.profiles()?.into_iter().find(|p|p.id==profile_id).ok_or("Profile not found")?;
  let mut data=BTreeMap::new();
  {let mut q=self.conn.prepare("SELECT key,value FROM profile_state WHERE profile_id=?1 ORDER BY key").map_err(error)?;
   let rows=q.query_map([profile_id],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?))).map_err(error)?;
   for row in rows {let (k,v)=row.map_err(error)?;data.insert(k,v);}
  }
  for (key,table) in all_collections() {
   let mut q=self.conn.prepare(&format!("SELECT data FROM {table} WHERE profile_id=?1 ORDER BY rowid")).map_err(error)?;
   let rows=q.query_map([profile_id],|r|r.get::<_,String>(0)).map_err(error)?;
   let mut records=Vec::new();for row in rows {records.push(serde_json::from_str::<Value>(&row.map_err(error)?).map_err(error)?);}
   data.insert(format!("lifeos4.{key}"),serde_json::to_string(&records).map_err(error)?);
  }
  Ok(Snapshot{profile,data})
 }
 pub fn import_legacy(&mut self,name:&str,data:BTreeMap<String,String>)->Result<ImportReceipt>{
  // Durably back up ALL raw keys before parsing or touching profile rows.
  let backup=self.backup("pre-migration",&json!({"format":"DOM.OS Legacy Snapshot","version":1,"sourceVersion":"6.1.3","data":data}))?;
  let fingerprint=hash(&serde_json::to_vec(&data).map_err(error)?);
  let existing:Option<(String,String,String)>=self.conn.query_row("SELECT profile_id,backup_path,counts FROM legacy_imports WHERE fingerprint=?1",[&fingerprint],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).optional().map_err(error)?;
  if let Some((profile_id,backup_path,counts))=existing{return Ok(ImportReceipt{profile_id,backup_path,counts:serde_json::from_str(&counts).map_err(error)?,fingerprint})}
  if name.trim().is_empty()||name.chars().count()>80{return Err("Name the destination profile".into())}
  let profile_id=Uuid::new_v4().to_string();let tx=self.conn.transaction().map_err(error)?;
  tx.execute("INSERT INTO profiles(id,name,preferences) VALUES(?1,?2,'{}')",params![profile_id,name.trim()]).map_err(error)?;
  let mut counts=BTreeMap::new();
  for (key,raw) in &data {
   if let Some(table)=table_for(key){let rows=validate_records(key,raw)?;counts.insert(table.into(),rows.len());write_records(&tx,&profile_id,table,&rows)?;
    let count:i64=tx.query_row(&format!("SELECT COUNT(*) FROM {table} WHERE profile_id=?1"),[&profile_id],|r|r.get(0)).map_err(error)?;
    if count!=rows.len() as i64{return Err(format!("Migration count verification failed: {key}"))}
    let mut q=tx.prepare(&format!("SELECT data FROM {table} WHERE profile_id=?1 ORDER BY rowid")).map_err(error)?;
    let actual=q.query_map([&profile_id],|r|r.get::<_,String>(0)).map_err(error)?.collect::<rusqlite::Result<Vec<_>>>().map_err(error)?;
    if actual!=rows.iter().map(|(_,v)|v.to_string()).collect::<Vec<_>>(){return Err(format!("Migration payload verification failed: {key}"))}
   } else {
    if key.starts_with("lifeos4.")||["domos612.settings","domos612.workTimer"].contains(&key.as_str()){serde_json::from_str::<Value>(raw).map_err(|_|format!("Invalid JSON in {key}; legacy data retained"))?;}
    tx.execute("INSERT INTO profile_state(profile_id,key,value) VALUES(?1,?2,?3)",params![profile_id,key,raw]).map_err(error)?;
   }
  }
  tx.execute("INSERT INTO legacy_imports(fingerprint,profile_id,backup_path,counts) VALUES(?1,?2,?3,?4)",params![fingerprint,profile_id,backup.to_string_lossy(),serde_json::to_string(&counts).map_err(error)?]).map_err(error)?;
  validate_goal_links(&tx,&profile_id)?;tx.commit().map_err(error)?;
  Ok(ImportReceipt{profile_id,backup_path:backup.to_string_lossy().into(),counts,fingerprint})
 }
 pub fn archive_legacy(&self,data:BTreeMap<String,String>)->Result<String>{
  Ok(self.backup("pre-migration",&json!({"format":"DOM.OS Legacy Snapshot","version":1,"sourceVersion":"6.1.3","data":data}))?.to_string_lossy().into())
 }
 pub fn commit(&mut self,profile_id:&str,expected_revision:i64,changes:BTreeMap<String,Option<String>>)->Result<i64>{
  // Domain version 1 is a per-profile migration, independent of SQLite schema 6.
  // Keep the raw legacy collections and verify a durable backup before cutover.
  let current=self.snapshot(profile_id)?;
  if current.profile.revision!=expected_revision{return Err("Profile changed in another window; reload before saving".into())}
  if current.data.contains_key("lifeos4.financeDomain") {
   if changes.keys().any(|k|["lifeos4.transactions","lifeos4.financeAccounts","lifeos4.financeBudgets","lifeos4.financeBills","lifeos4.financeSavings"].contains(&k.as_str())) {return Err("Legacy Finance collections are immutable after ledger cutover".into())}
   if changes.get("lifeos4.financeDomain")==Some(&None){return Err("Finance cannot be cleared through a normal commit".into())}
   if let Some(Some(raw))=changes.get("lifeos4.financeDomain") {let previous:Value=serde_json::from_str(&current.data["lifeos4.financeDomain"]).map_err(error)?;let next:Value=serde_json::from_str(raw).map_err(error)?;let revision=previous["revision"].as_u64().ok_or("Financial revision missing")?;if next["revision"].as_u64()!=revision.checked_add(1){return Err("Financial revision must advance by one".into())}}
  }else if changes.contains_key("lifeos4.financeDomain") {self.backup("pre-finance-v1",&self.export(profile_id)?)?;}
  valid_profile(profile_id)?;let tx=self.conn.transaction().map_err(error)?;
  let revision:Option<i64>=tx.query_row("SELECT revision FROM profiles WHERE id=?1",[profile_id],|r|r.get(0)).optional().map_err(error)?;
  if revision!=Some(expected_revision){return Err("Profile changed in another window; reload before saving".into())}
  for (key,raw) in changes {
   if key.is_empty()||key.len()>512||key.contains('\0'){return Err("Invalid profile key".into())}
   if let Some(table)=table_for(&key){let rows=validate_records(&key,raw.as_deref().unwrap_or("[]"))?;
    if ["daily_reviews","weekly_reviews"].contains(&table) {for (id,raw_row) in &rows {
     let previous:Option<String>=tx.query_row(&format!("SELECT data FROM {table} WHERE profile_id=?1 AND id=?2"),params![profile_id,id],|r|r.get(0)).optional().map_err(error)?;
     if let Some(old)=previous {let old:Value=serde_json::from_str(&old).map_err(error)?;let new=raw_row;if !old["periodKey"].is_null(){for field in ["kind","localDate","startDate","endDate","timezone","weekStart","periodStart","periodEnd","periodKey"]{if old[field]!=new[field]{return Err("Review period identity is immutable".into())}}}}
    }}
    tx.execute(&format!("DELETE FROM {table} WHERE profile_id=?1"),[profile_id]).map_err(error)?;write_records(&tx,profile_id,table,&rows)?;}
   else if let Some(value)=raw {tx.execute("INSERT INTO profile_state(profile_id,key,value) VALUES(?1,?2,?3) ON CONFLICT(profile_id,key) DO UPDATE SET value=excluded.value",params![profile_id,key,value]).map_err(error)?;}
   else {tx.execute("DELETE FROM profile_state WHERE profile_id=?1 AND key=?2",params![profile_id,key]).map_err(error)?;}
  }
  tx.execute("UPDATE profiles SET revision=revision+1 WHERE id=?1",[profile_id]).map_err(error)?;validate_goal_links(&tx,profile_id)?;tx.commit().map_err(error)?;Ok(expected_revision+1)
 }
 pub fn export(&self,profile_id:&str)->Result<Value>{Ok(json!({"format":"DOM.OS Backup","version":2,"appVersion":"6.2.0","schemaVersion":6,"createdAtUnixMs":std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(error)?.as_millis(),"profileIds":[profile_id],"profiles":[self.snapshot(profile_id)?]}))}
 pub fn restore(&mut self,profile_id:&str,payload:Value)->Result<()> {
  if payload["format"]!="DOM.OS Backup"||payload["version"]!=2||!matches!(payload["schemaVersion"].as_u64(),Some(1|2|3|4|5|6)){return Err("Unsupported backup format or schema".into())}
  let profiles=payload["profiles"].as_array().ok_or("Invalid backup profiles")?;
  if profiles.len()!=1{return Err("Select a single-profile backup".into())}
  let mut restored:Snapshot=serde_json::from_value(profiles[0].clone()).map_err(error)?;
  if restored.profile.name.trim().is_empty()||restored.profile.name.chars().count()>80||!restored.profile.preferences.is_object(){return Err("Invalid backup profile".into())}
  for (key,value) in &restored.data {if table_for(key).is_some(){validate_records(key,value)?;}}
  rebind_finance(&mut restored,profile_id)?;
  let current=self.snapshot(profile_id)?;self.backup("pre-restore",&self.export(profile_id)?)?;
  let mut changes:BTreeMap<String,Option<String>>=current.data.keys().map(|k|(k.clone(),None)).collect();
  changes.extend(restored.data.into_iter().map(|(k,v)|(k,Some(v))));
  let tx=self.conn.transaction().map_err(error)?;
  replace_state(&tx,profile_id,changes)?;
  tx.execute("UPDATE profiles SET name=?2,preferences=?3,revision=revision+1 WHERE id=?1",params![profile_id,restored.profile.name,restored.profile.preferences.to_string()]).map_err(error)?;
  validate_goal_links(&tx,profile_id)?;tx.commit().map_err(error)?;
  Ok(())
 }
 pub fn import_backup(&mut self,name:&str,payload:Value)->Result<Profile>{
  if payload["format"]!="DOM.OS Backup"||payload["version"]!=2||!matches!(payload["schemaVersion"].as_u64(),Some(1|2|3|4|5|6)){return Err("Unsupported backup format or schema".into())}
  let profiles=payload["profiles"].as_array().ok_or("Invalid backup profiles")?;if profiles.len()!=1{return Err("Select a single-profile backup".into())}
  let mut restored:Snapshot=serde_json::from_value(profiles[0].clone()).map_err(error)?;
  for (key,value) in &restored.data {if table_for(key).is_some(){validate_records(key,value)?;}}
  if name.trim().is_empty()||name.chars().count()>80||!restored.profile.preferences.is_object(){return Err("Invalid profile metadata".into())}
  self.backup("import-source",&payload)?;
  let id=Uuid::new_v4().to_string();rebind_finance(&mut restored,&id)?;let tx=self.conn.transaction().map_err(error)?;
  tx.execute("INSERT INTO profiles(id,name,preferences) VALUES(?1,?2,?3)",params![id,name.trim(),restored.profile.preferences.to_string()]).map_err(error)?;
  replace_state(&tx,&id,restored.data.into_iter().map(|(k,v)|(k,Some(v))).collect())?;validate_goal_links(&tx,&id)?;tx.commit().map_err(error)?;
  self.profiles()?.into_iter().find(|p|p.id==id).ok_or("Imported profile missing".into())
 }
}

fn rebind_finance(snapshot:&mut Snapshot,target:&str)->Result<()> {
 if let Some(raw)=snapshot.data.get_mut("lifeos4.financeDomain") {let mut state:Value=serde_json::from_str(raw).map_err(error)?;crate::finance_validation::validate(&state,&snapshot.profile.id)?;state["profileId"]=json!(target);for key in ["accounts","transactions","rules","occurrences","allocations","checks","operations"]{for row in state[key].as_array_mut().ok_or("Invalid Finance collection")?{row["profileId"]=json!(target);}}*raw=state.to_string();}Ok(())
}
fn replace_state(tx:&rusqlite::Transaction,profile:&str,changes:BTreeMap<String,Option<String>>)->Result<()> {
 for (key,raw) in changes {
  if key.is_empty()||key.len()>512||key.contains('\0'){return Err("Invalid profile key".into())}
  if let Some(table)=table_for(&key){let rows=validate_records(&key,raw.as_deref().unwrap_or("[]"))?;tx.execute(&format!("DELETE FROM {table} WHERE profile_id=?1"),[profile]).map_err(error)?;write_records(tx,profile,table,&rows)?;}
  else if let Some(value)=raw{tx.execute("INSERT INTO profile_state(profile_id,key,value) VALUES(?1,?2,?3) ON CONFLICT(profile_id,key) DO UPDATE SET value=excluded.value",params![profile,key,value]).map_err(error)?;}
  else{tx.execute("DELETE FROM profile_state WHERE profile_id=?1 AND key=?2",params![profile,key]).map_err(error)?;}
 }
 Ok(())
}

// Validate relationship targets within the destination profile inside the same transaction.
fn validate_goal_links(tx:&rusqlite::Transaction,profile:&str)->Result<()> {
 validate_finance(tx,profile)?;
 for (table,field,target) in [("habit_pause_periods","habitId","habits"),("habit_links","habitId","habits"),("habit_links","routineId","routines"),("tracker_pins","trackerId","trackers")] {
  let sql=format!("SELECT COUNT(*) FROM {table} s WHERE s.profile_id=?1 AND NOT EXISTS(SELECT 1 FROM {target} t WHERE t.profile_id=s.profile_id AND t.id=json_extract(s.data,'$.{field}'))");
  if tx.query_row(&sql,[profile],|r|r.get::<_,i64>(0)).map_err(error)?>0{return Err(format!("Invalid tracking relationship: {table}.{field}"))}
 }
 for (table,field,target) in [("habit_logs","habitId","habits"),("tracker_entries","trackerId","trackers")] {
  // Preserve legacy payloads. New canonical entries carry a source and must resolve locally.
  let sql=format!("SELECT COUNT(*) FROM {table} s WHERE s.profile_id=?1 AND json_extract(s.data,'$.source') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM {target} t WHERE t.profile_id=s.profile_id AND t.id=json_extract(s.data,'$.{field}'))");
  if tx.query_row(&sql,[profile],|r|r.get::<_,i64>(0)).map_err(error)?>0{return Err("Tracking entry belongs to another profile or is missing".into())}
 }
 for table in ["daily_reviews","weekly_reviews"] {
  let mut q=tx.prepare(&format!("SELECT data FROM {table} WHERE profile_id=?1")).map_err(error)?;
  let records=q.query_map([profile],|r|r.get::<_,String>(0)).map_err(error)?;
  for raw in records {let row:Value=serde_json::from_str(&raw.map_err(error)?).map_err(error)?;
   if row["periodKey"].is_null(){if table=="daily_reviews"{return Err("Daily review requires period identity".into())}continue;}
   if !matches!(row["status"].as_str(),Some("IN_PROGRESS"|"COMPLETED"))||!row["reflection"].is_string()||row["reflection"].as_str().unwrap().chars().count()>5000||!row["timezone"].is_string()||row["periodStart"].as_str().unwrap_or("")>=row["periodEnd"].as_str().unwrap_or("")||row["startDate"].as_str().unwrap_or("").len()!=10||row["endDate"].as_str().unwrap_or("").len()!=10 {return Err("Invalid Review period or lifecycle".into())}
   let valid_dates:bool=tx.query_row("SELECT date(?1,'+0 days')=?1 AND date(?2,'+0 days')=?2 AND julianday(?3) IS NOT NULL AND julianday(?4)>julianday(?3)",params![row["startDate"].as_str(),row["endDate"].as_str(),row["periodStart"].as_str(),row["periodEnd"].as_str()],|r|r.get(0)).unwrap_or(false);
   let expected_kind=if table=="daily_reviews"{"daily"}else{"weekly"};let week_start=row["weekStart"].as_i64().unwrap_or(-1);
   let expected_key=if expected_kind=="daily"{row["startDate"].as_str().unwrap_or("").to_string()}else{format!("{}|{}|{}",row["startDate"].as_str().unwrap_or(""),row["timezone"].as_str().unwrap_or(""),week_start)};
   if !valid_dates||row["kind"].as_str()!=Some(expected_kind)||!(0..=6).contains(&week_start)||row["timezone"].as_str().unwrap_or("").is_empty()||row["periodKey"].as_str()!=Some(expected_key.as_str()){return Err("Invalid Review date or identity".into())}
   if table=="daily_reviews"&&row["localDate"]!=row["startDate"]{return Err("Invalid Daily Review date".into())}
  }
 }
 let pins:i64=tx.query_row("SELECT COUNT(*) FROM tracker_pins WHERE profile_id=?1",[profile],|r|r.get(0)).map_err(error)?;if pins>5{return Err("Quick Check-In holds up to five trackers".into())}
 let relationships=[("goals","lifeAreaId","life_areas",true),("objectives","goalId","goals",false),("goal_related_area_links","goalId","goals",false),("goal_related_area_links","areaId","life_areas",false),("goal_milestones","goalId","goals",false),("life_area_checkins","lifeAreaId","life_areas",false),("goal_action_links","goalId","goals",false),("goal_action_links","objectiveId","objectives",true),("work_sessions","goalId","goals",true),("work_sessions","objectiveId","objectives",true),("weekly_focus","goalId","goals",true)];
 for (table,field,target,optional) in relationships {
  let scope=if table=="goals"{" AND json_extract(s.data,'$.type') IS NOT NULL"}else{""};
  let missing=if optional{" IS NOT NULL AND json_extract(s.data,'$.".to_string()+field+"')!='' AND "}else{" IS NULL OR " .into()};
  let sql=if optional{format!("SELECT COUNT(*) FROM {table} s WHERE s.profile_id=?1{scope} AND json_extract(s.data,'$.{field}'){missing}NOT EXISTS(SELECT 1 FROM {target} t WHERE t.profile_id=s.profile_id AND t.id=json_extract(s.data,'$.{field}'))")}else{format!("SELECT COUNT(*) FROM {table} s WHERE s.profile_id=?1{scope} AND (json_extract(s.data,'$.{field}'){missing}NOT EXISTS(SELECT 1 FROM {target} t WHERE t.profile_id=s.profile_id AND t.id=json_extract(s.data,'$.{field}')))")};
  let count:i64=tx.query_row(&sql,[profile],|r|r.get(0)).map_err(error)?;if count>0{return Err(format!("Invalid profile-scoped relationship: {table}.{field}"))}
 }
 for (kind,table) in [("task","tasks"),("routine","routines"),("habit","habits")] {
  let sql=format!("SELECT COUNT(*) FROM goal_action_links s WHERE s.profile_id=?1 AND json_extract(s.data,'$.kind')='{kind}' AND NOT EXISTS(SELECT 1 FROM {table} t WHERE t.profile_id=s.profile_id AND t.id=json_extract(s.data,'$.actionId'))");
  if tx.query_row(&sql,[profile],|r|r.get::<_,i64>(0)).map_err(error)?>0{return Err("Linked action belongs to another profile or is missing".into())}
 }
 let conflict:i64=tx.query_row("SELECT COUNT(*) FROM goal_action_links l JOIN objectives o ON o.profile_id=l.profile_id AND o.id=json_extract(l.data,'$.objectiveId') WHERE l.profile_id=?1 AND json_extract(l.data,'$.goalId')!=json_extract(o.data,'$.goalId')",[profile],|r|r.get(0)).map_err(error)?;
 if conflict>0{return Err("Objective belongs to another goal".into())}
 let work_conflict:i64=tx.query_row("SELECT COUNT(*) FROM work_sessions s JOIN objectives o ON o.profile_id=s.profile_id AND o.id=json_extract(s.data,'$.objectiveId') WHERE s.profile_id=?1 AND json_extract(s.data,'$.goalId') IS NOT NULL AND json_extract(s.data,'$.goalId')!=json_extract(o.data,'$.goalId')",[profile],|r|r.get(0)).map_err(error)?;
 if work_conflict>0{return Err("Work objective belongs to another goal".into())}
 for (kind,table) in [("goal","goals"),("objective","objectives")] {let sql=format!("SELECT COUNT(*) FROM weekly_focus f WHERE f.profile_id=?1 AND json_extract(f.data,'$.kind')='{kind}' AND NOT EXISTS(SELECT 1 FROM {table} t WHERE t.profile_id=f.profile_id AND t.id=json_extract(f.data,'$.targetId'))");if tx.query_row(&sql,[profile],|r|r.get::<_,i64>(0)).map_err(error)?>0{return Err("Invalid Weekly Focus target".into())}}
 Ok(())
}

fn validate_finance(tx:&rusqlite::Transaction,profile:&str)->Result<()> {
 let raw:Option<String>=tx.query_row("SELECT value FROM profile_state WHERE profile_id=?1 AND key='lifeos4.financeDomain'",[profile],|r|r.get(0)).optional().map_err(error)?;
 if let Some(raw)=raw {let state:Value=serde_json::from_str(&raw).map_err(error)?;crate::finance_validation::validate(&state,profile)?;}Ok(())
}
fn validate_records(key:&str,raw:&str)->Result<Vec<(String,Value)>>{
 let values:Vec<Value>=serde_json::from_str(raw).map_err(|_|format!("Invalid collection: {key}"))?;
 let mut ids=std::collections::HashSet::new();let mut rows=Vec::new();
 for (index,value) in values.into_iter().enumerate(){
  if !value.is_object(){return Err(format!("Invalid record: {key}"))}
  let id=if key=="lifeos4.routineExceptions"{format!("{}:{}:{index}",value["routineId"].as_str().ok_or("Invalid routine reference")?,value["date"].as_str().ok_or("Invalid exception date")?)}else{value["id"].as_str().ok_or("Record ID missing")?.to_string()};
  if id.is_empty()||!id.chars().all(|c|c.is_ascii_alphanumeric()||"_.:-".contains(c))||!ids.insert(id.clone()){return Err(format!("Invalid or duplicate ID in {key}"))}
  rows.push((id,value));
 }
 Ok(rows)
}
fn write_records(tx:&rusqlite::Transaction,profile:&str,table:&str,rows:&[(String,Value)])->Result<()> {
 for (id,value) in rows {tx.execute(&format!("INSERT INTO {table}(profile_id,id,data) VALUES(?1,?2,?3)"),params![profile,id,value.to_string()]).map_err(error)?;}Ok(())
}

#[cfg(test)]
mod tests {
 #[test] fn real_finance_cutover_fixture_is_atomic_and_lossless_when_supplied(){let Ok(path)=std::env::var("DOMOS_FINANCE_NATIVE_FIXTURE") else{return};let bytes=fs::read(path).unwrap();let payload:Value=serde_json::from_slice(&bytes).unwrap();let original:BTreeMap<String,String>=serde_json::from_value(payload["data"].clone()).unwrap();let (mut d,root)=db();let receipt=d.import_legacy("Finance cutover",original).unwrap();let before=d.snapshot(&receipt.profile_id).unwrap();let mut state=payload["finance"].clone();let old=state["profileId"].as_str().unwrap().to_string();crate::finance_validation::validate(&state,&old).unwrap();state["profileId"]=json!(receipt.profile_id);for key in ["accounts","transactions","rules","occurrences","allocations","checks","operations"]{for r in state[key].as_array_mut().unwrap(){r["profileId"]=json!(receipt.profile_id);}}let raw=state.to_string();d.commit(&receipt.profile_id,before.profile.revision,BTreeMap::from([("lifeos4.financeDomain".into(),Some(raw.clone()))])).unwrap();let after=d.snapshot(&receipt.profile_id).unwrap();for (key,value) in before.data{assert_eq!(after.data[&key],value);}assert_eq!(after.data["lifeos4.financeDomain"],raw);let backup=d.export(&receipt.profile_id).unwrap();let copy=d.import_backup("Copy",backup.clone()).unwrap();let imported:Value=serde_json::from_str(&d.snapshot(&copy.id).unwrap().data["lifeos4.financeDomain"]).unwrap();assert_eq!(imported["accounts"][0]["openingMinor"],state["accounts"][0]["openingMinor"]);d.restore(&receipt.profile_id,backup).unwrap();assert_eq!(d.snapshot(&receipt.profile_id).unwrap().data["lifeos4.financeDomain"],raw);assert_eq!(fs::read(std::env::var("DOMOS_FINANCE_NATIVE_FIXTURE").unwrap()).unwrap(),bytes);drop(d);fs::remove_dir_all(root).unwrap();}
 fn finance_fixture(profile:&str)->Value {json!({"version":1,"revision":0,"profileId":profile,"currency":"GBP","cutoverDate":"2026-10-09","accounts":[{"id":"a","profileId":profile,"currency":"GBP","name":"Receiving","type":"Current","supported":true,"archived":false,"openingMinor":100000,"openingDate":"2026-10-09","openingSource":"unverified-legacy-snapshot","verifiedAt":null}],"transactions":[],"rules":[],"occurrences":[],"allocations":[],"checks":[],"operations":[],"settings":{"horizon":30,"primaryAccountId":"a","spendingAccountId":"","billsReviewedAt":null},"legacy":{"bills":[],"budgets":[],"savings":[],"quarantine":[]}})}
 #[test] fn finance_cutover_backup_legacy_guard_and_revision_are_atomic(){let (mut d,root)=db();let a=d.create_profile("A",json!({})).unwrap();let legacy="[{\"id\":\"a\",\"balance\":1000}]";d.commit(&a.id,0,BTreeMap::from([("lifeos4.financeAccounts".into(),Some(legacy.into()))])).unwrap();let s=finance_fixture(&a.id);d.commit(&a.id,1,BTreeMap::from([("lifeos4.financeDomain".into(),Some(s.to_string()))])).unwrap();assert_eq!(fs::read_dir(root.join("backups")).unwrap().count(),1);assert_eq!(serde_json::from_str::<Value>(&d.snapshot(&a.id).unwrap().data["lifeos4.financeAccounts"]).unwrap(),serde_json::from_str::<Value>(legacy).unwrap());assert!(d.commit(&a.id,2,BTreeMap::from([("lifeos4.financeAccounts".into(),Some("[]".into()))])).is_err());assert!(d.commit(&a.id,1,BTreeMap::from([("lifeos4.financeDomain".into(),Some(s.to_string()))])).is_err());assert_eq!(d.snapshot(&a.id).unwrap().profile.revision,2);drop(d);fs::remove_dir_all(root).unwrap();}
 #[test] fn finance_restore_rejects_overlap_before_replacing_and_valid_periods_roundtrip(){let (mut d,root)=db();let a=d.create_profile("A",json!({"currency":"GBP"})).unwrap();let mut state=finance_fixture(&a.id);state["allocations"]=json!([{"id":"food1","profileId":a.id,"currency":"GBP","accountId":"a","amountMinor":10000,"kind":"essentials","category":"Food","startDate":"2026-10-09","endDate":"2026-10-15"},{"id":"food2","profileId":a.id,"currency":"GBP","accountId":"a","amountMinor":10000,"kind":"essentials","category":"Food","startDate":"2026-10-16","endDate":"2026-10-20"}]);d.commit(&a.id,0,BTreeMap::from([("lifeos4.financeDomain".into(),Some(state.to_string()))])).unwrap();let backup=d.export(&a.id).unwrap();let before=d.snapshot(&a.id).unwrap();let mut bad=backup.clone();state["allocations"][1]["startDate"]=json!("2026-10-15");bad["profiles"][0]["data"]["lifeos4.financeDomain"]=json!(state.to_string());assert!(d.restore(&a.id,bad.clone()).is_err());assert!(d.import_backup("Bad",bad).is_err());assert_eq!(d.profiles().unwrap().len(),1);assert_eq!(d.snapshot(&a.id).unwrap().data,before.data);assert_eq!(d.snapshot(&a.id).unwrap().profile.revision,before.profile.revision);d.restore(&a.id,backup.clone()).unwrap();let b=d.import_backup("Valid",backup).unwrap();let restored:Value=serde_json::from_str(&d.snapshot(&b.id).unwrap().data["lifeos4.financeDomain"]).unwrap();crate::finance_validation::validate(&restored,&b.id).unwrap();drop(d);fs::remove_dir_all(root).unwrap();}
 #[test] fn finance_native_rejects_internal_settlement_and_invalid_rule_history(){let mut s=finance_fixture("profile");s["rules"]=json!([{"id":"r","profileId":"profile","currency":"GBP","accountId":"a","kind":"expense","amountMinor":10000,"anchor":"2026-10-09","frequency":"once","weekend":"none","day":null}]);s["occurrences"]=json!([{"id":"r:2026-10-09","profileId":"profile","currency":"GBP","ruleId":"r","accountId":"a","kind":"expense","amountMinor":10000,"date":"2026-10-09","nominalDate":"2026-10-09"}]);s["transactions"]=json!([{"id":"legacy","profileId":"profile","currency":"GBP","accountId":"a","type":"expense","amountMinor":10000,"createdAt":"2026-10-09T12:00:00Z","effectiveDate":"2026-10-01","posted":false,"historical":true,"internalTransfer":true,"occurrenceId":"r:2026-10-09"}]);assert!(crate::finance_validation::validate(&s,"profile").is_err());s["transactions"][0]["internalTransfer"]=json!(false);crate::finance_validation::validate(&s,"profile").unwrap();s["rules"][0]["amountHistory"]=json!([{"effectiveFrom":"2026-10-09","amountMinor":5000},{"effectiveFrom":"2024-10-01","amountMinor":10000}]);assert!(crate::finance_validation::validate(&s,"profile").is_err());s["rules"][0]["amountHistory"]=json!([{"effectiveFrom":"2024-10-01","amountMinor":10000},{"effectiveFrom":"2026-10-09","amountMinor":5000}]);crate::finance_validation::validate(&s,"profile").unwrap();}
 #[test] fn finance_activation_optional_fields_reject_null_and_bad_text(){let mut s=finance_fixture("profile");s["transactions"]=json!([{"id":"t","profileId":"profile","currency":"GBP","accountId":"a","amountMinor":100,"type":"expense","createdAt":"2026-10-09T12:00:00Z","effectiveDate":"2026-10-09","posted":true,"description":null}]);assert!(crate::finance_validation::validate(&s,"profile").is_err());s["transactions"][0]["description"]=json!("Valid");crate::finance_validation::validate(&s,"profile").unwrap();s["transactions"][0]["voided"]=Value::Null;assert!(crate::finance_validation::validate(&s,"profile").is_err());s["transactions"][0]["voided"]=json!(false);s["legacy"]["budgets"]=json!([{"needsReview":true,"limitMinor":null}]);assert!(crate::finance_validation::validate(&s,"profile").is_err());}
 #[test] fn finance_document_revision_rejects_stale_writes(){let (mut d,root)=db();let a=d.create_profile("A",json!({})).unwrap();let mut s=finance_fixture(&a.id);d.commit(&a.id,0,BTreeMap::from([("lifeos4.financeDomain".into(),Some(s.to_string()))])).unwrap();assert!(d.commit(&a.id,1,BTreeMap::from([("lifeos4.financeDomain".into(),Some(s.to_string()))])).is_err());s["revision"]=json!(1);d.commit(&a.id,1,BTreeMap::from([("lifeos4.financeDomain".into(),Some(s.to_string()))])).unwrap();assert_eq!(d.snapshot(&a.id).unwrap().profile.revision,2);drop(d);fs::remove_dir_all(root).unwrap();}
 #[test] fn finance_invalid_money_and_foreign_postings_roll_back(){let (mut d,root)=db();let a=d.create_profile("A",json!({})).unwrap();let mut s=finance_fixture(&a.id);d.commit(&a.id,0,BTreeMap::from([("lifeos4.financeDomain".into(),Some(s.to_string()))])).unwrap();let before=d.snapshot(&a.id).unwrap();s["revision"]=json!(1);s["accounts"][0]["openingMinor"]=json!(1.5);assert!(d.commit(&a.id,1,BTreeMap::from([("lifeos4.financeDomain".into(),Some(s.to_string())),("lifeos4.quickNote".into(),Some("\"must roll back\"".into()))])).is_err());s=finance_fixture(&a.id);s["revision"]=json!(1);s["transactions"]=json!([{"id":"t","profileId":a.id,"currency":"GBP","accountId":"foreign","amountMinor":100,"type":"expense","effectiveDate":"2026-10-09","posted":true}]);assert!(d.commit(&a.id,1,BTreeMap::from([("lifeos4.financeDomain".into(),Some(s.to_string()))])).is_err());assert_eq!(d.snapshot(&a.id).unwrap().data,before.data);assert_eq!(d.snapshot(&a.id).unwrap().profile.revision,1);drop(d);fs::remove_dir_all(root).unwrap();}
 #[test] fn finance_backup_import_rebinds_ownership_and_bad_restore_retains_original(){let (mut d,root)=db();let a=d.create_profile("A",json!({})).unwrap();let s=finance_fixture(&a.id);d.commit(&a.id,0,BTreeMap::from([("lifeos4.financeDomain".into(),Some(s.to_string()))])).unwrap();let backup=d.export(&a.id).unwrap();let b=d.import_backup("Copy",backup.clone()).unwrap();let imported:Value=serde_json::from_str(&d.snapshot(&b.id).unwrap().data["lifeos4.financeDomain"]).unwrap();assert_eq!(imported["profileId"],b.id);assert_eq!(imported["accounts"][0]["profileId"],b.id);assert_eq!(imported["accounts"][0]["openingMinor"],100000);d.restore(&b.id,backup.clone()).unwrap();let before=d.snapshot(&b.id).unwrap().data;let mut bad=backup;let mut state=finance_fixture(&a.id);state["accounts"][0]["profileId"]=json!(b.id);bad["profiles"][0]["data"]["lifeos4.financeDomain"]=json!(state.to_string());assert!(d.restore(&b.id,bad).is_err());assert_eq!(d.snapshot(&b.id).unwrap().data,before);drop(d);fs::remove_dir_all(root).unwrap();}
 #[test] fn finance_failed_cutover_retains_legacy_and_verified_backup(){let (mut d,root)=db();let a=d.create_profile("A",json!({})).unwrap();let before=d.snapshot(&a.id).unwrap().data;let mut s=finance_fixture(&a.id);s["accounts"][0]["openingMinor"]=json!(i64::MIN);assert!(d.commit(&a.id,0,BTreeMap::from([("lifeos4.financeDomain".into(),Some(s.to_string()))])).is_err());assert_eq!(d.snapshot(&a.id).unwrap().data,before);assert_eq!(fs::read_dir(root.join("backups")).unwrap().count(),1);drop(d);fs::remove_dir_all(root).unwrap();}
 fn review_row(id:&str,kind:&str)->Value {json!({"id":id,"kind":kind,"localDate":if kind=="daily"{Some("2026-10-08")}else{None},"startDate":"2026-10-08","endDate":if kind=="daily"{"2026-10-09"}else{"2026-10-15"},"timezone":"Europe/London","weekStart":1,"periodStart":"2026-10-07T23:00:00.000Z","periodEnd":if kind=="daily"{"2026-10-08T23:00:00.000Z"}else{"2026-10-14T23:00:00.000Z"},"periodKey":if kind=="daily"{"2026-10-08"}else{"2026-10-08|Europe/London|1"},"status":"IN_PROGRESS","reflection":"","createdAt":"2026-10-08T12:00:00.000Z"})}
 #[test] fn review_uniqueness_profile_isolation_and_transactional_rollback(){let (mut d,root)=db();let a=d.create_profile("A",json!({})).unwrap();let b=d.create_profile("B",json!({})).unwrap();let row=review_row("d1","daily");let raw=json!([row.clone()]).to_string();d.commit(&a.id,0,BTreeMap::from([("lifeos4.dailyReviews".into(),Some(raw.clone()))])).unwrap();d.commit(&b.id,0,BTreeMap::from([("lifeos4.dailyReviews".into(),Some(raw))])).unwrap();let mut duplicate=row.clone();duplicate["id"]=json!("d2");let before=d.snapshot(&a.id).unwrap();assert!(d.commit(&a.id,1,BTreeMap::from([("lifeos4.dailyReviews".into(),Some(json!([row,duplicate]).to_string())),("lifeos4.quickNote".into(),Some("\"do not save\"".into()))])).is_err());assert_eq!(d.snapshot(&a.id).unwrap().data,before.data);assert_eq!(d.snapshot(&a.id).unwrap().profile.revision,1);drop(d);fs::remove_dir_all(root).unwrap();}
 #[test] fn review_period_metadata_is_immutable_but_reflection_lifecycle_editable(){let (mut d,root)=db();let a=d.create_profile("A",json!({})).unwrap();let mut row=review_row("w1","weekly");d.commit(&a.id,0,BTreeMap::from([("lifeos4.weeklyReviews".into(),Some(json!([row.clone()]).to_string()))])).unwrap();row["timezone"]=json!("America/New_York");assert!(d.commit(&a.id,1,BTreeMap::from([("lifeos4.weeklyReviews".into(),Some(json!([row.clone()]).to_string()))])).is_err());row["timezone"]=json!("Europe/London");row["reflection"]=json!("Remember this week");row["status"]=json!("COMPLETED");d.commit(&a.id,1,BTreeMap::from([("lifeos4.weeklyReviews".into(),Some(json!([row]).to_string()))])).unwrap();assert!(d.snapshot(&a.id).unwrap().data["lifeos4.weeklyReviews"].contains("Remember this week"));drop(d);fs::remove_dir_all(root).unwrap();}
 #[test] fn notification_claim_is_durable_unique_and_profile_scoped(){let (mut d,root)=db();let a=d.create_profile("A",json!({})).unwrap();let b=d.create_profile("B",json!({})).unwrap();let row=json!({"id":"n-one.0.0","status":"claimed"});assert!(d.claim_delivery(&a.id,"n-one.0.0",row.clone()).unwrap());assert!(!d.claim_delivery(&a.id,"n-one.0.0",row.clone()).unwrap());assert!(d.claim_delivery(&b.id,"n-one.0.0",row.clone()).unwrap());d.finish_delivery(&a.id,"n-one.0.0","native-requested",42,"API requested").unwrap();let revision=d.snapshot(&a.id).unwrap().profile.revision;assert_eq!(revision,0);let before=d.snapshot(&a.id).unwrap().data;drop(d);let d=Database::open(&root.join("test.sqlite"),root.join("backups")).unwrap();assert_eq!(d.snapshot(&a.id).unwrap().data,before);assert!(d.snapshot(&b.id).unwrap().data["lifeos4.notificationDeliveries"].contains("claimed"));drop(d);fs::remove_dir_all(root).unwrap();}
 #[test] fn notification_backup_roundtrip_and_invalid_restore_rollback(){let (mut d,root)=db();let a=d.create_profile("A",json!({})).unwrap();let state=json!([{"id":"n-one","snoozeUntil":1791450000000i64,"dismissedAt":null}]);d.commit(&a.id,0,BTreeMap::from([("lifeos4.notificationStates".into(),Some(state.to_string())),("lifeos4.notificationPreferences".into(),Some(json!({"sound":false,"quietEnabled":true}).to_string()))])).unwrap();d.claim_delivery(&a.id,"n-one.0.0",json!({"id":"n-one.0.0","status":"claimed"})).unwrap();let backup=d.export(&a.id).unwrap();let b=d.import_backup("Copy",backup.clone()).unwrap();assert_eq!(d.snapshot(&a.id).unwrap().data,d.snapshot(&b.id).unwrap().data);let before=d.snapshot(&a.id).unwrap().data;let mut bad=backup;bad["profiles"][0]["data"]["lifeos4.notificationStates"]=json!(json!([{"id":"same"},{"id":"same"}]).to_string());assert!(d.restore(&a.id,bad).is_err());assert_eq!(d.snapshot(&a.id).unwrap().data,before);drop(d);fs::remove_dir_all(root).unwrap();}
 #[test] fn schema_six_verifies_backup_and_preserves_v5_canonical_data(){let root=std::env::temp_dir().join(format!("domos-notifications-{}",Uuid::new_v4()));fs::create_dir_all(&root).unwrap();let path=root.join("test.sqlite");let mut conn=Connection::open(&path).unwrap();let base=schema();let goals=goal_schema();let tracking=tracking_schema();let reviews=review_schema();apply_migrations(&mut conn,&[(1,&base),(2,ASSISTANT_SCHEMA),(3,&goals),(4,&tracking),(5,&reviews)]).unwrap();let id=Uuid::new_v4().to_string();conn.execute("INSERT INTO profiles(id,name,preferences) VALUES(?1,'Existing','{}')",[&id]).unwrap();conn.execute("INSERT INTO tasks(profile_id,id,data) VALUES(?1,'t',?2)",params![id,json!({"id":"t","title":"Keep"}).to_string()]).unwrap();conn.execute("INSERT INTO profile_state(profile_id,key,value) VALUES(?1,'lifeos4.notificationStates','[]')",[&id]).unwrap();drop(conn);let d=Database::open(&path,root.join("backups")).unwrap();assert!(d.snapshot(&id).unwrap().data["lifeos4.tasks"].contains("Keep"));assert_eq!(d.snapshot(&id).unwrap().data["lifeos4.notificationStates"],"[]");assert_eq!(fs::read_dir(root.join("backups")).unwrap().count(),1);drop(d);let d=Database::open(&path,root.join("backups")).unwrap();assert_eq!(fs::read_dir(root.join("backups")).unwrap().count(),1);drop(d);fs::remove_dir_all(root).unwrap();}
 #[test] fn review_backup_roundtrip_bad_restore_and_duplicate_week_rollback(){let (mut d,root)=db();let a=d.create_profile("A",json!({})).unwrap();let row=review_row("w1","weekly");d.commit(&a.id,0,BTreeMap::from([("lifeos4.weeklyReviews".into(),Some(json!([row.clone()]).to_string())),("lifeos4.dailyReviews".into(),Some(json!([review_row("d1","daily")]).to_string()))])).unwrap();let backup=d.export(&a.id).unwrap();assert_eq!(backup["schemaVersion"],6);let copy=d.import_backup("Copy",backup.clone()).unwrap();assert_eq!(d.snapshot(&copy.id).unwrap().data,d.snapshot(&a.id).unwrap().data);let before=d.snapshot(&a.id).unwrap().data;let mut bad=backup;let mut duplicate=row.clone();duplicate["id"]=json!("w2");bad["profiles"][0]["data"]["lifeos4.weeklyReviews"]=json!(json!([row,duplicate]).to_string());assert!(d.restore(&a.id,bad).is_err());assert_eq!(d.snapshot(&a.id).unwrap().data,before);drop(d);fs::remove_dir_all(root).unwrap();}

 #[test] fn schema_upgrade_preserves_wal_records_in_verified_backup(){
  let root=std::env::temp_dir().join(format!("domos-upgrade-{}",Uuid::new_v4()));fs::create_dir_all(&root).unwrap();let path=root.join("test.sqlite");let mut conn=Connection::open(&path).unwrap();conn.execute_batch("PRAGMA journal_mode=WAL;").unwrap();
  let sql=schema();let goals=goal_schema();let tracking=tracking_schema();apply_migrations(&mut conn,&[(1,sql.as_str()),(2,ASSISTANT_SCHEMA),(3,goals.as_str()),(4,tracking.as_str())]).unwrap();
  let id=Uuid::new_v4().to_string();conn.execute("INSERT INTO profiles(id,name,preferences) VALUES(?1,'Keep me','{}')",[&id]).unwrap();conn.execute("INSERT INTO profile_state(profile_id,key,value) VALUES(?1,'unknown','retained WAL record')",[&id]).unwrap();
  let upgraded=Database::open(&path,root.join("backups")).unwrap();assert_eq!(upgraded.snapshot(&id).unwrap().data["unknown"],"retained WAL record");let files:Vec<_>=fs::read_dir(root.join("backups")).unwrap().map(|e|e.unwrap().path()).collect();assert_eq!(files.len(),1);
  let backup=Connection::open(&files[0]).unwrap();assert_eq!(backup.query_row("SELECT MAX(version) FROM schema_migrations",[],|r|r.get::<_,i64>(0)).unwrap(),4);assert_eq!(backup.query_row("SELECT value FROM profile_state WHERE key='unknown'",[],|r|r.get::<_,String>(0)).unwrap(),"retained WAL record");drop(backup);drop(upgraded);drop(conn);fs::remove_dir_all(root).unwrap();
 }

 #[test] fn failed_schema_upgrade_keeps_original_and_backup(){let root=std::env::temp_dir().join(format!("domos-upgrade-{}",Uuid::new_v4()));fs::create_dir_all(&root).unwrap();let path=root.join("test.sqlite");let mut conn=Connection::open(&path).unwrap();let sql=schema();let goals=goal_schema();let tracking=tracking_schema();apply_migrations(&mut conn,&[(1,sql.as_str()),(2,ASSISTANT_SCHEMA),(3,goals.as_str()),(4,tracking.as_str())]).unwrap();let id=Uuid::new_v4().to_string();conn.execute("INSERT INTO profiles(id,name,preferences) VALUES(?1,'Keep','{}')",[&id]).unwrap();for key in ["w1","w2"]{conn.execute("INSERT INTO weekly_reviews(profile_id,id,data) VALUES(?1,?2,?3)",params![id,key,review_row(key,"weekly").to_string()]).unwrap();}drop(conn);assert!(Database::open(&path,root.join("backups")).is_err());let original=Connection::open(&path).unwrap();assert_eq!(original.query_row("SELECT MAX(version) FROM schema_migrations",[],|r|r.get::<_,i64>(0)).unwrap(),4);assert_eq!(original.query_row("SELECT COUNT(*) FROM weekly_reviews",[],|r|r.get::<_,i64>(0)).unwrap(),2);assert_eq!(fs::read_dir(root.join("backups")).unwrap().count(),1);drop(original);fs::remove_dir_all(root).unwrap();}
 #[test] fn malformed_review_restore_rolls_back(){let (mut d,root)=db();let a=d.create_profile("A",json!({})).unwrap();let mut row=review_row("d1","daily");row["periodStart"]=json!("");let before=d.snapshot(&a.id).unwrap();assert!(d.commit(&a.id,0,BTreeMap::from([("lifeos4.dailyReviews".into(),Some(json!([row]).to_string()))])).is_err());assert_eq!(d.snapshot(&a.id).unwrap().data,before.data);assert_eq!(d.snapshot(&a.id).unwrap().profile.revision,0);drop(d);fs::remove_dir_all(root).unwrap();}
 use super::*;
 #[test] fn tracking_relationships_backup_and_failed_restore_are_atomic(){
  let (mut d,root)=db();let a=d.create_profile("Tracking",json!({})).unwrap();let b=d.create_profile("Other",json!({})).unwrap();let raw=|v:Value|Some(v.to_string());
  d.commit(&a.id,0,BTreeMap::from([
   ("lifeos4.habits".into(),raw(json!([{"id":"h","name":"Read"}]))),("lifeos4.trackers".into(),raw(json!([{"id":"t","name":"Energy"}]))),
   ("lifeos4.habitPausePeriods".into(),raw(json!([{"id":"p","habitId":"h","startDate":"2026-10-06"}]))),("lifeos4.trackerPins".into(),raw(json!([{"id":"pin","trackerId":"t","order":0}]))),
   ("lifeos4.habitLogs".into(),raw(json!([{"id":"log","habitId":"h","source":"routine","sourceReference":"occurrence","value":true}]))),
   ("lifeos4.trackerEntries".into(),raw(json!([{"id":"entry","trackerId":"t","source":"manual","value":3,"timestamp":"2026-10-06T13:00:00Z"}])))] )).unwrap();
  let backup=d.export(&a.id).unwrap();assert_eq!(backup["schemaVersion"],6);let copy=d.import_backup("Copy",backup.clone()).unwrap();assert_eq!(d.snapshot(&copy.id).unwrap().data,d.snapshot(&a.id).unwrap().data);
  assert_eq!(d.snapshot(&b.id).unwrap().data["lifeos4.trackerPins"],"[]");assert!(d.commit(&b.id,0,BTreeMap::from([("lifeos4.trackerPins".into(),raw(json!([{"id":"bad","trackerId":"t"}])))] )).is_err());
  let before=d.snapshot(&a.id).unwrap().data;let mut invalid=backup;invalid["profiles"][0]["data"]["lifeos4.habitPausePeriods"]=json!("[{\"id\":\"bad\",\"habitId\":\"foreign\"}]");assert!(d.restore(&a.id,invalid).is_err());assert_eq!(d.snapshot(&a.id).unwrap().data,before);
  assert!(d.commit(&a.id,1,BTreeMap::from([("lifeos4.habitLogs".into(),raw(json!([{"id":"x","habitId":"h","source":"routine","sourceReference":"same"},{"id":"y","habitId":"h","source":"routine","sourceReference":"same"}])))] )).is_err());assert_eq!(d.snapshot(&a.id).unwrap().data,before);
  drop(d);fs::remove_dir_all(root).unwrap();
 }
 #[test] fn assistant_changes_audit_and_undo_are_atomic_and_isolated(){let (mut d,root)=db();let a=d.create_profile("A",json!({})).unwrap();let b=d.create_profile("B",json!({})).unwrap();let task=Some("[{\"id\":\"task\",\"title\":\"Assistant task\"}]".into());let audit=Some("[{\"id\":\"audit\",\"provider\":\"Local\",\"success\":true}]".into());assert!(d.commit(&a.id,0,BTreeMap::from([("lifeos4.tasks".into(),task.clone()),("lifeos4.assistantAudit".into(),Some("[{\"id\":\"x\"},{\"id\":\"x\"}]".into()))])).is_err());assert_eq!(d.snapshot(&a.id).unwrap().data["lifeos4.tasks"],"[]");d.commit(&a.id,0,BTreeMap::from([("lifeos4.tasks".into(),task),("lifeos4.assistantAudit".into(),audit),("lifeos4.actionUndo".into(),Some("[{\"id\":\"undo\",\"used\":false}]".into()))])).unwrap();assert_eq!(d.snapshot(&b.id).unwrap().data["lifeos4.assistantAudit"],"[]");let backup=d.export(&a.id).unwrap();assert_eq!(backup["schemaVersion"],6);let restored=d.import_backup("Imported",backup).unwrap();assert_eq!(d.snapshot(&restored.id).unwrap().data,d.snapshot(&a.id).unwrap().data);drop(d);fs::remove_dir_all(root).unwrap();}
 #[test] fn goal_relationships_are_profile_scoped_atomic_and_restorable(){
  let (mut d,root)=db();let a=d.create_profile("A",json!({})).unwrap();let b=d.create_profile("B",json!({})).unwrap();
  let raw=|v:Value|Some(v.to_string());let changes=BTreeMap::from([
   ("lifeos4.lifeAreas".into(),raw(json!([{"id":"area","name":"Career"}]))),("lifeos4.goals".into(),raw(json!([{"id":"goal","name":"Build","type":"outcome","lifeAreaId":"area"}]))),
   ("lifeos4.objectives".into(),raw(json!([{"id":"objective","goalId":"goal","name":"Release"}]))),("lifeos4.tasks".into(),raw(json!([{"id":"task","title":"Test"}]))),
   ("lifeos4.goalActionLinks".into(),raw(json!([{"id":"link","goalId":"goal","objectiveId":"objective","kind":"task","actionId":"task"}]))),
   ("lifeos4.goalMilestones".into(),raw(json!([{"id":"milestone","goalId":"goal","title":"First"}]))),("lifeos4.lifeAreaCheckins".into(),raw(json!([{"id":"checkin","lifeAreaId":"area","rating":4}]))),
   ("lifeos4.weeklyFocus".into(),raw(json!([{"id":"focus","kind":"goal","targetId":"goal","week":"2026-10-05","state":"active"}])))]);
  d.commit(&a.id,0,changes).unwrap();let snapshot=d.snapshot(&a.id).unwrap();assert_eq!(d.snapshot(&b.id).unwrap().data["lifeos4.goalActionLinks"],"[]");
  let foreign=BTreeMap::from([("lifeos4.goalMilestones".into(),raw(json!([{"id":"bad","goalId":"goal","title":"Foreign"}])))]);assert!(d.commit(&b.id,0,foreign).is_err());assert_eq!(d.snapshot(&b.id).unwrap().profile.revision,0);
  let backup=d.export(&a.id).unwrap();let copied=d.import_backup("Copy",backup.clone()).unwrap();assert_eq!(d.snapshot(&copied.id).unwrap().data,snapshot.data);
  let mut bad=backup;bad["profiles"][0]["data"]["lifeos4.goalActionLinks"]=json!(json!([{"id":"bad","kind":"task","actionId":"foreign","goalId":"goal"}]).to_string());assert!(d.restore(&a.id,bad).is_err());assert_eq!(d.snapshot(&a.id).unwrap().data,snapshot.data);
  drop(d);fs::remove_dir_all(root).unwrap();
 }
 #[test] fn schema_three_preserves_v2_and_promotes_goal_entities_transactionally(){
  let root=std::env::temp_dir().join(format!("domos-goals-{}",Uuid::new_v4()));fs::create_dir_all(&root).unwrap();let path=root.join("test.sqlite");let mut conn=Connection::open(&path).unwrap();let sql=schema();apply_migrations(&mut conn,&[(1,sql.as_str()),(2,ASSISTANT_SCHEMA)]).unwrap();
  let id=Uuid::new_v4().to_string();conn.execute("INSERT INTO profiles(id,name,preferences) VALUES(?1,'Existing','{}')",[&id]).unwrap();conn.execute("INSERT INTO goals(profile_id,id,data) VALUES(?1,'g',?2)",params![id,json!({"id":"g","name":"Legacy","progress":42}).to_string()]).unwrap();conn.execute("INSERT INTO profile_state(profile_id,key,value) VALUES(?1,'lifeos4.goalMilestones',?2)",params![id,json!([{"id":"m","goalId":"g","title":"Kept"}]).to_string()]).unwrap();drop(conn);
  let mut d=Database::open(&path,root.join("backups")).unwrap();let snapshot=d.snapshot(&id).unwrap();assert!(snapshot.data["lifeos4.goals"].contains("Legacy"));assert!(snapshot.data["lifeos4.goalMilestones"].contains("Kept"));assert_eq!(d.conn.query_row("SELECT COUNT(*) FROM schema_migrations",[],|r|r.get::<_,i64>(0)).unwrap(),6);
  let b=d.create_profile("Other",json!({})).unwrap();assert_eq!(d.snapshot(&b.id).unwrap().data["lifeos4.goalMilestones"],"[]");let backup=d.export(&id).unwrap();let copy=d.import_backup("Copy",backup).unwrap();assert_eq!(d.snapshot(&copy.id).unwrap().data,snapshot.data);
  drop(d);fs::remove_dir_all(root).unwrap();
 }
 #[test] fn schema_two_upgrades_schema_one_without_changing_its_checksum_or_data(){let root=std::env::temp_dir().join(format!("domos-upgrade-{}",Uuid::new_v4()));fs::create_dir_all(&root).unwrap();let path=root.join("test.sqlite");let mut conn=Connection::open(&path).unwrap();let sql=schema();apply_migrations(&mut conn,&[(1,sql.as_str())]).unwrap();let id=Uuid::new_v4().to_string();conn.execute("INSERT INTO profiles(id,name,preferences) VALUES(?1,'Existing','{}')",[&id]).unwrap();let checksum:String=conn.query_row("SELECT checksum FROM schema_migrations WHERE version=1",[],|r|r.get(0)).unwrap();drop(conn);let db=Database::open(&path,root.join("backups")).unwrap();assert_eq!(db.snapshot(&id).unwrap().profile.name,"Existing");assert_eq!(db.snapshot(&id).unwrap().data["lifeos4.assistantAudit"],"[]");let actual:String=db.conn.query_row("SELECT checksum FROM schema_migrations WHERE version=1",[],|r|r.get(0)).unwrap();assert_eq!(actual,checksum);drop(db);fs::remove_dir_all(root).unwrap();}
 #[test] fn backup_metadata_validation_never_changes_existing_profiles(){let (mut d,root)=db();let a=d.create_profile("Existing",json!({})).unwrap();let original=d.snapshot(&a.id).unwrap();let mut payload=d.export(&a.id).unwrap();payload["profiles"][0]["profile"]["preferences"]=json!([]);assert!(d.restore(&a.id,payload.clone()).is_err());assert!(d.import_backup("Copy",payload).is_err());let valid=d.export(&a.id).unwrap();assert!(d.import_backup(&"x".repeat(81),valid).is_err());assert_eq!(d.profiles().unwrap().len(),1);assert_eq!(d.snapshot(&a.id).unwrap().data,original.data);assert_eq!(d.snapshot(&a.id).unwrap().profile.name,"Existing");drop(d);fs::remove_dir_all(root).unwrap();}
 #[test] fn profile_metadata_and_state_are_atomic(){let (mut d,root)=db();let a=d.create_profile("Original",json!({"currency":"GBP"})).unwrap();let bad=BTreeMap::from([("lifeos4.tasks".into(),Some("invalid".into()))]);assert!(d.update_profile_with_state(&a.id,"Changed",json!({"currency":"EUR"}),0,bad).is_err());assert_eq!(d.snapshot(&a.id).unwrap().profile.name,"Original");d.update_profile_with_state(&a.id,"Changed",json!({"currency":"EUR"}),0,BTreeMap::from([("lifeos4.paydayDay".into(),Some("15".into()))])).unwrap();let snapshot=d.snapshot(&a.id).unwrap();assert_eq!(snapshot.profile.name,"Changed");assert_eq!(snapshot.data["lifeos4.paydayDay"],"15");assert_eq!(snapshot.profile.revision,1);drop(d);fs::remove_dir_all(root).unwrap();}
 #[test] fn initialized_profile_rolls_back_on_invalid_templates(){let (mut d,root)=db();let changes=BTreeMap::from([("lifeos4.tasks".into(),Some("[{\"id\":\"duplicate\"},{\"id\":\"duplicate\"}]".into()))]);assert!(d.create_initialized_profile("Fresh",json!({}),changes).is_err());assert!(d.profiles().unwrap().is_empty());let a=d.create_initialized_profile("Fresh",json!({"currency":"EUR"}),BTreeMap::from([("lifeos4.paydayDay".into(),Some("null".into()))])).unwrap();assert_eq!(d.snapshot(&a.id).unwrap().data["lifeos4.paydayDay"],"null");drop(d);fs::remove_dir_all(root).unwrap();}
 fn db()->(Database,PathBuf){let root=std::env::temp_dir().join(format!("domos-test-{}",Uuid::new_v4()));let db=Database::open(&root.join("test.sqlite"),root.join("backups")).unwrap();(db,root)}
 #[test] fn migration_is_transactional(){let mut c=Connection::open_in_memory().unwrap();assert!(apply_migrations(&mut c,&[(1,"CREATE TABLE first(id TEXT);"),(2,"INVALID SQL;")]).is_err());let n:i64=c.query_row("SELECT COUNT(*) FROM sqlite_master WHERE name='first'",[],|r|r.get(0)).unwrap();assert_eq!(n,0);assert!(apply_migrations(&mut c,&[(1,"CREATE TABLE first(id TEXT);")]).is_ok());assert!(apply_migrations(&mut c,&[(1,"CREATE TABLE altered(id TEXT);")]).is_err());}
 #[test] fn profiles_are_empty_isolated_and_durable(){let (mut d,root)=db();let a=d.create_profile("A",json!({})).unwrap();let b=d.create_profile("B",json!({})).unwrap();assert_ne!(a.id,b.id);valid_profile(&a.id).unwrap();d.commit(&a.id,0,BTreeMap::from([("lifeos4.tasks".into(),Some("[{\"id\":\"old-id\",\"title\":\"Only A\"}]".into()))])).unwrap();assert_eq!(d.snapshot(&b.id).unwrap().data["lifeos4.tasks"],"[]");assert!(d.commit(&a.id,0,BTreeMap::new()).is_err());drop(d);let reopened=Database::open(&root.join("test.sqlite"),root.join("backups")).unwrap();assert!(reopened.snapshot(&a.id).unwrap().data["lifeos4.tasks"].contains("Only A"));drop(reopened);fs::remove_dir_all(root).unwrap();}
 #[test] fn migration_preserves_records_state_unknown_keys_and_is_idempotent(){let (mut d,root)=db();let data=BTreeMap::from([("lifeos4.tasks".into(),"[{\"id\":\"t1\",\"title\":\"Keep\"}]".into()),("lifeos4.quickNote".into(),"\"keep note\"".into()),("unknown".into(),"not JSON".into())]);let r=d.import_legacy("Existing",data.clone()).unwrap();assert_eq!(r.counts["tasks"],1);assert!(Path::new(&r.backup_path).exists());assert_eq!(d.import_legacy("Existing",data).unwrap().profile_id,r.profile_id);assert_eq!(d.profiles().unwrap().len(),1);assert_eq!(d.snapshot(&r.profile_id).unwrap().data["unknown"],"not JSON");drop(d);fs::remove_dir_all(root).unwrap();}
 #[test] fn invalid_import_rolls_back_but_keeps_backup(){let (mut d,root)=db();assert!(d.import_legacy("Broken",BTreeMap::from([("lifeos4.tasks".into(),"[{\"id\":\"x\"},{\"id\":\"x\"}]".into())])).is_err());assert!(d.profiles().unwrap().is_empty());assert_eq!(fs::read_dir(root.join("backups")).unwrap().count(),1);drop(d);fs::remove_dir_all(root).unwrap();}
 #[test] fn failed_backup_prevents_import(){let (mut d,root)=db();fs::write(root.join("blocked"),"file").unwrap();d.backups=root.join("blocked").join("cannot-create");assert!(d.import_legacy("User",BTreeMap::new()).is_err());assert!(d.profiles().unwrap().is_empty());drop(d);fs::remove_dir_all(root).unwrap();}
 #[test] fn backup_round_trip_and_bad_restore_rollback(){let (mut d,root)=db();let a=d.create_profile("A",json!({})).unwrap();d.commit(&a.id,0,BTreeMap::from([("lifeos4.notes".into(),Some("[{\"id\":\"n1\",\"title\":\"saved\"}]".into()))])).unwrap();let backup=d.export(&a.id).unwrap();d.commit(&a.id,1,BTreeMap::from([("lifeos4.notes".into(),Some("[]".into()))])).unwrap();d.restore(&a.id,backup.clone()).unwrap();assert!(d.snapshot(&a.id).unwrap().data["lifeos4.notes"].contains("saved"));let before=d.snapshot(&a.id).unwrap().data;let mut bad=backup;bad["profiles"][0]["data"]["lifeos4.notes"]=json!("[{\"id\":\"bad'\"}]");assert!(d.restore(&a.id,bad).is_err());assert_eq!(d.snapshot(&a.id).unwrap().data,before);drop(d);fs::remove_dir_all(root).unwrap();}
 #[test] fn real_613_fixture_is_lossless_when_supplied(){
  let Ok(path)=std::env::var("DOMOS_MIGRATION_FIXTURE") else{return};
  let bytes=fs::read(path).unwrap();let payload:Value=serde_json::from_slice(&bytes).unwrap();let original:BTreeMap<String,String>=serde_json::from_value(payload["data"].clone()).unwrap();
  let (mut d,root)=db();let receipt=d.import_legacy("Migration test",original.clone()).unwrap();let snapshot=d.snapshot(&receipt.profile_id).unwrap();
  for (key,raw) in &original{if table_for(key).is_some(){assert_eq!(serde_json::from_str::<Value>(&snapshot.data[key]).unwrap(),serde_json::from_str::<Value>(raw).unwrap());}else{assert_eq!(&snapshot.data[key],raw);}}
  let backup=d.export(&receipt.profile_id).unwrap();let imported=d.import_backup("Copy",backup.clone()).unwrap();assert_ne!(imported.id,receipt.profile_id);assert_eq!(d.snapshot(&imported.id).unwrap().data,snapshot.data);
  d.restore(&receipt.profile_id,backup).unwrap();assert_eq!(d.snapshot(&receipt.profile_id).unwrap().data,snapshot.data);assert_eq!(fs::read(std::env::var("DOMOS_MIGRATION_FIXTURE").unwrap()).unwrap(),bytes);
  drop(d);fs::remove_dir_all(root).unwrap();
 }
}
