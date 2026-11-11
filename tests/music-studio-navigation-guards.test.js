'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(){const handlers={},w={console,Date,Math,JSON,Intl,location:{hash:'#music-studio'},addEventListener:(name,fn)=>handlers[name]=fn};w.window=w;vm.runInNewContext(fs.readFileSync('music-studio.js','utf8'),w);const a=w.MusicStudio;a.state.loaded=true;a.state.settings=a.defaultSettings();const p=a.makeProject({projectId:'song',projectName:'Safe'});a.state.projects=[p];a.mountStandalone();return{a,w,handlers,p}}
const modes={
 'vocal recording':a=>a.vocal.phase='recording','vocal pending':a=>a.vocal.pending={},
 'MIDI recording':a=>a.state.midiInput.recording=true,'MIDI stopping':a=>a.state.midiInput.stopping=true,
 'dirty MIDI':a=>a.state.midiEditor={dirty:true},'MIDI save':a=>a.state.midiEditorSaveInFlight=true,
 'project save':a=>a.state.saveStatus='saving','lyric save':a=>a.lyricsEditor.busy=true,
 'lyric candidate':a=>a.lyricsEditor.pending={},'PCM operation':a=>a.pcmEditor.busy=true,'uncommitted PCM preview':a=>a.pcmEditor.preview={kind:'gain-preview',assetId:'asset-1',gainDb:-3},
 'archive operation':a=>a.archiveTransfer.busy=true,'checkpoint operation':a=>a.versionPanel.busy=true,
 'final export':a=>a.finalExport.busy=true
};
for(const [name,setup]of Object.entries(modes))test('all navigation entry guards retain '+name,()=>{for(const path of ['menu','project','lyrics','pcm','history','repeated-history']){const {a,w,handlers}=fixture();setup(a);const before=JSON.stringify([a.state.midiEditor,a.vocal.pending,a.state.projects]);if(path==='menu')a.goProjects();else if(path==='project')assert.equal(a.openProject('song'),false);else if(path==='lyrics')assert.equal(a.openLyricsAssignment('song'),false);else if(path==='pcm')assert.equal(a.pcmOpen('song'),false);else{w.location.hash='#music-studio/projects';handlers.hashchange();if(path==='repeated-history'){w.location.hash='#music-studio/settings';handlers.hashchange()}}assert.equal(w.location.hash,'#music-studio',name+':'+path);assert.equal(JSON.stringify([a.state.midiEditor,a.vocal.pending,a.state.projects]),before)}});
test('hash navigation requires explicit dirty discard, restores safely and does not reuse rejection for next navigation',()=>{const {a,w,handlers}=fixture();a.state.dirty=true;w.confirm=()=>false;w.location.hash='#music-studio/projects';handlers.hashchange();assert.equal(w.location.hash,'#music-studio');assert.equal(a.state.dirty,true);handlers.hashchange();w.confirm=()=>true;w.location.hash='#music-studio/settings';handlers.hashchange();assert.equal(w.location.hash,'#music-studio/settings');assert.equal(a.state.dirty,false)});
test('guarded internal navigation updates origin used for later history rejection',()=>{const {a,w,handlers}=fixture();a.goProjects();const origin='#'+w.location.hash.replace(/^#/,'');w.location.hash='#'+w.location.hash.replace(/^#/,'');handlers.hashchange();a.state.midiInput.recording=true;w.location.hash='#music-studio/settings';handlers.hashchange();assert.equal(w.location.hash,origin)});
test('host setView direct menu calls obey guards while internal guarded actions still work',()=>{const {a,w}=fixture(),calls=[];w.managementViewForRoute=()=>'';w.setView=route=>{calls.push(route);w.location.hash='#'+route};assert.equal(a.installHostRoutes(),true);a.state.midiInput.recording=true;assert.equal(w.setView('projects'),false);assert.deepEqual(calls,[]);a.state.midiInput.recording=false;a.goProjects();assert.deepEqual(calls,[a.PROJECTS_ROUTE]);a.state.dirty=true;w.confirm=()=>false;assert.equal(w.setView('settings'),false);assert.deepEqual(calls,[a.PROJECTS_ROUTE])});

for(const pending of ['starting','countingIn'])for(const veto of ['dirty MIDI','project discard rejected'])test(`rejected ${veto} navigation preserves MIDI ${pending}`,()=>{
 for(const entry of ['menu','project','history','host']){
  const {a,w,handlers}=fixture();let confirmations=0;
  w.confirm=()=>{confirmations++;return false};
  if(veto==='dirty MIDI')a.state.midiEditor={dirty:true};else a.state.dirty=true;
  Object.assign(a.state.midiInput,{starting:true,[pending]:true,recordingPart:'melody',recordingTrackId:'lead',countInBeat:2});
  const before=JSON.stringify(a.state.midiInput);
  if(entry==='host'){w.managementViewForRoute=()=>'';w.setView=route=>{w.location.hash='#'+route};a.installHostRoutes();assert.equal(w.setView('music-studio/settings'),false)}
  else if(entry==='history'){w.location.hash='#music-studio/settings';handlers.hashchange()}
  else if(entry==='project')assert.equal(a.openProject('song'),false);
  else a.goProjects();
  assert.equal(w.location.hash,'#music-studio',entry);assert.equal(JSON.stringify(a.state.midiInput),before,entry);
  assert.equal(confirmations,veto==='dirty MIDI'?0:1);
 }
});
for(const pending of ['starting','countingIn'])test(`accepted discard settles MIDI ${pending} exactly once`,()=>{
 const {a,w,handlers}=fixture();let settled=0;w.confirm=()=>true;a.state.dirty=true;
 Object.assign(a.state.midiInput,{starting:true,[pending]:true,countInResolve:()=>settled++});
 a.goProjects();assert.equal(a.state.dirty,false);assert.equal(a.state.midiInput.starting,false);assert.equal(Boolean(a.state.midiInput.countingIn),false);
 assert.equal(settled,pending==='countingIn'?1:0);handlers.hashchange();assert.equal(settled,pending==='countingIn'?1:0);
});

test('expired navigation notice removes only its own DOM and keeps an active dismiss button',()=>{
 for(const noticeOwnsFocus of [false,true]){
  const {a,w}=fixture();
  let callback,paints=0,removed=0;
  const activeElement={};
  const notice={
   contains:element=>noticeOwnsFocus&&element===activeElement,
   remove:()=>removed++
  };
  w.document={activeElement,querySelectorAll:selector=>selector==='.music-studio-shell .music-notice'?[notice]:[]};
  w.render=()=>paints++;
  w.setTimeout=fn=>{callback=fn;return 1};
  a.state.saveStatus='saving';
  a.goProjects();
  assert.equal(paints,1);
  assert.ok(a.state.notice);
  callback();
  assert.equal(paints,1);
  assert.equal(removed,noticeOwnsFocus?0:1);
  assert.equal(Boolean(a.state.notice),noticeOwnsFocus);
 }
});

for(const [name,setup] of Object.entries({
 'project save in progress':a=>a.state.saveStatus='saving',
 'MIDI save in progress':a=>a.state.midiEditorSaveInFlight=true,
 'MIDI import in progress':a=>a.state.midiImporting=true,
 'external song import in progress':a=>a.state.externalSongImporting=true,
 'checkpoint in progress':a=>a.versionPanel.busy=true,
 'lyrics candidate pending':a=>a.lyricsEditor.pending={},
 'uncommitted PCM preview':a=>a.pcmEditor.preview={kind:'gain-preview',assetId:'asset-1',gainDb:-3}
}))test('production navigation does not initiate dirty MIDI save during '+name,async()=>{
 const {a,w}=fixture();
 a.state.midiEditor={dirty:true,projectId:'song'};
 setup(a);
 const before=JSON.stringify([a.state.midiEditor,a.state.projects]);
 assert.equal(await a.productionOpenAction('mix','song'),false);
 assert.equal(w.location.hash,'#music-studio');
 assert.equal(JSON.stringify([a.state.midiEditor,a.state.projects]),before);
});
