/* MS-05: dependency-free Standard MIDI File Type 1 writer and independent inspector. */
(function(root){
  'use strict';
  const MAX_VLQ=0x0fffffff,MAX_NOTES=100000,MAX_TICK=MAX_VLQ;
  const encoder=()=>typeof root.TextEncoder==='function'?new root.TextEncoder():null;
  function utf8(value){const text=String(value??'');const native=encoder();if(native)return [...native.encode(text)];return [...unescape(encodeURIComponent(text))].map(char=>char.charCodeAt(0))}
  function u16(value){return[(value>>>8)&255,value&255]}
  function u32(value){return[(value>>>24)&255,(value>>>16)&255,(value>>>8)&255,value&255]}
  function encodeVariableLengthQuantity(value){if(!Number.isInteger(value)||value<0||value>MAX_VLQ)throw new RangeError('可変長数値は0〜268435455の整数で指定してください。');let buffer=value&0x7f,out=[];while((value>>>=7))buffer=(buffer<<8)|((value&0x7f)|0x80);for(;;){out.push(buffer&255);if(buffer&0x80)buffer>>>=8;else break}return Uint8Array.from(out)}
  function safeInt(value,min,max){const number=Number(value);return Number.isInteger(number)&&number>=min&&number<=max?number:null}
  function parseTimeSignature(value){let numerator,denominator;if(typeof value==='string')[numerator,denominator]=value.split('/').map(Number);else({numerator,denominator}=(value||{}));if(!Number.isInteger(numerator)||numerator<1||numerator>255||![1,2,4,8,16,32].includes(denominator))return null;return{numerator,denominator}}
  function validateMidiProjectData(input){
    const errors=[],warnings=[],data=input&&typeof input==='object'?input:{};
    const ppq=safeInt(data.ppq,24,0x7fff);if(ppq===null)errors.push('PPQは24〜32767の整数で指定してください。');
    const tempo=Number(data.tempo);if(!Number.isFinite(tempo)||tempo<20||tempo>400)errors.push('BPMは20〜400で指定してください。');
    const timeSignature=parseTimeSignature(data.timeSignature);if(!timeSignature)errors.push('拍子は1〜255／1・2・4・8・16・32で指定してください。');
    if(!Array.isArray(data.tracks)||data.tracks.length===0)errors.push('演奏トラックがありません。');
    const ids=new Set(),tracks=[];let noteCount=0;
    for(const [trackIndex,track] of (Array.isArray(data.tracks)?data.tracks:[]).entries()){
      const name=String(track?.name||`Track ${trackIndex+1}`).trim().slice(0,255)||`Track ${trackIndex+1}`;
      const channel=safeInt(track?.channel,1,16);if(channel===null)errors.push(`${name}のMIDIチャンネルは1〜16で指定してください。`);
      const program=track?.program==null?null:safeInt(track.program,0,127);if(track?.program!=null&&program===null)errors.push(`${name}のProgram Changeは0〜127で指定してください。`);
      if(track?.muted===true){warnings.push(`${name}はミュートのため書き出し対象外です。`);continue}
      const notes=[];if(!Array.isArray(track?.notes))errors.push(`${name}のnotesが配列ではありません。`);
      for(const [noteIndex,note] of (Array.isArray(track?.notes)?track.notes:[]).entries()){
        const id=String(note?.id||`${track?.id||trackIndex}-${noteIndex}`);if(ids.has(id))warnings.push(`ノートID ${id} が重複しています。`);ids.add(id);
        const pitch=safeInt(note?.pitch,0,127),startTick=safeInt(note?.startTick,0,MAX_TICK),durationTicks=safeInt(note?.durationTicks,1,MAX_TICK),velocity=safeInt(note?.velocity,1,127);
        if(pitch===null)errors.push(`${name}のノート${noteIndex+1}のpitchは0〜127で指定してください。`);
        if(startTick===null)errors.push(`${name}のノート${noteIndex+1}の開始tickが不正です。`);
        if(durationTicks===null)errors.push(`${name}のノート${noteIndex+1}の長さは1以上で指定してください。`);
        if(velocity===null)errors.push(`${name}のノート${noteIndex+1}のvelocityは1〜127で指定してください。`);
        if(startTick!==null&&durationTicks!==null&&startTick+durationTicks>MAX_TICK)errors.push(`${name}のノート${noteIndex+1}の終了tickが上限を超えます。`);
        if([pitch,startTick,durationTicks,velocity].every(value=>value!==null))notes.push({id,pitch,startTick,durationTicks,velocity});
        noteCount++;
      }
      if(notes.length===0)warnings.push(`${name}にノートがありません。`);
      tracks.push({id:String(track?.id||`track-${trackIndex+1}`),name,channel:channel??1,program,notes});
    }
    if(noteCount===0)errors.push('書き出せるノートがありません。空のMIDIは生成しません。');
    if(noteCount>MAX_NOTES)errors.push(`ノート数が安全上限${MAX_NOTES.toLocaleString()}件を超えています。`);else if(noteCount>10000)warnings.push('ノート数が10,000件を超えるため、書き出しに時間がかかる場合があります。');
    return{ok:errors.length===0,errors,warnings,data:{version:Number(data.version)||1,ppq:ppq??480,tempo:Number.isFinite(tempo)?tempo:120,timeSignature:timeSignature||{numerator:4,denominator:4},tracks},trackCount:tracks.filter(track=>track.notes.length).length,noteCount};
  }
  function meta(type,data){return[0xff,type,...encodeVariableLengthQuantity(data.length),...data]}
  function event(delta,bytes){return[...encodeVariableLengthQuantity(delta),...bytes]}
  function chunk(id,data){return Uint8Array.from([...utf8(id),...u32(data.length),...data])}
  function createMidiHeader(trackCount,ppq){if(!Number.isInteger(trackCount)||trackCount<1||trackCount>0xffff)throw Error('MIDIトラック数が不正です。');if(!Number.isInteger(ppq)||ppq<24||ppq>0x7fff)throw Error('PPQが不正です。');return Uint8Array.from([...utf8('MThd'),...u32(6),...u16(1),...u16(trackCount),...u16(ppq)]) }
  function createTempoTrack(data){const micros=Math.round(60000000/data.tempo);if(micros<1||micros>0xffffff)throw Error('BPMをテンポイベントへ変換できません。');const ts=data.timeSignature,exponent=Math.log2(ts.denominator);const body=[...event(0,meta(0x03,utf8('Tempo & Signature'))),...event(0,meta(0x51,[(micros>>>16)&255,(micros>>>8)&255,micros&255])),...event(0,meta(0x58,[ts.numerator,exponent,24,8])),...event(0,meta(0x2f,[]))];return chunk('MTrk',body)}
  function createNoteTrack(track){const channel=track.channel-1,events=[];if(track.program!==null)events.push({tick:0,order:1,bytes:[0xc0|channel,track.program]});for(const note of track.notes){events.push({tick:note.startTick,order:2,bytes:[0x90|channel,note.pitch,note.velocity]});events.push({tick:note.startTick+note.durationTicks,order:0,bytes:[0x80|channel,note.pitch,0]})}events.sort((a,b)=>a.tick-b.tick||a.order-b.order||a.bytes[1]-b.bytes[1]);let previous=0;const body=[...event(0,meta(0x03,utf8(track.name)))];for(const item of events){body.push(...event(item.tick-previous,item.bytes));previous=item.tick}body.push(...event(0,meta(0x2f,[])));return chunk('MTrk',body)}
  function concat(parts){const size=parts.reduce((sum,part)=>sum+part.length,0),bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}return bytes}
  function createMidiFile(input){const checked=validateMidiProjectData(input);if(!checked.ok){const error=Error(checked.errors.join(' '));error.validation=checked;throw error}const playable=checked.data.tracks.filter(track=>track.notes.length);const tracks=[createTempoTrack(checked.data),...playable.map(createNoteTrack)];const bytes=concat([createMidiHeader(tracks.length,checked.data.ppq),...tracks]);const inspection=inspectMidiBytes(bytes);if(!inspection.ok){const error=Error(`生成後のMIDI検査に失敗しました：${inspection.errors.join(' ')}`);error.inspection=inspection;throw error}return{bytes,validation:checked,inspection}}
  function readU16(bytes,offset){return(bytes[offset]<<8)|bytes[offset+1]}
  function readU32(bytes,offset){return(bytes[offset]*0x1000000)+((bytes[offset+1]<<16)|(bytes[offset+2]<<8)|bytes[offset+3])}
  function readVlq(bytes,position,end){let value=0,count=0,byte;do{if(position>=end||count===4)throw Error('可変長数値が破損しています。');byte=bytes[position++];value=(value<<7)|(byte&0x7f);count++}while(byte&0x80);return{value,position}}
  function inspectMidiBytes(source){
    const bytes=source instanceof Uint8Array?source:new Uint8Array(source||0),errors=[],warnings=[],tracks=[];let noteOnCount=0,noteOffCount=0;
    try{
      if(bytes.length<14)throw Error('MIDIファイルが短すぎます。');if(String.fromCharCode(...bytes.slice(0,4))!=='MThd')throw Error('MThdヘッダーがありません。');
      const headerLength=readU32(bytes,4),type=readU16(bytes,8),trackCount=readU16(bytes,10),ppq=readU16(bytes,12);if(headerLength!==6)errors.push('MThdの長さが6ではありません。');if(type!==1)errors.push('MIDI Type 1ではありません。');if(ppq<24||ppq>0x7fff)errors.push('PPQが範囲外です。');
      let position=8+headerLength;for(let index=0;index<trackCount;index++){
        if(position+8>bytes.length||String.fromCharCode(...bytes.slice(position,position+4))!=='MTrk')throw Error(`トラック${index+1}のMTrkチャンクがありません。`);
        const length=readU32(bytes,position+4),start=position+8,end=start+length;if(end>bytes.length)throw Error(`トラック${index+1}の長さがファイル境界を超えます。`);let cursor=start,runningStatus=null,endOfTrack=false,eventCount=0,tempo=null,timeSignature=null,name='';
        while(cursor<end){const delta=readVlq(bytes,cursor,end);cursor=delta.position;if(cursor>=end)throw Error(`トラック${index+1}のイベントが途中で終わっています。`);let status=bytes[cursor++];if(status<0x80){if(runningStatus===null)throw Error('Running Statusの開始状態がありません。');cursor--;status=runningStatus}else if(status<0xf0)runningStatus=status;else runningStatus=null;
          if(status===0xff){if(cursor>=end)throw Error('Meta Eventが破損しています。');const kind=bytes[cursor++],size=readVlq(bytes,cursor,end);cursor=size.position;if(cursor+size.value>end)throw Error('Meta Eventの長さが不正です。');const payload=bytes.slice(cursor,cursor+size.value);cursor+=size.value;if(kind===0x2f){if(size.value!==0)errors.push('End of Trackの長さが0ではありません。');endOfTrack=true}if(kind===0x51&&size.value===3)tempo=Math.round(60000000/((payload[0]<<16)|(payload[1]<<8)|payload[2])*1000)/1000;if(kind===0x58&&size.value===4)timeSignature=`${payload[0]}/${2**payload[1]}`;if(kind===0x03){try{name=typeof root.TextDecoder==='function'?new root.TextDecoder().decode(payload):String.fromCharCode(...payload)}catch(_){name=''}}
          }else if(status===0xf0||status===0xf7){const size=readVlq(bytes,cursor,end);cursor=size.position+size.value;if(cursor>end)throw Error('SysExの長さが不正です。');warnings.push('SysExイベントを含みます。')
          }else{const high=status&0xf0,dataLength=high===0xc0||high===0xd0?1:2;if(cursor+dataLength>end)throw Error('MIDI Channel Eventが破損しています。');const first=bytes[cursor],second=dataLength===2?bytes[cursor+1]:0;if(first>127||second>127)errors.push('MIDIデータ値が127を超えています。');if(high===0x90&&second>0)noteOnCount++;if(high===0x80||(high===0x90&&second===0))noteOffCount++;cursor+=dataLength}eventCount++;
        }
        if(!endOfTrack)errors.push(`トラック${index+1}にEnd of Trackがありません。`);tracks.push({index,length,eventCount,endOfTrack,name,tempo,timeSignature});position=end;
      }
      if(position!==bytes.length)errors.push('最終トラック後に余分なバイトがあります。');if(trackCount!==tracks.length)errors.push('ヘッダーのトラック数と実チャンク数が一致しません。');if(noteOnCount!==noteOffCount)errors.push('Note OnとNote Offの数が一致しません。');return{ok:errors.length===0,errors,warnings,size:bytes.length,headerLength,type,trackCount,ppq,tracks,noteOnCount,noteOffCount};
    }catch(error){errors.push(error.message);return{ok:false,errors,warnings,size:bytes.length,tracks,noteOnCount,noteOffCount}}
  }
  function createMidiBlob(bytes){if(typeof root.Blob!=='function')throw Error('このブラウザではBlobを作成できません。');return new root.Blob([bytes],{type:'audio/midi'})}
  function createTestMidiData(){const scale=[60,62,64,65,67,69,71,72].map((pitch,index)=>({id:`piano-${index+1}`,pitch,startTick:index*480,durationTicks:480,velocity:100}));const bass=[0,1].map(index=>({id:`bass-${index+1}`,pitch:36,startTick:index*1920,durationTicks:1920,velocity:92}));return{version:1,ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},tracks:[{id:'piano',name:'Piano ピアノ',channel:1,program:0,muted:false,notes:scale},{id:'bass',name:'Bass ベース',channel:2,program:32,muted:false,notes:bass}]}}
  root.MusicStudioMidi={MAX_VLQ,MAX_NOTES,encodeVariableLengthQuantity,parseTimeSignature,validateMidiProjectData,createMidiHeader,createTempoTrack,createNoteTrack,createMidiFile,createMidiBlob,inspectMidiBytes,createTestMidiData};
})(typeof window!=='undefined'?window:globalThis);
