/* PCM-only vocal capture. The output remains silent: no microphone monitoring. */
class NovaVocalPCMProcessor extends AudioWorkletProcessor {
  constructor(){super();this.block=new Float32Array(4096);this.count=0;this.frames=0;this.active=false;this.stopped=false;this.port.onmessage=event=>{if(event.data==='start'&&!this.stopped){this.active=true;this.port.postMessage({type:'started'})}if(event.data==='stop'&&!this.stopped){this.active=false;this.stopped=true;this.flush();this.port.postMessage({type:'stopped',frames:this.frames,sampleRate})}}}
  flush(){if(!this.count)return;const samples=this.block.slice(0,this.count);this.port.postMessage({type:'pcm',samples},[samples.buffer]);this.count=0}
  process(inputs){if(this.stopped)return false;const input=inputs[0]?.[0];if(this.active&&input)for(const sample of input){this.block[this.count++]=sample;this.frames++;if(this.count===this.block.length)this.flush();if(this.frames>=sampleRate*120){this.active=false;this.stopped=true;this.flush();this.port.postMessage({type:'stopped',frames:this.frames,sampleRate});return false}}return true}
}
registerProcessor('nova-vocal-pcm',NovaVocalPCMProcessor);
