const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
function load(){const window={TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob};window.window=window;vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-midi.js'),'utf8'),{window,globalThis:window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,unescape,encodeURIComponent},{filename:'music-studio-midi.js'});return window.MusicStudioMidi}function base(midi){return midi.createTestMidiData()}
for(const [value,expected] of [[0,[0]],[127,[127]],[128,[129,0]],[16383,[255,127]],[16384,[129,128,0]],[0x0fffffff,[255,255,255,127]]])test(`VLQ ${value}`,()=>assert.deepEqual([...load().encodeVariableLengthQuantity(value)],expected));
for(const value of [-1,1.5,0x10000000,NaN])test(`VLQ rejects ${value}`,()=>assert.throws(()=>load().encodeVariableLengthQuantity(value)));
for(const signature of ['4/4','3/4','6/8','5/4','7/8'])test(`time signature ${signature}`,()=>assert.ok(load().parseTimeSignature(signature)));
for(const signature of ['4/3','0/4','',null])test(`rejects time signature ${signature}`,()=>assert.equal(load().parseTimeSignature(signature),null));
test('header is MThd Type 1 with count and PPQ',()=>{const bytes=load().createMidiHeader(3,480);assert.equal(String.fromCharCode(...bytes.slice(0,4)),'MThd');assert.deepEqual([...bytes.slice(8,14)],[0,1,0,3,1,224])});
test('test MIDI creates tempo plus two note tracks',()=>{const midi=load(),result=midi.createMidiFile(base(midi));assert.equal(result.inspection.type,1);assert.equal(result.inspection.trackCount,3);assert.equal(result.inspection.ppq,480)});
test('every generated track has End of Track',()=>{const midi=load(),result=midi.createMidiFile(base(midi));assert.ok(result.inspection.tracks.every(track=>track.endOfTrack))});
test('explicit song length sets End of Track without changing notes',()=>{const midi=load(),data=base(midi);data.totalTick=16*4*480;const long=midi.createMidiFile(data);data.totalTick=12*4*480;const short=midi.createMidiFile(data);assert.equal(long.inspection.totalTick,30720);assert.equal(short.inspection.totalTick,23040);assert.equal(long.inspection.noteOnCount,short.inspection.noteOnCount);assert.equal(long.inspection.noteOffCount,short.inspection.noteOffCount);assert.ok(short.inspection.tracks.every(track=>track.endOfTrackTick===23040))});
test('generated MIDI has ten balanced notes',()=>{const midi=load(),result=midi.createMidiFile(base(midi));assert.equal(result.inspection.noteOnCount,10);assert.equal(result.inspection.noteOffCount,10)});
for(const bpm of [20,40,120,132,300,400])test(`valid BPM ${bpm}`,()=>{const midi=load(),data=base(midi);data.tempo=bpm;assert.equal(midi.validateMidiProjectData(data).ok,true);assert.equal(midi.createMidiFile(data).inspection.ok,true)});
for(const bpm of [0,-1,'bad',401])test(`invalid BPM ${bpm}`,()=>{const midi=load(),data=base(midi);data.tempo=bpm;assert.equal(midi.validateMidiProjectData(data).ok,false)});
test('Japanese track names are UTF-8 inspected',()=>{const midi=load(),result=midi.createMidiFile(base(midi));assert.equal(result.inspection.tracks[1].name,'Piano ピアノ')});
test('empty track name receives fallback',()=>{const midi=load(),data=base(midi);data.tracks[0].name='';assert.equal(midi.validateMidiProjectData(data).data.tracks[0].name,'Track 1')});
test('channels 1 and 16 are valid',()=>{const midi=load(),data=base(midi);data.tracks[0].channel=16;assert.equal(midi.validateMidiProjectData(data).ok,true)});
for(const channel of [0,17,'x'])test(`invalid channel ${channel}`,()=>{const midi=load(),data=base(midi);data.tracks[0].channel=channel;assert.equal(midi.validateMidiProjectData(data).ok,false)});
for(const [field,value] of [['pitch',128],['pitch',-1],['velocity',0],['velocity',128],['startTick',-1],['durationTicks',0]])test(`invalid note ${field} ${value}`,()=>{const midi=load(),data=base(midi);data.tracks[0].notes[0][field]=value;assert.equal(midi.validateMidiProjectData(data).ok,false)});
test('chords and simultaneous events remain balanced',()=>{const midi=load(),data=base(midi);data.tracks[0].notes.push({id:'chord',pitch:64,startTick:0,durationTicks:480,velocity:90});const result=midi.createMidiFile(data);assert.equal(result.inspection.noteOnCount,result.inspection.noteOffCount)});
test('same-tick Note Off and Note On remain valid',()=>{const midi=load(),data=base(midi);data.tracks[0].notes=[{id:'a',pitch:60,startTick:0,durationTicks:480,velocity:100},{id:'b',pitch:60,startTick:480,durationTicks:480,velocity:100}];assert.equal(midi.createMidiFile(data).inspection.ok,true)});
for(const kind of ['tracks','notes','muted'])test(`empty prevention ${kind}`,()=>{const midi=load(),data=base(midi);if(kind==='tracks')data.tracks=[];if(kind==='notes')data.tracks.forEach(track=>track.notes=[]);if(kind==='muted')data.tracks.forEach(track=>track.muted=true);assert.throws(()=>midi.createMidiFile(data))});
test('Blob has MIDI MIME and nonzero size',()=>{const midi=load(),result=midi.createMidiFile(base(midi)),blob=midi.createMidiBlob(result.bytes);assert.equal(blob.type,'audio/midi');assert.ok(blob.size>0)});
test('inspector rejects a bad header',()=>assert.equal(load().inspectMidiBytes(Uint8Array.from([1,2,3,4])).ok,false));
test('inspector rejects a truncated track',()=>{const midi=load(),result=midi.createMidiFile(base(midi));assert.equal(midi.inspectMidiBytes(result.bytes.slice(0,-1)).ok,false)});
test('inspector rejects trailing data',()=>{const midi=load(),result=midi.createMidiFile(base(midi)),bytes=new Uint8Array(result.bytes.length+1);bytes.set(result.bytes);assert.equal(midi.inspectMidiBytes(bytes).ok,false)});
test('validation warns about duplicate IDs',()=>{const midi=load(),data=base(midi);data.tracks[0].notes[1].id=data.tracks[0].notes[0].id;assert.match(midi.validateMidiProjectData(data).warnings.join(''),/重複/)});
test('program values are optional but bounded',()=>{const midi=load(),data=base(midi);data.tracks[0].program=128;assert.equal(midi.validateMidiProjectData(data).ok,false);delete data.tracks[0].program;assert.equal(midi.validateMidiProjectData(data).ok,true)});
test('Melody, Drums and Bass export as separate named MIDI tracks',()=>{
  const midi=load(),data={version:1,ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},tracks:[
    {id:'melody',name:'Melody',channel:1,program:0,notes:[{id:'m1',pitch:60,startTick:0,durationTicks:480,velocity:90}]},
    {id:'drums',name:'Drums',channel:10,program:null,notes:[{id:'d1',pitch:36,startTick:120,durationTicks:240,velocity:110}]},
    {id:'bass',name:'Bass',channel:2,program:32,notes:[{id:'b1',pitch:28,startTick:240,durationTicks:960,velocity:88}]}
  ]},result=midi.createMidiFile(data);
  assert.equal(result.inspection.trackCount,4);
  assert.equal(JSON.stringify(result.inspection.tracks.slice(1).map(track=>track.name)),JSON.stringify(['Melody','Drums','Bass']));
  assert.equal(result.inspection.noteOnCount,3);
  assert.equal(result.inspection.noteOffCount,3);
  assert.equal(result.validation.data.tracks.find(track=>track.name==='Drums').channel,10);
  assert.equal(result.validation.data.tracks.find(track=>track.name==='Drums').program,null);
  assert.equal(JSON.stringify(result.validation.data.tracks.find(track=>track.name==='Drums').notes[0]),'{"id":"d1","pitch":36,"startTick":120,"durationTicks":240,"velocity":110}');
  assert.equal(result.validation.data.tracks.find(track=>track.name==='Bass').channel,2);
  assert.equal(result.validation.data.tracks.find(track=>track.name==='Bass').program,32);
  assert.equal(JSON.stringify(result.validation.data.tracks.find(track=>track.name==='Bass').notes[0]),'{"id":"b1","pitch":28,"startTick":240,"durationTicks":960,"velocity":88}');
});
