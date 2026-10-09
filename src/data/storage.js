// Compatibility surface for the existing features, backed by an acknowledged
// SQLite revision. There is deliberately no localStorage fallback.
export const storage={
 get length(){return window.DOMOSStorage?.length||0},
 key:i=>window.DOMOSStorage?.key(i)??null,
 getItem:k=>window.DOMOSStorage?.getItem(k)??null,
 setItem:(k,v)=>{if(!window.DOMOSStorage)throw new Error('Open a profile before saving');window.DOMOSStorage.setItem(k,v)},
 removeItem:k=>{if(!window.DOMOSStorage)throw new Error('Open a profile before saving');window.DOMOSStorage.removeItem(k)}
};

export class ProfileStorage {
 constructor(snapshot,commit,onStatus=()=>{}){
  this.profile=snapshot.profile;this.values=new Map(Object.entries(snapshot.data));this.commit=commit;this.onStatus=onStatus;this.pending=new Map();this.running=null;this.failure=null;
 }
 get length(){return this.values.size}
 key(i){return [...this.values.keys()][i]??null}
 getItem(k){return this.values.get(k)??null}
 setItem(k,v){if(this.failure)throw new Error('Saving is paused after an error. Export recovery data or retry.');v=String(v);if(this.getItem(k)===v)return;this.values.set(k,v);this.pending.set(k,v);this.schedule()}
 removeItem(k){if(this.failure)throw this.failure;if(!this.values.has(k))return;this.values.delete(k);this.pending.set(k,null);this.schedule()}
 schedule(){this.onStatus('pending');if(!this.running){this.running=Promise.resolve().then(()=>this.flushLoop()).finally(()=>{this.running=null});this.running.catch(()=>{});}}
 async flushLoop(){
  try{while(this.pending.size){const changes=Object.fromEntries(this.pending);this.pending.clear();this.profile.revision=await this.commit(this.profile.id,this.profile.revision,changes);}this.onStatus('saved');}
  catch(error){this.failure=error instanceof Error?error:new Error(String(error));this.onStatus('error',this.failure);throw this.failure}
 }
 async flush(){if(this.running)await this.running;if(this.failure)throw this.failure}
 async acceptSnapshot(snapshot){await this.flush();if(snapshot.profile.id!==this.profile.id)throw new Error('Snapshot belongs to another profile');if(snapshot.profile.revision<this.profile.revision||this.pending.size||this.running)return null;const previous=this.values;this.values=new Map(Object.entries(snapshot.data));this.profile=snapshot.profile;return previous}
 recovery(){if(this.failedRecovery)return this.failedRecovery;return {format:'DOM.OS Unsaved Recovery',version:1,profile:this.profile,data:Object.fromEntries(this.values)}}
}
