'use strict';
const assert=require('node:assert/strict');
const Core=require('../dream-architect-transfer-core.js');

const project={id:'project_1',name:'作品'};
const cases=[];
function test(name,fn){cases.push([name,fn])}

test('character required and optional fields',()=>{
  const value=Core.normalizeCharacter({id:'char_1',title:'ティア'},project);
  assert.equal(value.characterId,'char_1');assert.equal(value.characterName,'ティア');assert.equal(value.projectId,'project_1');assert.equal(value.personality,'');
});
test('one and multiple characters',()=>{
  for(const count of [1,3]){const transfer=Core.buildTransfer({project,characters:Array.from({length:count},(_,i)=>({id:`c${i}`,name:`C${i}`,projectId:project.id}))});assert.equal(transfer.characters.length,count)}
});
test('official and Vidu asset flags',()=>{const asset=Core.normalizeAsset({id:'a',projectId:'project_1',name:'正面',state:'正式採用',isViduReference:true,storageLocation:'SSD/a.png'});assert.equal(asset.isOfficial,true);assert.equal(asset.isViduReference,true);assert.equal(asset.availability,'reference-available')});
test('blob and data URLs are metadata only',()=>{for(const url of ['blob:https://local/id','data:image/png;base64,aaa']){const asset=Core.normalizeAsset({id:'a',projectId:'project_1',url});assert.equal(asset.storageReference,'');assert.equal(asset.requiresReselection,true)}});
test('episode can be absent',()=>{assert.equal(Core.buildTransfer({project}).episode.id,'')});
test('legacy LINK-03 payload upgrades',()=>{const transfer=Core.normalizeTransfer({projectId:'project_1',projectName:'作品',episodeId:'episode_1'});assert.equal(transfer.schemaVersion,'2.0');assert.equal(transfer.project.id,'project_1');assert.equal(transfer.options.legacyNormalized,true)});
test('invalid transfer reports error',()=>{assert.equal(Core.validateTransfer(Core.normalizeTransfer({})).valid,false)});
test('valid and invalid results are isolated',()=>{const merged=Core.mergeResultCandidates([],[{resultId:'r1',transferId:'t1',projectId:'p1',title:'画像',resultType:'image'},{title:'invalid'}]);assert.equal(merged.report.added,1);assert.equal(merged.report.rejected.length,1)});
test('duplicate result is not added',()=>{const item={resultId:'r1',transferId:'t1',projectId:'p1',title:'画像',resultType:'image'};const first=Core.mergeResultCandidates([], [item]);const second=Core.mergeResultCandidates(first.items,[item]);assert.equal(second.items.length,1);assert.equal(second.report.duplicates,1)});
test('changed duplicate becomes update candidate',()=>{const old={resultId:'r1',transferId:'t1',projectId:'p1',title:'旧',resultType:'image'};const next={...old,title:'新'};const merged=Core.mergeResultCandidates(Core.mergeResultCandidates([],[old]).items,[next]);assert.equal(merged.report.updates,1);assert.equal(merged.items[0].updateCandidate.title,'新')});

for(const [name,fn] of cases){fn();process.stdout.write(`ok - ${name}\n`)}
process.stdout.write(`${cases.length} tests passed\n`);
