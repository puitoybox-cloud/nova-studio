/* Presence checks are software preflight, never permission/capacity/device acceptance. */
(function(root){
'use strict';
const definitions=[
 ['indexedDB','REQUIRED','durable browser metadata','music-studio.js: indexedDbRepository',e=>typeof e.indexedDB?.open==='function','session-memory'],
 ['webCrypto','REQUIRED','generation/package digest','music-studio-portable-package.js: digest',e=>typeof e.crypto?.subtle?.digest==='function',null],
 ['TextEncoder','REQUIRED','generation marker','music-studio-generation-adapter.js',e=>typeof e.TextEncoder==='function',null],
 ['Blob','REQUIRED','file export/audio pipeline','music-studio.js: downloadJson',e=>typeof e.Blob==='function',null],
 ['File','OPTIONAL','input files use text/arrayBuffer duck interface','music-studio.js: importFile',e=>typeof e.File==='function',null],
 ['objectURL','REQUIRED','download file','music-studio.js: performMidiExport',e=>typeof e.URL?.createObjectURL==='function'&&typeof e.URL?.revokeObjectURL==='function',null],
 ['TextDecoder','OPTIONAL','MIDI labels','music-studio-midi-parser.js: decodeText',e=>typeof e.TextDecoder==='function','URI/ASCII'],
 ['AudioContext','REQUIRED','playback only','music-studio-audio.js: create',e=>typeof e.AudioContext==='function'||typeof e.webkitAudioContext==='function','webkitAudioContext'],
 ['MIDI','OPTIONAL','external recording','music-studio-midi-input.js: requestAccess',e=>typeof e.navigator?.requestMIDIAccess==='function',null],
 ['storageEstimate','OPTIONAL','advisory only; no production use','capacity observation boundary',e=>typeof e.navigator?.storage?.estimate==='function',null],
 ['fileHandles','OPTIONAL','injected external resolver only','music-studio-binary-boundary.js: queryPermission',e=>typeof e.showOpenFilePicker==='function', 'byte binding/reselection'],
 ['AbortController','OPTIONAL','live provider transport excluded from offline','music-studio-editor.js: executePartialEditProviderRequest',e=>typeof e.AbortController==='function','reason callback'],
 ['FileReader','OPTIONAL','not required by current offline paths','file.text()/arrayBuffer()',e=>typeof e.FileReader==='function',null],
 ['structuredClone','OPTIONAL','not required by current product clone','JSON copy',e=>typeof e.structuredClone==='function','JSON copy'],
 ['Worker','OPTIONAL','no current offline product Worker dependency','source inventory',e=>typeof e.Worker==='function',null]
];
const profiles={package:['webCrypto','TextEncoder'],durableBrowser:['indexedDB','webCrypto','TextEncoder'],fileExport:['Blob','objectURL'],playback:['AudioContext'],session:[]};
function validate(environment={},profile='durableBrowser'){
 if(!profiles[profile])throw Error('unsupported-profile');const required=new Set(profiles[profile]);
 const matrix=definitions.map(([id,requirement,purpose,source,probe,fallback])=>{let available=false;try{available=probe(environment)}catch{}return{id,requirement:required.has(id)?'REQUIRED':'OPTIONAL',featureRequirement:requirement,purpose,source,available,fallback,status:available?'SUPPORTED':fallback?'FALLBACK AVAILABLE':'UNSUPPORTED',acceptance:'PHYSICAL TEST REQUIRED'}});
 const failures=matrix.filter(x=>required.has(x.id)&&!x.available).map(x=>x.id);
 return{profile,ok:failures.length===0,failures,matrix,deviceCapacity:'UNKNOWN',capacityGuaranteed:false,permission:'UNKNOWN',physicalAcceptance:'PENDING'};
}
async function estimate(environment){try{const value=await environment?.navigator?.storage?.estimate?.();return{status:value?'OBSERVED_ESTIMATE':'UNAVAILABLE',usage:Number.isFinite(value?.usage)?value.usage:null,quota:Number.isFinite(value?.quota)?value.quota:null,capacityGuaranteed:false}}catch{return{status:'UNAVAILABLE',usage:null,quota:null,capacityGuaranteed:false}}}
function permission(value){return['granted','denied','prompt'].includes(value)?value:'UNAVAILABLE'}
const api={validate,estimate,permission,profiles};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MusicStudioRuntimeCapabilities=api;
})(typeof window!=='undefined'?window:globalThis);
