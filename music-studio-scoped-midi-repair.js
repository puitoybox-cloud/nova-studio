/* Scoped, conservative repair of converted MIDI. No audio/AI calls; no mutation until caller applies. */
(function(root){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const signature=value=>JSON.stringify(value);
  function preview(project,input={}){
    const data=project?.midiData,tracks=data?.tracks,ppq=data?.ppq,signatureData=data?.timeSignature;
    if(!Array.isArray(tracks)||!Number.isInteger(ppq)||ppq<1)return{ok:false,reason:'invalid-project'};
    const numerator=signatureData?.numerator,denominator=signatureData?.denominator;
    if(!Number.isInteger(numerator)||!Number.isInteger(denominator)||denominator<1)return{ok:false,reason:'invalid-signature'};
    const bar=ppq*4*numerator/denominator;
    if(!Number.isInteger(bar)||bar<1)return{ok:false,reason:'unsupported-signature'};
    const track=tracks.find(t=>t.id===input.trackId);
    if(!track||!Array.isArray(track.notes))return{ok:false,reason:'missing-track'};
    const from=input.measureFrom,to=input.measureTo;
    if(!Number.isInteger(from)||!Number.isInteger(to)||from<1||to<from)return{ok:false,reason:'invalid-range'};
    const begin=(from-1)*bar,end=to*bar;
    const resolution=input.resolution??'1/16',denom=Number(String(resolution).split('/')[1]);
    if(![4,8,16,32].includes(denom))return{ok:false,reason:'invalid-resolution'};
    const step=Math.round(ppq*4/denom);
    const tolerance=input.toleranceTicks??Math.max(1,Math.floor(step/4));
    if(!Number.isInteger(tolerance)||tolerance<0||tolerance>step/2)return{ok:false,reason:'invalid-tolerance'};
    const before=clone(track.notes),after=clone(before),changes=[],suggestions=[];
    const eligible=n=>!n.locked&&Number.isInteger(n.startTick)&&Number.isInteger(n.durationTicks)&&n.durationTicks>0&&Number.isInteger(n.pitch)&&n.startTick>=begin&&n.startTick<end&&n.startTick+n.durationTicks<=end;
    for(const note of after){
      if(!eligible(note))continue;
      const snapped=Math.round(note.startTick/step)*step;
      if(snapped>=begin&&snapped<end&&Math.abs(snapped-note.startTick)<=tolerance&&snapped!==note.startTick){
        changes.push({type:'timing',noteId:note.id,before:note.startTick,after:snapped});
        note.startTick=snapped;
      }
    }
    // Exact duplicates only; never remove a locked note or infer that a short note is unwanted.
    const originalById=new Map(before.map(note=>[note.id,note]));
    const seen=new Set();
    for(let i=0;i<after.length;i++){
      const note=after[i];
      if(!eligible(note))continue;
      const original=originalById.get(note.id);
      const key=signature([original.pitch,original.startTick,original.durationTicks,original.velocity,original.inputChannel??null]);
      if(seen.has(key)){
        changes.push({type:'duplicate',noteId:note.id});
        after.splice(i--,1);
      }else seen.add(key);
    }
    // Flag uncertain very short notes for manual review, never silently delete them.
    for(const note of after){
      if(eligible(note)&&note.durationTicks<step/4)suggestions.push({type:'short-note',noteId:note.id});
    }
    // Trim only small overlaps of the same pitch and channel, entirely inside the requested measures.
    const sorted=[...after].sort((a,b)=>a.startTick-b.startTick);
    for(let i=0;i<sorted.length;i++){
      const note=sorted[i];if(!eligible(note)||note.startTick+note.durationTicks>end)continue;
      const next=sorted.slice(i+1).find(n=>n.pitch===note.pitch&&(n.inputChannel??null)===(note.inputChannel??null));
      if(!next||next.startTick<begin||next.startTick>=end)continue;
      const overlap=note.startTick+note.durationTicks-next.startTick;
      if(overlap>0&&overlap<=Math.min(step/2,Math.floor(note.durationTicks/4))&&next.startTick>note.startTick){
        changes.push({type:'duration',noteId:note.id,before:note.durationTicks,after:next.startTick-note.startTick});
        note.durationTicks=next.startTick-note.startTick;
      }
    }
    return{ok:true,trackId:track.id,measureFrom:from,measureTo:to,sourceSignature:signature(before),afterNotes:after,changes,suggestions};
  }
  function apply(project,result){
    if(!result?.ok)return{ok:false,reason:'missing-preview'};
    const track=project?.midiData?.tracks?.find(t=>t.id===result.trackId);
    if(!track||signature(track.notes)!==result.sourceSignature)return{ok:false,reason:'stale-preview'};
    // The caller owns persistence and undo; return a new project, not an in-place mutation.
    const updated=clone(project),target=updated.midiData.tracks.find(t=>t.id===result.trackId);
    target.notes=clone(result.afterNotes);
    return{ok:true,project:updated,changes:clone(result.changes)};
  }
  root.MusicStudioScopedMidiRepair={preview,apply};
})(typeof window!=='undefined'?window:globalThis);
