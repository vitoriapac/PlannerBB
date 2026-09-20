const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../planner-core.js");

const assignment = (patch={}) => Object.assign({
  id:"plan-1", topicId:"banc-1", subjectId:"banc", date:"2026-09-10",
  plannedMinutes:90, status:"planned"
}, patch);
const session = (patch={}) => Object.assign({
  id:"session-1", planAssignmentId:"plan-1", topicId:"banc-1",
  subjectId:"banc", date:"2026-09-10", actualMinutes:90
}, patch);

test("plano perfeito tem 100% de aderência e débito zero", ()=>{
  const result = Core.evaluatePlan([assignment()], [session()], {todayISO:"2026-09-11"});
  assert.equal(result.adherencePct, 100);
  assert.equal(result.debtMinutes, 0);
});

test("sessão parcial gera dívida", ()=>{
  const result = Core.evaluatePlan([assignment({plannedMinutes:120})], [session({actualMinutes:75})], {todayISO:"2026-09-11"});
  assert.equal(result.adherencePct, 62.5);
  assert.equal(result.debtMinutes, 45);
  assert.equal(result.evaluations[0].result.derivedStatus, "partial");
});

test("estudo espontâneo aumenta carga, mas não aderência", ()=>{
  const spontaneous = session({planAssignmentId:null, actualMinutes:90});
  const result = Core.evaluatePlan([assignment()], [spontaneous], {todayISO:"2026-09-11"});
  assert.equal(result.loadPct, 100);
  assert.equal(result.adherencePct, 0);
  assert.equal(result.debtMinutes, 90);
  assert.equal(result.spontaneousMinutes, 90);
});

test("excesso em um assignment não compensa outro", ()=>{
  const assignments = [assignment({id:"plan-1"}), assignment({id:"plan-2", topicId:"port-1"})];
  const sessions = [session({planAssignmentId:"plan-1", actualMinutes:180})];
  const result = Core.evaluatePlan(assignments, sessions, {todayISO:"2026-09-11"});
  assert.equal(result.adherencePct, 50);
  assert.equal(result.debtMinutes, 90);
});

test("tolerância considera 87 de 90 minutos como concluído", ()=>{
  const result = Core.evaluateAssignment(assignment(), [session({actualMinutes:87})], {todayISO:"2026-09-11"});
  assert.equal(result.derivedStatus, "completed");
  assert.equal(result.missingMinutes, 0);
  assert.equal(result.adherencePct, 100);
});

test("sessões antigas em horas continuam compatíveis", ()=>{
  assert.equal(Core.sessionMinutes({hours:1.5}), 90);
});

test("migração preserva dados e formaliza sessões e assignments", ()=>{
  const oldState = {
    sessions:[{id:"old", hours:1.5}],
    planAssignments:[{id:"plan-old", date:"2026-09-10", plannedMinutes:90}]
  };
  const migrated = Core.migrateState(oldState, 3);
  assert.equal(migrated.stateVersion, 3);
  assert.equal(migrated.sessions[0].actualMinutes, 90);
  assert.equal(migrated.sessions[0].planAssignmentId, null);
  assert.equal(migrated.planAssignments[0].source, "automatic");
  assert.equal(migrated.planAssignments[0].originalDate, "2026-09-10");
  assert.deepEqual(migrated.rescheduleHistory, []);
});

test("replanner divide dívida entre dias sem ultrapassar capacidade", ()=>{
  const proposal = Core.generateReplanProposal({
    todayISO:"2026-09-20", firstFutureDate:"2026-09-21", examDate:"2026-09-24",
    availability:{mon:30,tue:30,wed:30},
    assignments:[assignment({date:"2026-09-19", plannedMinutes:75})], sessions:[],
    createdAt:"2026-09-20T12:00:00.000Z"
  });
  assert.equal(proposal.feasible, true);
  assert.deepEqual(proposal.operations.map(o=>o.minutes), [30,30,15]);
  assert.equal(proposal.scheduledMinutes, 75);
});

test("replanner preserva capacidade já comprometida", ()=>{
  const proposal = Core.generateReplanProposal({
    todayISO:"2026-09-20", firstFutureDate:"2026-09-21", examDate:"2026-09-23",
    availability:{mon:60,tue:60},
    assignments:[
      assignment({id:"missed", date:"2026-09-19", plannedMinutes:90}),
      assignment({id:"future", date:"2026-09-21", plannedMinutes:45})
    ], sessions:[]
  });
  assert.deepEqual(proposal.operations.map(o=>[o.to,o.minutes]), [["2026-09-21",15],["2026-09-22",60]]);
  assert.equal(proposal.remainingDebtMinutes, 15);
  assert.equal(proposal.feasible, false);
});

test("detector de viabilidade inclui conteúdo, dívida, revisões e compromissos", ()=>{
  const result = Core.analyzeFeasibility({contentMinutes:100,debtMinutes:20,reviewMinutes:30,committedMinutes:50,availableMinutes:180});
  assert.equal(result.neededMinutes, 200);
  assert.equal(result.marginMinutes, -20);
  assert.equal(result.level, "infeasible");
});

test("replanner não agenda duas vezes dívida já coberta por recuperação", ()=>{
  const proposal=Core.generateReplanProposal({
    todayISO:"2026-09-20",firstFutureDate:"2026-09-21",examDate:"2026-09-25",
    availability:{mon:120,tue:120,wed:120,thu:120},
    assignments:[
      assignment({id:"original",date:"2026-09-19",plannedMinutes:60}),
      assignment({id:"recovery",date:"2026-09-21",plannedMinutes:60,kind:"recovery",sourceAssignmentId:"original"})
    ],sessions:[]
  });
  assert.equal(proposal.debtMinutes,0);
  assert.equal(proposal.operations.length,0);
});

test("conteúdo maior que o dia é dividido sem perda de minutos", ()=>{
  assert.deepEqual(Core.splitIntoBlocks(155,60),[60,60,35]);
  assert.equal(Core.splitIntoBlocks(155,60).reduce((a,b)=>a+b,0),155);
});
