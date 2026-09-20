(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  if(root) root.BBPlannerStress=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  function seeded(seed){
    let value=seed>>>0;
    return function(){ value=(value*1664525+1013904223)>>>0; return value/4294967296; };
  }
  function isoDaysFrom(startISO,offset){
    const date=new Date(startISO+"T12:00:00Z"); date.setUTCDate(date.getUTCDate()+offset); return date.toISOString().slice(0,10);
  }
  const STRESS_PRESETS=Object.freeze({
    balanced:{days:150,sessionCount:320,completionFactor:[0.85,1.15],spontaneousEvery:9,seed:20260920},
    irregular:{days:150,sessionCount:250,completionFactor:[0.35,1.25],spontaneousEvery:4,skipEvery:7,seed:20260921},
    critical:{days:150,sessionCount:130,completionFactor:[0.15,0.65],spontaneousEvery:11,skipEvery:3,seed:20260922},
    longTerm:{days:365,sessionCount:820,completionFactor:[0.65,1.2],spontaneousEvery:10,seed:20260923}
  });
  function generate(options={}){
    if(typeof options==="string") options={preset:options};
    const preset=STRESS_PRESETS[options.preset]||STRESS_PRESETS.balanced;
    options=Object.assign({},preset,options);
    const days=options.days||150;
    const sessionCount=options.sessionCount||320;
    const startISO=options.startISO||"2026-01-05";
    const subjects=options.subjectIds||["port","ing","mat","atu","matfin","banc","info","vendas","redacao"];
    const random=seeded(options.seed||20260920);
    const assignments=[];
    for(let index=0;index<days*2;index++){
      const subjectId=subjects[index%subjects.length];
      assignments.push({
        id:`stress_plan_${index}`,topicId:`${subjectId}-stress-${index%18}`,subjectId,
        date:isoDaysFrom(startISO,index%days),plannedMinutes:[30,45,60,90][index%4],
        status:"planned",kind:index%11===0?"review":"content",source:"stress",
        originalDate:isoDaysFrom(startISO,index%days),rescheduleCount:index%37===0?1:0
      });
    }
    const sessions=[];
    for(let index=0;index<sessionCount;index++){
      const assignment=assignments[index%assignments.length];
      const spontaneous=index%(options.spontaneousEvery||9)===0;
      if(options.skipEvery&&index%options.skipEvery===0) continue;
      const questions=index%4===0?0:10+Math.floor(random()*31);
      const accuracy=0.48+random()*0.47;
      const factor=options.completionFactor||[0.7,1.25];
      sessions.push({
        id:`stress_session_${index}`,planAssignmentId:spontaneous?null:assignment.id,
        topicId:assignment.topicId,subjectId:assignment.subjectId,date:assignment.date,
        method:questions?"Questões":"Leitura",actualMinutes:Math.max(5,Math.round(assignment.plannedMinutes*(factor[0]+random()*(factor[1]-factor[0])))),
        questions,correct:Math.round(questions*accuracy),wrong:questions-Math.round(questions*accuracy)
      });
    }
    const mockExams=Array.from({length:10},(_,index)=>({
      id:`stress_mock_${index}`,date:isoDaysFrom(startISO,index*14),title:`Simulado ${index+1}`,
      durationMinutes:210,totalQuestions:70,totalCorrect:35+index*3,accuracyPct:Math.round(((35+index*3)/70)*1000)/10,subjects:{}
    }));
    const rescheduleHistory=Array.from({length:6},(_,index)=>({
      id:`stress_history_${index}`,proposalId:`stress_proposal_${index}`,
      createdAt:isoDaysFrom(startISO,30+index*18)+"T12:00:00.000Z",appliedAt:isoDaysFrom(startISO,30+index*18)+"T12:05:00.000Z",
      reason:"missed_assignments",operations:[]
    }));
    return {preset:options.preset||"balanced",days,startISO,assignments,sessions,mockExams,rescheduleHistory};
  }
  return {STRESS_PRESETS,generate};
});
