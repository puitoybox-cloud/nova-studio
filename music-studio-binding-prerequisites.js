/* Pre-binding gate only: injected immutable backend owns transaction and storage policy. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const resources=node?require('./music-studio-package-resources'):root.MusicStudioPackageResources;
const runtime=node?require('./music-studio-runtime-capabilities'):root.MusicStudioRuntimeCapabilities;
const adapter=node?require('./music-studio-generation-adapter'):root.MusicStudioGenerationAdapter;
const matrix=[
 ['binary store','BLOCKED BY BACKEND'],['generation store','BLOCKED BY BACKEND'],['commit marker store','BLOCKED BY BACKEND'],['atomic metadata publication','BLOCKED BY BACKEND'],['selected generation pointer','BLOCKED BY BACKEND'],['repository identity guard','IMPLEMENTED'],['rollback/recovery interface','IMPLEMENTED'],['explicit incomplete cleanup interface','IMPLEMENTED'],['quota error handling','IMPLEMENTABLE WITHOUT POLICY'],['migration guard','IMPLEMENTED'],['legacy metadata compatibility','IMPLEMENTED'],['A/B/C storage/schema choice','BLOCKED BY POLICY'],['retention/GC choice','BLOCKED BY POLICY'],['power loss/capacity/permissions','PHYSICAL ONLY']
].map(([id,status])=>({id,status}));
function migrationGuard({sourceVersion,targetVersion,destructive=false,legacyPreserved=false}){if(destructive)throw Error('destructive-migration-forbidden');if(!legacyPreserved)throw Error('legacy-preservation-required');if(sourceVersion!==5||targetVersion!==5)throw Error('schema-policy-required');return{ok:true,migration:false}}
function preflight({limits,environment,repository,backend,sourceVersion=5,targetVersion=5,legacyPreserved=false}){
 const failures=[];let configured;try{configured=resources.configure(limits)}catch(e){failures.push(e.message)}
 const capability=runtime.validate(environment,'package');failures.push(...capability.failures.map(x=>'missing-capability:'+x));
 try{migrationGuard({sourceVersion,targetVersion,legacyPreserved})}catch(e){failures.push(e.message)}
 if(!repository||backend?.metadataRepository!==repository)failures.push('repository-identity-mismatch');
 for(const name of ['prepare','stageMetadata','stageBinary','read','commit','list','abort','cleanupIncomplete'])if(typeof backend?.[name]!=='function')failures.push('backend-interface:'+name);
 // A declared backend capability is a prerequisite, not proof of actual atomicity.
 for(const key of ['immutableSlots','guardedCommit','atomicMetadataPublication','selectedPointer','quotaFailureAtomic'])if(backend?.capabilities?.[key]!==true)failures.push('backend-capability:'+key);
 return{ok:failures.length===0,failures,limits:configured,capability,matrix,productionBinding:'BLOCKED',physicalAcceptance:'PENDING'};
}
function create(options){const result=preflight(options);if(!result.ok)throw Error('binding-preflight:'+result.failures.join(','));const generation=adapter.create({backend:options.backend,metadataRepository:options.repository,validateMetadata:options.validateMetadata,limits:result.limits,repositoryId:options.repositoryId});return{...generation,prerequisites:result,binding:'INJECTED ONLY',async restoreGeneration(g,control={}){const why=control.reason?.();if(why)throw Error(why);try{return await generation.restoreGeneration(g,control)}catch(e){if(e?.name==='QuotaExceededError')throw Error('quota-unavailable');throw e}}}}
const api={matrix,migrationGuard,preflight,create};if(node)module.exports=api;else root.MusicStudioBindingPrerequisites=api;
})(typeof window!=='undefined'?window:globalThis);
