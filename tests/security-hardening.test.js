const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const security=require('../security.js');

function validBackup(){return {format:'nova-studio-backup',schemaVersion:'1.0',data:{projects:[{id:'project_日本語-1',title:'通常作品'}],storyArchiveCards:[{id:'archive_1',title:'カード',images:[{id:'image_1',name:'画像',previewDataUrl:'data:image/jpeg;base64,/9j/2Q=='}]}]}}}
function rejection(value,code,limits){assert.throws(()=>security.validateImportObject(value,limits),error=>error.code===code)}

test('normal backup remains JSON round-trip compatible and importable',()=>{
  const backup=validBackup(),roundTrip=JSON.parse(JSON.stringify(backup));
  assert.deepEqual(roundTrip,backup);
  assert.equal(security.validateImportObject(roundTrip).ok,true);
});

test('crafted card and image identifiers cannot reach executable inline syntax',()=>{
  const attacks=[`card' onclick='globalThis.pwned=1`,`image\" onmouseover=alert(1) x=\"`,'<script>alert(1)</script>','x);alert(1);//'];
  for(const attack of attacks){
    const card=validBackup();card.data.storyArchiveCards[0].id=attack;rejection(card,'invalid-id');
    const image=validBackup();image.data.storyArchiveCards[0].images[0].id=attack;rejection(image,'invalid-id');
  }
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  const hardened=app.slice(app.indexOf('/* Imported identifiers stay in inert data attributes.'));
  assert.match(hardened,/data-archive-action="open-image"/);
  assert.doesNotMatch(hardened,/archiveImageCard=function\([^]*?onclick=/);
  for(const file of ['story-archive-home-unified.js','story-archive-search-enhancement.js']){
    const source=fs.readFileSync(path.join(root,file),'utf8');
    assert.match(source,/data-archive-action="open-card"/);
    assert.doesNotMatch(source,/openStoryArchiveDetail\('\$\{card\.id\}'\)/);
  }
});

test('image previews accept raster data only and reject event or script payloads',()=>{
  for(const value of ['data:image/svg+xml,<svg onload=alert(1)>','javascript:alert(1)','<img src=x onerror=alert(1)>','data:text/html,<script>alert(1)</script>']){
    const backup=validBackup();backup.data.storyArchiveCards[0].images[0].previewDataUrl=value;rejection(backup,'invalid-preview');
  }
  for(const kind of ['png','jpeg','webp','gif']){const backup=validBackup();backup.data.storyArchiveCards[0].images[0].previewDataUrl=`data:image/${kind};base64,AA==`;assert.equal(security.validateImportObject(backup).ok,true)}
});

test('navigation permits HTTPS and explicit loopback HTTP only',()=>{
  assert.equal(security.safeNavigationUrl('https://example.com/path','https://nova.example/'),'https://example.com/path');
  assert.equal(security.safeNavigationUrl('http://localhost:8765/app','https://nova.example/'),'http://localhost:8765/app');
  assert.equal(security.safeNavigationUrl('http://127.0.0.1:8765/app','https://nova.example/'),'http://127.0.0.1:8765/app');
  for(const value of ['javascript:alert(1)','data:text/html,x','file:///tmp/x','vbscript:msgbox(1)','ftp://example.com/x','http://example.com/x'])assert.equal(security.safeNavigationUrl(value,'https://nova.example/'),'');
});

test('file size, depth, collections, strings, and preview totals are bounded',()=>{
  assert.throws(()=>security.validateImportFile({size:security.IMPORT_LIMITS.fileBytes+1}),error=>error.code==='max-file');
  assert.equal(security.validateImportFile({size:security.IMPORT_LIMITS.fileBytes}),true);
  let nested={};const rootValue=nested;for(let i=0;i<34;i++){nested.next={};nested=nested.next}rejection(rootValue,'max-depth');
  rejection({projects:Array.from({length:6},()=>({id:'safe'}))},'max-collection',{...security.IMPORT_LIMITS,maxArrayItems:5});
  rejection({projects:Array.from({length:4},()=>({id:'safe'})),episodes:Array.from({length:4},()=>({id:'safe'}))},'max-total-items',{...security.IMPORT_LIMITS,maxArrayItems:10,maxTotalItems:7});
  rejection({projects:[{id:'safe',title:'123456'}]},'max-string',{...security.IMPORT_LIMITS,maxStringLength:5});
  const previews=validBackup();previews.data.storyArchiveCards[0].images.push({id:'image_2',previewDataUrl:'data:image/png;base64,AAAA'});rejection(previews,'max-preview',{...security.IMPORT_LIMITS,maxPreviewBytes:4});
});

test('validation failure occurs before import mutation path',()=>{
  const source=fs.readFileSync(path.join(root,'import-export.js'),'utf8');
  const finalImport=source.slice(source.lastIndexOf('function importFile(file)'));
  assert.ok(finalImport.indexOf('validateImportFile(file)')<finalImport.indexOf('new FileReader()'));
  assert.ok(finalImport.indexOf('validateImportObject(obj)')<finalImport.indexOf('mergeImportedData(data'));
  const state={sentinel:'unchanged'},before=JSON.stringify(state),bad=validBackup();bad.data.storyArchiveCards[0].id=`bad'id`;
  assert.throws(()=>security.validateImportObject(bad));
  assert.equal(JSON.stringify(state),before);
});
