const test=require("node:test");
const assert=require("node:assert/strict");

require("../edital-data.js");

test("edital externo expõe grupos, disciplinas e identificadores únicos",()=>{
  const edital=globalThis.BB_EDITAL;
  assert.ok(edital);
  assert.equal(edital.subjectGroups.length,3);
  assert.equal(edital.subjects.length,9);
  const ids=[];
  edital.subjects.forEach(subject=>{
    ids.push(subject.id);
    subject.topics.forEach(topic=>{
      ids.push(topic.id);
      topic.subtopics.forEach(subtopic=>ids.push(subtopic.id));
    });
  });
  assert.equal(new Set(ids).size,ids.length);
  assert.ok(edital.subjects.some(subject=>subject.id==="banc"));
});
