/* LINK-04 / LINK-05 / LINK-06 shared data creation and validation. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.DreamArchitectTransferCore=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const SCHEMA_VERSION='2.0';
  const SOURCE_APP='nova-studio';
  const DESTINATION_APP='dream-architect-studio';
  const RESULT_TYPES=new Set(['image','video','audio','midi','document','prompt','other']);
  const text=value=>value==null?'':String(value);
  const list=value=>Array.isArray(value)?value:[];
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const date=value=>text(value)||new Date().toISOString();
  const id=(prefix='transfer')=>`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
  const isEphemeralReference=value=>/^(blob:|filesystem:)/i.test(text(value));

  function normalizeCharacter(value={},project={}){
    const item=object(value);
    return {
      characterId:text(item.characterId||item.id),
      characterName:text(item.characterName||item.name||item.title),
      projectId:text(item.projectId||project.id),
      projectName:text(item.projectName||project.name||project.title),
      role:text(item.role),
      description:text(item.description||item.profile||item.summary||item.memo),
      personality:text(item.personality),
      speechStyle:text(item.speechStyle||item.voice||item.talkingStyle),
      appearance:text(item.appearance),
      officialImages:list(item.officialImages).map(normalizeAsset).filter(item=>item.assetId),
      viduReferenceImages:list(item.viduReferenceImages).map(normalizeAsset).filter(item=>item.assetId),
      updatedAt:text(item.updatedAt)
    };
  }

  function normalizeAsset(value={},fallback={}){
    const item=object(value),meta=object(fallback.management);
    const rawReference=text(item.storageReference||item.storageLocation||item.fileName||item.path||item.url||item.src||item.previewDataUrl||item.dataUrl);
    const ephemeral=isEphemeralReference(rawReference);
    const embedded=/^data:/i.test(rawReference);
    const persistent=Boolean(rawReference&&!ephemeral&&!embedded);
    return {
      assetId:text(item.assetId||item.id||item.imageId||fallback.id),
      projectId:text(item.projectId||fallback.projectId),
      assetName:text(item.assetName||item.name||item.title||item.fileName||fallback.name),
      assetType:text(item.assetType||item.materialType||item.type||fallback.type||'image'),
      usage:text(item.usage||item.referenceRole||item.description||fallback.usage),
      isOfficial:Boolean(item.isOfficial||item.state==='正式採用'||meta.official),
      isViduReference:Boolean(item.isViduReference||item.viduReference||meta.viduReference),
      angle:text(item.angle),
      setName:text(item.setName||fallback.setName||meta.setName),
      storageReference:persistent?rawReference:'',
      updatedAt:text(item.updatedAt||fallback.updatedAt),
      availability:persistent?'reference-available':'metadata-only',
      requiresReselection:!persistent,
      unavailableReason:ephemeral?'一時的なblob URLのため画像本体は共有できません。':embedded?'埋め込み画像は連携データへ複製しません。':'永続参照がないためNova Studio側で再選択が必要です。'
    };
  }

  function validateTransfer(input){
    const value=object(input),errors=[],warnings=[];
    if(!text(value.transferId))errors.push('transferIdがありません。');
    const project=object(value.project);
    if(!text(project.id))errors.push('作品IDがありません。');
    list(value.characters).forEach((item,index)=>{
      if(!text(item?.characterId)||!text(item?.characterName)||!text(item?.projectId))warnings.push(`キャラクター${index+1}は必須項目不足のため除外されます。`);
    });
    list(value.assets).forEach((item,index)=>{
      if(!text(item?.assetId)||!text(item?.projectId))warnings.push(`素材${index+1}は必須識別情報不足のため除外されます。`);
    });
    return {valid:errors.length===0,errors,warnings};
  }

  function normalizeTransfer(input,options={}){
    const value=object(input),legacy=!value.schemaVersion||(!value.project&&('projectId'in value||'projectName'in value));
    const project=object(value.project);
    const normalizedProject={id:text(project.id||value.projectId),name:text(project.name||project.title||value.projectName)};
    const episodeValue=object(value.episode);
    const episode={id:text(episodeValue.id||value.episodeId),name:text(episodeValue.name||episodeValue.title||episodeValue.numberLabel||value.episodeName)};
    const characters=list(value.characters).map(item=>normalizeCharacter(item,normalizedProject)).filter(item=>item.characterId&&item.characterName&&item.projectId);
    const assets=list(value.assets).map(item=>normalizeAsset(item,{projectId:normalizedProject.id})).filter(item=>item.assetId&&item.projectId);
    const createdAt=date(value.createdAt);
    const result={
      schemaVersion:text(value.schemaVersion)||'1.0',
      transferId:text(value.transferId)||id('transfer'),
      createdAt,
      updatedAt:date(value.updatedAt||createdAt),
      sourceApp:text(value.sourceApp)||SOURCE_APP,
      destinationApp:text(value.destinationApp)||DESTINATION_APP,
      project:normalizedProject,
      episode,
      characters,
      assets,
      options:{...object(value.options),legacyNormalized:legacy}
    };
    if(options.upgrade!==false)result.schemaVersion=SCHEMA_VERSION;
    return result;
  }

  function buildTransfer({project,episode,characters,assets,options,transferId,createdAt}={}){
    const stamp=date(createdAt);
    return normalizeTransfer({schemaVersion:SCHEMA_VERSION,transferId:transferId||id('transfer'),createdAt:stamp,updatedAt:stamp,sourceApp:SOURCE_APP,destinationApp:DESTINATION_APP,project,episode,characters,assets,options});
  }

  function normalizeResult(input){
    const item=object(input),errors=[];
    const resultType=RESULT_TYPES.has(text(item.resultType))?text(item.resultType):'other';
    const result={
      resultId:text(item.resultId||item.id),transferId:text(item.transferId),projectId:text(item.projectId),
      sourceApp:text(item.sourceApp)||DESTINATION_APP,resultType,title:text(item.title),description:text(item.description),
      createdAt:text(item.createdAt),updatedAt:text(item.updatedAt||item.createdAt),status:text(item.status)||'pending',
      assetMetadata:object(item.assetMetadata),notes:text(item.notes)
    };
    if(!result.resultId)errors.push('resultIdがありません。');
    if(!result.transferId)errors.push('transferIdがありません。');
    if(!result.projectId)errors.push('projectIdがありません。');
    if(!result.title)errors.push('titleがありません。');
    return {result,valid:errors.length===0,errors};
  }

  function mergeResultCandidates(existing,incoming){
    const current=list(existing).map(item=>object(item));
    const output=[...current],report={added:0,duplicates:0,updates:0,rejected:[]};
    list(incoming).forEach(raw=>{
      const checked=normalizeResult(raw);
      if(!checked.valid){report.rejected.push({item:raw,errors:checked.errors});return;}
      const index=output.findIndex(item=>item.resultId===checked.result.resultId);
      if(index<0){output.push({...checked.result,decision:'pending'});report.added++;return;}
      const same=JSON.stringify(normalizeResult(output[index]).result)===JSON.stringify(checked.result);
      if(same){report.duplicates++;return;}
      output[index]={...output[index],updateCandidate:checked.result,decision:output[index].decision||'pending'};
      report.updates++;
    });
    return {items:output,report};
  }

  return {SCHEMA_VERSION,SOURCE_APP,DESTINATION_APP,RESULT_TYPES:[...RESULT_TYPES],isEphemeralReference,normalizeCharacter,normalizeAsset,validateTransfer,normalizeTransfer,buildTransfer,normalizeResult,mergeResultCandidates};
});
