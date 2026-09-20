(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  if(root) root.BBPlannerExport=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const BACKUP_SCHEMA="bb-study-planner-backup";
  const INTERCHANGE_SCHEMA="bb-study-planner-interchange";
  const SCHEMA_VERSION=5;

  function clone(value){ return JSON.parse(JSON.stringify(value)); }

  function buildBackup(input){
    return {
      schema:BACKUP_SCHEMA,
      schemaVersion:SCHEMA_VERSION,
      plannerVersion:input.plannerVersion||"2.0.0",
      exportedAt:input.exportedAt||new Date().toISOString(),
      stateVersion:input.stateVersion,
      state:clone(input.state),
      config:clone(input.config||{})
    };
  }

  function validateBackup(payload){
    const errors=[];
    if(!payload||typeof payload!=="object") errors.push("Arquivo JSON inválido.");
    else {
      if(payload.schema!==BACKUP_SCHEMA) errors.push("Schema de backup não reconhecido.");
      if(!Number.isInteger(payload.schemaVersion)||payload.schemaVersion<1) errors.push("Versão de schema inválida.");
      else if(payload.schemaVersion>SCHEMA_VERSION) errors.push("Backup criado por uma versão mais nova do Planner.");
      if(!payload.state||typeof payload.state!=="object") errors.push("Estado do planner ausente.");
      else {
        if(!payload.state.items||typeof payload.state.items!=="object") errors.push("Tópicos ausentes.");
        ["sessions","mockExams","planAssignments"].forEach(field=>{
          if(!Array.isArray(payload.state[field])) errors.push(`Campo ${field} inválido.`);
        });
      }
    }
    return {valid:errors.length===0,errors};
  }

  function buildInterchange(input){
    return {
      schema:INTERCHANGE_SCHEMA,
      schemaVersion:SCHEMA_VERSION,
      source:"BB Study Planner",
      plannerVersion:input.plannerVersion||"2.0.0",
      exportedAt:input.exportedAt||new Date().toISOString(),
      exportId:input.exportId||("export_"+Date.now()),
      exam:clone(input.exam),
      subjects:clone(input.subjects),
      topics:clone(input.topics),
      studySessions:clone(input.studySessions),
      mockExams:clone(input.mockExams),
      planning:{
        assignments:clone(input.assignments||[]),
        rescheduleHistory:clone(input.rescheduleHistory||[]),
        dailyAvailability:clone(input.dailyAvailability||{}),
        preferences:clone(input.preferences||{}),
        summary:clone(input.planningSummary||{})
      },
      reviews:clone(input.reviews||{}),
      progress:clone(input.progress||{})
    };
  }

  function downloadJSON(payload,fileName,documentRef,URLRef){
    const doc=documentRef||document;
    const urlApi=URLRef||URL;
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url=urlApi.createObjectURL(blob);
    const anchor=doc.createElement("a");
    anchor.href=url; anchor.download=fileName; doc.body.appendChild(anchor); anchor.click(); anchor.remove();
    urlApi.revokeObjectURL(url);
  }

  return {BACKUP_SCHEMA,INTERCHANGE_SCHEMA,SCHEMA_VERSION,buildBackup,validateBackup,buildInterchange,downloadJSON};
});
