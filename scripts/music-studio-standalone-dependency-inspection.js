/* Explicit offline CLI: inspect checkout files, never execute or repair dependencies. */
const fs=require('node:fs'),path=require('node:path');
function bundledFile(root,realRoot,name){
 const target=path.resolve(root,name);
 if(!target.startsWith(root+path.sep))return{exists:false,unsafe:true};
 try{
  if(!fs.statSync(target).isFile())return{exists:false,unsafe:false};
  const realTarget=fs.realpathSync(target);
  if(!realTarget.startsWith(realRoot+path.sep))return{exists:false,unsafe:true};
  return{exists:true,unsafe:false};
 }catch(error){
  if(['ENOENT','ENOTDIR','ELOOP'].includes(error.code))return{exists:false,unsafe:false};
  throw error;
 }
}
function inspect(root){
 root=path.resolve(root);
 const issues=[],dependencies=[],htmlPath=path.join(root,'music-studio.html');
 if(!fs.existsSync(root))return{valid:false,issues:[{code:'missing-entry',path:'music-studio.html'}],dependencies:[]};
 const realRoot=fs.realpathSync(root),entry=bundledFile(root,realRoot,'music-studio.html');
 if(!entry.exists)return{valid:false,issues:[{code:entry.unsafe?'unsafe-path':'missing-entry',path:'music-studio.html'}],dependencies:[]};
 const html=fs.readFileSync(htmlPath,'utf8'),seen=new Set();
 for(const match of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi)){
  const url=match[1];if(url.startsWith('data:'))continue;
  if(!url.startsWith('./')){issues.push({code:'nonlocal-dependency',path:url.split('?')[0]});continue;}
  const name=url.slice(2).split(/[?#]/)[0],file=bundledFile(root,realRoot,name);
  if(file.unsafe){issues.push({code:'unsafe-path',path:name});continue;}
  if(seen.has(name))issues.push({code:'duplicate-dependency',path:name});seen.add(name);
  dependencies.push({path:name,exists:file.exists});if(!file.exists)issues.push({code:'missing-dependency',path:name});
 }
 for(const name of ['music-studio-dependency-inspection.js','tools/music-audio-pipeline/server.py','tools/music-audio-pipeline/requirements.txt','tools/music-native-wrapper/MusicStudioWebMidiBridge.swift']){
  const file=bundledFile(root,realRoot,name);
  dependencies.push({path:name,exists:file.exists,scope:'optional-tooling'});
  if(file.unsafe)issues.push({code:'unsafe-path',path:name});
  else if(!file.exists)issues.push({code:'missing-tooling',path:name});
 }
 const requirements=path.join(root,'tools/music-audio-pipeline/requirements.txt');
 const packages=bundledFile(root,realRoot,'tools/music-audio-pipeline/requirements.txt').exists?fs.readFileSync(requirements,'utf8').split(/\r?\n/).filter(x=>x.trim()&&!x.startsWith('#')):[];
 return{valid:issues.length===0,issues,dependencies,pythonRequirements:packages,
 boundaries:[{feature:'Standalone MIDI editor/save/JSON/Backup',dependency:'local browser scripts + IndexedDB',verification:'static-only'},
 {feature:'Audio-to-MIDI/Stem',dependency:'explicit loopback 127.0.0.1:8766, pipeline revision 2, Python packages and model weights',verification:'runtime-unassessed'},
 {feature:'native MIDI',dependency:'optional WKWebView/CoreMIDI wrapper; browser Web MIDI is separate',verification:'physical-pending'},
 {feature:'Dream Architect/Nova navigation',dependency:'optional host routes/window; not standalone music persistence',verification:'runtime-unassessed'}],
 transitiveAssets:'unassessed',modelAvailability:'unassessed',licenseCompatibility:'unassessed',physicalVerification:'pending'};
}
module.exports={inspect};
if(require.main===module)process.stdout.write(JSON.stringify(inspect(path.resolve(__dirname,'..')),null,2)+'\n');
