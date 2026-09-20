(function(root, factory){
  const api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  if(root) root.BBPlannerCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  const COMPLETION_TOLERANCE = Object.freeze({ minutes: 5, ratio: 0.95 });
  const PLAN_LIFECYCLE_STATUS = Object.freeze({
    PLANNED:"planned", RESCHEDULED:"rescheduled", CANCELLED:"cancelled"
  });
  const PLAN_EXECUTION_STATUS = Object.freeze({
    NOT_STARTED:"not_started", PLANNED:"planned", PARTIAL:"partial",
    COMPLETED:"completed", MISSED:"missed", CANCELLED:"cancelled"
  });

  function numberOrZero(value){
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function sessionMinutes(session){
    if(!session) return 0;
    if(session.actualMinutes !== undefined && session.actualMinutes !== null){
      return Math.round(numberOrZero(session.actualMinutes));
    }
    return Math.round(numberOrZero(session.hours) * 60);
  }

  function sessionsForAssignment(assignmentId, sessions){
    if(!assignmentId) return [];
    return (sessions || []).filter(session => session.planAssignmentId === assignmentId);
  }

  function migrateState(saved, targetVersion){
    if(!saved || typeof saved !== "object") return null;
    const migrated = saved;
    (migrated.sessions || []).forEach(session=>{
      if(session.actualMinutes === undefined) session.actualMinutes = sessionMinutes(session);
      if(session.planAssignmentId === undefined) session.planAssignmentId = null;
    });
    (migrated.planAssignments || []).forEach(assignment=>{
      assignment.kind = assignment.kind || "content";
      assignment.source = assignment.source || "automatic";
      assignment.originalDate = assignment.originalDate || assignment.date;
      assignment.rescheduleCount = Number(assignment.rescheduleCount)||0;
    });
    migrated.rescheduleHistory = migrated.rescheduleHistory || [];
    migrated.stateVersion = targetVersion;
    return migrated;
  }

  function evaluateAssignment(assignment, sessions, options){
    options = options || {};
    const tolerance = Object.assign({}, COMPLETION_TOLERANCE, options.tolerance || {});
    const plannedMinutes = Math.max(0, Math.round(numberOrZero(assignment && assignment.plannedMinutes)));
    const linkedSessions = sessionsForAssignment(assignment && assignment.id, sessions);
    const completedMinutes = linkedSessions.reduce((sum, session)=> sum + sessionMinutes(session), 0);
    const missingMinutes = Math.max(plannedMinutes - completedMinutes, 0);
    const completionRatio = plannedMinutes ? completedMinutes / plannedMinutes : 0;
    const withinTolerance = plannedMinutes > 0 && (
      missingMinutes <= numberOrZero(tolerance.minutes) ||
      completionRatio >= numberOrZero(tolerance.ratio)
    );
    const creditedMinutes = withinTolerance
      ? plannedMinutes
      : Math.min(completedMinutes, plannedMinutes);
    const todayISO = options.todayISO || new Date().toISOString().slice(0, 10);

    let derivedStatus = PLAN_EXECUTION_STATUS.NOT_STARTED;
    if(assignment && assignment.status === PLAN_LIFECYCLE_STATUS.CANCELLED) derivedStatus = PLAN_EXECUTION_STATUS.CANCELLED;
    else if(completedMinutes >= plannedMinutes && plannedMinutes > 0 || withinTolerance) derivedStatus = PLAN_EXECUTION_STATUS.COMPLETED;
    else if(completedMinutes > 0) derivedStatus = PLAN_EXECUTION_STATUS.PARTIAL;
    else if(assignment && assignment.date < todayISO) derivedStatus = PLAN_EXECUTION_STATUS.MISSED;
    else derivedStatus = PLAN_EXECUTION_STATUS.PLANNED;

    return {
      plannedMinutes,
      completedMinutes,
      creditedMinutes,
      missingMinutes: derivedStatus === "completed" ? 0 : missingMinutes,
      loadPct: plannedMinutes ? Math.round((completedMinutes / plannedMinutes) * 1000) / 10 : null,
      adherencePct: plannedMinutes ? Math.round((creditedMinutes / plannedMinutes) * 1000) / 10 : null,
      derivedStatus,
      linkedSessionCount: linkedSessions.length
    };
  }

  function evaluatePlan(assignments, sessions, options){
    options = options || {};
    const todayISO = options.todayISO || new Date().toISOString().slice(0, 10);
    const startISO = options.startISO || "0000-01-01";
    const endISO = options.endISO && options.endISO < todayISO ? options.endISO : todayISO;
    const considered = (assignments || []).filter(assignment =>
      assignment.status !== "cancelled" && assignment.date >= startISO && assignment.date <= endISO
    );
    const evaluations = considered.map(assignment => ({
      assignment,
      result: evaluateAssignment(assignment, sessions, {todayISO, tolerance:options.tolerance})
    }));
    const plannedMinutes = evaluations.reduce((sum, item)=> sum + item.result.plannedMinutes, 0);
    const linkedMinutes = evaluations.reduce((sum, item)=> sum + item.result.completedMinutes, 0);
    const creditedMinutes = evaluations.reduce((sum, item)=> sum + item.result.creditedMinutes, 0);
    const debtMinutes = evaluations.reduce((sum, item)=>{
      const isOverdue = item.assignment.date < todayISO;
      return sum + (isOverdue ? item.result.missingMinutes : 0);
    }, 0);
    const totalStudyMinutes = (sessions || [])
      .filter(session => session.date >= startISO && session.date <= endISO)
      .reduce((sum, session)=> sum + sessionMinutes(session), 0);
    const spontaneousMinutes = (sessions || [])
      .filter(session => session.date >= startISO && session.date <= endISO && !session.planAssignmentId)
      .reduce((sum, session)=> sum + sessionMinutes(session), 0);
    const assignmentCounts = {
      completed:evaluations.filter(item=>item.result.derivedStatus===PLAN_EXECUTION_STATUS.COMPLETED).length,
      partial:evaluations.filter(item=>item.result.derivedStatus===PLAN_EXECUTION_STATUS.PARTIAL).length,
      missed:evaluations.filter(item=>item.result.derivedStatus===PLAN_EXECUTION_STATUS.MISSED).length,
      planned:evaluations.filter(item=>item.result.derivedStatus===PLAN_EXECUTION_STATUS.PLANNED).length
    };

    return {
      plannedMinutes,
      linkedMinutes,
      creditedMinutes,
      totalStudyMinutes,
      spontaneousMinutes,
      debtMinutes,
      loadPct: plannedMinutes ? Math.round((totalStudyMinutes / plannedMinutes) * 1000) / 10 : null,
      adherencePct: plannedMinutes ? Math.round((creditedMinutes / plannedMinutes) * 1000) / 10 : null,
      assignmentCounts,
      completedAssignments:assignmentCounts.completed,
      partialAssignments:assignmentCounts.partial,
      missedAssignments:assignmentCounts.missed,
      plannedAssignments:assignmentCounts.planned,
      evaluations
    };
  }

  function calculateStudyDebt(assignments,sessions,options){
    options=options||{};
    const todayISO=options.todayISO||new Date().toISOString().slice(0,10);
    const startISO=options.startISO||"0000-01-01";
    const endISO=options.endISO||todayISO;
    const active=(assignments||[]).filter(assignment=>assignment.status!==PLAN_LIFECYCLE_STATUS.CANCELLED);
    const coverage={};
    active.filter(assignment=>assignment.kind==="recovery"&&assignment.sourceAssignmentId).forEach(assignment=>{
      const evaluation=evaluateAssignment(assignment,sessions,{todayISO,tolerance:options.tolerance});
      const effectiveCoverage=assignment.date>=todayISO
        ? numberOrZero(assignment.plannedMinutes)
        : Math.min(evaluation.completedMinutes,numberOrZero(assignment.plannedMinutes));
      coverage[assignment.sourceAssignmentId]=(coverage[assignment.sourceAssignmentId]||0)+effectiveCoverage;
    });
    const rows=active
      .filter(assignment=>assignment.kind!=="recovery"&&assignment.date>=startISO&&assignment.date<=endISO&&assignment.date<todayISO)
      .map(assignment=>{
        const evaluation=evaluateAssignment(assignment,sessions,{todayISO,tolerance:options.tolerance});
        const coveredByRecoveryMinutes=coverage[assignment.id]||0;
        const remainingMinutes=Math.max(0,evaluation.missingMinutes-coveredByRecoveryMinutes);
        return {
          assignmentId:assignment.id,subjectId:assignment.subjectId,topicId:assignment.topicId,
          plannedDate:assignment.date,executionStatus:evaluation.derivedStatus,
          plannedMinutes:evaluation.plannedMinutes,completedMinutes:evaluation.completedMinutes,
          coveredByRecoveryMinutes,remainingMinutes,assignment
        };
      })
      .filter(row=>row.remainingMinutes>0);
    return {
      totalMinutes:rows.reduce((sum,row)=>sum+row.remainingMinutes,0),
      grossMinutes:rows.reduce((sum,row)=>sum+row.remainingMinutes+row.coveredByRecoveryMinutes,0),
      assignments:rows
    };
  }

  function reconcileRecoveries(assignments,sessions,options){
    options=options||{};
    const todayISO=options.todayISO||new Date().toISOString().slice(0,10);
    const cancelledAt=options.cancelledAt||new Date().toISOString();
    const next=(assignments||[]).map(assignment=>Object.assign({},assignment));
    const originals=new Map(next.filter(assignment=>assignment.kind!=="recovery").map(assignment=>[assignment.id,assignment]));
    const cancellations=[];
    next.filter(assignment=>assignment.kind==="recovery"&&assignment.sourceAssignmentId&&assignment.status!==PLAN_LIFECYCLE_STATUS.CANCELLED)
      .forEach(recovery=>{
        const source=originals.get(recovery.sourceAssignmentId);
        if(!source) return;
        const evaluation=evaluateAssignment(source,sessions,{todayISO,tolerance:options.tolerance});
        if(evaluation.missingMinutes>0) return;
        recovery.status=PLAN_LIFECYCLE_STATUS.CANCELLED;
        recovery.cancelReason="Débito resolvido após correção da sessão original";
        recovery.cancelledAt=cancelledAt;
        recovery.updatedAt=cancelledAt;
        cancellations.push({assignmentId:recovery.id,sourceAssignmentId:source.id,reason:recovery.cancelReason});
      });
    return {assignments:next,cancellations};
  }

  function applyReplanProposal(assignments,proposal,options){
    options=options||{};
    const existing=(assignments||[]).map(assignment=>Object.assign({},assignment));
    const proposalId=proposal&&proposal.id;
    const alreadyApplied=proposalId&&existing.some(assignment=>assignment.proposalId===proposalId);
    if(!proposal||alreadyApplied) return {assignments:existing,created:[],alreadyApplied:Boolean(alreadyApplied)};
    const created=(proposal.operations||[]).map((operation,index)=>{
      const source=existing.find(assignment=>assignment.id===operation.sourceAssignmentId);
      const isReview=operation.type==="create_review_assignment";
      return {
        id:(isReview?"review_":"recovery_")+(proposalId||"proposal")+"_"+index,
        proposalId:proposalId||null,date:operation.to,topicId:operation.topicId,subjectId:operation.subjectId,
        plannedMinutes:operation.minutes,completedMinutes:0,status:PLAN_LIFECYCLE_STATUS.PLANNED,
        kind:isReview?"review":"recovery",source:"replanner",sourceAssignmentId:operation.sourceAssignmentId||null,
        originalDate:source?(source.originalDate||source.date):operation.from,
        rescheduleCount:(source?Number(source.rescheduleCount)||0:0)+1,
        reviewStage:isReview?operation.reviewStage:null,reviewDueDate:isReview?operation.reviewDueDate:null,
        createdAt:options.createdAt||proposal.createdAt,updatedAt:options.createdAt||proposal.createdAt
      };
    });
    return {assignments:existing.concat(created),created,alreadyApplied:false};
  }

  function analyzePlanImpact(assignments,availability,examDate){
    const byDate={};
    const beyondExam=[];
    (assignments||[]).filter(assignment=>assignment.status!==PLAN_LIFECYCLE_STATUS.CANCELLED).forEach(assignment=>{
      if(examDate&&assignment.date>=examDate) beyondExam.push(assignment);
      const row=byDate[assignment.date]||(byDate[assignment.date]={date:assignment.date,committedMinutes:0,capacityMinutes:0});
      row.committedMinutes+=Math.max(0,Math.round(numberOrZero(assignment.plannedMinutes)));
    });
    Object.values(byDate).forEach(row=>{
      row.capacityMinutes=Math.max(0,Math.round(numberOrZero((availability||{})[dayKeyFromISO(row.date)])));
      row.excessMinutes=Math.max(0,row.committedMinutes-row.capacityMinutes);
    });
    const overloadedDays=Object.values(byDate).filter(row=>row.excessMinutes>0).sort((a,b)=>a.date.localeCompare(b.date));
    return {overloadedDays,beyondExam,totalExcessMinutes:overloadedDays.reduce((sum,row)=>sum+row.excessMinutes,0),requiresReplan:overloadedDays.length>0||beyondExam.length>0};
  }

  function parseISO(iso){
    const parts = String(iso).split("-").map(Number);
    return new Date(Date.UTC(parts[0], parts[1]-1, parts[2]));
  }

  function toISO(date){ return date.toISOString().slice(0, 10); }

  function addDays(iso, amount){
    const date = parseISO(iso);
    date.setUTCDate(date.getUTCDate()+amount);
    return toISO(date);
  }

  function dayKeyFromISO(iso){
    return ["sun","mon","tue","wed","thu","fri","sat"][parseISO(iso).getUTCDay()];
  }

  function dateRange(startISO, endExclusiveISO){
    const dates = [];
    for(let cursor=startISO; cursor<endExclusiveISO; cursor=addDays(cursor, 1)) dates.push(cursor);
    return dates;
  }

  function buildCapacityLedger(assignments, availability, startISO, examDate){
    const ledger = {};
    dateRange(startISO, examDate).forEach(date=>{
      ledger[date] = {
        date,
        capacityMinutes:Math.max(0, Math.round(numberOrZero(availability[dayKeyFromISO(date)]))),
        committedMinutes:0,
        freeMinutes:0,
        reviewMinutes:0,
        subjectIds:new Set()
      };
    });
    (assignments || []).forEach(assignment=>{
      if(assignment.status === "cancelled" || !ledger[assignment.date]) return;
      ledger[assignment.date].committedMinutes += Math.max(0, Math.round(numberOrZero(assignment.plannedMinutes)));
      if(assignment.kind==="review") ledger[assignment.date].reviewMinutes += Math.max(0,Math.round(numberOrZero(assignment.plannedMinutes)));
      if(assignment.subjectId) ledger[assignment.date].subjectIds.add(assignment.subjectId);
    });
    Object.values(ledger).forEach(day=> day.freeMinutes = Math.max(day.capacityMinutes-day.committedMinutes, 0));
    return ledger;
  }

  function splitIntoBlocks(totalMinutes, blockMinutes){
    let remaining=Math.max(0,Math.round(numberOrZero(totalMinutes)));
    const block=Math.max(1,Math.round(numberOrZero(blockMinutes))||remaining||1);
    const blocks=[];
    while(remaining>0){
      const minutes=Math.min(block,remaining);
      blocks.push(minutes);
      remaining-=minutes;
    }
    return blocks;
  }

  function daysBetween(fromISO,toISO){
    return Math.max(0,Math.round((parseISO(toISO)-parseISO(fromISO))/86400000));
  }

  function calculateChangeCost(operation,operations){
    const distance=daysBetween(operation.from,operation.to);
    const crossesWeek=Math.floor(distance/7)>0?5:0;
    const fragments=(operations||[]).filter(item=>item.sourceAssignmentId&&item.sourceAssignmentId===operation.sourceAssignmentId).length>1?4:0;
    const creation=operation.type==="create_review_assignment"?1:0;
    return distance+crossesWeek+fragments+creation;
  }

  function calculatePlanStability(assignments){
    const active=(assignments||[]).filter(assignment=>assignment.status!==PLAN_LIFECYCLE_STATUS.CANCELLED);
    const unchanged=active.filter(assignment=>(assignment.originalDate||assignment.date)===assignment.date&&(Number(assignment.rescheduleCount)||0)===0&&assignment.source!=="replanner");
    const totalAssignments=active.length;
    const unchangedAssignments=unchanged.length;
    const changedAssignments=totalAssignments-unchangedAssignments;
    return {
      totalAssignments,unchangedAssignments,changedAssignments,
      stabilityPct:totalAssignments?Math.round((unchangedAssignments/totalAssignments)*1000)/10:100
    };
  }

  function generateReplanProposal(input){
    const todayISO = input.todayISO;
    const firstFutureDate = input.firstFutureDate || addDays(todayISO, 1);
    const assignments = input.assignments || [];
    const sessions = input.sessions || [];
    const ledger = buildCapacityLedger(assignments, input.availability || {}, firstFutureDate, input.examDate);
    const scoreByTopic = input.scoreByTopic || {};
    const reasonsByTopic = input.reasonsByTopic || {};
    const preferences=Object.assign({
      maxSubjectsPerDay:Infinity,conflictPairs:[],reservedReviewDays:[],
      maxReviewCapacityPct:.4,allowOverdueReviewOverflow:true,reviewEstimatedMinutes:30
    },input.preferences||{});
    const conflictPairs=input.subjectConflicts||preferences.conflictPairs||[];
    const debt=calculateStudyDebt(assignments,sessions,{todayISO,tolerance:input.tolerance});
    const debts=debt.assignments.slice().sort((a,b)=>{
      const aPartial=a.executionStatus===PLAN_EXECUTION_STATUS.PARTIAL?1:0;
      const bPartial=b.executionStatus===PLAN_EXECUTION_STATUS.PARTIAL?1:0;
      return bPartial-aPartial || (scoreByTopic[b.topicId]||0)-(scoreByTopic[a.topicId]||0) || a.plannedDate.localeCompare(b.plannedDate);
    });
    const operations = [];
    const days=Object.values(ledger);
    const subjectsConflict=(subjectId,subjectIds)=>conflictPairs.some(pair=>(subjectId===pair[0]&&subjectIds.has(pair[1]))||(subjectId===pair[1]&&subjectIds.has(pair[0])));
    const acceptsSubject=(day,subjectId)=> day.subjectIds.has(subjectId) || (
      day.subjectIds.size < preferences.maxSubjectsPerDay && !subjectsConflict(subjectId,day.subjectIds)
    );
    const reserveDays=new Set(preferences.reservedReviewDays||[]);

    // Revisões vencidas e de hoje entram primeiro e disputam a mesma capacidade.
    const existingReviewKeys=new Set(assignments.filter(a=>a.status!==PLAN_LIFECYCLE_STATUS.CANCELLED&&a.kind==="review")
      .map(a=>a.topicId+"|"+a.reviewStage+"|"+a.reviewDueDate));
    const reviews=(input.reviews||[])
      .filter(review=>review.nextReviewDate<=todayISO&&!existingReviewKeys.has(review.id+"|"+review.reviewStage+"|"+review.nextReviewDate))
      .sort((a,b)=>a.nextReviewDate.localeCompare(b.nextReviewDate));
    let remainingReviewMinutes=0;
    reviews.forEach(review=>{
      let remaining=Math.round(numberOrZero(review.estimatedMinutes)||preferences.reviewEstimatedMinutes);
      const orderedDays=days.slice().sort((a,b)=>{
        const ar=reserveDays.has(dayKeyFromISO(a.date))?0:1;
        const br=reserveDays.has(dayKeyFromISO(b.date))?0:1;
        return ar-br||a.date.localeCompare(b.date);
      });
      orderedDays.some(day=>{
        if(remaining<=0) return true;
        if(day.freeMinutes<=0||!acceptsSubject(day,review.subjectId)) return false;
        const reviewLimit=Math.round(day.capacityMinutes*preferences.maxReviewCapacityPct);
        const allowedByLimit=Math.max(0,reviewLimit-day.reviewMinutes);
        const overdue=review.nextReviewDate<todayISO;
        const allowed=overdue&&preferences.allowOverdueReviewOverflow?day.freeMinutes:Math.min(day.freeMinutes,allowedByLimit);
        if(allowed<=0) return false;
        const minutes=Math.min(remaining,allowed);
        operations.push({
          type:"create_review_assignment",topicId:review.id,subjectId:review.subjectId,
          reviewStage:review.reviewStage,reviewDueDate:review.nextReviewDate,
          from:review.nextReviewDate,to:day.date,minutes,
          reasons:[overdue?"Revisão vencida":"Revisão prevista para hoje","Revisões consomem capacidade antes de conteúdo novo"],
          constraintsSatisfied:["Capacidade diária respeitada","Limite de disciplinas respeitado","Conflitos de matérias respeitados"]
        });
        day.freeMinutes-=minutes; day.committedMinutes+=minutes; day.reviewMinutes+=minutes; day.subjectIds.add(review.subjectId); remaining-=minutes;
        return remaining<=0;
      });
      remainingReviewMinutes+=remaining;
    });

    let remainingDebtMinutes = 0;
    debts.forEach(item=>{
      let remaining = item.remainingMinutes;
      days.some(day=>{
        if(remaining<=0) return true;
        if(day.freeMinutes<=0||reserveDays.has(dayKeyFromISO(day.date))||!acceptsSubject(day,item.subjectId)) return false;
        const minutes = Math.min(remaining, day.freeMinutes);
        operations.push({
          type:"create_recovery_assignment",
          sourceAssignmentId:item.assignmentId,
          topicId:item.topicId,
          subjectId:item.subjectId,
          from:item.plannedDate,
          to:day.date,
          minutes,
          reasons:[
            item.executionStatus===PLAN_EXECUTION_STATUS.PARTIAL?"Assignment parcialmente realizado":"Assignment não realizado",
            scoreByTopic[item.topicId]?"Prioridade adaptativa do tópico":"Débito de estudo vencido"
          ].concat(reasonsByTopic[item.topicId]||[]).filter((reason,index,list)=>list.indexOf(reason)===index),
          constraintsSatisfied:["Capacidade diária respeitada","Máximo de disciplinas respeitado","Conflitos de matérias respeitados","Assignment original preservado"]
        });
        day.freeMinutes -= minutes;
        day.committedMinutes += minutes;
        day.subjectIds.add(item.subjectId);
        remaining -= minutes;
        return remaining<=0;
      });
      remainingDebtMinutes += remaining;
    });

    operations.forEach(operation=>operation.changeCost=calculateChangeCost(operation,operations));
    const affectedSources=new Set(operations.map(operation=>operation.sourceAssignmentId).filter(Boolean));
    const currentActive=assignments.filter(assignment=>assignment.status!==PLAN_LIFECYCLE_STATUS.CANCELLED).length;
    const predictedTotal=currentActive+operations.filter(operation=>operation.type==="create_review_assignment").length;
    const predictedChanged=affectedSources.size+operations.filter(operation=>operation.type==="create_review_assignment").length;
    const predictedStability={
      totalAssignments:predictedTotal,
      unchangedAssignments:Math.max(0,predictedTotal-predictedChanged),
      changedAssignments:predictedChanged,
      stabilityPct:predictedTotal?Math.round(((predictedTotal-predictedChanged)/predictedTotal)*1000)/10:100
    };
    return {
      reason:"missed_assignments",
      createdAt:input.createdAt || new Date().toISOString(),
      affectedAssignmentIds:debts.map(item=>item.assignmentId),
      debtMinutes:debt.totalMinutes,
      reviewMinutes:reviews.reduce((sum,review)=>sum+(numberOrZero(review.estimatedMinutes)||preferences.reviewEstimatedMinutes),0),
      scheduledMinutes:operations.filter(operation=>operation.type==="create_recovery_assignment").reduce((sum,operation)=>sum+operation.minutes,0),
      scheduledReviewMinutes:operations.filter(operation=>operation.type==="create_review_assignment").reduce((sum,operation)=>sum+operation.minutes,0),
      remainingDebtMinutes,
      remainingReviewMinutes,
      feasible:remainingDebtMinutes===0&&remainingReviewMinutes===0,
      totalChangeCost:operations.reduce((sum,operation)=>sum+operation.changeCost,0),
      planStability:predictedStability,
      guarantees:{
        dailyCapacityRespected:true,
        completedAssignmentsPreserved:true,
        maxSubjectsPerDayRespected:true,
        subjectConflictsRespected:true,
        examDateRespected:operations.every(operation=>operation.to<input.examDate)
      },
      operations,
      debt
    };
  }

  function analyzeFeasibility(input){
    const contentMinutes = Math.max(0, Math.round(numberOrZero(input.contentMinutes)));
    const debtMinutes = Math.max(0, Math.round(numberOrZero(input.debtMinutes)));
    const reviewMinutes = Math.max(0, Math.round(numberOrZero(input.reviewMinutes)));
    const committedMinutes = Math.max(0, Math.round(numberOrZero(input.committedMinutes)));
    const availableMinutes = Math.max(0, Math.round(numberOrZero(input.availableMinutes)));
    const bufferPct=Math.max(0,numberOrZero(input.bufferPct));
    const baseNeededMinutes=contentMinutes+debtMinutes+reviewMinutes+committedMinutes;
    const bufferMinutes=Math.round(baseNeededMinutes*(bufferPct/100));
    const neededMinutes = baseNeededMinutes+bufferMinutes;
    const marginMinutes = availableMinutes-neededMinutes;
    const utilizationPct = availableMinutes ? Math.round((neededMinutes/availableMinutes)*1000)/10 : (neededMinutes ? Infinity : 0);
    const comfortableLimitPct=numberOrZero(input.comfortableLimitPct)||80;
    const tightLimitPct=numberOrZero(input.tightLimitPct)||95;
    let level = "comfortable";
    if(marginMinutes<0) level="infeasible";
    else if(utilizationPct>tightLimitPct) level="risk";
    else if(utilizationPct>comfortableLimitPct) level="tight";
    return {contentMinutes,debtMinutes,reviewMinutes,committedMinutes,baseNeededMinutes,bufferPct,bufferMinutes,neededMinutes,availableMinutes,marginMinutes,utilizationPct,level,feasible:marginMinutes>=0};
  }

  function suggestFeasibilityAdjustments(input){
    const deficitMinutes=Math.max(0,Math.round(numberOrZero(input.deficitMinutes)));
    if(!deficitMinutes) return [];
    const startISO=input.startISO;
    const examDate=input.examDate;
    const countDays=keys=>dateRange(startISO,examDate).filter(date=>keys.includes(dayKeyFromISO(date))).length;
    const candidates=[
      {id:"add_mon_wed_30",label:"Adicionar 30 min nas segundas e quartas",recoveredMinutes:countDays(["mon","wed"])*30},
      {id:"add_saturday_60",label:"Adicionar 1h aos sábados",recoveredMinutes:countDays(["sat"])*60},
      {id:"reduce_low_priority",label:"Reduzir conteúdos de prioridade baixa",recoveredMinutes:Math.round(numberOrZero(input.lowPriorityMinutes))}
    ].filter(candidate=>candidate.recoveredMinutes>0);
    return candidates.map(candidate=>Object.assign(candidate,{
      remainingDeficitMinutes:Math.max(0,deficitMinutes-candidate.recoveredMinutes),
      resolvesDeficit:candidate.recoveredMinutes>=deficitMinutes
    })).sort((a,b)=>{
      if(a.resolvesDeficit!==b.resolvesDeficit) return a.resolvesDeficit?-1:1;
      return Math.abs(a.recoveredMinutes-deficitMinutes)-Math.abs(b.recoveredMinutes-deficitMinutes);
    });
  }

  return {
    COMPLETION_TOLERANCE,
    PLAN_LIFECYCLE_STATUS,
    PLAN_EXECUTION_STATUS,
    migrateState,
    sessionMinutes,
    sessionsForAssignment,
    evaluateAssignment,
    evaluatePlan,
    calculateStudyDebt,
    reconcileRecoveries,
    applyReplanProposal,
    analyzePlanImpact,
    addDays,
    dayKeyFromISO,
    buildCapacityLedger,
    splitIntoBlocks,
    calculateChangeCost,
    calculatePlanStability,
    generateReplanProposal,
    analyzeFeasibility,
    suggestFeasibilityAdjustments
  };
});
