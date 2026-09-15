#!/usr/bin/env node
'use strict';
const{chromium}=require('playwright');
const baseUrl=process.env.SMOKE_BASE_URL||'http://127.0.0.1:8765';
const viewports=[{width:1180,height:820},{width:1024,height:768},{width:1366,height:1024}];
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    for(const viewport of viewports){
      const context=await browser.newContext({viewport,hasTouch:true});
      const page=await context.newPage();
      const messages=[];
      page.on('console',m=>messages.push({type:m.type(),text:m.text()}));
      page.on('pageerror',e=>messages.push({type:'error',text:e.message}));
      await page.goto(`${baseUrl}/music-studio.html#music-studio`,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>window.MusicStudio?.state?.loaded===true);
      await page.evaluate(async()=>{
        const app=MusicStudio;
        const project=app.makeProject({projectId:'pr249-layout',projectName:'PR249 Layout',midiData:{ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},editor:{measureCount:4},tracks:[
          {id:'core-melody',part:'melody',name:'Melody',notes:[{id:'n',pitch:60,startTick:0,durationTicks:480,velocity:90}]},
          {id:'core-drums',part:'drums',name:'Drums',notes:[]},
          {id:'core-bass',part:'bass',name:'Bass',notes:[]}
        ]}});
        const repo=app.memoryRepository();app.setRepository(repo);await repo.put(project);app.state.projects=[project];
        location.hash='music-studio/midi-editor/pr249-layout';
      });
      await page.waitForSelector('.music-midi-editor-page');
      const result=await page.evaluate(()=>{
        const rect=s=>document.querySelector(s)?.getBoundingClientRect().toJSON();
        const sections=[...document.querySelectorAll('.music-editor-bottom>section')].map(section=>({title:section.querySelector('h2')?.textContent.trim(),...section.getBoundingClientRect().toJSON()}));
        const rows=[...new Set(sections.map(s=>Math.round(s.top)))];
        return{
          viewport:{width:innerWidth,height:innerHeight},
          coarse:matchMedia('(pointer:coarse)').matches,
          landscape:matchMedia('(orientation:landscape)').matches,
          page:rect('.music-midi-editor-page'),
          piano:rect('.music-editor-layout'),
          bottom:rect('.music-editor-bottom'),
          sections,
          rows:rows.length,
          documentOverflowX:document.documentElement.scrollWidth-document.documentElement.clientWidth,
          documentOverflowY:document.documentElement.scrollHeight-document.documentElement.clientHeight,
          bottomOverflowY:document.querySelector('.music-editor-bottom').scrollHeight-document.querySelector('.music-editor-bottom').clientHeight,
          computed:{
            pageHeight:getComputedStyle(document.querySelector('.music-midi-editor-page')).height,
            pianoHeight:getComputedStyle(document.querySelector('.music-piano-viewport')).height,
            bottomHeight:getComputedStyle(document.querySelector('.music-editor-bottom')).height,
            bottomColumns:getComputedStyle(document.querySelector('.music-editor-bottom')).gridTemplateColumns
          }
        };
      });
      result.console=messages.filter(m=>m.type==='error'||m.type==='warning');
      const failures=[];
      if(!result.coarse||!result.landscape)failures.push('iPad media conditions');
      if(result.rows!==1||result.sections.length!==5)failures.push('five-region row');
      if(result.documentOverflowX!==0||result.documentOverflowY!==0)failures.push('document overflow');
      if(result.page.top!==0||Math.abs(result.page.bottom-result.viewport.height)>1)failures.push('page viewport fit');
      if(result.piano.height<150||result.piano.bottom>result.bottom.top+1)failures.push('piano fit');
      if(result.bottom.bottom>result.viewport.height+1||result.sections.some(section=>section.top<0||section.top>=result.viewport.height))failures.push('bottom region visibility');
      if(result.console.length)failures.push('console');
      console.log(JSON.stringify({...result,failures}));
      if(failures.length)throw new Error(`layout assertions failed: ${failures.join(', ')}`);
      await context.close();
    }
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
