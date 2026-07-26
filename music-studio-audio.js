/* MS-RESTART-07: lightweight Web Audio melody monitor and playback synth. */
(function(root){
  'use strict';
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));
  const frequency=pitch=>440*Math.pow(2,(clamp(pitch,0,127)-69)/12);
  function createSynth(options={}){
    const Context=options.AudioContext||root.AudioContext||root.webkitAudioContext,volume=clamp(options.volume??0.12,0.01,0.2);
    let context=null,master=null;const live=new Map(),playback=new Set();
    function supported(){return typeof Context==='function'}
    function ensure(){if(context)return context;if(!supported())return null;context=new Context();master=context.createGain();master.gain.setValueAtTime(volume,context.currentTime);master.connect(context.destination);return context}
    async function unlock(){const ctx=ensure();if(!ctx)return false;if(ctx.state==='suspended')await ctx.resume();return true}
    function voice(pitch,velocity,start,stopAt=null,group=null){
      const ctx=ensure();if(!ctx)return null;const oscillator=ctx.createOscillator(),gain=ctx.createGain(),peak=clamp(velocity,1,127)/127*.7;
      oscillator.type='triangle';oscillator.frequency.setValueAtTime(frequency(pitch),start);
      gain.gain.setValueAtTime(.0001,start);gain.gain.linearRampToValueAtTime(peak,start+.008);gain.gain.linearRampToValueAtTime(Math.max(.0001,peak*.32),start+.16);
      oscillator.connect(gain);gain.connect(master);oscillator.start(start);
      let cancelled=false;const item={oscillator,gain,stop(when=ctx.currentTime){if(cancelled)return;const release=Math.max(when,start+.01);gain.gain.cancelScheduledValues(release);gain.gain.setValueAtTime(Math.max(.0001,gain.gain.value||.0001),release);gain.gain.linearRampToValueAtTime(.0001,release+.12);try{oscillator.stop(release+.13)}catch(_){}},cancel(when=ctx.currentTime){if(cancelled)return;cancelled=true;gain.gain.cancelScheduledValues(when);gain.gain.setValueAtTime(Math.max(.0001,gain.gain.value||.0001),when);gain.gain.linearRampToValueAtTime(.0001,when+.005);try{oscillator.stop(when+.006)}catch(_){}}};
      if(group)group.add(item);if(stopAt!==null)item.stop(stopAt);return item
    }
    function noteOn(pitch,velocity=100,channel=1){const ctx=ensure();if(!ctx)return false;const id=`${channel}:${pitch}`;if(live.has(id))return false;const item=voice(pitch,velocity,ctx.currentTime);if(item)live.set(id,item);return Boolean(item)}
    function noteOff(pitch,channel=1){const id=`${channel}:${pitch}`,item=live.get(id);if(!item)return false;live.delete(id);item.stop();return true}
    function allNotesOff(){for(const item of live.values())item.stop();live.clear()}
    function stopPlayback(){const ctx=ensure();if(!ctx)return;for(const item of playback)item.cancel(ctx.currentTime);playback.clear()}
    function playNotes(notes=[],timing={}){
      const ctx=ensure();if(!ctx)return{ok:false,noteCount:0,durationMs:0};stopPlayback();
      const ppq=clamp(timing.ppq||480,24,9600),tempo=clamp(timing.tempo||120,20,400),secondsPerTick=60/(tempo*ppq),lead=.04;
      let endTick=0,noteCount=0;for(const note of notes){if(!Number.isFinite(Number(note.startTick))||!Number.isFinite(Number(note.durationTicks)))continue;const startTick=Math.max(0,Number(note.startTick)),durationTicks=Math.max(1,Number(note.durationTicks)),start=ctx.currentTime+lead+startTick*secondsPerTick,stop=start+durationTicks*secondsPerTick;voice(note.pitch,note.velocity||100,start,stop,playback);endTick=Math.max(endTick,startTick+durationTicks);noteCount++}
      return{ok:true,noteCount,durationMs:(lead+endTick*secondsPerTick+.15)*1000}
    }
    function previewNote(pitch,velocity=100,duration=.35){const ctx=ensure();if(!ctx)return false;voice(pitch,velocity,ctx.currentTime,ctx.currentTime+clamp(duration,.05,2),playback);return true}
    function dispose(){allNotesOff();stopPlayback();context?.close?.();context=null;master=null}
    return{supported,unlock,noteOn,noteOff,allNotesOff,playNotes,stopPlayback,previewNote,dispose,frequency,volume,get context(){return context},get liveVoices(){return live.size},get playingVoices(){return playback.size}};
  }
  root.MusicStudioAudio={createSynth,frequency};
})(typeof window!=='undefined'?window:globalThis);
