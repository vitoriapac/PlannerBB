const test=require("node:test");
const assert=require("node:assert/strict");
const {performance}=require("node:perf_hooks");
const Core=require("../planner-core.js");
const Stress=require("../stress-fixtures.js");

test("fixture determinística cobre 150 dias e centenas de registros",()=>{
  const first=Stress.generate();
  const second=Stress.generate();
  assert.equal(first.days,150);
  assert.equal(first.assignments.length,300);
  assert.equal(first.sessions.length,320);
  assert.equal(first.mockExams.length,10);
  assert.equal(first.rescheduleHistory.length,6);
  assert.deepEqual(first,second);
});

test("presets representam rotinas equilibrada, irregular, crítica e de longo prazo",()=>{
  const balanced=Stress.generate("balanced");
  const irregular=Stress.generate("irregular");
  const critical=Stress.generate("critical");
  const longTerm=Stress.generate("longTerm");
  assert.ok(balanced.sessions.length>critical.sessions.length);
  assert.ok(irregular.sessions.length<balanced.sessions.length);
  assert.equal(longTerm.days,365);
  assert.equal(longTerm.sessions.length,820);
  assert.deepEqual(critical,Stress.generate("critical"));
});

test("cenário crítico produz aderência inferior ao equilibrado",()=>{
  const evaluate=fixture=>Core.evaluatePlan(fixture.assignments,fixture.sessions,{
    startISO:fixture.startISO,endISO:"2026-06-30",todayISO:"2026-06-30"
  });
  const balanced=evaluate(Stress.generate("balanced"));
  const critical=evaluate(Stress.generate("critical"));
  assert.ok(critical.adherencePct<balanced.adherencePct);
  assert.ok(critical.debtMinutes>balanced.debtMinutes);
});

test("motores processam cenário de estresse sem inconsistência",()=>{
  const fixture=Stress.generate();
  const started=performance.now();
  const metrics=Core.evaluatePlan(fixture.assignments,fixture.sessions,{
    startISO:"2026-01-05",endISO:"2026-06-30",todayISO:"2026-06-30"
  });
  const proposal=Core.generateReplanProposal({
    todayISO:"2026-06-01",firstFutureDate:"2026-06-02",examDate:"2026-07-01",
    availability:{mon:180,tue:180,wed:180,thu:180,fri:180,sat:120,sun:0},
    assignments:fixture.assignments,sessions:fixture.sessions
  });
  const elapsed=performance.now()-started;
  assert.ok(metrics.plannedMinutes>0);
  assert.ok(metrics.totalStudyMinutes>0);
  assert.ok(proposal.operations.every(operation=>operation.minutes>0));
  assert.ok(elapsed<2000,`cenário levou ${elapsed.toFixed(1)} ms`);
});

test("LONG_TERM_CHAOTIC preserva invariantes durante 150 dias",()=>{
  const fixture=Stress.generate("longTermChaotic");
  assert.equal(fixture.days,150);
  assert.ok(fixture.events.some(event=>event.type==="availability_change"));
  assert.ok(fixture.events.some(event=>event.type==="exam_anticipated"));
  let availability=fixture.availability;
  let examDate=fixture.examDate;
  let sessions=[];
  for(let day=0;day<fixture.days;day++){
    const todayISO=Core.addDays(fixture.startISO,day);
    sessions=fixture.sessions.filter(session=>session.date<=todayISO).map(session=>Object.assign({},session));
    fixture.events.filter(event=>event.day<=day).forEach(event=>{
      if(event.type==="availability_change") availability=event.availability;
      if(event.type==="exam_anticipated") examDate=event.examDate;
      if(event.type==="retroactive_edit"){
        const target=sessions.find(session=>session.id===event.sessionId); if(target) target.actualMinutes=event.actualMinutes;
      }
      if(event.type==="session_deleted") sessions=sessions.filter(session=>session.id!==event.sessionId);
    });
    const metrics=Core.evaluatePlan(fixture.assignments,sessions,{startISO:fixture.startISO,endISO:todayISO,todayISO});
    assert.ok(metrics.debtMinutes>=0,"dívida nunca pode ser negativa");
    assert.ok(metrics.evaluations.every(item=>item.result.missingMinutes>=0));
    const sessionAssignmentIds=new Set(fixture.assignments.map(item=>item.id));
    assert.ok(sessions.filter(session=>session.planAssignmentId).every(session=>sessionAssignmentIds.has(session.planAssignmentId)),"sessão não pode ficar órfã");
    if(Core.addDays(todayISO,1)>=examDate) continue;
    const proposal=Core.generateReplanProposal({
      todayISO,firstFutureDate:Core.addDays(todayISO,1),examDate,availability,
      assignments:fixture.assignments,sessions,reviews:fixture.reviews,
      preferences:{maxSubjectsPerDay:4,maxReviewCapacityPct:.4,allowOverdueReviewOverflow:false}
    });
    const recoveryKeys=proposal.operations.filter(operation=>operation.type==="create_recovery_assignment").map(operation=>`${operation.sourceAssignmentId}|${operation.to}`);
    const reviewKeys=proposal.operations.filter(operation=>operation.type==="create_review_assignment").map(operation=>`${operation.topicId}|${operation.reviewStage}|${operation.reviewDueDate}|${operation.to}`);
    assert.equal(new Set(recoveryKeys).size,recoveryKeys.length,"recovery duplicado");
    assert.equal(new Set(reviewKeys).size,reviewKeys.length,"revisão duplicada");
    const ledger=Core.buildCapacityLedger(fixture.assignments,availability,Core.addDays(todayISO,1),examDate);
    const baseline=Object.fromEntries(Object.values(ledger).map(row=>[row.date,row.committedMinutes]));
    proposal.operations.forEach(operation=>{
      assert.ok(operation.minutes>0);
      assert.ok(ledger[operation.to],"operação deve apontar para um dia válido");
      ledger[operation.to].committedMinutes+=operation.minutes;
    });
    Object.values(ledger).forEach(row=>assert.ok(
      row.committedMinutes<=Math.max(row.capacityMinutes,baseline[row.date]),
      "replanner não pode aumentar excesso de capacidade previamente detectado"
    ));
  }
});
