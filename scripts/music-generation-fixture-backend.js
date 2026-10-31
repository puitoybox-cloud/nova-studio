'use strict';
// Owned, disposable filesystem only. Never binds production storage.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
function create(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'nova-generation-fixture-'));let sequence=0;
 const slot=id=>path.join(root,Buffer.from(id).toString('hex'));
 const sync=p=>{const fd=fs.openSync(p,'r');try{fs.fsyncSync(fd)}finally{fs.closeSync(fd)}};
 const write=(p,v)=>{const fd=fs.openSync(p,'wx');try{fs.writeFileSync(fd,JSON.stringify(v));fs.fsyncSync(fd)}finally{fs.closeSync(fd)}};
 const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
 function connect(fault=()=>{}){return{
 async prepare(id){const dir=slot(id);fs.mkdirSync(dir);write(path.join(dir,'identity'),{id,sequence:++sequence});sync(root)},
 async stageMetadata(id,text){write(path.join(slot(id),'metadata'),text);await fault('metadata',slot(id))},
 async stageBinary(id,key,bytes){write(path.join(slot(id),'binary-'+Buffer.from(key).toString('hex')),{key,bytes:Array.from(bytes)});await fault('binary',slot(id))},
 async read(id){const dir=slot(id);await fault('read',dir);return{...json(path.join(dir,'identity')),packageText:json(path.join(dir,'metadata')),binaries:fs.readdirSync(dir).filter(n=>n.startsWith('binary-')).map(n=>json(path.join(dir,n))),marker:fs.existsSync(path.join(dir,'COMMIT'))?json(path.join(dir,'COMMIT')):null}},
 async commit(id,marker,control){const dir=slot(id);await fault('before-commit',dir);if(control.reason())throw Error(control.reason());write(path.join(dir,'COMMIT'),marker);sync(dir);sync(root);await fault('after-commit',dir)},
 async list(){return fs.readdirSync(root).map(n=>json(path.join(root,n,'identity')))},
 async abort(id){const dir=slot(id);if(!fs.existsSync(path.join(dir,'COMMIT')))write(path.join(dir,'ABORT'),true)},
 async cleanupIncomplete(id){const dir=slot(id);if(fs.existsSync(path.join(dir,'COMMIT')))throw Error('committed-cleanup-forbidden');fs.rmSync(dir,{recursive:true});sync(root)}
 }}
 return{root,slot,connect,dispose:()=>fs.rmSync(root,{recursive:true})};
}
module.exports={create};
