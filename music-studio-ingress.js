/* Guarded user-facing file boundary. Acceptance ceiling is not storage quota. */
(function(root){
'use strict';
const DEFAULT_JSON_MAX_BYTES=64*1024*1024;
function create(){let epoch=0,active=null;return{cancel(){epoch++;active?.abort();active=null},async readText(file,{maxBytes=DEFAULT_JSON_MAX_BYTES,signal,reason=()=>null}={}){
 const mine=++epoch;active?.abort();const controller=new AbortController();active=controller;let reader,listener;
 const check=()=>{const why=signal?.aborted||controller.signal.aborted?'Abort':mine!==epoch?'superseded':reason();if(why)throw Error(why)};
 const integer=n=>{if(!Number.isSafeInteger(n)||n<0)throw Error('unsafe-size')};integer(maxBytes);integer(file?.size);const declared=file.size;if(declared>maxBytes)throw Error('over-limit:file-bytes');check();
 const wait=promise=>new Promise((resolve,reject)=>{const stop=()=>reject(Error('Abort'));controller.signal.addEventListener('abort',stop,{once:true});if(controller.signal.aborted)stop();Promise.resolve(promise).then(resolve,reject).finally(()=>controller.signal.removeEventListener('abort',stop))});
 listener=()=>controller.abort();signal?.addEventListener?.('abort',listener,{once:true});let text='',observed=0;
 try{
  if(typeof file.stream==='function'&&typeof TextDecoder==='function'){
   reader=file.stream().getReader();const decoder=new TextDecoder('utf-8',{fatal:true});
   for(;;){check();const chunk=await wait(reader.read());check();if(chunk.done)break;if(!(chunk.value instanceof Uint8Array))throw Error('invalid-chunk');const n=chunk.value.byteLength;if(n>Number.MAX_SAFE_INTEGER-observed)throw Error('size-overflow');observed+=n;if(observed>maxBytes)throw Error('over-limit:file-bytes');if(observed>declared)throw Error('size-mismatch');text+=decoder.decode(chunk.value,{stream:true})}text+=decoder.decode();
  }else if(typeof file.text==='function'){
   text=await wait(file.text());check();if(typeof text!=='string')throw Error('invalid-file-text');
   // Legacy/custom File fallback; real browser Files take the incremental path.
   for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);observed+=c<128?1:c<2048?2:3;if(c>=0xd800&&c<=0xdbff&&text.charCodeAt(i+1)>=0xdc00&&text.charCodeAt(i+1)<=0xdfff){observed++;i++}if(observed>maxBytes)throw Error('over-limit:file-bytes');if(i%4096===0)check()}
  }else throw Error('unsupported-file-reader');
  check();if(observed!==declared)throw Error('size-mismatch');if(file.size!==declared)throw Error('stale');return{text,observedBytes:observed,declaredBytes:declared,guard:check};
 }catch(error){if(reader){try{Promise.resolve(reader.cancel()).catch(()=>{})}catch{}}throw error}
 finally{signal?.removeEventListener?.('abort',listener);try{reader?.releaseLock()}catch{}if(active===controller)active=null}
}}}
const api={create,DEFAULT_JSON_MAX_BYTES};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MusicStudioIngress=api;
})(typeof window!=='undefined'?window:globalThis);
