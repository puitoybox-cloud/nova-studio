#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict');
const{chromium}=require('playwright');
const baseUrl=process.env.SMOKE_BASE_URL||'http://127.0.0.1:8765';
const viewports=[{width:1440,height:900},{width:820,height:900},{width:390,height:844}];

async function verify(browser,viewport){
  const page=await browser.newPage({viewport});
  const messages=[];
  page.on('console',message=>messages.push({type:message.type(),text:message.text()}));
  page.on('pageerror',error=>messages.push({type:'error',text:error.message}));
  await page.goto(`${baseUrl}/music-studio.html#music-studio`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.MusicStudio?.state?.loaded===true);
  await page.evaluate(async()=>{
    const note=(id,pitch,startTick=0)=>({id,pitch,startTick,durationTicks:120,velocity:80});
    const project=MusicStudio.makeProject({
      projectId:'cleanup-popover-smoke',
      projectName:'Cleanup Popover Smoke',
      midiData:{
        ppq:480,
        tempo:120,
        timeSignature:{numerator:4,denominator:4},
        editor:{measureCount:8},
        tracks:[
          {id:'melody',part:'melody',name:'Melody',notes:[note('melody-1',60)]},
          {id:'drums',part:'drums',name:'Drums',channel:10,notes:[note('drums-1',36)]},
          {id:'bass',part:'bass',name:'Bass',notes:[note('bass-1',48)]},
          {id:'external-melody',name:'External Melody',trackType:'midi-melodic',roleAssignment:'melody',notes:[note('external-1',72),note('external-2',74,240)]}
        ]
      }
    });
    const repo=MusicStudio.memoryRepository();
    MusicStudio.setRepository(repo);
    await repo.put(project);
    MusicStudio.state.projects=[project];
    location.hash='music-studio/midi-editor/cleanup-popover-smoke';
  });
  await page.waitForSelector('.music-midi-editor-page');
  assert.equal(await page.evaluate(()=>MusicStudio.editorSelectTrack('external-melody')),true);
  await page.waitForFunction(()=>MusicStudio.resolveCurrentTrackSelection()?.id==='external-melody');
  let menu=page.locator('.music-cleanup-menu');
  const summary=menu.locator('summary');
  let popover=menu.locator('.music-cleanup-popover');
  assert.equal(await summary.isVisible(),true);
  const correction=page.locator('.music-correction-menu');
  await correction.locator('summary').click();
  assert.equal(await correction.getAttribute('open'),'');
  await summary.click();
  assert.equal(await menu.getAttribute('open'),'');
  assert.equal(await correction.getAttribute('open'),null);
  assert.equal(await popover.isVisible(),true);
  const bounds=await popover.boundingBox();
  assert.ok(bounds);
  assert.ok(bounds.x>=0);
  assert.ok(bounds.y>=0);
  assert.ok(bounds.x+bounds.width<=viewport.width+1);
  assert.ok(bounds.y+bounds.height<=viewport.height+1);
  assert.equal(await popover.locator('#generatedCleanupQuantize').isVisible(),true);
  assert.equal(await popover.getByText('同じ位置・音程の重複Noteを除く',{exact:false}).isVisible(),true);
  assert.equal(await popover.getByText('同じ音程の短い重なりを整える',{exact:false}).isVisible(),true);
  assert.equal(await popover.locator('[onclick="MusicStudio.editorPreviewGeneratedMidiCleanup()"]') .isVisible(),true);
  assert.equal(await popover.locator('[onclick="MusicStudio.editorApplyGeneratedMidiCleanup()"]') .isVisible(),true);
  assert.equal(await popover.locator('[onclick="MusicStudio.editorCancelGeneratedMidiCleanup()"]') .isVisible(),true);
  assert.equal(await popover.locator('.music-cleanup-panel-close').count(),1);
  await popover.locator('[onclick="MusicStudio.editorPreviewGeneratedMidiCleanup()"]') .click();
  menu=page.locator('.music-cleanup-menu');popover=menu.locator('.music-cleanup-popover');
  assert.equal(await menu.getAttribute('open'),'');
  assert.equal(await page.evaluate(()=>Boolean(MusicStudio.state.midiEditor.generatedCleanupPreview)),true);
  assert.deepEqual(await popover.boundingBox(),bounds);
  await popover.locator('[onclick="MusicStudio.editorCancelGeneratedMidiCleanup()"]') .click();
  menu=page.locator('.music-cleanup-menu');popover=menu.locator('.music-cleanup-popover');
  assert.equal(await menu.getAttribute('open'),'');
  assert.equal(await page.evaluate(()=>MusicStudio.state.midiEditor.generatedCleanupPreview),null);
  assert.deepEqual(await popover.boundingBox(),bounds);
  await popover.locator('.music-cleanup-panel-close').click();
  assert.equal(await menu.getAttribute('open'),null);
  await menu.locator('summary').click();
  assert.deepEqual(await menu.locator('.music-cleanup-popover').boundingBox(),bounds);
  await page.evaluate(()=>MusicStudio.editorSetTrackSolo(MusicStudio.resolveCurrentTrackSelection().id,true));
  menu=page.locator('.music-cleanup-menu');popover=menu.locator('.music-cleanup-popover');
  assert.equal(await menu.getAttribute('open'),'');
  assert.equal(await popover.isVisible(),true);
  assert.deepEqual(await popover.boundingBox(),bounds);
  const unexpected=messages.filter(message=>message.type==='error'||message.type==='warning');
  assert.deepEqual(unexpected,[]);
  await page.close();
  return{viewport:viewport.width,menuOpen:true,popoverVisible:true,withinViewport:true,consoleErrors:0,consoleWarnings:0};
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const results=[];
    for(const viewport of viewports)results.push(await verify(browser,viewport));
    console.log(JSON.stringify(results,null,2));
  }finally{
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1});
