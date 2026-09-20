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
