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

test("aderência conta assignments concluídos, parciais e perdidos",()=>{
  const assignments=[
    assignment({id:"done",plannedMinutes:60}),
    assignment({id:"partial",topicId:"banc-2",plannedMinutes:60}),
    assignment({id:"missed",topicId:"banc-3",plannedMinutes:60})
  ];
  const sessions=[
    session({id:"s1",planAssignmentId:"done",actualMinutes:60}),
    session({id:"s2",planAssignmentId:"partial",actualMinutes:30})
  ];
  const result=Core.evaluatePlan(assignments,sessions,{todayISO:"2026-09-11"});
  assert.deepEqual(result.assignmentCounts,{completed:1,partial:1,missed:1,planned:0});
});

test("duas sessões completam o mesmo assignment",()=>{
  const sessions=[session({id:"s1",actualMinutes:30}),session({id:"s2",actualMinutes:60})];
  const result=Core.evaluateAssignment(assignment(),sessions,{todayISO:"2026-09-11"});
  assert.equal(result.completedMinutes,90);
  assert.equal(result.derivedStatus,Core.PLAN_EXECUTION_STATUS.COMPLETED);
});

test("StudyDebt detalha dívida e desconta recuperação futura",()=>{
  const assignments=[
    assignment({id:"original",plannedMinutes:90}),
    assignment({id:"recovery",date:"2026-09-12",plannedMinutes:30,kind:"recovery",sourceAssignmentId:"original"})
  ];
  const debt=Core.calculateStudyDebt(assignments,[session({planAssignmentId:"original",actualMinutes:30})],{todayISO:"2026-09-11"});
  assert.equal(debt.totalMinutes,30);
  assert.equal(debt.grossMinutes,60);
  assert.equal(debt.assignments[0].coveredByRecoveryMinutes,30);
});

test("replanner prioriza assignment parcial antes do perdido",()=>{
  const assignments=[
    assignment({id:"missed",topicId:"banc-1",subjectId:"banc",plannedMinutes:60}),
    assignment({id:"partial",topicId:"mat-1",subjectId:"mat",plannedMinutes:60})
  ];
  const proposal=Core.generateReplanProposal({
    todayISO:"2026-09-11",firstFutureDate:"2026-09-12",examDate:"2026-09-13",
    availability:{sat:30},assignments,
    sessions:[session({planAssignmentId:"partial",topicId:"mat-1",subjectId:"mat",actualMinutes:30})]
  });
  assert.equal(proposal.operations[0].sourceAssignmentId,"partial");
});

test("replanner respeita máximo de disciplinas e conflitos",()=>{
  const assignments=[
    assignment({id:"existing",date:"2026-09-12",subjectId:"port",topicId:"port-1",plannedMinutes:30}),
    assignment({id:"missed",date:"2026-09-10",subjectId:"info",topicId:"info-1",plannedMinutes:30})
  ];
  const proposal=Core.generateReplanProposal({
    todayISO:"2026-09-11",firstFutureDate:"2026-09-12",examDate:"2026-09-14",
    availability:{sat:60,sun:60},assignments,sessions:[],
    preferences:{maxSubjectsPerDay:1,conflictPairs:[["port","info"]]}
  });
  const recovery=proposal.operations.find(operation=>operation.type==="create_recovery_assignment");
  assert.equal(recovery.to,"2026-09-13");
  assert.equal(proposal.guarantees.maxSubjectsPerDayRespected,true);
  assert.equal(proposal.guarantees.subjectConflictsRespected,true);
});

test("revisão vencida ocupa capacidade antes da dívida",()=>{
  const proposal=Core.generateReplanProposal({
    todayISO:"2026-09-11",firstFutureDate:"2026-09-12",examDate:"2026-09-14",
    availability:{sat:60,sun:60},
    assignments:[assignment({id:"missed",date:"2026-09-10",plannedMinutes:60})],sessions:[],
    reviews:[{id:"banc-2",subjectId:"banc",reviewStage:1,nextReviewDate:"2026-09-10",estimatedMinutes:30}],
    preferences:{reservedReviewDays:["sun"],maxReviewCapacityPct:.5,reviewEstimatedMinutes:30}
  });
  assert.equal(proposal.operations[0].type,"create_review_assignment");
  assert.equal(proposal.operations[0].to,"2026-09-13");
  assert.equal(proposal.scheduledReviewMinutes,30);
  assert.ok(proposal.operations.every(operation=>operation.reasons.length>0&&operation.constraintsSatisfied.length>0));
});

test("aceitação: dois dias ruins e revisões vencidas geram recuperação segura",()=>{
  const assignments=[
    assignment({id:"monday",date:"2026-09-07",plannedMinutes:120}),
    assignment({id:"tuesday",date:"2026-09-08",topicId:"banc-2",plannedMinutes:60})
  ];
  const snapshot=JSON.parse(JSON.stringify(assignments));
  const proposal=Core.generateReplanProposal({
    todayISO:"2026-09-09",firstFutureDate:"2026-09-10",examDate:"2026-09-14",
    availability:{thu:120,fri:120,sat:120,sun:0},assignments,
    sessions:[session({planAssignmentId:"monday",actualMinutes:45})],
    reviews:[
      {id:"banc-review-1",subjectId:"banc",reviewStage:1,nextReviewDate:"2026-09-07",estimatedMinutes:30},
      {id:"banc-review-2",subjectId:"banc",reviewStage:2,nextReviewDate:"2026-09-08",estimatedMinutes:30}
    ],
    scoreByTopic:{"banc-2":95},reasonsByTopic:{"banc-2":["Baixo aproveitamento em Conhecimentos Bancários"]},
    preferences:{maxSubjectsPerDay:3,maxReviewCapacityPct:.5,reviewEstimatedMinutes:30}
  });
  assert.equal(proposal.debtMinutes,135);
  assert.equal(proposal.operations[0].type,"create_review_assignment");
  assert.equal(proposal.scheduledReviewMinutes,60);
  assert.equal(proposal.scheduledMinutes,135);
  assert.equal(proposal.feasible,true);
  assert.equal(proposal.guarantees.dailyCapacityRespected,true);
  assert.ok(proposal.operations.some(operation=>operation.reasons.some(reason=>/Baixo aproveitamento/.test(reason))));
  assert.deepEqual(assignments,snapshot,"a proposta não pode alterar o histórico original");
  const usedByDay=proposal.operations.reduce((map,operation)=>{
    map[operation.to]=(map[operation.to]||0)+operation.minutes; return map;
  },{});
  assert.ok(Object.values(usedByDay).every(minutes=>minutes<=120));
});
