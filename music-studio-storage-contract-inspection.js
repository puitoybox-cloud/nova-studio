/* Review-only contract report: no binary IO, persistence or future schema inference. */
'use strict';
const dependency=require('./music-studio-dependency-inspection');
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function inspect(project){
 const inventory=dependency.inspect(project);
 const dependencies=inventory.assets.map(asset=>({
  ...asset, contentIdentity:'unverified', ownership:'unassessed',
  portability:asset.referenceState==='temporary'?'non-portable':'unassessed',
  backupCoverage:'metadata-only', restoreRequirement:asset.requiresReselection?'reselection':'binary-presence-unverified'
 }));
 return {inventory,dependencies,completeBackup:'not-established',standalonePortability:'not-established',
  takeContract:'undecided',audioVersionContract:'undecided',checkpointContract:'undecided',
  projectBinding:object(project)?{projectId:typeof project.projectId==='string'?project.projectId:null,revision:Number.isInteger(project.revision)?project.revision:null}:null,
  resolution:'not-performed',physicalVerification:'pending'};
}
function inspectBackup(backup){
 const issues=[];
 if(!object(backup))return {valid:false,issues:[{code:'malformed-backup'}],completeBackup:'not-established',projects:[]};
 if(backup.format!=='music-studio-backup')issues.push({code:'unknown-format'});
 if(backup.version===undefined)issues.push({code:'unknown-version'});
 else if(backup.version!==1)issues.push({code:'unsupported-version'});
 if(!Array.isArray(backup.projects))issues.push({code:'malformed-projects'});
 const projects=Array.isArray(backup.projects)?backup.projects.map(inspect):[];
 if(backup.metadata?.binariesIncluded!==false)issues.push({code:'binary-coverage-unverified'});
 // A metadata declaration cannot prove presence, checksum, ownership or restore.
 return {valid:issues.length===0,issues,projects,completeBackup:'not-established',binaryCoverage:'not-verified',restoreDependencies:projects.flatMap((p,index)=>p.dependencies.map(d=>({projectIndex:index,path:d.path,identity:d.identity,requirement:d.restoreRequirement}))),resolution:'not-performed'};
}
function session(project){
 const guard=dependency.session(project);
 return {inspect(current){const r=guard.inspect(current);return r.cancelled||r.issues?.some(i=>i.code==='stale-project')?r:inspect(current);},cancel:guard.cancel};
}
module.exports={inspect,inspectBackup,session};
