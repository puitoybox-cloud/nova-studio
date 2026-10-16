'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('music-studio-ai-assistant-panel.js','utf8');
const from=src.indexOf('async function auditionCandidate('),to=src.indexOf('function applyCandidatePreview(',from);
assert.ok(from>=0&&to>from,'production audition must remain extractable');
function harness(){
 const p={projectId:'song'},session={},bundle={candidateId:'A'},record={candidatePreview:bundle,auditionGeneration:0,message:''};
 const states=new Map([['song',record]]),pending=[],repaints=[];
 const application={state:{midiEditor:session},editorAuditionCandidate(){return new Promise((resolve,reject)=>pending.push({resolve,reject}))}};
 const context={states,project:()=>p,stateFor:()=>record,app:()=>application,core:()=>({}),materializer:()=>({auditionPlan:()=>({})}),candidateSelection:()=>null,refresh:id=>repaints.push(id)};
 const audition=vm.runInNewContext(src.slice(from,to)+';auditionCandidate',context);
 return{audition,p,session,bundle,record,application,pending,repaints};
}
test('a cancelled preview cannot overwrite newer candidate messaging',async()=>{
 const h=harness(),task=h.audition('song','A');
 h.record.candidatePreview=null;h.record.message='Preview cancelled';
 h.pending[0].resolve({ok:true});await task;
 assert.equal(h.record.message,'Preview cancelled');assert.equal(h.repaints.length,0);
});
test('late first audition does not overwrite a newer audition',async()=>{
 const h=harness(),first=h.audition('song','A'),second=h.audition('song','A');
 h.pending[1].resolve({ok:true});await second;
 h.pending[0].reject(Error('old playback failure'));await first;
 assert.equal(h.record.message,'候補Aを試聴中。MIDI原本は変更していません。');
 assert.equal(h.repaints.length,1);
});
test('candidate controls retain local unsent drafts but reset does not resurrect them',()=>{
 assert.match(src,/preserveCandidateDrafts&&\^ai/);
 assert.match(src,/data-candidate-edit/);
 assert.match(src,/refresh\(id,\{preserveCandidateDrafts:false\}\)/);
});
