// Synthetic, in-memory integration with an explicitly supplied exact #265 module.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),meterPath=process.argv[2];
if(!meterPath)throw Error('Supply the exact meter module path; do not substitute a stub.');
const w={};w.window=w;
for(const file of [path.join(root,'music-studio-editor.js'),meterPath,path.join(root,'music-studio-measure-locks.js')])vm.runInNewContext(fs.readFileSync(file,'utf8'),w,{filename:file});
const core=w.MusicStudioEditor,locks=w.MusicStudioMeasureLocks,meter=w.MusicStudioMeterMap,plain=v=>JSON.parse(JSON.stringify(v));
const cases=[
 {name:'4/4',initial:[4,4],changes:[],measure:2,expected:[1920,3840]},
 {name:'6/8',initial:[6,8],changes:[],measure:2,expected:[1440,2880]},
 {name:'3/4',initial:[3,4],changes:[],measure:2,expected:[1440,2880]},
 {name:'boundary',initial:[4,4],changes:[[1920,3,4]],measure:2,expected:[1920,3360]},
 {name:'off-bar',initial:[4,4],changes:[[960,3,4]],measure:2,expected:[960,2400]},
 {name:'multiple',initial:[4,4],changes:[[960,3,4],[2500,5,8]],measure:4,expected:[2500,3700]},
 {name:'denominator',initial:[4,4],changes:[[960,6,8]],measure:2,expected:[960,2400]}
];
for(const item of cases){
 const project={midiData:{ppq:480,timeSignature:{numerator:item.initial[0],denominator:item.initial[1]},timeSignatureMap:[[0,...item.initial],...item.changes].map(([tick,numerator,denominator])=>({tick,numerator,denominator})),tempoMap:[{tick:960,bpm:90}],keySignatureMap:[{tick:960,sharps:-3,minor:true}],totalTick:12000,tracks:[{id:'lead',part:'melody',notes:[{id:'crossing',pitch:60,startTick:959,durationTicks:2,velocity:100}]}],editor:{measureCount:8,lockedMeasures:[1]}}};
 const original=plain(project),s=locks.createSession(project,core),before=plain(s.midiData),old=plain(locks.readState(s.midiData,core).tracks);
 const result=locks.addMeasureLock(s,core,meter,{trackId:'lead',startMeasure:item.measure});assert.equal(result.ok,true);assert.deepEqual([result.range.startTick,result.range.endTick],item.expected);
 const state=locks.readState(s.midiData,core);assert.deepEqual(plain(state.tracks.map(t=>t.legacyRanges)),old.map(t=>t.legacyRanges));
 // Exhaustively compare the old protected tick set, including each boundary's adjacent tick.
 const legacy=state.tracks.find(t=>t.trackId==='lead').legacyRanges,bar=480*4*item.initial[0]/item.initial[1];
 for(let tick=0;tick<7000;tick++)assert.equal(legacy.some(r=>tick>=r.startTick&&tick<r.endTick),tick<bar);
 for(const field of ['tracks','timeSignatureMap','tempoMap','keySignatureMap'])assert.deepEqual(plain(s.midiData[field]),before[field]);
 const reopened=locks.createSession(plain({midiData:s.midiData}),core);assert.deepEqual(plain(locks.readState(reopened.midiData,core)),plain(state));
 const protectedNote={id:'new-protected',pitch:70,startTick:item.expected[1]-1,durationTicks:1,velocity:90};const unchanged=plain(s);
 assert.equal(locks.edit(s,core,copy=>core.addNote(copy,protectedNote)).ok,false);assert.deepEqual(plain(s),unchanged);
 core.undo(s);assert.equal(s.midiData.editor.measureLocks,undefined);core.redo(s);assert.deepEqual(plain(locks.readState(s.midiData,core)),plain(state));
 const release=meter.rangeToTicks(s.midiData,1,1),oldState=plain(locks.readState(s.midiData,core));
 locks.unlockMeasures(s,core,meter,{trackId:'lead',startMeasure:1});
 for(let tick=0;tick<7000;tick++){
   const was=oldState.tracks.find(t=>t.trackId==='lead');
   const protectedBefore=[...was.legacyRanges,...was.rangeLocks].some(r=>tick>=r.startTick&&tick<r.endTick);
   assert.equal(locks.isProtected(s.midiData,core,'lead',{startTick:tick,durationTicks:1}),protectedBefore&&!(tick>=release.startTick&&tick<release.endTick));
 }
 const released=plain(locks.readState(s.midiData,core));core.undo(s);assert.deepEqual(plain(locks.readState(s.midiData,core)),oldState);core.redo(s);assert.deepEqual(plain(locks.readState(s.midiData,core)),released);
 assert.deepEqual(plain(locks.readState(locks.createSession(plain({midiData:s.midiData}),core).midiData,core)),released);
 assert.deepEqual(plain(project),original);console.log(item.name+': legacy tick set exact; new A boundary, partial unlock, JSON reopen and Undo/Redo PASS');
}
