#!/usr/bin/env node
'use strict';

require('../music-studio-editor.js');

const provider=process.argv[2];
const environments={openai:{apiKey:'OPENAI_API_KEY',model:'OPENAI_MODEL'},gemini:{apiKey:'GEMINI_API_KEY',model:'GEMINI_MODEL'}};
if(!environments[provider]){
  process.stderr.write('Usage: node scripts/music-studio-live-api-smoke.js <openai|gemini>\n');
  process.exitCode=2;
}else{
  const names=environments[provider],apiKey=process.env[names.apiKey],model=process.env[names.model];
  if(!apiKey||!model){
    process.stdout.write(JSON.stringify({ok:false,provider,modelAvailable:Boolean(model),credentialAvailable:Boolean(apiKey),stage:'config',code:'unavailable'})+'\n');
  }else{
    const config=globalThis.MusicStudioEditor.createPartialEditProviderConfig(provider,{apiKey,model});
    globalThis.MusicStudioEditor.runPartialEditLiveApiSmokeTest({config,apiKey}).then(result=>{process.stdout.write(JSON.stringify(result)+'\n');if(!result.ok)process.exitCode=1});
  }
}
