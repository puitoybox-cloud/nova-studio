(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.NovaSecurity=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  // Nova Studio stores the complete state in localStorage and creates only
  // approximately 180 px JPEG previews. These limits leave metadata headroom
  // while remaining far above the normal depth and collection sizes in the
  // current schema.
  const IMPORT_LIMITS=Object.freeze({
    fileBytes:8*1024*1024,
    maxDepth:32,
    maxArrayItems:5000,
    maxTotalItems:20000,
    maxStringLength:1024*1024,
    maxPreviewBytes:6*1024*1024
  });
  const ID_PATTERN=/^[\p{L}\p{N}][\p{L}\p{N}._:-]{0,127}$/u;
  const PREVIEW_KEYS=new Set(['previewDataUrl','dataUrl','thumbnailUrl']);
  const RASTER_DATA_URL=/^data:image\/(?:png|jpeg|webp|gif);base64,([a-z0-9+/]*={0,2})$/i;
  const ID_ARRAY_KEYS=new Set(['relatedIds','relatedImageIds','imageIds']);

  function error(code,message,path='$'){const value=new Error(message);value.code=code;value.path=path;return value}
  function approximateDataUrlBytes(value){const payload=value.slice(value.indexOf(',')+1);return Math.floor(payload.length*3/4)-(payload.endsWith('==')?2:payload.endsWith('=')?1:0)}
  function isIdKey(key){return key==='id'||key.endsWith('Id')}

  function validateImportObject(value,limits=IMPORT_LIMITS){
    if(!value||typeof value!=='object'||Array.isArray(value))throw error('invalid-root','JSONの最上位はオブジェクトである必要があります。');
    const stack=[{value,path:'$',depth:0,key:''}];
    const seen=new Set();
    let totalItems=0,previewBytes=0;
    while(stack.length){
      const current=stack.pop(),item=current.value;
      if(current.depth>limits.maxDepth)throw error('max-depth','JSONの階層が上限を超えています。',current.path);
      if(typeof item==='string'){
        if(item.length>limits.maxStringLength)throw error('max-string','文字列が上限を超えています。',current.path);
        if(isIdKey(current.key)&&item&&!ID_PATTERN.test(item))throw error('invalid-id','IDに使用できない文字が含まれています。',current.path);
        if(PREVIEW_KEYS.has(current.key)&&item){
          const match=item.match(RASTER_DATA_URL);
          if(!match)throw error('invalid-preview','画像previewはPNG、JPEG、WebP、GIFのbase64 data URLだけ使用できます。',current.path);
          previewBytes+=approximateDataUrlBytes(item);
          if(previewBytes>limits.maxPreviewBytes)throw error('max-preview','画像previewの合計容量が上限を超えています。',current.path);
        }
        continue;
      }
      if(item===null||typeof item!=='object')continue;
      if(seen.has(item))throw error('cycle','循環参照は読み込めません。',current.path);
      seen.add(item);
      if(Array.isArray(item)){
        if(item.length>limits.maxArrayItems)throw error('max-collection','配列の件数が上限を超えています。',current.path);
        totalItems+=item.length;
        if(totalItems>limits.maxTotalItems)throw error('max-total-items','JSON内の総件数が上限を超えています。',current.path);
        for(let index=item.length-1;index>=0;index--){
          const child=item[index];
          if(ID_ARRAY_KEYS.has(current.key)&&typeof child==='string'&&child&&!ID_PATTERN.test(child))throw error('invalid-id','IDに使用できない文字が含まれています。',`${current.path}[${index}]`);
          stack.push({value:child,path:`${current.path}[${index}]`,depth:current.depth+1,key:current.key});
        }
      }else{
        for(const [key,child] of Object.entries(item))stack.push({value:child,path:`${current.path}.${key}`,depth:current.depth+1,key});
      }
    }
    return {ok:true,totalItems,previewBytes};
  }

  function validateImportFile(file,limits=IMPORT_LIMITS){
    if(!file||!Number.isFinite(file.size)||file.size<0)throw error('invalid-file','JSONファイルを確認できません。');
    if(file.size>limits.fileBytes)throw error('max-file','JSONファイルの容量が上限を超えています。');
    return true;
  }

  function safeNavigationUrl(value,base){
    try{
      const url=new URL(String(value||''),base);
      const loopback=url.hostname==='localhost'||url.hostname==='127.0.0.1'||url.hostname==='[::1]';
      if(url.protocol!=='https:'&&!(url.protocol==='http:'&&loopback))return '';
      if(url.username||url.password)return '';
      return url.toString();
    }catch{return ''}
  }

  return {IMPORT_LIMITS,ID_PATTERN,RASTER_DATA_URL,validateImportFile,validateImportObject,safeNavigationUrl};
});
