const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const prefix=fs.readFileSync('tests/music-studio-ai-midi-candidate-import.test.js','utf8').split('\ntest(')[0],fixture=new Function('require',prefix+'\nreturn fixture;')(require),plain=v=>JSON.parse(JSON.stringify(v));
function setup(){const f=fixture();f.s.editRange={startMeasure:1,endMeasure:4};return f;}
function candidate(f,variant=0,density='rich',chords='C F G7 C'){const source=f.C.remakeSource(f.s,f.core);return {candidateId:'ABC'[variant],value:f.C.bindEnsemble(f.C.midiCandidate(f.data,f.file,{key:'C',range:source.range},variant,480),source,chords,{name:'chorus',density,roles:['piano','bass','strings','drums'],range:source.range})};}
test('inversions minimize ordered voice motion and keep each required pitch class without crossing',()=>{const f=setup();const result=f.C.performanceVoicing([0,5,9],48,79,[60,64,67]);assert.deepEqual(plain(result),[60,65,69]);for(const symbol of ['C','Ebm','F#maj7','Bdim']){const chord=f.C.ensembleChords(symbol)[0],notes=f.C.performanceVoicing(chord.pcs,48,59,[48,52,55]);assert.equal(new Set(notes.map(n=>n%12)).size,chord.pcs.length);assert.ok(notes.every((n,i)=>i===0||n>notes[i-1]));}});
test('sparse drums keep backbeat and downbeat in time, with fewer hats; boundary fills bounded and variants differ',()=>{const f=setup();for(const density of ['sparse','normal','rich']){const c=candidate(f,0,density),first=f.C.drumPerformance(c.value,f.s,f.core,1),last=f.C.drumPerformance(c.value,f.s,f.core,4);assert.ok(first.some(n=>n.pitch===38&&n.startTick===480));assert.ok(first.some(n=>n.pitch===36&&n.startTick===0));assert.ok(last.every(n=>n.startTick+n.durationTicks<=7680));assert.equal(first.some(n=>n.pitch===50),false);assert.equal(last.some(n=>n.pitch===50),density!=='sparse');}const a=f.C.drumPerformance(candidate(f,0).value,f.s,f.core,4),b=f.C.drumPerformance(candidate(f,1).value,f.s,f.core,4),c=f.C.drumPerformance(candidate(f,2).value,f.s,f.core,4);assert.notDeepEqual(plain(a),plain(b));assert.notDeepEqual(plain(a),plain(c));});
test('diminished bass fifth stays in harmony and expression differs from fixed repeated velocity',()=>{const f=setup(),c=candidate(f,1,'rich','Bdim'),notes=f.C.chordEnsembleNotes(c.value,c.value.ensemble.source,f.s,f.core,'bass');assert.ok(notes.every(n=>[11,5].includes(n.pitch%12)));assert.ok(new Set(notes.map(n=>n.velocity)).size>1);assert.ok(notes.every(n=>n.pitch>=28&&n.pitch<=55));});
test('preview exposes bounded distribution metrics for each role, preserves original, adopts and undoes exactly',()=>{const f=setup(),before=plain(f.s.midiData),c=candidate(f),b=f.P.createPreview(f.s,f.core,c);assert.equal(b.companion.performance.length,4);for(const m of b.companion.performance){assert.equal(m.method,'note-distribution-only');assert.ok(m.notes>0);assert.ok(m.pitchMin>=0&&m.pitchMax<=127);}assert.deepEqual(plain(f.s.midiData),before);f.P.applyPreview(f.s,f.core,b,{startMeasure:2,endMeasure:3,roles:['strings','drums']});assert.deepEqual(plain(f.s.midiData.tracks.slice(0,3)),before.tracks);f.core.undo(f.s);assert.deepEqual(plain(f.s.midiData),before);});
test('suspended chords work in model-backed ensembles with arpeggios and 6/8 backbeats',()=>{
  const f=setup();
  f.s.midiData.timeSignature={numerator:6,denominator:8};
  f.s.midiData.timeSignatureMap=[];
  const c=candidate(f,2,'normal','Csus4');
  const notes=f.C.chordEnsembleNotes(c.value,c.value.ensemble.source,f.s,f.core,'piano');
  assert.deepEqual([...new Set(notes.map(note=>note.pitch%12))].sort((a,b)=>a-b),[0,5,7]);
  const drums=f.C.drumPerformance(c.value,f.s,f.core,1);
  assert.deepEqual(plain(drums.filter(note=>note.pitch===38).map(note=>note.startTick)),[720]);
});

test('strummed voicing opens the register while retaining the chord tones',()=>{
  const {C}=setup();
  const closed=C.performanceVoicing([0,4,7],48,79,[60,64,67]);
  const open=C.performanceVoicing([0,4,7],48,79,[60,64,67],true);
  assert.ok(open.at(-1)-open[0]>closed.at(-1)-closed[0]);
  assert.deepEqual([...open.map(pitch=>pitch%12)].sort((a,b)=>a-b),[0,4,7]);
});

test('drum backbeat and bass use the meter pulse across a change from 2/2 to 6/8',()=>{
  const f=setup();
  f.s.midiData.timeSignature={numerator:2,denominator:2};
  f.s.midiData.timeSignatureMap=[{tick:1920,numerator:6,denominator:8}];
  const c=candidate(f,0,'normal','C');
  const snare=bar=>f.C.drumPerformance(c.value,f.s,f.core,bar)
    .filter(note=>note.pitch===38).map(note=>note.startTick);
  assert.deepEqual(plain(snare(1)),[960]);
  assert.deepEqual(plain(snare(2)),[2640]);
  const bass=f.C.chordEnsembleNotes(c.value,c.value.ensemble.source,f.s,f.core,'bass');
  assert.deepEqual(plain(bass.filter(note=>note.startTick<3360).map(note=>note.startTick)),[0,960,1920,2640]);
});

test('confirmed progression follows selected measures and protects locked chords',()=>{
  const {C,s,core}=setup();
  const review={chords:'C F G7 C',rows:['C','F','G7','C'].map((symbol,index)=>({
    ...core.measureRangeToTicks({startMeasure:index+1,endMeasure:index+1},s.midiData),
    measure:index+1,symbol,locked:index===2
  }))};
  const range={startMeasure:2,endMeasure:3};
  assert.equal(C.scopedGenerationChords(s,core,range,review.chords,review),'F G7');
  assert.equal(C.scopedGenerationChords(s,core,range,'',review),'F G7');
  assert.equal(C.scopedGenerationChords(s,core,range,'Dm → G7',review),'Dm G7');
  assert.throws(()=>C.scopedGenerationChords(s,core,range,'F',review),/3小節の固定コード/);
  assert.throws(()=>C.scopedGenerationChords(s,core,{startMeasure:3,endMeasure:5},'',review),/全小節/);
});

test('altered extensions and slash chords preserve chord tones and lowest bass',()=>{
  const {C}=setup();
  const [chord,extended]=C.ensembleChords('G7b9/B → Cadd9');
  assert.deepEqual(plain(chord),{symbol:'G7b9/B',root:7,pcs:[7,11,2,5,8],bass:11});
  assert.deepEqual(plain(extended.pcs),[0,4,7,2]);
  const voicing=C.performanceVoicing(chord.pcs,40,72,[],true,chord.bass);
  assert.equal(voicing[0]%12,11);
  assert.deepEqual(plain(voicing.map(pitch=>pitch%12).sort((a,b)=>a-b)),[2,5,7,8,11]);
});
