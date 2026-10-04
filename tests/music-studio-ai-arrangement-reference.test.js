const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const plain=v=>JSON.parse(JSON.stringify(v));
function fixture(){const w={};w.window=w;w.globalThis=w;for(const f of ['music-studio-meter-map.js','music-studio-measure-locks.js','music-studio-editor.js','music-studio-ai-workflow.js','music-studio-ai-composition.js'])vm.runInNewContext(fs.readFileSync(f,'utf8'),w);const p={projectId:'references',revision:1,midiData:{ppq:480,timeSignature:{numerator:4,denominator:4},timeSignatureMap:[{tick:1000,numerator:3,denominator:8}],editor:{measureCount:4,editRange:{startMeasure:1,endMeasure:4}},tracks:[{id:'melody',part:'melody',notes:[]},{id:'bass',part:'bass',notes:[]},{id:'drums',part:'drums',notes:[]}]}},core=w.MusicStudioEditor,s=core.createCoordinatedSession(p),C=w.MusicStudioAIComposition,ctx=C.createContext(p,s,core),ws=w.MusicStudioAIWorkflow.createWorkspace(p);for(const kind of ['section','chord','arrangement'])w.MusicStudioAIWorkflow.createCandidateSet(ws,kind,{range:ctx.range},C.candidateValues(kind,ctx),{adapter:'local-test'});const value=ws.candidateSets.at(-1).candidates[1].value;return{core,s,ws,value,C}}
const inspect=(f,range={startMeasure:3,endMeasure:4})=>f.C.arrangementReferencePreview(f.value,f.ws,f.s,f.core,range);
test('Arrangement identity inspection uses exact stored Section/Chord and preserves excluded entry, source and unknown fields',()=>{const f=fixture();f.ws.future={opaque:true};f.ws.candidateSets[1].candidates[1].value.future='retained';const before=plain({ws:f.ws,s:f.s});const p=inspect(f);assert.equal(p.timeline.entryAnchors.length,0);assert.equal(p.references.length,2);assert.equal(p.references[1].value.future,'retained');assert.equal(p.references[0].section.segments[0].startTick,1720);assert.match(f.C.arrangementReferenceRows(p).join('|'),/harmony not assessed/);p.references[1].value.future='mutated';assert.deepEqual(plain({ws:f.ws,s:f.s}),before);assert.equal(inspect(f,{startMeasure:2,endMeasure:2}).timeline.entryAnchors[0].startTick,1000)});
for(const kind of ['section','chord'])for(const [label,change,error] of [
 ['missing', (f,set)=>f.ws.candidateSets.splice(f.ws.candidateSets.indexOf(set),1),new RegExp('missing-arrangement-'+kind+'-reference')],
 ['duplicate set',(f,set)=>f.ws.candidateSets.push(plain(set)),new RegExp('ambiguous-arrangement-'+kind+'-reference')],
 ['duplicate candidate',(f,set)=>set.candidates.push(plain(set.candidates[1])),new RegExp('ambiguous-arrangement-'+kind+'-reference')],
 ['wrong kind',(f,set)=>set.candidates[1].value.kind='melody',new RegExp('incompatible-arrangement-'+kind+'-reference')],
 ['wrong variant',(f,set)=>set.candidates[1].value.candidateFamily.variant='A',new RegExp('incompatible-arrangement-'+kind+'-reference')],
 ['key conflict',(f,set)=>set.candidates[1].value.key='G',new RegExp('incompatible-arrangement-'+kind+'-reference')],
 ['range conflict',(f,set)=>set.candidates[1].value.range.endTick++,new RegExp('incompatible-arrangement-'+kind+'-reference')],
 ['malformed collection',(f,set)=>set.candidates=null,/invalid-arrangement-reference-candidates/]
])test(`Arrangement ${kind} ${label} fails closed without mutations`,()=>{const f=fixture(),set=f.ws.candidateSets.find(x=>x.kind===kind);change(f,set);const before=plain({ws:f.ws,s:f.s});assert.throws(()=>inspect(f),error);assert.deepEqual(plain({ws:f.ws,s:f.s}),before)});
test('Malformed excluded Section source and invalid Arrangement anchors cannot hide behind partial reference inspection',()=>{const f=fixture();f.ws.candidateSets[0].candidates[1].value.plan[0].bars=0;assert.throws(()=>inspect(f),/invalid-section-part/);const g=fixture();g.value.entry=99;assert.throws(()=>inspect(g),/invalid-arrangement-entry/);assert.throws(()=>inspect(fixture(),{startMeasure:0,endMeasure:1}),/invalid-arrangement-selection/)});

test('Arrangement existing track inspection follows core roles and exact IDs, validates excluded entry and retains unknown fields',()=>{
 const f=fixture();f.s.midiData.tracks[0].id='exact-Melody';f.s.midiData.tracks[0].future={opaque:true};const before=plain({ws:f.ws,s:f.s});const p=f.C.arrangementTrackPreview(f.value,f.ws,f.s,f.core,{startMeasure:3,endMeasure:4});assert.equal(p.timeline.entryAnchors.length,0);assert.deepEqual(plain(p.trackTargets),[{role:'melody',trackId:'exact-Melody'},{role:'bass',trackId:'bass'}]);assert.match(f.C.arrangementReferenceRows(p).join('|'),/no destination binding/);p.trackTargets[0].trackId='changed';assert.deepEqual(plain({ws:f.ws,s:f.s}),before);
});
for(const [label,change,error] of [
 ['missing role',f=>f.s.midiData.tracks.splice(0,1),/missing-arrangement-track-role:melody/],
 ['ambiguous role',f=>f.s.midiData.tracks.push({id:'other',part:'melody',notes:[]}),/ambiguous-arrangement-track-role:melody/],
 ['duplicate ID',f=>f.s.midiData.tracks.push({id:'melody',part:'bass',notes:[]}),/duplicate-arrangement-track-id/],
 ['invalid ID',f=>f.s.midiData.tracks[2].id=' ',/invalid-arrangement-track-id/],
 ['null track',f=>f.s.midiData.tracks.push(null),/invalid-arrangement-track-id/],
 ['malformed tracks',f=>f.s.midiData.tracks=null,/arrangement-tracks-unavailable/],
 ['unknown role',f=>f.value.tracks=['unknown'],/missing-arrangement-track-role:unknown/],
 ['no roleAssignment fallback',f=>{f.s.midiData.tracks[0].id='external';delete f.s.midiData.tracks[0].part;f.s.midiData.tracks[0].roleAssignment='melody'},/missing-arrangement-track-role:melody/],
 ['invalid excluded source',f=>f.ws.candidateSets[0].candidates[1].value.plan[0].bars=0,/invalid-section-part/]
])test(`Arrangement track ${label} refuses read-only inspection`,()=>{const f=fixture();change(f);const before=plain({ws:f.ws,s:f.s});assert.throws(()=>f.C.arrangementTrackPreview(f.value,f.ws,f.s,f.core,{startMeasure:3,endMeasure:4}),error);assert.deepEqual(plain({ws:f.ws,s:f.s}),before)});
test('Arrangement core canonical ID roles remain supported without part metadata',()=>{const f=fixture();for(const t of f.s.midiData.tracks)delete t.part;assert.equal(f.C.arrangementTrackPreview(f.value,f.ws,f.s,f.core).trackTargets.length,2)});

for(const range of [null,{startMeasure:2,endMeasure:2},{startMeasure:3,endMeasure:4}])test('Explicit Arrangement destination identity inspection preserves data with range '+JSON.stringify(range),()=>{
 const f=fixture();f.s.midiData.tracks[0].id='exact-Melody';f.s.midiData.tracks[0].future={opaque:true};const before=plain({ws:f.ws,s:f.s});const p=f.C.arrangementDestinationPreview(f.value,f.ws,f.s,f.core,{role:'melody',trackId:'exact-Melody'},range);assert.equal(p.destinationInspection.trackId,'exact-Melody');assert.deepEqual(plain(p.destinationInspection.range),plain(p.timeline.range));assert.match(f.C.arrangementReferenceRows(p).join('|'),/write compatibility unassessed/);p.destinationInspection.range.startTick=99;assert.deepEqual(plain({ws:f.ws,s:f.s}),before);
});
for(const target of [null,{}, {role:'melody',trackId:''},{role:'bass',trackId:'melody'},{role:'melody',trackId:'missing'},{role:'drums',trackId:'drums'}])test('Explicit destination rejects '+JSON.stringify(target),()=>{const f=fixture(),before=plain({ws:f.ws,s:f.s});assert.throws(()=>f.C.arrangementDestinationPreview(f.value,f.ws,f.s,f.core,target),/arrangement-destination/);assert.deepEqual(plain({ws:f.ws,s:f.s}),before)});
for(const [label,change,error] of [
 ['duplicate ID',f=>f.s.midiData.tracks.push(plain(f.s.midiData.tracks[0])),/duplicate-arrangement-track-id/],
 ['ambiguous role',f=>f.s.midiData.tracks.push({id:'other',part:'melody',notes:[]}),/ambiguous-arrangement-track-role/],
 ['orphan',f=>f.s.midiData.tracks.shift(),/missing-arrangement-track-role/],
 ['malformed',f=>f.s.midiData.tracks=null,/arrangement-tracks-unavailable/],
 ['excluded source',f=>f.ws.candidateSets[0].candidates[1].value.plan[0].bars=0,/invalid-section-part/],
 ['reference conflict',f=>f.ws.candidateSets[1].candidates[1].value.key='G',/incompatible-arrangement-chord-reference/]
])test('Destination revalidates '+label+' before partial inspection',()=>{const f=fixture();change(f);const before=plain({ws:f.ws,s:f.s});assert.throws(()=>f.C.arrangementDestinationPreview(f.value,f.ws,f.s,f.core,{role:'melody',trackId:'melody'},{startMeasure:3,endMeasure:4}),error);assert.deepEqual(plain({ws:f.ws,s:f.s}),before)});
