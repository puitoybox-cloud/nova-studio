#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict');
const{chromium}=require('playwright');
const baseUrl=process.env.SMOKE_BASE_URL||'http://127.0.0.1:8765';
const viewports=[{width:1440,height:900},{width:820,height:900},{width:390,height:844}];
const placement=box=>({x:box.x,y:box.y,width:box.width});

async function assertSingleVisiblePanel(page,menu,closeSelector){
  await page.waitForFunction(()=>document.querySelectorAll('.music-editor-topbar > .music-editor-menu[open]').length===1);
  assert.equal(await page.locator('.music-editor-topbar > .music-editor-menu[open]').count(),1);
  const popover=menu.locator(':scope > .music-editor-popover');
  assert.equal(await popover.isVisible(),true);
  const close=popover.locator(closeSelector);
  assert.equal(await close.count(),1);
  assert.equal(await close.isVisible(),true);
  assert.equal(await close.evaluate(button=>Boolean(button.closest('.music-editor-popover'))),true);
  assert.equal(await popover.getByRole('button',{name:/閉じる/}).count(),1);
  return popover.boundingBox();
}

async function verify(browser,viewport){
  const page=await browser.newPage({viewport});
  const messages=[];
  page.on('console',message=>messages.push({type:message.type(),text:message.text()}));
  page.on('pageerror',error=>messages.push({type:'error',text:error.message}));
  await page.goto(`${baseUrl}/index.html#music-studio`,{waitUntil:'networkidle'});
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
          {id:'external-melody',name:'External Melody',trackType:'midi-melodic',roleAssignment:'melody',notes:[note('external-1',72),note('external-duplicate',72),note('external-2',74,240)]}
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
  let correction=page.locator('.music-correction-menu');
  const projectMenu=page.locator('.music-project-menu');
  await projectMenu.locator('summary').click();
  assert.equal(await projectMenu.getAttribute('open'),'');
  await correction.locator('summary').click();
  await page.waitForFunction(()=>!document.querySelector('.music-project-menu')?.open);
  assert.equal(await projectMenu.getAttribute('open'),null);
  const coreCorrectionBounds=await assertSingleVisiblePanel(page,correction,'.music-correction-panel-close');
  await page.evaluate(()=>MusicStudio.editorSetTrackSolo(MusicStudio.resolveCurrentTrackSelection().id,true));
  correction=page.locator('.music-correction-menu');
  assert.equal(await correction.getAttribute('open'),'');
  assert.deepEqual(await assertSingleVisiblePanel(page,correction,'.music-correction-panel-close'),coreCorrectionBounds);
  await correction.locator('.music-correction-panel-close').click();
  assert.equal(await correction.getAttribute('open'),null);
  assert.equal(await page.evaluate(()=>MusicStudio.editorSelectTrack('external-melody')),true);
  await page.waitForFunction(()=>MusicStudio.resolveCurrentTrackSelection()?.id==='external-melody');
  let menu=page.locator('.music-cleanup-menu');
  const summary=menu.locator('summary');
  let popover=menu.locator('.music-cleanup-popover');
  const transferMenu=page.locator('.music-editor-topbar > .music-editor-menu').filter({has:page.getByText('Import / Export（読み込み／書き出し）',{exact:true})});
  await transferMenu.locator('summary').click();
  const transferPopover=transferMenu.locator(':scope > .music-editor-popover');
  const transferBounds=await assertSingleVisiblePanel(page,transferMenu,'.music-popup-close');
  const transferStyle=await transferPopover.evaluate(element=>{const style=getComputedStyle(element);return{position:style.position,padding:style.padding,borderRadius:style.borderRadius,backgroundColor:style.backgroundColor,borderTopColor:style.borderTopColor,borderTopWidth:style.borderTopWidth}});
  await transferPopover.locator('.music-popup-close').click();
  assert.equal(await summary.isVisible(),true);
  correction=page.locator('.music-correction-menu');
  await projectMenu.locator('summary').click();
  assert.equal(await projectMenu.getAttribute('open'),'');
  await correction.locator('summary').click();
  assert.equal(await correction.getAttribute('open'),'');
  await page.waitForFunction(()=>!document.querySelector('.music-project-menu')?.open);
  assert.equal(await projectMenu.getAttribute('open'),null);
  const externalCorrectionBounds=await assertSingleVisiblePanel(page,correction,'.music-correction-panel-close');
  const correctionUi=await correction.locator('.music-correction-popover').evaluate(element=>{const label=element.querySelector('.music-correction-target label'),checkbox=element.querySelector('input[type="checkbox"]'),button=element.querySelector('.music-correction-actions button'),section=element.querySelector('.music-correction-target'),style=node=>{const value=getComputedStyle(node);return{display:value.display,gap:value.gap,minHeight:value.minHeight,padding:value.padding,borderRadius:value.borderRadius,borderTopWidth:value.borderTopWidth}};return{label:style(label),checkbox:{width:checkbox?.getBoundingClientRect().width||0,height:checkbox?.getBoundingClientRect().height||0},button:style(button),section:style(section)}});
  await page.evaluate(()=>MusicStudio.editorSetTrackSolo(MusicStudio.resolveCurrentTrackSelection().id,true));
  correction=page.locator('.music-correction-menu');
  assert.deepEqual(await assertSingleVisiblePanel(page,correction,'.music-correction-panel-close'),externalCorrectionBounds);
  await summary.click();
  await page.waitForFunction(()=>!document.querySelector('.music-correction-menu')?.open);
  assert.equal(await menu.getAttribute('open'),'');
  assert.equal(await correction.getAttribute('open'),null);
  const bounds=await assertSingleVisiblePanel(page,menu,'.music-popup-close');
  assert.ok(bounds);
  assert.ok(bounds.x>=0);
  assert.ok(bounds.y>=0);
  assert.ok(bounds.x+bounds.width<=viewport.width+1);
  assert.ok(bounds.y+bounds.height<=viewport.height+1);
  assert.deepEqual(await popover.evaluate(element=>{const style=getComputedStyle(element);return{position:style.position,padding:style.padding,borderRadius:style.borderRadius,backgroundColor:style.backgroundColor,borderTopColor:style.borderTopColor,borderTopWidth:style.borderTopWidth}}),transferStyle);
  assert.ok(Math.abs(bounds.y-transferBounds.y)<=1);
  assert.ok(Math.abs(bounds.width-transferBounds.width)<=1);
  if(transferStyle.position==='fixed')assert.deepEqual(await popover.evaluate(element=>{const filtered=[];for(let parent=element.parentElement;parent;parent=parent.parentElement){const style=getComputedStyle(parent),filters=[style.backdropFilter,style.webkitBackdropFilter].filter(Boolean);if(filters.some(value=>value!=='none'))filtered.push(parent.className||parent.tagName)}return filtered}),[]);
  assert.equal(await popover.locator('#generatedCleanupQuantize').isVisible(),true);
  assert.equal(await popover.getByText('重複Note削除',{exact:true}).isVisible(),true);
  assert.equal(await popover.getByText('同じ音程の短い重なり整理',{exact:true}).isVisible(),true);
  assert.equal(await popover.locator('[onclick="MusicStudio.editorPreviewGeneratedMidiCleanup()"]') .isVisible(),true);
  assert.equal(await popover.locator('[onclick="MusicStudio.editorApplyGeneratedMidiCleanup()"]') .isVisible(),true);
  assert.equal(await popover.locator('[onclick="MusicStudio.editorCancelGeneratedMidiCleanup()"]') .isVisible(),true);
  assert.equal(await popover.locator(':scope > .music-popup-close-row > .music-popup-close').count(),1);
  const cleanupUi=await popover.evaluate(element=>{const label=element.querySelector('.music-correction-target label'),checkbox=element.querySelector('input[type="checkbox"]'),button=element.querySelector('.music-correction-actions button'),section=element.querySelector('.music-correction-target'),style=node=>{const value=getComputedStyle(node);return{display:value.display,gap:value.gap,minHeight:value.minHeight,padding:value.padding,borderRadius:value.borderRadius,borderTopWidth:value.borderTopWidth}};return{label:style(label),checkbox:{width:checkbox.getBoundingClientRect().width,height:checkbox.getBoundingClientRect().height},button:style(button),section:style(section)}});
  assert.equal(cleanupUi.label.display,correctionUi.label.display);
  assert.ok(parseFloat(cleanupUi.label.gap)<=8);
  assert.deepEqual(cleanupUi.button,correctionUi.button);
  assert.deepEqual(cleanupUi.section,correctionUi.section);
  assert.ok(cleanupUi.checkbox.width<=20&&cleanupUi.checkbox.height<=20);
  assert.equal(await popover.locator('.music-external-import,.music-transfer-actions,.music-toggle').count(),0);
  await popover.locator('[onclick="MusicStudio.editorPreviewGeneratedMidiCleanup()"]') .click();
  await page.waitForFunction(()=>document.querySelector('.music-cleanup-menu')?.open&&Boolean(MusicStudio.state.midiEditor.generatedCleanupPreview));
  menu=page.locator('.music-cleanup-menu');popover=menu.locator('.music-cleanup-popover');
  assert.equal(await menu.getAttribute('open'),'');
  assert.equal(await page.evaluate(()=>Boolean(MusicStudio.state.midiEditor.generatedCleanupPreview)),true);
  assert.deepEqual(placement(await popover.boundingBox()),placement(bounds));
  await popover.locator('[onclick="MusicStudio.editorCancelGeneratedMidiCleanup()"]') .click();
  await page.waitForFunction(()=>!MusicStudio.state.midiEditor.generatedCleanupPreview);
  await page.waitForFunction(()=>document.querySelector('.music-cleanup-menu')?.open);
  menu=page.locator('.music-cleanup-menu');popover=menu.locator('.music-cleanup-popover');
  assert.equal(await menu.getAttribute('open'),'');
  assert.equal(await page.evaluate(()=>MusicStudio.state.midiEditor.generatedCleanupPreview),null);
  assert.deepEqual(await popover.boundingBox(),bounds);
  await popover.locator('.music-popup-close').click();
  assert.equal(await menu.getAttribute('open'),null);
  await menu.locator('summary').click();
  assert.deepEqual(await menu.locator('.music-cleanup-popover').boundingBox(),bounds);
  await page.evaluate(()=>MusicStudio.editorSetTrackSolo(MusicStudio.resolveCurrentTrackSelection().id,true));
  menu=page.locator('.music-cleanup-menu');popover=menu.locator('.music-cleanup-popover');
  assert.equal(await menu.getAttribute('open'),'');
  assert.equal(await popover.isVisible(),true);
  await assertSingleVisiblePanel(page,menu,'.music-popup-close');
  assert.deepEqual(await popover.boundingBox(),bounds);
  await correction.locator('summary').click();
  await page.waitForFunction(()=>!document.querySelector('.music-cleanup-menu')?.open);
  assert.equal(await menu.getAttribute('open'),null);
  await assertSingleVisiblePanel(page,correction,'.music-correction-panel-close');
  await menu.locator('summary').click();
  await page.waitForFunction(()=>!document.querySelector('.music-correction-menu')?.open);
  assert.equal(await correction.getAttribute('open'),null);
  await assertSingleVisiblePanel(page,menu,'.music-popup-close');
  await transferMenu.locator('summary').click();
  await page.waitForFunction(()=>!document.querySelector('.music-cleanup-menu')?.open);
  await assertSingleVisiblePanel(page,transferMenu,'.music-popup-close');
  await menu.locator('summary').click();
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll('.music-editor-topbar > .music-editor-menu')).find(item=>item.querySelector('summary')?.textContent.includes('Import / Export'))?.open);
  await assertSingleVisiblePanel(page,menu,'.music-popup-close');
  await popover.locator('[onclick="MusicStudio.editorPreviewGeneratedMidiCleanup()"]') .click();
  menu=page.locator('.music-cleanup-menu');popover=menu.locator('.music-cleanup-popover');
  assert.equal(await popover.locator('[onclick="MusicStudio.editorApplyGeneratedMidiCleanup()"]') .isEnabled(),true);
  await popover.locator('[onclick="MusicStudio.editorApplyGeneratedMidiCleanup()"]') .click();
  assert.equal(await page.evaluate(()=>MusicStudio.state.midiEditor.generatedCleanupPreview),null);
  assert.equal(await page.evaluate(()=>MusicStudio.state.midiEditor.undo.length>0),true);
  const unexpected=messages.filter(message=>message.type==='error'||message.type==='warning');
  assert.deepEqual(unexpected,[]);
  await page.close();
  return{viewport:viewport.width,menuOpen:true,popoverVisible:true,withinViewport:true,consoleErrors:0,consoleWarnings:0};
}

(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
  try{
    const results=[];
    for(const viewport of viewports)results.push(await verify(browser,viewport));
    console.log(JSON.stringify(results,null,2));
  }finally{
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1});
