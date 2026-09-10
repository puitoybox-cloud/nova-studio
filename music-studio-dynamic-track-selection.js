/* Dynamic Track Selection UI: Track-ID based selection without expanding unrelated editing scope. */
(function(root){
  'use strict';

  const CORE_ORDER=['melody','drums','bass'];
  const MIDI_TYPES=new Set(['midi-melodic','midi-drums']);
  const BLOCKED_EXTERNAL_ACTIONS=[
    'editorAddNote','editorStartNoteResize','editorMoveSelected','editorResizeSelected',
    'editorCopy','editorPaste','editorDuplicate','editorSelectAllNotes','editorLockSelectedNotes','editorUnlockSelectedNotes','editorMatchDuration','editorMatchVelocity',
    'editorApplyQuantize','editorPianoInput','editorDrumInput','editorGenerateCandidate','editorApplyCandidate',
    'editorStartPartialEdit','editorPreviewPartialEditPitchUp','editorRunPartialEditProvider','editorApplyPartialEdit',
    'editorPreviewCorrection','editorApplyCorrection','editorPreviewTranspose','editorApplyTranspose','editorPreviewNoteLength','editorApplyNoteLength',
    'editorToggleMelodyPlayback','editorPlayMelody'
  ];

  function validTrackId(value){return typeof value==='string'&&value.trim()!==''}
  function coreSlot(track,core){return core?.resolveCoreTrackSlot?.(track)||core?.resolveCoreTrackRole?.(track)||null}
  function displayName(track,core){return core?.resolveTrackDisplayName?.(track)||String(track?.name||track?.id||'Track')}
  function trackType(track,core){return core?.resolveTrackType?.(track)||'unknown'}
  function capabilities(track,core){return core?.resolveTrackCapabilities?.(track)||{canEditNotes:false,canRecordMidi:false,canPlayMidi:false,supportsPitchCorrection:false,supportsDrumLabels:false,supportsPartialEdit:false}}

  function createSelectionModel(session,core=root.MusicStudioEditor){
    const tracks=Array.isArray(session?.midiData?.tracks)?session.midiData.tracks:[];
    const current=core?.currentTrack?.(session)||null;
    const selectedId=validTrackId(current?.id)?current.id:'';
    const indexed=tracks.map((track,index)=>({track,index,slot:coreSlot(track,core)}));
    const used=new Set(),ordered=[];
    for(const slot of CORE_ORDER){const match=indexed.find(item=>item.slot===slot&&validTrackId(item.track?.id)&&!used.has(item.track.id));if(match){used.add(match.track.id);ordered.push({...match,kind:'core'})}}
    const external=indexed.filter(item=>{if(!validTrackId(item.track?.id)||used.has(item.track.id)||item.slot)return false;return MIDI_TYPES.has(trackType(item.track,core))}).sort((a,b)=>{const ao=Number(a.track?.order),bo=Number(b.track?.order),av=Number.isFinite(ao)?ao:Number.POSITIVE_INFINITY,bv=Number.isFinite(bo)?bo:Number.POSITIVE_INFINITY;return av-bv||a.index-b.index});
    for(const item of external){used.add(item.track.id);ordered.push({...item,kind:'external'})}
    return ordered.map(item=>{const track=item.track,caps=capabilities(track,core),slot=item.slot||null;return Object.freeze({id:track.id,name:displayName(track,core),kind:item.kind,coreSlot:slot,trackType:trackType(track,core),role:core?.resolveTrackRole?.(track)||'unassigned',capabilities:Object.freeze({...caps}),selected:track.id===selectedId,sourceIndex:item.index})})
  }

  function resolveCurrentSelection(session,core=root.MusicStudioEditor){const model=createSelectionModel(session,core),current=core?.currentTrack?.(session)||null;return model.find(item=>item.id===current?.id)||model[0]||null}
  function isExternalSelection(api=root.MusicStudio,core=root.MusicStudioEditor){return resolveCurrentSelection(api?.state?.midiEditor,core)?.kind==='external'}
  function externalDeleteShortcut(event){
    if(!event||event.isComposing||event.repeat)return false;
    const target=event.target?.nodeType===3?event.target.parentElement:event.target;
    if(target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))return false;
    const key=String(event.key||''),lower=key.toLowerCase(),meta=Boolean(event.metaKey||event.ctrlKey),option=Boolean(event.altKey),shift=Boolean(event.shiftKey);
    return (!meta&&!option&&!shift&&(key==='Delete'||key==='Backspace'))||(meta&&!option&&lower==='z')
  }

  function renderEditor(api,doc=root.document){const session=api?.state?.midiEditor,page=doc?.querySelector?.('.music-midi-editor-page');if(!session||!page)return false;if(typeof api.editorClearSelection==='function'){api.editorClearSelection();const next=doc.querySelector('.music-midi-editor-page');if(next)enhanceEditor(next,api,root.MusicStudioEditor,doc);return Boolean(next)}if(typeof api.midiEditorView!=='function')return false;const scrollTop=page.scrollTop||0,scrollLeft=page.scrollLeft||0,markup=api.midiEditorView(session.projectId);page.outerHTML=markup;const next=doc.querySelector('.music-midi-editor-page');if(next){next.scrollTop=scrollTop;next.scrollLeft=scrollLeft;enhanceEditor(next,api,root.MusicStudioEditor,doc)}return Boolean(next)}

  function selectTrack(trackId,api=root.MusicStudio,core=root.MusicStudioEditor,doc=root.document){const session=api?.state?.midiEditor;if(!session||!core)return false;const item=createSelectionModel(session,core).find(track=>track.id===trackId);if(!item)return false;api.__externalNoteSelectionTrackId=null;if(item.kind==='core'&&item.coreSlot&&typeof api.editorSelectPart==='function'){api.editorSelectPart(item.coreSlot);return true}const before=JSON.stringify(session.midiData),selected=core.selectTrackById?.(session,trackId)===true;if(!selected)return false;api.state.partialEditSession=null;api.state.midiMultiSelect=false;session.correctionPreview=null;session.transposePreview=null;session.noteLengthPreview=null;if(JSON.stringify(session.midiData)!==before)throw new Error('Track selection must not mutate MIDI data.');renderEditor(api,doc);return true}

  function button(doc,label,className){const item=doc.createElement('button');item.type='button';item.className=className;item.textContent=label;return item}
  function renderTrackStrip(page,model,api,doc){const list=page.querySelector('.music-part-tab-list');if(!list)return false;list.replaceChildren();list.classList.add('music-dynamic-track-strip');const soloByTrackId=api.state?.melodyAudio?.playbackState?.soloByTrackId||{};for(const item of model){const group=doc.createElement('div');group.className=`music-part-tab-group music-dynamic-track-group is-${item.kind}`;group.dataset.trackId=item.id;group.dataset.trackType=item.trackType;group.dataset.trackRole=item.role;group.dataset.canEditNotes=String(item.capabilities.canEditNotes===true);group.dataset.canPlayMidi=String(item.capabilities.canPlayMidi===true);group.dataset.canRecordMidi=String(item.capabilities.canRecordMidi===true);const select=button(doc,item.name,`music-part-tab music-dynamic-track-button ${item.selected?'music-primary is-active':'music-secondary'}`);select.setAttribute('aria-pressed',String(item.selected));select.setAttribute('aria-label',`Current Track ${item.name}`);select.title=item.kind==='external'?`${item.name} / External MIDI / ${item.role}`:item.name;select.addEventListener('click',()=>api.editorSelectTrack(item.id));group.appendChild(select);if(item.kind==='core'){const source=api.state.midiEditor?.midiData?.tracks?.find(track=>track.id===item.id),muted=source?.muted===true,solo=soloByTrackId[item.id]===true;const mute=button(doc,'M',muted?'music-primary':'music-secondary');mute.setAttribute('aria-pressed',String(muted));mute.setAttribute('aria-label',`${item.name} Mute`);mute.addEventListener('click',()=>api.editorSetTrackMuted(item.id,!muted));const soloButton=button(doc,'S',solo?'music-primary':'music-secondary');soloButton.setAttribute('aria-pressed',String(solo));soloButton.setAttribute('aria-label',`${item.name} Solo`);soloButton.addEventListener('click',()=>api.editorSetTrackSolo(item.id,!solo));group.append(mute,soloButton)}list.appendChild(group)}const nav=list.closest('.music-part-tabs');if(nav){nav.classList.add('music-dynamic-track-nav');nav.setAttribute('aria-label','Current Track selection')}return true}

  function disableExternalEditing(page,current){
    page.classList.add('is-external-track-selected');
    page.querySelectorAll('.music-midi-note').forEach(note=>{note.disabled=false;note.removeAttribute('aria-disabled');note.querySelectorAll?.('.music-note-resize').forEach(handle=>{handle.style.pointerEvents='none';handle.setAttribute('aria-hidden','true')})});
    page.querySelectorAll('.music-partial-edit button,.music-partial-edit input,.music-partial-edit select,.music-partial-edit textarea,.music-edit-range input,.music-correction-menu button,.music-correction-menu input,.music-correction-menu select,.music-correction-menu textarea').forEach(control=>{control.disabled=true;control.setAttribute('aria-disabled','true')});
    const actionNames=['editorAddNote','editorCopy','editorPaste','editorDuplicate','editorSelectAllNotes','editorLockSelectedNotes','editorUnlockSelectedNotes','editorMatchDuration','editorMatchVelocity','editorApplyQuantize','editorAddMeasures','editorRemoveMeasures','editorToggleMelodyPlayback'];
    for(const name of actionNames)page.querySelectorAll(`[onclick*="${name}"]`).forEach(control=>{control.disabled=true;control.setAttribute('aria-disabled','true')});
    page.querySelectorAll('[onclick*="editorDeleteNote"]').forEach(control=>{control.disabled=false;control.removeAttribute('aria-disabled')});
    if(current.capabilities.canRecordMidi!==true)page.querySelectorAll('[onclick*="editorToggleMidiRecording"]').forEach(control=>{control.disabled=true;control.setAttribute('aria-disabled','true')});
    page.querySelectorAll('.music-editor-transfer button').forEach(control=>{if(/^Export (?!All)/.test(control.textContent||'')){control.disabled=true;control.title='Current external Track export is not connected in this phase.'}});
    page.dataset.currentTrackMode='delete-only';page.dataset.currentTrackId=current.id;page.dataset.currentTrackCanEditNotes=String(current.capabilities.canEditNotes===true);page.dataset.currentTrackCanPlayMidi=String(current.capabilities.canPlayMidi===true);page.dataset.currentTrackCanRecordMidi=String(current.capabilities.canRecordMidi===true)
  }

  function enhanceEditor(page,api=root.MusicStudio,core=root.MusicStudioEditor,doc=root.document){if(!page||!api||!core)return false;const model=createSelectionModel(api.state?.midiEditor,core),current=resolveCurrentSelection(api.state?.midiEditor,core);if(!current)return false;const key=`${current.id}|${model.map(item=>item.id).join('|')}`;if(page.dataset.dynamicTrackSelectionKey===key)return true;page.dataset.dynamicTrackSelectionKey=key;page.dataset.currentTrackId=current.id;page.dataset.currentTrackType=current.trackType;page.dataset.currentTrackRole=current.role;renderTrackStrip(page,model,api,doc);const heading=page.querySelector('#midiEditorTitle');if(heading){heading.textContent=current.kind==='core'?`${current.name}制作`:`Current Track：${current.name}`;heading.dataset.trackId=current.id;heading.title=current.kind==='external'?'Dynamic Playback / Recording / safe note deletion are Track-ID routed. Correction / Partial Edit remain unavailable.':''}if(current.kind==='external')disableExternalEditing(page,current);else page.classList.remove('is-external-track-selected');return true}

  function install(api=root.MusicStudio,core=root.MusicStudioEditor,doc=root.document){
    if(!api||!core||api.__dynamicTrackSelectionInstalled)return false;
    api.__dynamicTrackSelectionInstalled=true;api.createTrackSelectionModel=session=>createSelectionModel(session||api.state?.midiEditor,core);api.resolveCurrentTrackSelection=session=>resolveCurrentSelection(session||api.state?.midiEditor,core);api.editorSelectTrack=trackId=>selectTrack(trackId,api,core,doc);api.enhanceDynamicTrackSelection=()=>enhanceEditor(doc?.querySelector?.('.music-midi-editor-page'),api,core,doc);
    const shortcut=api.editorHandleShortcut;if(typeof shortcut==='function')api.editorHandleShortcut=function(event,...args){if(isExternalSelection(api,core)&&!externalDeleteShortcut(event))return false;return shortcut.call(this,event,...args)};
    const originalDrag=api.editorStartNoteDrag;if(typeof originalDrag==='function')api.editorStartNoteDrag=function(event,id,...args){if(!isExternalSelection(api,core))return originalDrag.call(this,event,id,...args);if(event?.button!=null&&event.button!==0)return false;event?.preventDefault?.();const additive=Boolean(event?.shiftKey||event?.metaKey||event?.ctrlKey||api.state?.midiMultiSelect),current=resolveCurrentSelection(api.state?.midiEditor,core),trackId=current?.id||null;api.__externalNoteSelectionTrackId=trackId;api.editorSelectNote?.(id,additive);const after=resolveCurrentSelection(api.state?.midiEditor,core),selected=core.selectedIds?.(api.state?.midiEditor)||[];if(!trackId||after?.id!==trackId||!selected.includes(id)){api.__externalNoteSelectionTrackId=null;return false}return true};
    const originalDelete=api.editorDeleteNote;if(typeof originalDelete==='function')api.editorDeleteNote=function(...args){if(!isExternalSelection(api,core))return originalDelete.apply(this,args);const current=resolveCurrentSelection(api.state?.midiEditor,core);if(!current||String(api.__externalNoteSelectionTrackId||'')!==String(current.id)){core.clearNoteSelection?.(api.state?.midiEditor);return false}const result=originalDelete.apply(this,args);api.__externalNoteSelectionTrackId=null;return result};
    for(const name of BLOCKED_EXTERNAL_ACTIONS){const original=api[name];if(typeof original!=='function')continue;api[name]=function(...args){if(isExternalSelection(api,core))return{ok:false,reason:'core-track-required'};return original.apply(this,args)}}
    const run=()=>api.enhanceDynamicTrackSelection();run();if(typeof root.MutationObserver==='function'&&doc?.body){const observer=new root.MutationObserver(()=>run());observer.observe(doc.body,{childList:true,subtree:true});api.__dynamicTrackSelectionObserver=observer}return true
  }

  let bootTimer=null;
  function bootWithRetry(){if(install())return true;if(root.MusicStudio?.__dynamicTrackSelectionInstalled)return true;if(typeof root.setInterval!=='function')return false;if(bootTimer!=null)root.clearInterval(bootTimer);let attempts=0;bootTimer=root.setInterval(()=>{attempts+=1;if(install()||root.MusicStudio?.__dynamicTrackSelectionInstalled||attempts>=200){root.clearInterval(bootTimer);bootTimer=null}},25);return false}

  const exported={CORE_ORDER:[...CORE_ORDER],createSelectionModel,resolveCurrentSelection,selectTrack,externalDeleteShortcut,enhanceEditor,install,bootWithRetry};root.MusicStudioDynamicTrackSelection=exported;bootWithRetry();if(typeof root.addEventListener==='function')root.addEventListener('hashchange',bootWithRetry)
})(typeof window!=='undefined'?window:globalThis);
