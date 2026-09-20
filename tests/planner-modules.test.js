const test=require("node:test");
const assert=require("node:assert/strict");
const Core=require("../planner-core.js");
const Metrics=require("../planner/planner-metrics.js");
const Capacity=require("../planner/planner-capacity.js");
const Replanner=require("../planner/planner-replanner.js");
const Reviews=require("../planner/planner-reviews.js");
const Feasibility=require("../planner/planner-feasibility.js");

test("módulos de domínio preservam o contrato da fachada Core",()=>{
  assert.equal(Metrics.evaluatePlan,Core.evaluatePlan);
  assert.equal(Capacity.buildCapacityLedger,Core.buildCapacityLedger);
  assert.equal(Replanner.generateReplanProposal,Core.generateReplanProposal);
  assert.equal(Feasibility.analyzeFeasibility,Core.analyzeFeasibility);
});

test("módulo de revisões elimina itens já agendados",()=>{
  const reviews=[{id:"topic",reviewStage:1,nextReviewDate:"2026-09-10"}];
  const assignments=[{topicId:"topic",reviewStage:1,reviewDueDate:"2026-09-10",kind:"review",status:"planned"}];
  assert.deepEqual(Reviews.pendingReviews(reviews,"2026-09-11",assignments),[]);
  assert.equal(Reviews.pendingReviews(reviews,"2026-09-11",[]).length,1);
});
