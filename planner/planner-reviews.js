(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  if(root) root.BBPlannerReviews=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  function reviewKey(review){
    return [review.id||review.topicId,review.reviewStage,review.nextReviewDate||review.reviewDueDate].join("|");
  }
  function pendingReviews(reviews,todayISO,assignments){
    const scheduled=new Set((assignments||[]).filter(item=>item.status!=="cancelled"&&item.kind==="review")
      .map(item=>[item.topicId,item.reviewStage,item.reviewDueDate].join("|")));
    return (reviews||[]).filter(review=>(review.nextReviewDate||"")<=todayISO&&!scheduled.has(reviewKey(review)));
  }
  return Object.freeze({reviewKey,pendingReviews});
});
