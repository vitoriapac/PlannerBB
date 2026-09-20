const test=require("node:test");
const assert=require("node:assert/strict");
const Core=require("../planner-core.js");
const StorageModule=require("../planner-storage.js");
const Export=require("../planner-export.js");

function memoryStorage(){
  const values=new Map();
  return {
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key)
  };
}

test("persistência salva, carrega e migra estado antigo",()=>{
  const backend=memoryStorage();
  backend.setItem("planner",JSON.stringify({sessions:[{hours:1}],planAssignments:[],items:{},mockExams:[]}));
  const storage=StorageModule.create({key:"planner",version:4,backend,migrate:Core.migrateState});
  const state=storage.load();
  assert.equal(state.stateVersion,4);
  assert.equal(state.sessions[0].actualMinutes,60);
  assert.equal(storage.save(state),true);
  assert.equal(JSON.parse(backend.getItem("planner")).stateVersion,4);
});

test("backup completo é validado e não compartilha referências",()=>{
  const source={stateVersion:4,items:{a:{status:"finalizado"}},sessions:[],mockExams:[],planAssignments:[],rescheduleHistory:[],settings:{}};
  const backup=Export.buildBackup({stateVersion:4,state:source,config:{examDate:"2027-02-21"},exportedAt:"2026-09-20T12:00:00.000Z"});
  assert.equal(Export.validateBackup(backup).valid,true);
  source.items.a.status="nao_iniciado";
  assert.equal(backup.state.items.a.status,"finalizado");
});

test("backup inválido retorna mensagens úteis",()=>{
  const result=Export.validateBackup({schema:"desconhecido",schemaVersion:4,state:{}});
  assert.equal(result.valid,false);
  assert.ok(result.errors.length>=4);
});

test("backup de versão futura é recusado com segurança",()=>{
  const result=Export.validateBackup({
    schema:Export.BACKUP_SCHEMA,schemaVersion:999,
    state:{items:{},sessions:[],mockExams:[],planAssignments:[]}
  });
  assert.equal(result.valid,false);
  assert.match(result.errors.join(" "),/versão mais nova/i);
});

test("intercâmbio v4 inclui planejamento, revisões e metadados",()=>{
  const payload=Export.buildInterchange({
    exportedAt:"2026-09-20T12:00:00.000Z",exportId:"export-test",
    exam:{examDate:"2027-02-21"},subjects:[],topics:[],studySessions:[],mockExams:[],
    assignments:[{id:"plan-1"}],rescheduleHistory:[{id:"history-1"}],dailyAvailability:{mon:60},
    preferences:{maxSubjectsPerDay:3},reviews:{intervalsDays:[1,3]},progress:{global:{pct:0}}
  });
  assert.equal(payload.schema,"bb-study-planner-interchange");
  assert.equal(payload.schemaVersion,4);
  assert.equal(payload.planning.assignments.length,1);
  assert.equal(payload.planning.rescheduleHistory.length,1);
  assert.deepEqual(payload.reviews.intervalsDays,[1,3]);
});
