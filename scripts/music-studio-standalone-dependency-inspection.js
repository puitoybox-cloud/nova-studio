/* Explicit offline CLI: inspect checkout files, never execute or repair dependencies. */
const fs=require('node:fs'),path=require('node:path');
function inspect(root){
 const issues=[],dependencies=[],htmlPath=path.join(root,'music-studio.html');
 if(!fs.existsSync(htmlPath))return{valid:false,issues:[{code:'missing-entry',path:'music-studio.html'}],dependencies:[]};
 const html=fs.readFileSync(htmlPath,'utf8'),seen=new Set();
 for(const match of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi)){
  const url=match[1];if(url.startsWith('data:'))continue;
  if(!url.startsWith('./')){issues.push({code:'nonlocal-dependency',path:url.split('?')[0]});continue;}
  const name=url.slice(2).split(/[?#]/)[0],target=path.resolve(root,name);
  if(!target.startsWith(path.resolve(root)+path.sep)){issues.push({code:'unsafe-path',path:name});continue;}
  if(seen.has(name))issues.push({code:'duplicate-dependency',path:name});seen.add(name);
  const exists=fs.existsSync(target)&&fs.statSync(target).isFile();dependencies.push({path:name,exists});if(!exists)issues.push({code:'missing-dependency',path:name});
 }
 for(const name of ['music-studio-dependency-inspection.js','tools/music-audio-pipeline/server.py','tools/music-audio-pipeline/requirements.txt','tools/music-native-wrapper/MusicStudioWebMidiBridge.swift']){
  const exists=fs.existsSync(path.join(root,name));dependencies.push({path:name,exists,scope:'optional-tooling'});if(!exists)issues.push({code:'missing-tooling',path:name});
 }
 const requirements=path.join(root,'tools/music-audio-pipeline/requirements.txt');
 const packages=fs.existsSync(requirements)?fs.readFileSync(requirements,'utf8').split(/\r?\n/).filter(x=>x.trim()&&!x.startsWith('#')):[];
 return{valid:issues.length===0,issues,dependencies,pythonRequirements:packages,
 boundaries:[{feature:'Standalone MIDI editor/save/JSON/Backup',dependency:'local browser scripts + IndexedDB',verification:'static-only'},
 {feature:'Audio-to-MIDI/Stem',dependency:'explicit loopback 127.0.0.1:8766, pipeline revision 2, Python packages and model weights',verification:'runtime-unassessed'},
 {feature:'native MIDI',dependency:'optional WKWebView/CoreMIDI wrapper; browser Web MIDI is separate',verification:'physical-pending'},
 {feature:'Dream Architect/Nova navigation',dependency:'optional host routes/window; not standalone music persistence',verification:'runtime-unassessed'}],
 transitiveAssets:'unassessed',modelAvailability:'unassessed',licenseCompatibility:'unassessed',physicalVerification:'pending'};
}
module.exports={inspect};
if(require.main===module)process.stdout.write(JSON.stringify(inspect(path.resolve(__dirname,'..')),null,2)+'\n');
