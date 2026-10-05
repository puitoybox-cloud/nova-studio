/* Explicit repository/generation identity; injected backend only, no storage selection. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const gate=node?require('./music-studio-binding-prerequisites'):root.MusicStudioBindingPrerequisites;
const codec=node?require('./music-studio-portable-package'):root.MusicStudioPortablePackage;
function identity(value,repositoryId,generationId){if(value?.version!==1||value.repositoryId!==repositoryId||value.generationId!==generationId)throw Error('repository-generation-identity-mismatch')}
function create(options){
 const {backend,repositoryId,repository}=options;
 if(typeof repositoryId!=='string'||!repositoryId.trim()||backend?.repositoryId!==repositoryId)throw Error('repository-identity-mismatch');
 if(typeof backend.readSelectedPointer!=='function')throw Error('selected-pointer-interface-required');
 const adapter=gate.create({...options,repositoryId});let epoch=0,active=null;
 const checkRepository=()=>{if(backend.metadataRepository!==repository||backend.repositoryId!==repositoryId)throw Error('stale-repository')};
 async function selected(generationId,control={}){
  checkRepository();const pointer=await backend.readSelectedPointer({limits:options.limits});checkRepository();if(control.reason?.())throw Error(control.reason());
  identity(pointer,repositoryId,generationId);const record=await backend.read(generationId,{limits:options.limits});
  if(pointer.digest!==record?.marker?.digest)throw Error('selected-pointer-marker-mismatch');
  const generation=await adapter.reloadGeneration(generationId);identity(generation.identity,repositoryId,generationId);checkRepository();if(control.reason?.())throw Error(control.reason());return generation;
 }
 return{binding:'INJECTED ONLY',productionBinding:'BLOCKED BY BACKEND',async importPackage(file,control={}){
  const mine=++epoch;active?.abort();const controller=new AbortController();active=controller;const stop=()=>controller.abort();control.signal?.addEventListener?.('abort',stop,{once:true});
  const reason=()=>mine!==epoch?'superseded':control.signal?.aborted||controller.signal.aborted?'Abort':control.reason?.()||null;checkRepository();
  try{
  const parsed=await codec.readFile(file,{limits:options.limits,validateMetadata:options.validateMetadata,reason,signal:controller.signal});
  identity(parsed.generation.identity,repositoryId,parsed.generation.id);checkRepository();if(reason())throw Error(reason());
  const result=await adapter.restoreGeneration(parsed.generation,{reason:()=>{checkRepository();return reason()}});
  const generation=await selected(result.id,{reason});
  return{...result,generation,identity:generation.identity,selectedAcknowledged:true};
  }finally{control.signal?.removeEventListener?.('abort',stop);if(active===controller)active=null}
 },reloadSelected:selected,cancel(){epoch++;active?.abort()}};
}
const api={create,identity};if(node)module.exports=api;else root.MusicStudioPublicationPrebinding=api;
})(typeof window!=='undefined'?window:globalThis);
