(function(root,factory){
  const core=typeof module==="object"&&module.exports?require("../planner-core.js"):root.BBPlannerCore;
  const api=factory(core);
  if(typeof module==="object"&&module.exports) module.exports=api;
  if(root) root.BBPlannerMetrics=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(core){
  "use strict";
  return Object.freeze({
    sessionMinutes:core.sessionMinutes,
    sessionsForAssignment:core.sessionsForAssignment,
    evaluateAssignment:core.evaluateAssignment,
    evaluatePlan:core.evaluatePlan,
    calculateStudyDebt:core.calculateStudyDebt,
    reconcileRecoveries:core.reconcileRecoveries,
    calculatePlanStability:core.calculatePlanStability
  });
});
