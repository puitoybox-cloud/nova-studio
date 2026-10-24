/* NOVA Core: local, explicit Logic instrument plans. Never controls a host. */
(function(root){
 'use strict';
 const copy=x=>JSON.parse(JSON.stringify(x)), same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const proofs=new WeakMap();
 function text(x){if(typeof x!=='string'||!x.trim()||x.length>500)throw Error('instrument-text-required');return x.trim()}
 function integer(x,min,max){if(!Number.isInteger(x)||x<min||x>max)throw Error('instrument-number-invalid');return x}
 function registry(value={version:1,entries:[]}){
  if(value.version!==1||!Array.isArray(value.entries)||value.entries.length>256)throw Error('instrument-registry-invalid');
  const ids=new Set();return{version:1,entries:value.entries.map(e=>{
   const id=text(e.id);if(ids.has(id))throw Error('instrument-id-duplicate');ids.add(id);
   if(!['logic','au'].includes(e.kind)||!['piano','strings','bass','drums','other'].includes(e.family))throw Error('instrument-kind-invalid');
   if(!['patch','channel-strip','template','preset'].includes(e.method))throw Error('instrument-method-invalid');
   const range=e.range===null?null:[integer(e.range?.[0],0,127),integer(e.range?.[1],0,127)];if(range&&range[0]>range[1])throw Error('instrument-range-invalid');
   const component=e.kind==='au'?{type:text(e.component?.type),subtype:text(e.component?.subtype),manufacturer:text(e.component?.manufacturer)}:null;
   if(component&&Object.values(component).some(s=>s.length!==4))throw Error('au-fourcc-invalid');
   return{id,name:text(e.name),kind:e.kind,family:e.family,version:text(e.version),method:e.method,reference:text(e.reference),preset:text(e.preset),machineId:text(e.machineId),installed:e.installed===true,verifiedAt:text(e.verifiedAt),range,component,tags:(e.tags||[]).map(text),roles:(e.roles||[]).map(text)};
  })};
 }
 function workspace(p){const w=p.logicInstruments||{version:1,registry:{version:1,entries:[]},assignments:{},history:[]};if(w.version!==1||!w.assignments||!Array.isArray(w.history))throw Error('instrument-workspace-invalid');return{...copy(w),registry:registry(w.registry)}}
 function register(p,entry){const next=copy(p),w=workspace(p);if(w.registry.entries.some(e=>e.id===entry.id))throw Error('instrument-id-already-registered');w.registry=registry({version:1,entries:[...w.registry.entries,entry]});next.logicInstruments=w;return next}
 function tracks(p){const ids=new Set();return(p.midiData?.tracks||[]).map(t=>{if(!t.id||ids.has(t.id))throw Error('track-identity-ambiguous');ids.add(t.id);const notes=t.notes||[],pitches=notes.map(n=>integer(n.pitch,0,127));return{id:t.id,name:t.name||t.id,channel:t.channel??null,role:t.role||null,noteCount:notes.length,range:pitches.length?[Math.min(...pitches),Math.max(...pitches)]:null,velocity:notes.length?[Math.min(...notes.map(n=>n.velocity)),Math.max(...notes.map(n=>n.velocity))]:null}})}
 function parse(instruction){const s=text(instruction);if(/さっき.*戻|元.*戻/.test(s))return{operation:'undo'};if(/AとB.*比較/.test(s))return{operation:'compare'};const family=/ピアノ/.test(s)?'piano':/ストリングス/.test(s)?'strings':/ベース/.test(s)?'bass':/ドラム/.test(s)?'drums':null;if(!family&&!/持っている音源/.test(s))throw Error('instrument-instruction-unsupported');return{operation:'recommend',family,tags:[/温か/.test(s)?'温かい':null,/優し/.test(s)?'優しい':null,/アコースティック/.test(s)?'アコースティック':null,/壮大/.test(s)?'壮大':null].filter(Boolean)}}
 function recommend(p,{trackId,instruction,machineId}){
  const intent=parse(instruction);if(intent.operation!=='recommend')return{intent};
  const track=tracks(p).find(t=>t.id===trackId);if(!track)throw Error('track-not-found');const w=workspace(p);
  const candidates=w.registry.entries.filter(e=>e.installed&&e.machineId===machineId&&(!intent.family||e.family===intent.family)&&(!track.range||e.range&&track.range[0]>=e.range[0]&&track.range[1]<=e.range[1])).map(e=>{
   const matched=intent.tags.filter(t=>e.tags.includes(t));return{entry:copy(e),score:matched.length*10+(track.role&&e.roles.includes(track.role)?3:0),reasons:[`登録済み / ${e.verifiedAt}`,e.range?`MIDI音域 ${e.range.join('–')}`:'音域未確認',...matched.map(t=>`登録タグ: ${t}`)],unconfirmed:intent.tags.filter(t=>!e.tags.includes(t))};
  }).sort((a,b)=>b.score-a.score||a.entry.id.localeCompare(b.entry.id)).slice(0,3).map((c,i)=>({...c,label:'ABC'[i]}));
  return{intent,track,candidates,context:copy(p.musicalSettings||{}),auditionAvailable:false,hostApplied:false};
 }
 function preview(p,{trackId,entryId,machineId,expression={}}){
  const w=workspace(p),track=tracks(p).find(t=>t.id===trackId),entry=w.registry.entries.find(e=>e.id===entryId);
  if(!track||!entry||!entry.installed||entry.machineId!==machineId)throw Error('instrument-unavailable');
  if(track.range&&(!entry.range||track.range[0]<entry.range[0]||track.range[1]>entry.range[1]))throw Error('instrument-range-unconfirmed');
  const velocityScale=expression.velocityScale??1,timingTicks=expression.timingTicks??0,lengthScale=expression.lengthScale??1;
  if(!Number.isFinite(velocityScale)||velocityScale<0.5||velocityScale>1.5||!Number.isFinite(lengthScale)||lengthScale<0.5||lengthScale>1.5)throw Error('expression-out-of-range');integer(timingTicks,-120,120);
  if(Object.keys(expression).some(k=>!['velocityScale','timingTicks','lengthScale'].includes(k)))throw Error('unknown-expression-control');
  const source=p.midiData.tracks.find(t=>t.id===trackId),notes=source.notes.map(n=>({...copy(n),velocity:Math.max(1,Math.min(127,Math.round(n.velocity*velocityScale))),startTick:Math.max(0,n.startTick+timingTicks),durationTicks:Math.max(1,Math.round(n.durationTicks*lengthScale))}));
  const plan={trackId,entry:copy(entry),expression:{velocityScale,timingTicks,lengthScale},before:copy(source.notes),after:notes,logicTrackId:null,hostApplied:false,method:'manual-patch-or-template'};
  proofs.set(plan,{baseline:JSON.stringify(p),plan:JSON.stringify(plan)});return plan;
 }
 function apply(p,plan,{approved=false}={}){const proof=proofs.get(plan);if(!approved||!proof||proof.baseline!==JSON.stringify(p)||proof.plan!==JSON.stringify(plan))throw Error('instrument-unapproved-or-stale');const next=copy(p),w=workspace(p),t=next.midiData.tracks.find(t=>t.id===plan.trackId);w.history.push({trackId:t.id,before:w.assignments[t.id]||null,after:copy(plan),beforeNotes:copy(t.notes),afterNotes:copy(plan.after)});w.assignments[t.id]=copy(plan);t.notes=copy(plan.after);next.logicInstruments=w;return next}
 function undo(p,{approved=false}={}){if(!approved)throw Error('instrument-approval-required');const next=copy(p),w=workspace(p),h=[...w.history].reverse().find(h=>!h.undone);if(!h)throw Error('instrument-history-empty');const t=next.midiData.tracks.find(t=>t.id===h.trackId);if(!t||!same(t.notes,h.afterNotes)||!same(w.assignments[h.trackId],h.after))throw Error('instrument-manual-edit-conflict');t.notes=copy(h.beforeNotes);if(h.before)w.assignments[t.id]=copy(h.before);else delete w.assignments[t.id];h.undone=true;next.logicInstruments=w;return next}
 function audit(p,machineId){const w=workspace(p);return Object.entries(w.assignments).map(([trackId,a])=>{const e=w.registry.entries.find(e=>e.id===a.entry.id);return{trackId,status:!p.midiData?.tracks.some(t=>t.id===trackId)?'track-missing':!e||!e.installed||e.machineId!==machineId?'instrument-missing':e.version!==a.entry.version?'version-mismatch':'manual-host-verification-required'}})}
 function handoff(p,machineId){return{version:1,hostApplied:false,projectId:p.projectId,musicalSettings:copy(p.musicalSettings),tracks:tracks(p),assignments:copy(workspace(p).assignments),audit:audit(p,machineId),steps:['Logicで別名保存して作業用コピーを作成','Music StudioのType 1 MIDIを読み込む','Track ID・名前・チャンネル・音域を照合して対応を手動確認','対象Trackを選び、登録済みPatch / Channel Strip / テンプレートを手動で読み込む','音と奏法を確認してLogic側で別名保存'],limitation:'Logicプロジェクトやプラグイン内部状態の復元ではありません。自動割り当て未対応。'};}
 root.NovaLogicInstruments={registry,workspace,register,tracks,parse,recommend,preview,apply,undo,audit,handoff};
})(typeof window!=='undefined'?window:globalThis);
