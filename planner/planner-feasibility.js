(function(root,factory){
  const core=typeof module==="object"&&module.exports?require("../planner-core.js"):root.BBPlannerCore;
  const api=factory(core);
  if(typeof module==="object"&&module.exports) module.exports=api;
  if(root) root.BBPlannerFeasibility=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(core){
  "use strict";
  return Object.freeze({
    analyzeFeasibility:core.analyzeFeasibility,
    suggestFeasibilityAdjustments:core.suggestFeasibilityAdjustments
  });
});
