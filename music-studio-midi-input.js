/* MS-RESTART-07: dependency-free Web MIDI recording adapter. */
(function(root){
  'use strict';
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,Math.round(Number(value)||0)));
  const key=(channel,pitch)=>`${channel}:${pitch}`;
  function isSupported(navigatorLike=root.navigator){return typeof navigatorLike?.requestMIDIAccess==='function'}
  function createMessageGate(windowMs=3){let lastFingerprint='',lastTime=-Infinity;return{accept(data,time){const fingerprint=Array.from(data||[]).slice(0,3).join(':'),stamp=Number(time);if(fingerprint===lastFingerprint&&Number.isFinite(stamp)&&Math.abs(stamp-lastTime)<=windowMs)return false;lastFingerprint=fingerprint;lastTime=stamp;return true},reset(){lastFingerprint='';lastTime=-Infinity}}}
  function createRecorder(options={}){
    const ppq=clamp(options.ppq||480,24,9600),tempo=Math.min(400,Math.max(20,Number(options.tempo)||120)),clock=options.clock||(()=>root.performance?.now?.()??Date.now());
    let recording=false,startedAt=0,sequence=0;const active=new Map(),notes=[],messageGate=createMessageGate(options.duplicateWindowMs);
    const toTick=milliseconds=>Math.max(0,Math.round(milliseconds*ppq*tempo/60000));
    function start(time=clock()){recording=true;startedAt=Number(time);sequence=0;active.clear();notes.length=0;messageGate.reset();return api}
    function noteOff(channel,pitch,time){const stack=active.get(key(channel,pitch));if(!stack?.length)return null;const onset=stack.shift();if(!stack.length)active.delete(key(channel,pitch));const startTick=toTick(onset.time-startedAt),endTick=toTick(Number(time)-startedAt),note={id:`midi-recorded-${++sequence}`,pitch,startTick,durationTicks:Math.max(1,endTick-startTick),velocity:onset.velocity,inputChannel:channel,inputMethod:'midi-keyboard'};notes.push(note);options.onNote?.(note);return note}
    function handleMessage(data,time=clock()){if(!recording||!data)return null;if(!messageGate.accept(data,time))return{type:'duplicate'};const status=Number(data[0])||0,command=status&0xf0,channel=(status&0x0f)+1,pitch=clamp(data[1],0,127),velocity=clamp(data[2],0,127);if(command===0x90&&velocity>0){const item={time:Number(time),velocity};const stack=active.get(key(channel,pitch))||[];stack.push(item);active.set(key(channel,pitch),stack);return{type:'noteOn',channel,pitch,velocity}}if(command===0x80||(command===0x90&&velocity===0))return noteOff(channel,pitch,time);return null}
    function stop(time=clock()){if(!recording)return[];for(const [compound,stack] of active){const [channel,pitch]=compound.split(':').map(Number);while(stack.length)noteOff(channel,pitch,time)}recording=false;return notes.map(note=>({...note}))}
    const api={start,stop,handleMessage,get recording(){return recording},get activeCount(){return[...active.values()].reduce((sum,stack)=>sum+stack.length,0)}};
    return api
  }
  async function requestAccess(navigatorLike=root.navigator){if(!isSupported(navigatorLike))return{supported:false,access:null,inputs:[]};const access=await navigatorLike.requestMIDIAccess({sysex:false}),inputs=[...(access.inputs?.values?.()||[])];return{supported:true,access,inputs}}
  root.MusicStudioMidiInput={isSupported,createMessageGate,createRecorder,requestAccess};
})(typeof window!=='undefined'?window:globalThis);
