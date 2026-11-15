'use strict';
// Deliberate reference regeneration; never imports production code.
const fs=require('node:fs'),{spawnSync}=require('node:child_process'),{createHash}=require('node:crypto');
const {cases,signal}=require('../tests/fixtures/music-meter-signals');
const version=spawnSync('ffmpeg',['-version'],{encoding:'utf8'});if(version.status!==0)throw Error('ffmpeg unavailable');
const rows=cases.map(c=>{const pcm=signal(c),n=pcm.channels[0].length,ch=pcm.channels.length,bytes=Buffer.alloc(n*ch*4);for(let i=0;i<n;i++)for(let k=0;k<ch;k++)bytes.writeFloatLE(pcm.channels[k][i],4*(i*ch+k));
 const args=['-hide_banner','-nostats','-f','f32le','-ar','48000','-ac',String(ch),'-i','pipe:0','-af','ebur128=peak=true','-f','null','-'];
 const r=spawnSync('ffmpeg',args,{input:bytes,encoding:'utf8',maxBuffer:10e6});if(r.status!==0)throw Error(r.stderr);const summary=r.stderr.slice(r.stderr.lastIndexOf('Summary:')),l=summary.match(/I:\s+(-?[\d.]+) LUFS/),p=summary.match(/Peak:\s+(-?[\d.]+|-inf) dBFS/);if(!l||!p)throw Error(summary);
 return{id:c.id,pcmSha256:createHash('sha256').update(bytes).digest('hex'),lufs:Number(l[1]),truePeakDb:p[1]==='-inf'?null:Number(p[1]),summary};
});
fs.writeFileSync('tests/fixtures/music-meter-ffmpeg-reference.json',JSON.stringify({date:'2026-10-31 JST',source:'https://ffmpeg.org/ffmpeg-filters.html#ebur128',version:version.stdout.split('\n')[0],command:'ffmpeg -hide_banner -nostats -f f32le -ar 48000 -ac CHANNELS -i pipe:0 -af ebur128=peak=true -f null -',signalSourceSha256:createHash('sha256').update(fs.readFileSync('tests/fixtures/music-meter-signals.js')).digest('hex'),rounding:.1,lufsTolerance:.11,steadyTruePeakToleranceDb:.2,discontinuousTruePeakCharacterizationOnly:true,rows},null,2)+'\n');
