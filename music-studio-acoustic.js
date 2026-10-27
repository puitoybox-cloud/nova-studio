/* Explicit same-origin, integrity checked acoustic samples. No provider calls. */
(function(root){
 'use strict';
 const base='./assets/music-acoustic-v1/',roles=['piano','bass','strings','drums'];
 let loading=false;
 async function load(role){
  if(!roles.includes(role))throw Error('acoustic-role-invalid');
  const response=await root.fetch(base+'Manifest.json',{cache:'no-cache'});if(!response.ok)throw Error('acoustic-manifest-unavailable');
  const manifest=await response.json();if(manifest.id!=='nova-acoustic-v1'||manifest.version!==1)throw Error('acoustic-manifest-invalid');
  const selected=manifest.roles?.[role];if(!selected||!Array.isArray(selected.regions)||!selected.regions.length||selected.regions.length>32)throw Error('acoustic-regions-invalid');
  const entries=[];let bytes=0;
  for(const r of selected.regions){
   if(!/^[a-z]+-\d+\.wav$/.test(r.file)||!/^nova-acoustic-v1-[a-z]+-\d+$/.test(r.assetId)||!Number.isSafeInteger(r.bytes)||r.bytes<44||r.bytes>500000||!/^[a-f0-9]{64}$/.test(r.sha256))throw Error('acoustic-file-invalid');
   bytes+=r.bytes;if(bytes>3000000)throw Error('acoustic-bank-capacity');
   const res=await root.fetch(base+r.file);if(!res.ok)throw Error('acoustic-sample-unavailable');const buffer=await res.arrayBuffer();
   if(buffer.byteLength!==r.bytes)throw Error('acoustic-size-mismatch');
   const digest=Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',buffer)),v=>v.toString(16).padStart(2,'0')).join('');if(digest!==r.sha256)throw Error('acoustic-hash-mismatch');
   const pcm=root.MusicStudio.pcmDecodeWav(buffer);if(pcm.sampleRate!==24000||pcm.channels.length!==1||pcm.channels[0].length>240000||pcm.channels[0].some(v=>Math.abs(v)>=1))throw Error('acoustic-pcm-invalid');
   entries.push({id:r.assetId,pcm,source:{pack:manifest.id,sha256:digest,file:r.file,source:r.source||manifest.sources.find(s=>s.role===role)?.url,license:r.license||'CC-BY-3.0-US; upstream MIT',notice:base+'NOTICES.md'}});
  }
  const instrument=root.MusicStudioInstruments.normalize({version:2,name:selected.name,regions:selected.regions});return{entries,instrument};
 }
 async function install(role){
  const a=root.MusicStudio,E=root.MusicStudioEditor,s=a.state.midiEditor;if(loading||!s)throw Error('acoustic-install-busy');
  loading=true;const trackId=E.currentTrackId(s),original=JSON.stringify(E.currentTrack(s));
  try{
   const bank=await load(role);if(a.state.midiEditor!==s||E.currentTrackId(s)!==trackId||JSON.stringify(E.currentTrack(s))!==original)throw Error('acoustic-stale-track');
   // Refuse incomplete kit mappings; preserve the old synth/binding on failure.
   if(E.currentTrack(s).notes.some(n=>!root.MusicStudioInstruments.select(bank.instrument,n.pitch,n.velocity)))throw Error('acoustic-kit-key-unavailable');
   const result=await a.instrumentProjectCommit(s.projectId,p=>{if(E.currentTrackId(s)!==trackId||JSON.stringify(E.currentTrack(s))!==original)throw Error('acoustic-stale-track');for(const e of bank.entries){const existing=p.pcmMix?.assets.find(x=>x.id===e.id);if(existing){if(JSON.stringify(existing.original)!==JSON.stringify(e.pcm))throw Error('acoustic-asset-conflict');continue}p=a.pcmImport(p,e.pcm,e.id);const asset=p.pcmMix.assets.at(-1);asset.id=e.id;asset.sourceInfo=e.source;}return p});
   if(!result.ok)throw Error(result.error);a.editorAdoptInstrument(bank.instrument);const saved=await a.saveMidiEditor({silent:true});if(saved?.ok===false)throw Error(saved.error);return{ok:true,project:a.state.projects.find(p=>p.projectId===s.projectId),entries:bank.entries.length};
  }finally{loading=false}
 }
 root.MusicStudioAcoustic={load,install,roles};
})(typeof window!=='undefined'?window:globalThis);
