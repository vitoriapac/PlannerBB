(function(root, factory){
  const api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  if(root) root.BBPlannerCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  const COMPLETION_TOLERANCE = Object.freeze({ minutes: 5, ratio: 0.95 });

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

    let derivedStatus = "not_started";
    if(assignment && assignment.status === "cancelled") derivedStatus = "cancelled";
    else if(completedMinutes >= plannedMinutes && plannedMinutes > 0 || withinTolerance) derivedStatus = "completed";
    else if(completedMinutes > 0) derivedStatus = "partial";
    else if(assignment && assignment.date < todayISO) derivedStatus = "missed";
    else derivedStatus = "planned";

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

    return {
      plannedMinutes,
      linkedMinutes,
      creditedMinutes,
      totalStudyMinutes,
      spontaneousMinutes,
      debtMinutes,
      loadPct: plannedMinutes ? Math.round((totalStudyMinutes / plannedMinutes) * 1000) / 10 : null,
      adherencePct: plannedMinutes ? Math.round((creditedMinutes / plannedMinutes) * 1000) / 10 : null,
      evaluations
    };
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
        freeMinutes:0
      };
    });
    (assignments || []).forEach(assignment=>{
      if(assignment.status === "cancelled" || !ledger[assignment.date]) return;
      ledger[assignment.date].committedMinutes += Math.max(0, Math.round(numberOrZero(assignment.plannedMinutes)));
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

  function generateReplanProposal(input){
    const todayISO = input.todayISO;
    const firstFutureDate = input.firstFutureDate || addDays(todayISO, 1);
    const assignments = input.assignments || [];
    const sessions = input.sessions || [];
    const ledger = buildCapacityLedger(assignments, input.availability || {}, firstFutureDate, input.examDate);
    const scoreByTopic = input.scoreByTopic || {};
    const recoveryCoverageBySource = {};
    assignments.filter(assignment=>assignment.status!=="cancelled" && assignment.kind==="recovery" && assignment.sourceAssignmentId).forEach(assignment=>{
      recoveryCoverageBySource[assignment.sourceAssignmentId]=(recoveryCoverageBySource[assignment.sourceAssignmentId]||0)+numberOrZero(assignment.plannedMinutes);
    });
    const debts = assignments
      .filter(assignment=> assignment.status !== "cancelled" && assignment.date < todayISO)
      .map(assignment=>{
        const evaluation=evaluateAssignment(assignment,sessions,{todayISO,tolerance:input.tolerance});
        const outstandingMinutes=Math.max(0,evaluation.missingMinutes-(recoveryCoverageBySource[assignment.id]||0));
        return {assignment,evaluation,outstandingMinutes};
      })
      .filter(item=>item.outstandingMinutes>0)
      .sort((a,b)=> (scoreByTopic[b.assignment.topicId]||0)-(scoreByTopic[a.assignment.topicId]||0) || a.assignment.date.localeCompare(b.assignment.date));

    const operations = [];
    let remainingDebtMinutes = 0;
    debts.forEach(item=>{
      let remaining = item.outstandingMinutes;
      Object.values(ledger).some(day=>{
        if(remaining<=0) return true;
        if(day.freeMinutes<=0) return false;
        const minutes = Math.min(remaining, day.freeMinutes);
        operations.push({
          type:"create_recovery_assignment",
          sourceAssignmentId:item.assignment.id,
          topicId:item.assignment.topicId,
          subjectId:item.assignment.subjectId,
          from:item.assignment.date,
          to:day.date,
          minutes
        });
        day.freeMinutes -= minutes;
        day.committedMinutes += minutes;
        remaining -= minutes;
        return remaining<=0;
      });
      remainingDebtMinutes += remaining;
    });

    return {
      reason:"missed_assignments",
      createdAt:input.createdAt || new Date().toISOString(),
      affectedAssignmentIds:debts.map(item=>item.assignment.id),
      debtMinutes:debts.reduce((sum,item)=>sum+item.outstandingMinutes,0),
      scheduledMinutes:operations.reduce((sum,operation)=>sum+operation.minutes,0),
      remainingDebtMinutes,
      feasible:remainingDebtMinutes===0,
      operations
    };
  }

  function analyzeFeasibility(input){
    const contentMinutes = Math.max(0, Math.round(numberOrZero(input.contentMinutes)));
    const debtMinutes = Math.max(0, Math.round(numberOrZero(input.debtMinutes)));
    const reviewMinutes = Math.max(0, Math.round(numberOrZero(input.reviewMinutes)));
    const committedMinutes = Math.max(0, Math.round(numberOrZero(input.committedMinutes)));
    const availableMinutes = Math.max(0, Math.round(numberOrZero(input.availableMinutes)));
    const neededMinutes = contentMinutes + debtMinutes + reviewMinutes + committedMinutes;
    const marginMinutes = availableMinutes-neededMinutes;
    const utilizationPct = availableMinutes ? Math.round((neededMinutes/availableMinutes)*1000)/10 : (neededMinutes ? Infinity : 0);
    let level = "healthy";
    if(marginMinutes<0) level="infeasible";
    else if(utilizationPct>95) level="risk";
    else if(utilizationPct>80) level="tight";
    return {contentMinutes, debtMinutes, reviewMinutes, committedMinutes, neededMinutes, availableMinutes, marginMinutes, utilizationPct, level, feasible:marginMinutes>=0};
  }

  return {
    COMPLETION_TOLERANCE,
    migrateState,
    sessionMinutes,
    sessionsForAssignment,
    evaluateAssignment,
    evaluatePlan,
    addDays,
    dayKeyFromISO,
    buildCapacityLedger,
    splitIntoBlocks,
    generateReplanProposal,
    analyzeFeasibility
  };
});
