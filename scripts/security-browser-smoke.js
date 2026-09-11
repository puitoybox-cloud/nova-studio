#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const{chromium}=require('playwright');
const baseUrl=process.env.SMOKE_BASE_URL||'http://127.0.0.1:8765';
const viewports=[{width:1440,height:900},{width:820,height:900},{width:390,height:844}];

async function verify(browser,viewport){
  const page=await browser.newPage({viewport});const messages=[];
  page.on('console',message=>messages.push({type:message.type(),text:message.text()}));
  page.on('pageerror',error=>messages.push({type:'error',text:error.message}));
  page.on('dialog',dialog=>dialog.accept(dialog.type()==='prompt'?'merge':undefined));
  await page.goto(`${baseUrl}/index.html`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.NovaSecurity&&typeof window.storyArchiveView==='function');
  assert.ok(await page.locator('#app').count());

  await page.evaluate(()=>setView('backup'));
  const input=page.locator('input[type=file][accept*="json"]').first();assert.equal(await input.count(),1);
  const normal={format:'nova-studio-backup',schemaVersion:'1.0',data:{storyArchiveCards:[{id:'security_card',type:'storyArchiveCard',title:'Security Card',body:'normal',category:'キャラクター',projectId:'project_tia_nova',episodeId:'episode_tia_nova_all',images:[{id:'security_image',name:'Preview',previewDataUrl:'data:image/png;base64,iVBORw0KGgo='}]}]}};
  await input.setInputFiles({name:'normal.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(normal))});
  await page.waitForFunction(()=>state.storyArchiveCards.some(card=>card.id==='security_card'));
  await page.evaluate(()=>openStoryArchive());await page.waitForSelector('[data-card-id="security_card"]');
  assert.equal(await page.locator('[data-card-id="security_card"][onclick]').count(),0);
  await page.locator('[data-archive-action="open-card"][data-card-id="security_card"]').first().click();
  await page.waitForSelector('[data-image-id="security_image"]');
  assert.equal(await page.locator('[data-image-id="security_image"][onclick]').count(),0);

  const before=await page.evaluate(()=>JSON.stringify(state));
  const malicious={format:'nova-studio-backup',schemaVersion:'1.0',data:{storyArchiveCards:[{id:`bad' onclick='globalThis.pwned=1`,title:'<script>globalThis.pwned=1</script>',images:[{id:'image_bad',previewDataUrl:'data:image/svg+xml,<svg onload=globalThis.pwned=1>'}]}]}};
  await page.evaluate(()=>setView('backup'));const badInput=page.locator('input[type=file][accept*="json"]').first();
  await badInput.setInputFiles({name:'malicious.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(malicious))});await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);assert.equal(await page.evaluate(()=>globalThis.pwned),undefined);

  const navigation=await page.evaluate(()=>{const opened=[];const original=window.open;window.open=url=>opened.push(url);openApp('promptStudio','javascript:alert(1)');openApp('promptStudio','data:text/html,x');openApp('promptStudio','https://example.com/path');window.open=original;return opened});
  assert.deepEqual(navigation,['https://example.com/path']);

  await page.evaluate(()=>openApp('musicStudio'));await page.waitForSelector('.music-studio-shell,.music-midi-editor-page');
  assert.ok(await page.locator('.music-studio-shell,.music-midi-editor-page').count());
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert.ok(overflow<=1);
  const unexpected=messages.filter(message=>message.type==='error'||message.type==='warning');assert.deepEqual(unexpected,[]);
  await page.close();return{viewport:viewport.width,novaStudio:true,importExport:true,storyArchive:true,navigation:true,musicStudio:true,dynamicTrackUi:true,consoleErrors:0,consoleWarnings:0};
}

(async()=>{const browser=await chromium.launch({headless:true});try{const results=[];for(const viewport of viewports)results.push(await verify(browser,viewport));console.log(JSON.stringify(results,null,2))}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
