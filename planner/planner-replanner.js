(function(root,factory){
  const core=typeof module==="object"&&module.exports?require("../planner-core.js"):root.BBPlannerCore;
  const api=factory(core);
  if(typeof module==="object"&&module.exports) module.exports=api;
  if(root) root.BBPlannerReplanner=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(core){
  "use strict";
  return Object.freeze({
    generateReplanProposal:core.generateReplanProposal,
    applyReplanProposal:core.applyReplanProposal,
    calculateChangeCost:core.calculateChangeCost,
    calculatePlanStability:core.calculatePlanStability
  });
});
