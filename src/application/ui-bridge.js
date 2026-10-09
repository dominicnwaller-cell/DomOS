export function installUIBridge(services,commandBar,profileId){
 const context={profileId};
 window.DOMOSActions={services,applyUIChanges:(explicitContext,changes)=>services.applyUIChanges(explicitContext,changes),performUI:(explicitContext,request)=>services.performUI(explicitContext,request),requestUI:request=>commandBar.requestUI(request)};
 for(const [name,collection,selector] of [['openTask','tasks','#drawer'],['openEvent','events','#drawer'],['openCalendarTemplate','calendarTemplates','#drawer'],['openFinanceAccount','financeAccounts','#drawer'],['openTransaction','transactions','#drawer'],['openFinanceBudget','financeBudgets','#drawer'],['openFinanceBill','financeBills','#drawer'],['openFinanceSaving','financeSavings','#drawer'],['openGoal','goals','#goalModal'],['openRoutine','routines','#routineModal']]){
  const original=window[name];if(typeof original!=='function')continue;window[name]=function(id,...args){const result=original(id,...args),editor=document.querySelector(selector);if(editor){editor.dataset.entityCollection=collection;editor.dataset.entityId=id||''}return result};
 }
 window.eval(`
 deleteTask=function(id){window.DOMOSActions.requestUI({action:'task.delete',id})};
 deleteEvent=function(id){window.DOMOSActions.requestUI({action:'event.delete',id})};
 deleteCalendarTemplate=function(id){window.DOMOSActions.requestUI({action:'record.delete',collection:'calendarTemplates',id})};
 deleteFinanceAccount=function(id){window.DOMOSActions.requestUI({action:'record.delete',collection:'financeAccounts',id})};
 deleteNote=function(id){window.DOMOSActions.requestUI({action:'record.delete',collection:'notes',id})};
 deleteGoal=function(){if(editingGoalId)window.DOMOSActions.requestUI({action:'record.delete',collection:'goals',id:editingGoalId})};
 deleteCurrentRoutine=function(){if(editingRoutineId)window.DOMOSActions.requestUI({action:'record.delete',collection:'routines',id:editingRoutineId})};
 deleteFinanceRecord=function(collection,id){window.DOMOSActions.requestUI({action:'record.delete',collection,id})};
 `);
 return context;
}
