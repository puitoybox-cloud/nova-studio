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
  const menu=page.locator('.music-cleanup-menu');
  const summary=menu.locator('summary');
  const popover=menu.locator('.music-cleanup-popover');
  assert.equal(await summary.isVisible(),true);
  await summary.click();
  assert.equal(await menu.getAttribute('open'),'');
  assert.equal(await popover.isVisible(),true);
  const bounds=await popover.boundingBox();
  assert.ok(bounds);
  assert.ok(bounds.x>=0);
  assert.ok(bounds.y>=0);
  assert.ok(bounds.x+bounds.width<=viewport.width+1);
  assert.ok(bounds.y+bounds.height<=viewport.height+1);
  const paintState=await popover.evaluate(node=>{
    const rect=node.getBoundingClientRect(),x=Math.round(rect.left+rect.width/2),y=Math.round(rect.top+Math.min(rect.height/2,80));
    const hit=document.elementFromPoint(x,y);
    const ancestors=[];
    for(let current=node.parentElement;current;current=current.parentElement){
      const style=getComputedStyle(current);
      ancestors.push({tag:current.tagName,className:current.className,overflowX:style.overflowX,overflowY:style.overflowY,contain:style.contain,transform:style.transform,filter:style.filter,backdropFilter:style.backdropFilter});
    }
    return{hitInside:Boolean(hit&&(hit===node||node.contains(hit))),hitTag:hit?.tagName||null,hitClass:hit?.className||'',ancestors};
  });
  assert.equal(paintState.hitInside,true,JSON.stringify(paintState));
  assert.equal(await popover.locator('#generatedCleanupQuantize').isVisible(),true);
  assert.equal(await popover.getByText('同じ位置・音程の重複Noteを除く',{exact:false}).isVisible(),true);
  assert.equal(await popover.getByText('同じ音程の短い重なりを整える',{exact:false}).isVisible(),true);
  assert.equal(await popover.locator('[onclick="MusicStudio.editorPreviewGeneratedMidiCleanup()"]') .isVisible(),true);
  assert.equal(await popover.locator('[onclick="MusicStudio.editorApplyGeneratedMidiCleanup()"]') .isVisible(),true);
  assert.equal(await popover.locator('[onclick="MusicStudio.editorCancelGeneratedMidiCleanup()"]') .isVisible(),true);
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
