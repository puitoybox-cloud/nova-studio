/* Read-only metadata inspection. No IO, resolution, repair or persistence. */
(function(root){
  'use strict';
  const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const string=value=>typeof value==='string'&&value.trim().length>0;
  function inspect(project){
    const issues=[],assets=[],identities=new Map();
    const issue=(code,path)=>issues.push({code,path});
    if(!object(project))return{valid:false,issues:[{code:'malformed-project',path:'$'}],assets:[],physicalVerification:'pending'};
    if(project.format!==undefined&&project.format!=='music-studio-project')issue('unknown-format','format');
    if(project.schemaVersion!==undefined&&project.schemaVersion!=='1.0')issue('unknown-version','schemaVersion');
    if(project.version!==undefined&&project.version!==1)issue('unknown-version','version');
    for(const collection of ['audioAssets','midiAssets','fileReferences']){
      const items=project[collection];if(items===undefined)continue;
      if(!Array.isArray(items)){issue('malformed-collection',collection);continue;}
      items.forEach((asset,index)=>{
        const path=`${collection}[${index}]`;
        if(!object(asset)){issue('malformed-asset',path);return;}
        const key=collection==='fileReferences'?'id':'assetId',id=asset[key];
        if(!string(id))issue('missing-identity',`${path}.${key}`);
        else {const scope=collection==='fileReferences'?'file':'asset',token=`${scope}:${id}`;if(identities.has(token)){issue('duplicate-identity',path);issue('duplicate-identity',identities.get(token));}else identities.set(token,path);}
        const storage=asset.storage,reference=object(storage)?storage.reference:undefined;
        if(storage!==undefined&&!object(storage))issue('malformed-storage',`${path}.storage`);
        if(object(storage)&&storage.kind!==undefined&&!['external-file','external'].includes(storage.kind))issue('unknown-storage-kind',`${path}.storage.kind`);
        if(asset.version!==undefined||asset.schemaVersion!==undefined)issue('unassessed-asset-version',path);
        const temporary=typeof reference==='string'&&/^(?:blob:|data:)/i.test(reference);
        const remote=typeof reference==='string'&&/^https?:/i.test(reference);
        if(temporary)issue('temporary-reference',`${path}.storage.reference`);
        if(remote)issue('remote-reference-unassessed',`${path}.storage.reference`);
        if(reference!==undefined&&!string(reference))issue('malformed-reference',`${path}.storage.reference`);
        const missing=asset.missing===true;
        if(missing)issue('declared-missing',path);
        if(!string(reference))issue('no-resolvable-reference',path);
        if(storage?.requiresReselection===true)issue('requires-reselection',path);
        assets.push({path,identity:string(id)?id:null,kind:collection,referenceState:missing?'declared-missing':temporary?'temporary':string(reference)?'unverified':'absent',requiresReselection:storage?.requiresReselection===true,binaryIncluded:false,binaryDependency:'unassessed'});
      });
    }
    for(const collection of ['audioAssets','midiAssets'])if(Array.isArray(project[collection]))project[collection].forEach((asset,index)=>{
      if(!object(asset)||asset.derivedFromAssetId==null)return;
      const target=asset.derivedFromAssetId,path=`${collection}[${index}].derivedFromAssetId`;
      if(!string(target))issue('malformed-dependency',path);
      else {const matches=assets.filter(item=>item.kind!=='fileReferences'&&item.identity===target);if(matches.length===0)issue('missing-dependency',path);else if(matches.length>1)issue('ambiguous-dependency',path);}
    });
    return{valid:issues.length===0,issues,assets,resolution:'not-performed',compatibility:'unassessed',binaryBackup:'not-included-by-current-contract',physicalVerification:'pending'};
  }
  function session(project){
    // Caller passes a JSON project snapshot. Session owns no project or storage handle.
    const snapshot=JSON.stringify(project);let active=true;
    return{inspect(current){if(!active)return{valid:false,cancelled:true};if(JSON.stringify(current)!==snapshot)return{valid:false,issues:[{code:'stale-project',path:'$'}]};return inspect(current);},cancel(){active=false;return{cancelled:true};}};
  }
  const api={inspect,session};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MusicStudioDependencyInspection=api;
})(typeof window!=='undefined'?window:globalThis);
