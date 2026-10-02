const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),plain=v=>JSON.parse(JSON.stringify(v));
function loadPanel(){
  const w={};w.window=w;w.globalThis=w;
  for(const file of ['music-studio-ai-workflow.js','music-studio-ai-composition.js','music-studio-ai-assistant-ui.js','music-studio-ai-assistant-panel.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),w,{filename:file});
  return w;
}
test('standalone and hosted entry points load composition service before assistant panel',()=>{
  const html=fs.readFileSync(path.join(root,'music-studio.html'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  for(const source of [html,app]){
    const composition=source.indexOf('music-studio-ai-composition.js'),panel=source.indexOf('music-studio-ai-assistant-panel.js');
    assert.ok(composition>=0);assert.ok(panel>composition);
  }
});
test('assistant panel candidate fixture now comes from deterministic composition service',()=>{
  const w=loadPanel(),chord=w.MusicStudioAIAssistantPanel._candidateValues('chord'),arr=w.MusicStudioAIAssistantPanel._candidateValues('arrangement'),lyrics=w.MusicStudioAIAssistantPanel._candidateValues('lyrics-structure');
  assert.deepEqual(plain(chord[1].progression),['C','Am','F','G']);
  assert.equal(chord.every(item=>item.keyPolicy==='candidate-only'&&item.localOnly),true);
  assert.equal(arr.every(item=>item.register&&item.dynamics&&item.applyPolicy==='metadata-only'),true);
  assert.deepEqual(plain(lyrics.map(item=>item.linkedMelodyCandidate)),['A','B','C']);
});
test('composition integration contains no endpoint, credential or fetch path',()=>{
  for(const file of ['music-studio-ai-composition.js','music-studio-ai-assistant-panel.js']){
    const source=fs.readFileSync(path.join(root,file),'utf8');
    assert.doesNotMatch(source,/https?:\/\/|apiKey|credential|fetch\s*\(/);
  }
});
