(function(root,factory){
  const core=typeof module==="object"&&module.exports?require("../planner-core.js"):root.BBPlannerCore;
  const api=factory(core);
  if(typeof module==="object"&&module.exports) module.exports=api;
  if(root) root.BBPlannerCapacity=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(core){
  "use strict";
  return Object.freeze({
    addDays:core.addDays,
    dayKeyFromISO:core.dayKeyFromISO,
    buildCapacityLedger:core.buildCapacityLedger,
    analyzePlanImpact:core.analyzePlanImpact,
    splitIntoBlocks:core.splitIntoBlocks
  });
});
