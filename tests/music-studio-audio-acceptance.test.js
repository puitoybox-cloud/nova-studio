'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const {inspect,inspectFiles,secondsAt}=require('../scripts/music-audio-acceptance');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'tools/music-audio-pipeline/fixtures/synthetic_six_notes.wav'));
const pitches=[60,64,67,72,67,60],labels=['Vocals','Drums','Bass','Guitar','Piano','Other'];
const be16=n=>[n>>8,n&255],be32=n=>[n>>>24,(n>>>16)&255,(n>>>8)&255,n&255];
function vlq(n){const bytes=[n&127];while(n>>=7)bytes.unshift((n&127)|128);return bytes}
function meta(t,type,data){return[...vlq(t),255,type,...vlq(data.length),...data]}
function track(events){return[77,84,114,107,...be32(events.length),...events]}
function midi(options={}){
 const events=[];
 for(let i=0;i<(options.pitches||pitches).length;i++){
  events.push({tick:i*720+(options.offset||0),data:[0x90+(options.channel||0),(options.pitches||pitches)[i],100]});
  if(!(options.unfinished&&i===5))events.push({tick:i*720+672+(options.offset||0),data:[0x80+(options.channel||0),(options.pitches||pitches)[i],0]});
 }
 if(options.extra)events.push({tick:5000,data:[144,60,100]},{tick:5100,data:[128,60,0]});
 if(options.orphan)events.push({tick:0,data:[128,20,0]});
 events.sort((a,b)=>a.tick-b.tick);let last=0;
 const voice=[...meta(0,3,[...Buffer.from('Vocals')])];
 for(const event of events){voice.push(...vlq(event.tick-last),...event.data);last=event.tick}
 if(!options.missingEot)voice.push(...meta(0,47,[]));
 let names=options.names||labels;
 const conductor=[...meta(0,3,[...Buffer.from('Tempo')]),...meta(0,81,[7,161,32]),...meta(0,88,[4,2,24,8])];
 if(options.conflictTempo)conductor.push(...meta(0,81,[15,66,64]));
 conductor.push(...meta(0,47,[]));
 const tracks=[track(conductor),...names.map(name=>name==='Vocals'?track(voice):track([...meta(0,3,[...Buffer.from(name)]),...meta(0,47,[])]))];
 return Buffer.from([77,84,104,100,...be32(6),...be16(options.type||1),...be16(tracks.length),...be16(480),...tracks.flat(),...(options.trailing?[1,2]:[])]);
}
test('complete six-note synthetic output passes offline checks, device stays pending',()=>{const r=inspect(source,midi());assert.equal(r.passed,true);assert.deepEqual(r.actualVocals,pitches);assert.equal(r.tracks.length,7);assert.equal(r.physicalVerification,'pending')});
for(const [name,options,code] of [
 ['E4 becomes F4',{pitches:[60,65,67,72,67,60]},'vocal-pitch:2'],
 ['extra split notes',{pitches:[60,64,67,72,72,67,60]},'vocal-note-count'],
 ['missing note',{pitches:[60,64,67,72,67]},'vocal-note-count'],
 ['correct pitches but late onset',{offset:96},'vocal-onset:1'],
 ['unclosed note',{unfinished:true},'midi-unfinished-note'],
 ['orphan release',{orphan:true},'midi-orphan-note-off'],
 ['missing EOT',{missingEot:true},'midi-not-importable'],
 ['trailing bytes',{trailing:true},'midi-trailing-data'],
 ['missing stem',{names:labels.slice(0,5)},'missing-stem:Other'],
 ['duplicate vocals',{names:[...labels,'Vocals']},'duplicate-stem:Vocals'],
 ['drum channel vocals',{channel:9},'vocals-on-drum-channel'],
 ['conflicting same-tick tempos',{conflictTempo:true},'ambiguous-tempo'],
 ['extra notes after source end',{extra:true},'vocal-duration:7']
])test(`acceptance rejects ${name}`,()=>{const r=inspect(source,midi(options));assert.equal(r.passed,false);assert.ok(r.errors.includes(code),JSON.stringify(r.errors));assert.equal(r.physicalVerification,'pending')});
test('fixture mismatch refuses to grade arbitrary unpublished audio',()=>{const r=inspect(Buffer.from('other audio'),midi());assert.deepEqual(r.errors,['source-fixture-mismatch']);assert.equal(r.tracks,undefined)});
test('malformed MIDI fails closed without mutation',()=>{const data=Buffer.from([1,2,3]),before=Buffer.from(data);const r=inspect(source,data);assert.deepEqual(r.errors,['invalid-midi']);assert.deepEqual(data,before)});
test('actual September captured failure remains a failure without repairing its bytes',()=>{const data=fs.readFileSync(path.join(root,'tools/music-audio-pipeline/fixtures/observed_six_notes_stems.mid')),before=Buffer.from(data);const r=inspect(source,data);assert.equal(r.passed,false);assert.ok(r.errors.includes('vocal-note-count'));assert.ok(r.actualVocals.includes(65));assert.deepEqual(data,before)});
test('global tempo changes calculate onset seconds instead of using a single BPM',()=>{const map=[{tick:0,microsecondsPerQuarter:500000},{tick:480,microsecondsPerQuarter:1000000}];assert.equal(secondsAt(960,480,map),1.5);assert.equal(secondsAt(240,480,map),.25)});
test('input byte arrays are unchanged by successful inspection',()=>{const data=midi(),copy=Buffer.from(data),src=Buffer.from(source);inspect(source,data);assert.deepEqual(data,copy);assert.deepEqual(source,src)});
test('CLI records hashes and host environment without claiming physical verification or writing inputs',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'nova-acceptance-'));
 try{const wav=path.join(folder,'source.wav'),mid=path.join(folder,'result.mid');fs.writeFileSync(wav,source);fs.writeFileSync(mid,midi());const before=fs.readFileSync(mid);
 const result=spawnSync(process.execPath,[path.join(root,'scripts/music-audio-acceptance.js'),wav,mid],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);const r=JSON.parse(result.stdout);assert.match(r.midiSha256,/^[a-f0-9]{64}$/);assert.match(r.helperSourceDigest,/^[a-f0-9]{64}$/);assert.equal(r.executionEnvironment.platform,os.platform());assert.equal(r.physicalVerification,'pending');assert.deepEqual(fs.readFileSync(mid),before);assert.deepEqual(inspectFiles(wav,mid).actualVocals,pitches);
 }finally{fs.rmSync(folder,{recursive:true,force:true})}
});
test('CLI missing input exits nonzero with machine-readable failure',()=>{const r=spawnSync(process.execPath,[path.join(root,'scripts/music-audio-acceptance.js')],{encoding:'utf8'});assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).passed,false)});
test('real model conversion verifier consumes byte acceptance instead of pitch-only success',()=>{const s=fs.readFileSync(path.join(root,'tools/music-audio-pipeline/verify_real_conversion.py'),'utf8');assert.match(s,/subprocess.run/);assert.match(s,/music-audio-acceptance.js/);assert.match(s,/checked.returncode == 0 and report\["acceptance"\]\["passed"\]/)});
