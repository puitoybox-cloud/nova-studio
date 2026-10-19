/* MS-RESTART-07: lightweight Web Audio melody monitor and playback synth. */
(function(root){
  'use strict';
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));
  const frequency=pitch=>440*Math.pow(2,(clamp(pitch,0,127)-69)/12);
  function resolveTrackAudio(track={}){const role=String(track.role||track.part||'').toLowerCase();if(role==='drums')return{mode:'drums',fallback:false,reason:null};if(role==='bass')return{mode:'bass',fallback:false,reason:null};if(role==='melody')return{mode:'melody',fallback:false,reason:null};return{mode:'melody',fallback:true,reason:'missing-core-role'}}
  function tempoTimeline(items=[],initialTempo=120){const byTick=new Map();for(const item of Array.isArray(items)?items:[]){const tick=Math.round(Number(item?.tick)),bpm=Number(item?.bpm);if(Number.isInteger(tick)&&tick>=0&&Number.isFinite(bpm)&&bpm>=20&&bpm<=400)byTick.set(tick,{tick,bpm})}byTick.set(0,{tick:0,bpm:clamp(initialTempo,20,400)});return[...byTick.values()].sort((a,b)=>a.tick-b.tick)}
  function durationBetween(startTick,endTick,ppq,map,initialTempo){let tick=startTick,seconds=0,index=0;while(index+1<map.length&&map[index+1].tick<=tick)index++;while(tick<endTick){const next=Math.min(endTick,map[index+1]?.tick??endTick);seconds+=(next-tick)*60/((map[index]?.bpm||initialTempo)*ppq);tick=next;if(map[index+1]?.tick===tick)index++}return seconds}
  function createSynth(options={}){
    const Context=options.AudioContext||root.AudioContext||root.webkitAudioContext,volume=clamp(options.volume??0.12,0.01,0.2);
    let context=null,master=null,noiseBuffer=null;const live=new Map(),liveSamples=new Set(),playback=new Set(),preview=new Set(),metronome=new Set(),diagnostics={voiceCalls:0,oscillatorsCreated:0,noiseSourcesCreated:0,liveVoicesCreated:0,playbackVoicesCreated:0,previewVoicesCreated:0,bassVoicesCreated:0,drumVoicesCreated:0,metronomeClicks:0,soundPaths:{melody:0,bass:0,kick:0,snare:0,'closed-hat':0,'open-hat':0,tom:0,cymbal:0}};
    function supported(){return Boolean(options.context?.createGain)||typeof Context==='function'}
    function ensure(){if(context)return context;if(!supported())return null;context=options.context||new Context();master=context.createGain();master.gain.setValueAtTime(volume,context.currentTime);master.connect(context.destination);return context}
    async function unlock(){const ctx=ensure();if(!ctx)return false;if(ctx.state==='suspended')await ctx.resume();return true}
    function voice(pitch,velocity,start,stopAt=null,group=null,source='unknown'){
      const ctx=ensure();if(!ctx)return null;const oscillator=ctx.createOscillator(),gain=ctx.createGain(),peak=clamp(velocity,1,127)/127*.7;
      diagnostics.voiceCalls++;diagnostics.oscillatorsCreated++;if(source==='live')diagnostics.liveVoicesCreated++;else if(source==='playback')diagnostics.playbackVoicesCreated++;else if(source==='preview')diagnostics.previewVoicesCreated++;
      oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency(pitch),start);
      const sustain=Math.max(.0001,peak*.32);gain.gain.setValueAtTime(.0001,start);gain.gain.linearRampToValueAtTime(peak,start+.008);gain.gain.linearRampToValueAtTime(sustain,start+.16);
      oscillator.connect(gain);gain.connect(master);oscillator.start(start);
      let cancelled=false;const item={oscillator,gain,stop(when=ctx.currentTime){if(cancelled)return;const release=Math.max(when,start+.01);if(typeof gain.gain.cancelAndHoldAtTime==='function')gain.gain.cancelAndHoldAtTime(release);else{gain.gain.cancelScheduledValues(release);gain.gain.setValueAtTime(release>ctx.currentTime+.001?sustain:Math.max(.0001,gain.gain.value||.0001),release)}gain.gain.linearRampToValueAtTime(.0001,release+.12);try{oscillator.stop(release+.13)}catch(_){}},cancel(when=ctx.currentTime){if(cancelled)return;cancelled=true;gain.gain.cancelScheduledValues(when);gain.gain.setValueAtTime(Math.max(.0001,gain.gain.value||.0001),when);gain.gain.linearRampToValueAtTime(.0001,when+.005);try{oscillator.stop(when+.006)}catch(_){}}};
      if(group){group.add(item);oscillator.onended=()=>group.delete(item)}if(stopAt!==null)item.stop(stopAt);return item
    }
    function drumSoundPath(pitch){const note=Math.round(Number(pitch)||0);if(note===35||note===36)return'kick';if(note>=37&&note<=40)return'snare';if(note===42||note===44)return'closed-hat';if(note===46)return'open-hat';if([41,43,45,47,48,50].includes(note))return'tom';return'cymbal'}
    let noiseState=(options.noiseSeed>>>0)||1;
    function seededNoise(){noiseState=(Math.imul(1664525,noiseState)+1013904223)>>>0;return noiseState/4294967296}
    function sharedNoise(){const ctx=ensure();if(!ctx?.createBuffer)return null;if(noiseBuffer)return noiseBuffer;noiseBuffer=ctx.createBuffer(1,Math.max(1,Math.round((ctx.sampleRate||44100)*.6)),ctx.sampleRate||44100);const data=noiseBuffer.getChannelData(0);for(let index=0;index<data.length;index++)data[index]=(options.noiseSeed===undefined?Math.random():seededNoise())*2-1;return noiseBuffer}
    function previewItem(sources,gain,start,stopAt,group,soundPath){const ctx=ensure();if(!ctx)return null;let cancelled=false,pending=sources.length;const item={sources,gain,soundPath,cancel(when=ctx.currentTime){if(cancelled)return;cancelled=true;gain.gain.cancelScheduledValues(when);gain.gain.setValueAtTime(Math.max(.0001,gain.gain.value||.0001),when);gain.gain.linearRampToValueAtTime(.0001,when+.005);for(const source of sources)try{source.stop(when+.006)}catch(_){}}};if(group)group.add(item);for(const source of sources)source.onended=()=>{pending--;if(pending<=0)group?.delete(item)};for(const source of sources)source.start(start);for(const source of sources)source.stop(stopAt);return item}
    function bassVoice(pitch,velocity,start,stopAt,group){const ctx=ensure();if(!ctx)return null;const oscillator=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter?.(),peak=clamp(velocity,1,127)/127*.42,release=Math.max(start+.02,stopAt);diagnostics.voiceCalls++;diagnostics.oscillatorsCreated++;diagnostics.playbackVoicesCreated++;diagnostics.bassVoicesCreated++;diagnostics.soundPaths.bass++;oscillator.type='triangle';oscillator.frequency.setValueAtTime(frequency(pitch),start);gain.gain.setValueAtTime(.0001,start);gain.gain.linearRampToValueAtTime(peak,start+.012);gain.gain.linearRampToValueAtTime(Math.max(.0001,peak*.48),start+.12);gain.gain.linearRampToValueAtTime(.0001,release+.08);if(filter){filter.type='lowpass';filter.frequency.setValueAtTime(720,start);oscillator.connect(filter);filter.connect(gain)}else oscillator.connect(gain);gain.connect(master);return previewItem([oscillator],gain,start,release+.09,group,'bass')}
    function drumVoice(pitch,velocity,start,stopAt,group){const ctx=ensure();if(!ctx)return null;const path=drumSoundPath(pitch),gain=ctx.createGain(),sources=[],peak=clamp(velocity,1,127)/127*.45,maxDuration=Math.max(.01,stopAt-start),duration=Math.min(maxDuration,{kick:.3,snare:.22,'closed-hat':.065,'open-hat':.42,tom:.3,cymbal:.5}[path]),end=start+duration;diagnostics.voiceCalls++;diagnostics.playbackVoicesCreated++;diagnostics.drumVoicesCreated++;diagnostics.soundPaths[path]++;gain.gain.setValueAtTime(peak,start);if(typeof gain.gain.exponentialRampToValueAtTime==='function')gain.gain.exponentialRampToValueAtTime(.0001,end);else gain.gain.linearRampToValueAtTime(.0001,end);if(path==='kick'||path==='tom'){const oscillator=ctx.createOscillator();diagnostics.oscillatorsCreated++;oscillator.type='sine';const initial=path==='kick'?135:frequency(Math.max(36,Number(pitch)-12)),target=path==='kick'?48:Math.max(55,initial*.62);oscillator.frequency.setValueAtTime(initial,start);oscillator.frequency.exponentialRampToValueAtTime?.(target,end);oscillator.connect(gain);sources.push(oscillator)}else{const buffer=sharedNoise(),noise=ctx.createBufferSource?.(),filter=ctx.createBiquadFilter?.();if(noise&&buffer){diagnostics.noiseSourcesCreated++;noise.buffer=buffer;if(filter){filter.type=path==='snare'?'bandpass':'highpass';filter.frequency.setValueAtTime(path==='snare'?1800:6500,start);noise.connect(filter);filter.connect(gain)}else noise.connect(gain);sources.push(noise)}if(path==='snare'){const tone=ctx.createOscillator();diagnostics.oscillatorsCreated++;tone.type='triangle';tone.frequency.setValueAtTime(185,start);tone.connect(gain);sources.push(tone)}}gain.connect(master);return previewItem(sources,gain,start,end,group,path)}
    // Project-local PCM only. No URL fetches or synthesized instrument claims.
    let sampleBank=new Map();
    function setSampleBank(entries=[]){
      const next=new Map();
      for(const entry of entries){const pcm=entry?.pcm,frames=pcm?.channels?.[0]?.length;
        if(typeof entry?.id!=='string'||!entry.id||next.has(entry.id)||!Number.isInteger(pcm?.sampleRate)||pcm.sampleRate<8000||pcm.sampleRate>192000||!Array.isArray(pcm.channels)||pcm.channels.length<1||pcm.channels.length>2||!frames||frames>pcm.sampleRate*10||pcm.channels.some(ch=>!Array.isArray(ch)||ch.length!==frames||ch.some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1)))throw Error('invalid-instrument-sample');
        next.set(entry.id,{pcm:{sampleRate:pcm.sampleRate,channels:pcm.channels.map(ch=>ch.slice())},buffer:null});
      }
      sampleBank=next;return next.size;
    }
    function samplePlan(binding,pitch,velocity,elapsed=0){
      let region;try{region=binding?.version!==undefined?root.MusicStudioInstruments?.select(binding,pitch,velocity):{...binding,gainDb:0,tuneCents:0,startSeconds:0,endSeconds:null,attackMs:3,releaseMs:15,oneShot:false}}catch(_){return{reason:'invalid-instrument-binding'}}
      if(!region)return{reason:'instrument-region-unmapped'};const entry=sampleBank.get(region.assetId),rootPitch=region.rootPitch;
      if(!entry||!Number.isInteger(rootPitch)||rootPitch<0||rootPitch>127)return{region,reason:'instrument-sample-unavailable'};
      const rate=2**((clamp(pitch,0,127)-rootPitch)/12+(region.tuneCents||0)/1200),total=entry.pcm.channels[0].length/entry.pcm.sampleRate,begin=region.startSeconds||0,end=region.endSeconds??total,offset=begin+Math.max(0,elapsed)*rate;
      if(begin>=end||end>total+.000001)return{region,reason:'invalid-instrument-trim'};
      if(offset>=end)return{region,reason:'one-shot-sample-ended'};
      return{region,entry,rate,offset,end};
    }
    function sampleVoice(binding,pitch,velocity,start,stopAt,group,elapsed=0){
      const ctx=ensure(),plan=samplePlan(binding,pitch,velocity,elapsed);if(!ctx||plan.reason||!ctx.createBufferSource)return null;
      const {entry,region,rate,offset,end}=plan,peak=clamp(velocity,1,127)/127*10**((region.gainDb||0)/20),naturalEnd=start+(end-offset)/rate;
      if(!entry.buffer){entry.buffer=ctx.createBuffer(entry.pcm.channels.length,entry.pcm.channels[0].length,entry.pcm.sampleRate);entry.pcm.channels.forEach((ch,i)=>entry.buffer.getChannelData(i).set(ch));}
      const source=ctx.createBufferSource(),gain=ctx.createGain(),attackEnd=Math.min(naturalEnd,start+(region.attackMs??3)/1000);
      source.buffer=entry.buffer;source.playbackRate.setValueAtTime(rate,start);source.connect(gain);gain.connect(master);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(peak,attackEnd);
      let ended=false;const item={source,gain,region,plan,soundPath:'sample',stop(when=ctx.currentTime,force=false){if(ended||region.oneShot&&!force)return;const releaseStart=Math.min(naturalEnd,Math.max(start,when)),releaseEnd=Math.min(naturalEnd,releaseStart+(region.releaseMs??15)/1000),level=attackEnd>start&&releaseStart<attackEnd?peak*(releaseStart-start)/(attackEnd-start):peak;gain.gain.cancelScheduledValues(releaseStart);gain.gain.setValueAtTime(level,releaseStart);gain.gain.linearRampToValueAtTime(0,releaseEnd);try{source.stop(releaseEnd)}catch(_){}},cancel(when=ctx.currentTime){if(ended)return;ended=true;gain.gain.cancelScheduledValues(when);gain.gain.setValueAtTime(0,when);try{source.stop(when)}catch(_){}}};
      group?.add(item);source.onended=()=>{ended=true;group?.delete(item);item.onEnded?.();source.disconnect?.();gain.disconnect?.()};source.start(start,offset);source.stop(naturalEnd);if(stopAt!==null)item.stop(stopAt);return item;
    }
    function previewInstrument(binding,pitch,velocity=100,duration=.35){const ctx=ensure();return Boolean(ctx&&sampleVoice(binding,pitch,velocity,ctx.currentTime,ctx.currentTime+clamp(duration,.05,2),preview))}
    function noteOn(pitch,velocity=100,channel=1,binding=null){const ctx=ensure();if(!ctx)return false;const id=`${channel}:${pitch}`;if(live.has(id))return false;const item=binding?sampleVoice(binding,pitch,velocity,ctx.currentTime,null,liveSamples):voice(pitch,velocity,ctx.currentTime,null,null,'live');if(item){live.set(id,item);if(binding)item.onEnded=()=>{if(live.get(id)===item)live.delete(id)}}return Boolean(item)}
    function noteOff(pitch,channel=1){const id=`${channel}:${pitch}`,item=live.get(id);if(!item)return false;live.delete(id);item.stop();return true}
    function allNotesOff(){for(const item of live.values())item.stop(undefined,true);live.clear();for(const item of liveSamples)item.stop(undefined,true);liveSamples.clear()}
    function stopPreview(){const ctx=ensure();if(!ctx)return;for(const item of preview)item.cancel(ctx.currentTime);preview.clear();for(const [id,item] of live)if(id.startsWith('piano-roll-preview:')){item.cancel(ctx.currentTime);live.delete(id)}}
    function stopPlayback(){const ctx=ensure();if(!ctx)return;for(const item of playback)item.cancel(ctx.currentTime);playback.clear()}
    function metronomeClick(accent=false,when=null){const ctx=ensure();if(!ctx)return false;const start=Number.isFinite(Number(when))?Math.max(ctx.currentTime,Number(when)):ctx.currentTime,oscillator=ctx.createOscillator(),gain=ctx.createGain(),item={oscillator,gain};diagnostics.metronomeClicks++;oscillator.type='square';oscillator.frequency.setValueAtTime(accent?1560:1040,start);gain.gain.setValueAtTime(.0001,start);gain.gain.linearRampToValueAtTime(accent?.18:.11,start+.002);gain.gain.exponentialRampToValueAtTime?.(.0001,start+.045);oscillator.connect(gain);gain.connect(master);metronome.add(item);oscillator.onended=()=>metronome.delete(item);oscillator.start(start);oscillator.stop(start+.05);return true}
    function stopMetronome(){const ctx=ensure();if(!ctx)return;for(const item of metronome){item.gain.gain.cancelScheduledValues(ctx.currentTime);item.gain.gain.setValueAtTime(.0001,ctx.currentTime);try{item.oscillator.stop(ctx.currentTime+.001)}catch(_){}}metronome.clear()}
    function audioTime(seconds){return options.quantizeTiming?Math.round(seconds*(context.sampleRate||48000))/(context.sampleRate||48000):seconds}
    function playTracks(tracks=[],timing={}){
      const ctx=ensure();if(!ctx)return{ok:false,noteCount:0,durationMs:0};if(timing.append!==true)stopPlayback();
      const ppq=clamp(timing.ppq||480,24,9600),tempo=clamp(timing.tempo||120,20,400),tempoMap=tempoTimeline(timing.tempoMap,tempo),secondsPerTick=60/(tempo*ppq),requestedStart=Number(timing.startTime),lead=Number.isFinite(Number(timing.leadSeconds))?clamp(Number(timing.leadSeconds),0,.25):.04,playbackStart=Number.isFinite(requestedStart)?Math.max(ctx.currentTime,requestedStart):ctx.currentTime+lead,scheduledLead=Math.max(0,playbackStart-ctx.currentTime),fromTick=Math.max(0,Number(timing.startTick)||0),requestedEnd=Number(timing.endTick),toTick=Number.isFinite(requestedEnd)&&requestedEnd>fromTick?requestedEnd:Infinity;
      const oscillatorStart=diagnostics.oscillatorsCreated,scheduledNotes=[];let endTick=fromTick,noteCount=0;for(const track of tracks){const identity={trackId:String(track?.id||''),part:String(track?.part||''),channel:Number(track?.channel)||1,program:track?.program==null?null:Number(track.program)},audio=resolveTrackAudio(track);for(const note of track?.notes||[]){if(!Number.isFinite(Number(note.startTick))||!Number.isFinite(Number(note.durationTicks)))continue;const noteStart=Math.max(0,Number(note.startTick)),noteEnd=noteStart+Math.max(1,Number(note.durationTicks));if(noteEnd<=fromTick||noteStart>=toTick)continue;const startTick=Math.max(noteStart,fromTick),clippedEnd=Math.min(noteEnd,toTick),durationTicks=clippedEnd-startTick,start=audioTime(playbackStart+durationBetween(fromTick,startTick,ppq,tempoMap,tempo)),stop=audioTime(playbackStart+durationBetween(fromTick,clippedEnd,ppq,tempoMap,tempo)),soundPath=audio.mode==='drums'?drumSoundPath(note.pitch):audio.mode==='bass'?'bass':'melody',scheduled={...identity,noteId:String(note.id||''),pitch:Number(note.pitch),startTick:noteStart,durationTicks:Number(note.durationTicks),velocity:Number(note.velocity)||100,scheduledStartTick:startTick,scheduledDurationTicks:durationTicks,startTime:start,stopTime:stop,audible:true,soundPath};scheduledNotes.push(scheduled);if(track.sampleInstrument){const elapsed=durationBetween(noteStart,startTick,ppq,tempoMap,tempo),plan=samplePlan(track.sampleInstrument,note.pitch,note.velocity||100,elapsed),item=sampleVoice(track.sampleInstrument,note.pitch,note.velocity||100,start,stop,playback,elapsed);scheduled.audible=Boolean(item);scheduled.soundPath=item?'sample':plan.reason==='one-shot-sample-ended'?'sample-ended':plan.reason==='instrument-region-unmapped'?'unmapped-sample':'missing-sample';if(plan.region){scheduled.assetId=plan.region.assetId;scheduled.regionId=plan.region.id||null;scheduled.rootPitch=plan.region.rootPitch}if(!item){scheduled.reason=plan.reason||'instrument-sample-unavailable';continue}}else if(audio.mode==='drums')drumVoice(note.pitch,note.velocity||100,start,stop,playback);else if(audio.mode==='bass')bassVoice(note.pitch,note.velocity||100,start,stop,playback);else{diagnostics.soundPaths.melody++;voice(note.pitch,note.velocity||100,start,stop,playback,'playback')}endTick=Math.max(endTick,clippedEnd);noteCount++}}
      if(Number.isFinite(toTick))endTick=toTick;
      const timelineDurationSeconds=durationBetween(fromTick,endTick,ppq,tempoMap,tempo);return{ok:true,trackCount:tracks.length,noteCount,oscillatorCount:diagnostics.oscillatorsCreated-oscillatorStart,durationMs:(scheduledLead+timelineDurationSeconds+.15)*1000,playbackStart,secondsPerTick,timelineDurationSeconds,tempoMap,startTick:fromTick,endTick,scheduledNotes,missingSampleCount:scheduledNotes.filter(n=>n.soundPath==='missing-sample').length,unmappedSampleCount:scheduledNotes.filter(n=>n.soundPath==='unmapped-sample').length}
    }
    function playNotes(notes=[],timing={}){return playTracks([{id:'melody',part:'melody',channel:1,program:0,notes}],timing)}
    function previewNote(pitch,velocity=100,duration=.35){const ctx=ensure();if(!ctx)return false;voice(pitch,velocity,ctx.currentTime,ctx.currentTime+clamp(duration,.05,2),preview,'preview');return true}
    function previewTrackNote(part,pitch,velocity=100,duration=.35){const ctx=ensure();if(!ctx)return false;const start=ctx.currentTime,stop=start+clamp(duration,.05,2);if(part==='drums')return Boolean(drumVoice(pitch,velocity,start,stop,preview));if(part==='bass')return Boolean(bassVoice(pitch,velocity,start,stop,preview));return previewNote(pitch,velocity,duration)}
    function dispose(){allNotesOff();stopPreview();stopPlayback();stopMetronome();if(!options.context)context?.close?.();context=null;master?.disconnect?.();master=null;noiseBuffer=null;sampleBank.clear()}
    return{setSampleBank,previewInstrument,supported,unlock,noteOn,noteOff,allNotesOff,playTracks,playNotes,stopPreview,stopPlayback,metronomeClick,stopMetronome,previewTrackNote,previewNote,dispose,frequency,drumSoundPath,volume,get diagnostics(){return{...diagnostics,soundPaths:{...diagnostics.soundPaths}}},get context(){return context},get liveVoices(){return live.size},get playingVoices(){return playback.size+preview.size}};
  }
  // Same instrument scheduler as live playback, rendered locally without microphone capture.
  function midiRenderPlan(midi,entries=[],options={}){
    const guard=options.guard||(()=>{}),Playback=root.MusicStudioPlayback;
    guard();if(!Playback||!midi||!Array.isArray(midi.tracks))throw Error('midi-render-data-required');
    const ppq=midi.ppq,tempo=midi.tempo;
    if(!Number.isInteger(ppq)||ppq<24||ppq>9600||!Number.isFinite(tempo)||tempo<20||tempo>400)throw Error('midi-render-timing');
    const active=Playback.activePlaybackTracks(midi.tracks);
    if(options.trackIds!==undefined&&(!Array.isArray(options.trackIds)||!options.trackIds.length||new Set(options.trackIds).size!==options.trackIds.length||options.trackIds.some(id=>typeof id!=='string'||!active.some(t=>t.id===id))))throw Error('midi-render-invalid-track-selection');
    const tracks=options.trackIds?active.filter(t=>options.trackIds.includes(t.id)):active,notes=tracks.flatMap(t=>t.notes);
    if(!notes.length||notes.length>20000)throw Error('midi-render-note-capacity');
    for(const n of notes)if(!Number.isSafeInteger(n.startTick)||n.startTick<0||!Number.isSafeInteger(n.durationTicks)||n.durationTicks<1||!Number.isSafeInteger(n.startTick+n.durationTicks)||!Number.isInteger(n.pitch)||n.pitch<0||n.pitch>127||!Number.isInteger(n.velocity)||n.velocity<1||n.velocity>127)throw Error('midi-render-note-invalid');
    if(midi.totalTick!==undefined&&(!Number.isSafeInteger(midi.totalTick)||midi.totalTick<0))throw Error('midi-render-invalid-total-tick');
    // Stems share the complete active song timeline, including declared final rests.
    const endTick=Math.max(midi.totalTick||0,...active.flatMap(t=>t.notes).map(n=>n.startTick+n.durationTicks)),seconds=Playback.tickDurationSeconds(0,endTick,ppq,midi.tempoMap,tempo);
    if(!Number.isFinite(seconds)||seconds<=0||seconds>480)throw Error('midi-render-480-seconds-limit');
    // Include complete one-shot playback after pitch shifting, or refuse an excessive tail.
    let finish=seconds+.8;
    for(const track of tracks)if(track.sampleInstrument)for(const note of track.notes){
      const binding=track.sampleInstrument,region=binding.version===undefined?{...binding,releaseMs:15}:root.MusicStudioInstruments?.select(binding,note.pitch,note.velocity),entry=entries.find(e=>e.id===region?.assetId);
      if(!region||!entry)throw Error('midi-render-missing-or-unmapped-sample');
      const start=Playback.tickDurationSeconds(0,note.startTick,ppq,midi.tempoMap,tempo),end=Playback.tickDurationSeconds(0,note.startTick+note.durationTicks,ppq,midi.tempoMap,tempo),rate=2**((note.pitch-region.rootPitch)/12+(region.tuneCents||0)/1200),natural=start+((region.endSeconds??entry.pcm.channels[0].length/entry.pcm.sampleRate)-(region.startSeconds||0))/rate;
      finish=Math.max(finish,region.oneShot?natural:Math.min(natural,end+(region.releaseMs??15)/1000));
    }
    const tail=finish-seconds;if(!Number.isFinite(tail)||tail>10)throw Error('midi-render-sample-tail-limit');
    const frames=Math.ceil(finish*48000);
    return{tracks,notes,ppq,tempo,seconds,tail,frames,sampleRate:48000,channels:2,noteCount:notes.length,trackIds:tracks.map(t=>t.id)};
  }
  async function renderMidi(midi,entries=[],options={}){
    const guard=options.guard||(()=>{}),Playback=root.MusicStudioPlayback; midi={...midi,tempoMap:Playback.normalizeTempoMap(midi?.tempoMap,midi?.tempo)};const plan=midiRenderPlan(midi,entries,options),{tracks,notes,ppq,tempo,seconds,tail,frames}=plan;
    if(seconds>120)throw Error('midi-render-120-seconds-limit');
    const Context=options.OfflineAudioContext||root.OfflineAudioContext||root.webkitOfflineAudioContext;
    if(typeof Context!=='function')throw Error('offline-audio-unavailable');
    const context=new Context(2,frames,48000),synth=createSynth({context,volume:.12,noiseSeed:1,quantizeTiming:true});
    try{
      synth.setSampleBank(entries);const schedule=Playback.schedulePlaybackTracks(synth,tracks,{ppq,bpm:tempo,tempoMap:midi.tempoMap,startTick:0,startTime:0,leadSeconds:0});
      if(!schedule.ok||schedule.noteCount!==notes.length||schedule.scheduledNotes.some(n=>!n.audible))throw Error('midi-render-missing-or-unmapped-sample');
      guard();const buffer=await context.startRendering();guard();
      if(buffer.sampleRate!==48000||buffer.numberOfChannels!==2||buffer.length!==frames)throw Error('midi-render-output-invalid');
      return{buffer,frames,sampleRate:48000,channels:2,seconds,tail,noteCount:notes.length,trackIds:tracks.map(t=>t.id)};
    }finally{synth.dispose()}
  }
  // Each window reconstructs crossing voices from their original attack. PCM is
  // sliced only on the absolute 48kHz grid; no seek/retrigger or window fades.
  // A 120s voice-span limit bounds preroll and refuses pathological sustains.
  function renderMidiStream(midi,entries=[],options={}){
    const guard=options.guard||(()=>{}),Playback=root.MusicStudioPlayback;
    midi={...midi,tempoMap:Playback.normalizeTempoMap(midi?.tempoMap,midi?.tempo)};
    const plan=midiRenderPlan(midi,entries,options);
    const Context=options.OfflineAudioContext||root.OfflineAudioContext||root.webkitOfflineAudioContext;
    if(typeof Context!=='function')throw Error('offline-audio-unavailable');
    const spans=plan.tracks.map(track=>({track,notes:track.notes.map(note=>{
      const start=Playback.tickDurationSeconds(0,note.startTick,plan.ppq,midi.tempoMap,plan.tempo),stop=Playback.tickDurationSeconds(0,note.startTick+note.durationTicks,plan.ppq,midi.tempoMap,plan.tempo);
      let end=stop+.8;
      if(track.sampleInstrument){const binding=track.sampleInstrument,region=binding.version===undefined?{...binding,releaseMs:15}:root.MusicStudioInstruments.select(binding,note.pitch,note.velocity),entry=entries.find(e=>e.id===region.assetId),rate=2**((note.pitch-region.rootPitch)/12+(region.tuneCents||0)/1200),natural=start+((region.endSeconds??entry.pcm.channels[0].length/entry.pcm.sampleRate)-(region.startSeconds||0))/rate;end=region.oneShot?natural:Math.min(natural,stop+(region.releaseMs??15)/1000)}
      if(end-start>120)throw Error('midi-render-voice-span-limit');
      return{note,start,end};
    })}));
    const windowFrames=30*48000;
    async function* chunks(){
      let completed=0;
      for(let first=0;first<plan.frames;first+=windowFrames){
        guard();const last=Math.min(plan.frames,first+windowFrames),active=spans.map(({track,notes})=>({track,notes:notes.filter(n=>n.start<last/48000&&n.end>first/48000)})),selected=active.flatMap(t=>t.notes);
        let buffer=null,synth=null,offset=0;
        try{
          if(selected.length){
            const origin=selected.reduce((a,b)=>a.start<b.start?a:b),originFrame=Math.floor(Math.min(origin.start,first/48000)*48000/128)*128,originTick=Playback.tickAtSeconds(0,originFrame/48000,plan.ppq,midi.tempoMap,plan.tempo),length=last-originFrame;
            if(length>150*48000+128)throw Error('midi-render-window-capacity');
            const context=new Context(2,length,48000);synth=createSynth({context,volume:.12,noiseSeed:1,quantizeTiming:true});synth.setSampleBank(entries);
            const tracks=active.filter(t=>t.notes.length).map(t=>({...t.track,notes:t.notes.map(n=>n.note)}));
            const schedule=Playback.schedulePlaybackTracks(synth,tracks,{ppq:plan.ppq,bpm:plan.tempo,tempoMap:midi.tempoMap,startTick:originTick,startTime:0,leadSeconds:0});
            if(!schedule.ok||schedule.noteCount!==selected.length||schedule.scheduledNotes.some(n=>!n.audible))throw Error('midi-render-missing-or-unmapped-sample');
            guard();buffer=await context.startRendering();guard();offset=first-originFrame;
            if(buffer.sampleRate!==48000||buffer.numberOfChannels!==2||buffer.length!==length)throw Error('midi-render-output-invalid');
          }
          for(let at=first;at<last;at+=16384){guard();const count=Math.min(16384,last-at),begin=offset+at-first;yield{sampleRate:48000,channels:[0,1].map(c=>buffer?Array.from(buffer.getChannelData(c).subarray(begin,begin+count)):Array(count).fill(0))}}
        }finally{synth?.dispose();buffer=null}
        completed=last;options.onProgress?.({frames:completed,totalFrames:plan.frames,ratio:completed/plan.frames});
        if(root.setTimeout)await new Promise(r=>root.setTimeout(r,0));guard();
      }
    }
    options.onProgress?.({frames:0,totalFrames:plan.frames,ratio:0});
    const {tracks,notes,...metadata}=plan;return{...metadata,chunks:chunks()};
  }
  root.MusicStudioAudio={createSynth,frequency,resolveTrackAudio,renderMidi,renderMidiStream};
})(typeof window!=='undefined'?window:globalThis);
