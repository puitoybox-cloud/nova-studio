// Packaging benchmark only: deterministic PCM fixtures, not MIDI/WebAudio rendering.
const fs=require('node:fs'),vm=require('node:vm'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {performance}=require('node:perf_hooks');
async function main(){
 const w={console,Blob,crypto,setTimeout};w.window=w;vm.runInNewContext(fs.readFileSync('music-studio.js','utf8'),w);
 const frames=48000*480,bytes=frames*4,files=[],hashes=[],start=performance.now(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'nova-stem-zip-'));
 for(let instrument=0;instrument<4;instrument++){
  const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(bytes+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(2,22);header.writeUInt32LE(48000,24);header.writeUInt32LE(192000,28);header.writeUInt16LE(4,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(bytes,40);
  const block=Buffer.alloc(192000);for(let i=0;i<48000;i++){const sample=Math.round(3000*Math.sin(2*Math.PI*(110*(instrument+1))*i/48000));block.writeInt16LE(sample,i*4);block.writeInt16LE(sample,i*4+2)}
  const blob=new Blob([header,...Array(480).fill(block)]),hash=crypto.createHash('sha256');for await(const chunk of blob.stream())hash.update(chunk);
  files.push({name:['Piano','Bass','Strings','Drums'][instrument]+'.wav',blob});hashes.push(hash.digest('hex'));
 }
 const prepared=performance.now(),progress=[];const zip=await w.MusicStudio.finalZip(files,()=>{},p=>{if(!progress.length||p.ratio===1||p.completedBytes-progress.at(-1).completedBytes>=32*1048576)progress.push(p)}),packaged=performance.now();
 const zipPath=path.join(dir,'Stems.zip'),fd=fs.openSync(zipPath,'w');try{for await(const chunk of zip.stream())fs.writeSync(fd,chunk)}finally{fs.closeSync(fd)}
 const report={date:new Date().toISOString(),kind:'deterministic-pcm-packaging-only',midiRenderVerified:false,seconds:480,sampleRate:48000,channels:2,frames,files:files.map((f,i)=>({name:f.name,bytes:f.blob.size,sha256:hashes[i]})),zipBytes:zip.size,fixturePreparationMs:prepared-start,packagingMs:packaged-prepared,peakRssKiB:process.resourceUsage().maxRSS,zipPath,progress};
 console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
