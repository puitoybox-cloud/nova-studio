/* Offline acceptance for the public six-note fixture only. Never repairs MIDI. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const os=require('node:os');
const root=path.resolve(__dirname,'..');
const fixtureSha256='45c3a180b78015bae9e7441e12f7c2817611f19f88f73e03c2e0bc5b6411d9a3';
const expectedPitches=Object.freeze([60,64,67,72,67,60]);
const labels=Object.freeze(['Vocals','Drums','Bass','Guitar','Piano','Other']);
const onsetToleranceSeconds=0.05; // Existing synthetic accuracy regression tolerance; not a composition policy.
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function parser(){
  const context={TextDecoder,TextEncoder,Uint8Array,ArrayBuffer};context.window=context;
  vm.runInNewContext(fs.readFileSync(path.join(root,'music-studio-midi-parser.js'),'utf8'),context);
  return context.MusicStudioMidiParser;
}
function secondsAt(tick,ppq,map){
  let seconds=0,previous=0,micros=500000;
  for(const event of map){if(event.tick>tick)break;seconds+=(event.tick-previous)*micros/ppq/1e6;previous=event.tick;micros=event.microsecondsPerQuarter}
  return seconds+(tick-previous)*micros/ppq/1e6;
}
function inspect(sourceBytes,midiBytes){
  const report={format:'music-studio-synthetic-audio-acceptance',version:1,sourceSha256:digest(sourceBytes),midiSha256:digest(midiBytes),expectedVocals:[...expectedPitches],onsetToleranceSeconds,passed:false,errors:[],physicalVerification:'pending'};
  if(report.sourceSha256!==fixtureSha256){report.errors.push('source-fixture-mismatch');return report}
  let parsed;try{parsed=parser().parseMidiFile(new Uint8Array(midiBytes))}catch(error){report.errors.push('invalid-midi');report.parseError=error.message;return report}
  const n=parsed.normalized;
  report.midiType=parsed.header.format;report.ppq=n.ppq;
  report.warnings=parsed.validation.warnings.map(w=>w.code);
  if(parsed.header.format!==1)report.errors.push('type-1-required');
  if(!parsed.validation.importable)report.errors.push('midi-not-importable');
  const fatal=new Set(['unfinished-note','orphan-note-off','zero-duration','trailing-data','after-eot','extended-header']);
  for(const warning of report.warnings)if(fatal.has(warning))report.errors.push(`midi-${warning}`);
  const tempos=new Map();
  for(const event of n.tempoMap){if(tempos.has(event.tick)&&tempos.get(event.tick)!==event.microsecondsPerQuarter)report.errors.push('ambiguous-tempo');tempos.set(event.tick,event.microsecondsPerQuarter)}
  report.tracks=n.tracks.map(track=>({name:track.name,sourceTrackNumber:track.sourceTrackNumber,notes:track.notes.map(note=>({pitch:note.pitch,channel:note.channel,start:secondsAt(note.startTick,n.ppq,n.tempoMap),end:secondsAt(note.endTick,n.ppq,n.tempoMap)}))}));
  for(const label of labels){const count=report.tracks.filter(track=>track.name===label).length;if(count!==1)report.errors.push(`${count?'duplicate':'missing'}-stem:${label}`)}
  if(report.tracks.length!==7)report.errors.push('seven-tracks-required');
  for(const track of report.tracks)if(!labels.includes(track.name)&&track.notes.length)report.errors.push('unexpected-playable-track');
  const vocals=report.tracks.filter(track=>track.name==='Vocals');
  if(vocals.length===1){
    const notes=vocals[0].notes;report.actualVocals=notes.map(note=>note.pitch);
    if(notes.length!==expectedPitches.length)report.errors.push('vocal-note-count');
    notes.forEach((note,index)=>{
      if(note.pitch!==expectedPitches[index])report.errors.push(`vocal-pitch:${index+1}`);
      if(index<6&&Math.abs(note.start-index*0.75)>onsetToleranceSeconds+1e-9)report.errors.push(`vocal-onset:${index+1}`);
      if(note.end<=note.start||note.start<0||note.end>4.5+onsetToleranceSeconds)report.errors.push(`vocal-duration:${index+1}`);
      if(note.channel===10)report.errors.push('vocals-on-drum-channel');
      if(index&&note.start<notes[index-1].end-1e-9)report.errors.push('vocal-overlap');
    });
  }
  report.errors=[...new Set(report.errors)];report.passed=report.errors.length===0;return JSON.parse(JSON.stringify(report));
}
function inspectFiles(sourcePath,midiPath){
  const report=inspect(fs.readFileSync(sourcePath),fs.readFileSync(midiPath));
  report.helperSourceDigest=digest(fs.readFileSync(path.join(root,'tools/music-audio-pipeline/server.py')));
  report.executionEnvironment={platform:os.platform(),architecture:os.arch(),node:process.version};
  return report;
}
if(require.main===module){
  let report;
  try{if(process.argv.length!==4)throw Error('usage: node scripts/music-audio-acceptance.js SOURCE.wav RESULT.mid');report=inspectFiles(process.argv[2],process.argv[3])}
  catch(error){report={passed:false,errors:['acceptance-input-error'],error:error.message,physicalVerification:'pending'}}
  process.stdout.write(JSON.stringify(report,null,2)+'\n');process.exitCode=report.passed?0:1;
}
module.exports={inspect,inspectFiles,secondsAt,fixtureSha256};
