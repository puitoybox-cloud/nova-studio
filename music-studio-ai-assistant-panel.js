/* Music Studio compact local-only AI Assistant panel. Optional loopback host; no external provider path. */
(function(root){
  'use strict';
  const states=new Map(),tabs=new Map();
  const FAMILY_COMPONENTS=[['melody','Melody（メロディ）'],['chord','Chord / Bass（コード候補からBass）'],['section','Section（構成）'],['arrangement','Arrangement（編成metadata）'],['lyrics-structure','Lyrics（歌詞metadata）'],['continuation','Continuation（続き）']];
  const clone=value=>JSON.parse(JSON.stringify(value));
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const app=()=>root.MusicStudio,ui=()=>root.MusicStudioAIAssistantUI,ai=()=>root.MusicStudioAIWorkflow,composition=()=>root.MusicStudioAIComposition,materializer=()=>root.MusicStudioAICandidatePreview,familyPreview=()=>root.MusicStudioAIFamilyPreview,familyApply=()=>root.MusicStudioAIFamilyApply,core=()=>root.MusicStudioEditor;
  function project(id){return app()?.state.projects.find(item=>item.projectId===id)||null}
  function stateFor(project){let record=states.get(project.projectId);if(record?.revision===project.revision)return record;try{record={state:ui().createState(project,{workspace:project.aiWorkspace}),revision:project.revision,pending:false,error:'',message:''}}catch(error){record={state:null,revision:project.revision,pending:false,error:error.message,message:''}}states.set(project.projectId,record);return record}
  function targetInfo(project,session,record){const model=ui().viewModel(record.state,project,session,core()),track=core().getTrackById(session.midiData.tracks,model.target.trackId);return{model,trackName:track?.name||model.target.trackId,range:`${model.target.range.startMeasure}–${model.target.range.endMeasure}小節`,notes:model.target.selectedNoteIds.length?model.target.selectedNoteIds.join(', '):`${core().notesInRange(session,model.target.range).length} notes in range`}}
  function activeRequest(state){return state.workspace.requests.find(item=>item.requestId===state.activeRequestId)||[...state.workspace.requests].reverse().find(item=>item.kind==='edit')||null}
  function assistant(project,session,record){const info=targetInfo(project,session,record),request=activeRequest(record.state),changes=request?.proposal?.result?.changes,history=record.state.workspace.history.slice(-5).reverse(),choices=(changes?.updates||[]).map(note=>`<label><input type="checkbox" name="musicAINote" value="${esc(note.id)}" ${record.noteReviews?.get(request?.requestId)?.get(note.id)===false?'':'checked'} onchange="MusicStudioAIAssistantPanel.captureNoteReview('${esc(project.projectId)}')"> ${esc(note.id)} → MIDI ${note.pitch}</label>`).join('');return`<div class="music-ai-context"><span>Track <b>${esc(info.trackName)}</b></span><span>Range <b>${esc(info.range)}</b></span><span>Note <b>${esc(info.notes)}</b></span></div><label class="music-ai-instruction"><span>指示（local synthetic）</span><textarea id="musicAIInstruction" rows="2" maxlength="2000" placeholder="例：選択した音を1音上げる">${esc(record.state.instruction)}</textarea></label><div class="music-ai-actions"><button class="music-primary" type="button" onclick="MusicStudioAIAssistantPanel.previewEdit('${esc(project.projectId)}')">Preview（確認）</button><button class="music-primary" type="button" onclick="MusicStudioAIAssistantPanel.applyEdit('${esc(project.projectId)}')" ${request?.status==='preview'?'':'disabled'}>Apply（採用）</button><button class="music-secondary" type="button" onclick="MusicStudioAIAssistantPanel.rejectEdit('${esc(project.projectId)}')" ${['requested','preview'].includes(request?.status)?'':'disabled'}>Reject</button><button class="music-secondary" type="button" onclick="MusicStudio.editorUndo()">Undo（元に戻す）</button></div><p class="music-ai-status" role="status">${esc(record.message||status(request))}</p>${choices?`<fieldset class="music-ai-note-choice" data-request-id="${esc(request?.requestId||'')}"><legend>部分採用するnote</legend><div class="music-ai-note-review"><button type="button" class="music-secondary" onclick="MusicStudioAIAssistantPanel.selectAllNotes('${esc(project.projectId)}',true)">All（全て選択）</button><button type="button" class="music-secondary" onclick="MusicStudioAIAssistantPanel.selectAllNotes('${esc(project.projectId)}',false)">None（選択解除）</button><span>Checked notes only（チェックした音符だけ採用）</span></div>${choices}<label><input type="checkbox" id="aiFamilyMetadataOnly" ${record.familyMetadataOnly?'checked':''} onchange="MusicStudioAIAssistantPanel.selectFamilyComponents('${esc(project.projectId)}')"> Metadata only（採用記録のみ／MIDIを変更しない）</label></fieldset>`:''}<details><summary>変更理由・provenance・履歴</summary><p>${esc(request?.reason||'User instruction / deterministic local preview')}</p><ol>${history.map(row=>`<li>${esc(row.kind)} / ${esc(row.requestId||row.setId||'local')}</li>`).join('')||'<li>履歴はまだありません。</li>'}</ol></details>`}
  function status(request){if(!request)return'Previewまでは原本を変更しません。';const c=request.proposal?.result?.changes;return`${request.status} / ${request.provenance.adapter||'local'}${c?` / 更新 ${c.updates.length}・追加 ${c.adds.length}・削除 ${c.deleteNoteIds.length}`:''}`}
  function song(project,record){const draft=record.state.newSongDraft,plan=record.state.newSongPreview;return`<div class="music-ai-form-grid"><label>曲名<input id="aiSongTitle" value="${esc(draft.title||'新しい曲')}"></label><label>BPM<input id="aiSongBpm" type="number" min="20" max="400" value="${esc(draft.bpm)}"></label><label>拍子<input id="aiSongMeter" value="${draft.numerator}/${draft.denominator}"></label><label>Key（調）<input id="aiSongKey" value="${esc(draft.key||'C')}"></label><label>小節数<input id="aiSongBars" type="number" min="1" max="10000" value="${esc(draft.bars)}"></label><label>雰囲気<input id="aiSongMood" value="${esc(draft.mood)}"></label><label>ジャンル<input id="aiSongGenre" value="${esc(draft.genre)}"></label><label>編成<input id="aiSongTracks" value="${esc(draft.tracks.join(', '))}"></label><label class="music-ai-wide">参考メモ<textarea id="aiSongMemo" rows="2">${esc(draft.memo)}</textarea></label></div><div class="music-ai-actions"><button class="music-primary" onclick="MusicStudioAIAssistantPanel.previewSong('${esc(project.projectId)}')">Preview（確認）</button><button class="music-primary" onclick="MusicStudioAIAssistantPanel.confirmSong('${esc(project.projectId)}')" ${plan?'':'disabled'}>Confirmして新規作成</button></div>${plan?`<div class="music-ai-preview"><b>${esc(plan.title)}</b><span>${plan.bpm} BPM / ${plan.signature.numerator}/${plan.signature.denominator} / ${esc(plan.key||'Key未設定')} / ${plan.bars}小節</span><span>Tracks: ${plan.tracks.map(track=>esc(track.name)).join(', ')}</span><span>現在のProjectは上書きしません。</span></div>`:'<p class="music-ai-status">Confirm前はProjectを作成しません。</p>'}`}
  function candidateValues(kind){const service=composition();if(!service)throw Error('ai-composition-unavailable');return service.candidateValues(kind,service.defaultContext())}
  function candidateValuesForProject(kind,project,session,generation){const service=composition();if(!service)throw Error('ai-composition-unavailable');return service.candidateValues(kind,{...service.createContext(project,session,core()),...(generation?{generation}:{} )})}
  function activeCandidateSet(record){return record.state.workspace.candidateSets.find(item=>item.setId===record.state.activeCandidateSetId)||record.state.workspace.candidateSets.at(-1)||null}
  function captureGeneration(id,strict=false){const record=stateFor(project(id));try{const seed=value('#aiGenerationSeed').trim(),register=value('#aiGenerationRegister')||'mid';record.generation=seed===''?null:composition().generationOptions({seed:Number(seed),register});return record.generation}catch(error){record.message=`生成設定拒否: ${error.message}`;if(strict)throw error;return null}}
  function generationControls(project,record,set){const g=record.generation===undefined?set?.candidates?.[0]?.value?.generation:record.generation;return`<details class="music-ai-generation-controls"><summary>Local recipe（端末内の生成設定）</summary><p>規則によるMelody / Continuation候補です。モデルによるAI作曲・歌声合成は未接続。Seedが空欄の場合は従来の候補を使います。</p><div class="music-ai-range"><label>Seed（再現番号）<input id="aiGenerationSeed" type="number" min="0" max="999999" step="1" value="${esc(g?.seed??'')}" onchange="${esc(`MusicStudioAIAssistantPanel.captureGeneration(${JSON.stringify(project.projectId)})`)}"></label><label>Register（音域）<select id="aiGenerationRegister" onchange="${esc(`MusicStudioAIAssistantPanel.captureGeneration(${JSON.stringify(project.projectId)})`)}">${[['mid','Mid（中央）'],['mid-high','High（高め）'],['low-mid','Low（低め）']].map(([id,title])=>`<option value="${id}" ${id===(g?.register||'mid')?'selected':''}>${title}</option>`).join('')}</select></label></div></details>`}
  function candidateSelection(candidateId){const rawFrom=value(`#aiFrom${candidateId}`).trim(),rawTo=value(`#aiTo${candidateId}`).trim();if(!rawFrom&&!rawTo)return null;const from=Number(rawFrom),to=Number(rawTo);if(!Number.isInteger(from)||!Number.isInteger(to)||from<1||to<from)throw Error('invalid-candidate-selection');return{startMeasure:from,endMeasure:to}}
  function candidatePreviewText(bundle){if(!bundle)return'';if(bundle.type==='metadata-preview')return'Metadata Preview / 原本変更なし'+(bundle.companion?.timeline?.segments||[]).map(part=>` / Section ${part.label}: M${part.startMeasure}-${part.endMeasure} / tick ${part.startTick}-${part.endTick}`).join('')+composition().lyricsTimelineRows(bundle.companion?.timeline).map(line=>` / ${line}`).join('');const changes=bundle.result?.changes||{updates:[],adds:[],deleteNoteIds:[]};return`MIDI Preview → ${bundle.targetTrackId} / 更新 ${changes.updates.length}・追加 ${changes.adds.length}・削除 ${changes.deleteNoteIds.length} / 原本変更なし${bundle.companion?.instrumentFit?` / Sample fit（音源の音域・強さ）: ${bundle.companion.instrumentFit.changed?'調整あり':'範囲内'}`:''}`}
  function candidateEditHtml(project,candidate){
    let edits;try{edits=materializer().previewEdits(candidate.value.previewEdits)}catch(error){return`<p role="alert">${esc(error.message)}</p>`}
    const call=esc(`MusicStudioAIAssistantPanel.editCandidate(${JSON.stringify(project.projectId)},${JSON.stringify(candidate.candidateId)})`),reset=esc(`MusicStudioAIAssistantPanel.editCandidate(${JSON.stringify(project.projectId)},${JSON.stringify(candidate.candidateId)},true)`);
    return`<details data-candidate-edit="${esc(candidate.candidateId)}"><summary>Edit（候補を調整）</summary><div class="music-ai-range"><label>Transpose（半音）<input id="aiTranspose${candidate.candidateId}" type="number" min="-24" max="24" value="${edits.transpose}"></label><label>Velocity（強さ差）<input id="aiVelocity${candidate.candidateId}" type="number" min="-64" max="64" value="${edits.velocity}"></label><label>Length（音の長さ％）<input id="aiLength${candidate.candidateId}" type="number" min="25" max="200" value="${edits.lengthPercent}"></label></div><div class="music-ai-actions"><button class="music-secondary" onclick="${call}">調整をPreview</button><button class="music-secondary" onclick="${reset}">調整をリセット</button></div><small>原本への反映はApply。調整は保存対象です。</small></details>`;
  }
  function editCandidate(id,candidateId,reset=false){
    app()?.editorStopCandidateAudition?.();const p=project(id),record=stateFor(p),set=activeCandidateSet(record),candidate=set?.candidates.find(c=>c.candidateId===candidateId);
    try{
      if(!candidate||!['melody','chord','continuation'].includes(set.kind))throw Error('midi-candidate-required');
      const read=selector=>{const raw=value(selector).trim();if(!raw)throw Error('candidate-edit-required');return Number(raw)},edits=reset?null:materializer().previewEdits({transpose:read(`#aiTranspose${candidateId}`),velocity:read(`#aiVelocity${candidateId}`),lengthPercent:read(`#aiLength${candidateId}`)});
      const next=clone(candidate);if(reset)delete next.value.previewEdits;else next.value.previewEdits=edits;
      const session=app().state.midiEditor,bundle=materializer().createPreview(session,core(),next,{project:p});
      // Reuse adoption preflight to reject stale/locked targets before persisting edits.
      materializer().auditionPlan(session,core(),bundle,candidateSelection(candidateId));
      touch(id);candidate.value=next.value;record.candidatePreview=bundle;record.familyPreview=null;record.familyApplyPlan=null;record.familyApplyPreflight=null;record.message=reset?'候補の調整をリセットしました。':'調整をPreviewしました。Listenで試聴し、Applyで採用できます。';
    }catch(error){record.message=`候補調整拒否: ${error.message}`}refresh(id,{preserveCandidateDrafts:false});
  }
  function candidatePreviewHtml(bundle){const rows=[...composition().lyricsTimelineRows(bundle?.companion?.timeline),...composition().arrangementTimelineRows(bundle?.companion?.timeline),...materializer().continuationSourceRows(bundle?.companion?.sourcePreview)];return rows.length?`<section class="music-ai-status"><p>${bundle.type==='midi-preview'?esc(candidatePreviewText(bundle)):'Metadata Preview / 原本変更なし'}</p><ul>${rows.map(row=>`<li>${esc(row)}</li>`).join('')}</ul></section>`:`<p class="music-ai-status">${esc(candidatePreviewText(bundle))}</p>`}
  function familyPreviewHtml(project,record){
    const preview=record.familyPreview;if(!preview)return'';
    const rows=familyPreview().familyRows(preview).map(row=>`<li>${esc(row)}</li>`).join('');
    const state=preview.familyMismatch?'Family ID mismatch':preview.complete?'Complete family':'Incomplete family';
    const selected=record.familyKinds||familyApply().DEFAULT_KINDS;
    const choices=FAMILY_COMPONENTS.map(([kind,label])=>`<label><input type="checkbox" name="musicAIFamilyComponent" value="${kind}" ${selected.includes(kind)?'checked':''} onchange="MusicStudioAIAssistantPanel.selectFamilyComponents('${esc(project.projectId)}')"> ${label}</label>`).join('');
    return`<div class="music-ai-preview"><b>Family ${esc(preview.variant)} Preview / ${esc(state)}</b><span>原本変更なし</span><ul>${rows}</ul><fieldset class="music-ai-note-choice"><legend>Applyするcomponent（依存不足はBLOCKED）</legend>${choices}<label><input type="checkbox" id="aiFamilyMetadataOnly" ${record.familyMetadataOnly?'checked':''} onchange="MusicStudioAIAssistantPanel.selectFamilyComponents('${esc(project.projectId)}')"> Metadata only（採用記録のみ／MIDIを変更しない）</label><label><input type="checkbox" id="aiFamilyProjectSections" ${record.familyProjectSections?'checked':''} onchange="MusicStudioAIAssistantPanel.selectFamilyComponents('${esc(project.projectId)}')"> Apply Section to Project（曲構成へ追加）</label></fieldset><div class="music-ai-range"><label>開始小節<input id="aiFamilyFrom" type="number" min="1" value="${esc(record.familyRangeInput?.from??'')}" onchange="MusicStudioAIAssistantPanel.selectFamilyComponents('${esc(project.projectId)}')"></label><label>終了小節<input id="aiFamilyTo" type="number" min="1" value="${esc(record.familyRangeInput?.to??'')}" onchange="MusicStudioAIAssistantPanel.selectFamilyComponents('${esc(project.projectId)}')"></label></div><small>Chord / Bassは既存のBass生成を利用。通常のSection・Arrangement・Lyricsは採用metadataのみ。曲構成への追加は上の明示選択が必要です。既存構成と重なる範囲は拒否します。空の小節欄は候補の全範囲。</small><div class="music-ai-actions"><button class="music-primary" onclick="MusicStudioAIAssistantPanel.createFamilyApplyPlan('${esc(project.projectId)}')">Apply Planを作成</button></div></div>`
  }
  function familyApplyHtml(project,record){
    const plan=record.familyApplyPlan;if(!plan)return'';
    const rows=familyApply().planRows(plan).map(row=>`<li>${esc(row)}</li>`).join(''),pre=record.familyApplyPreflight;
    const preflight=pre?(pre.ok?'Preflight PASS':`Preflight BLOCKED: ${pre.errors.join(', ')}`):'Preflight未実行';
    return`<div class="music-ai-preview"><b>Family Apply Plan</b><span>${esc(preflight)}</span><ul>${rows}</ul><div class="music-ai-actions"><button class="music-secondary" onclick="MusicStudioAIAssistantPanel.preflightFamilyApply('${esc(project.projectId)}')">Preflight</button>${pre?.ok?`<button class="music-primary" onclick="MusicStudioAIAssistantPanel.confirmFamilyApply('${esc(project.projectId)}')">Confirm Family Apply</button>`:''}<button class="music-secondary" onclick="MusicStudioAIAssistantPanel.cancelFamilyApply('${esc(project.projectId)}')">Cancel Plan</button></div><small>Confirm前はMIDI・candidate adoptionを変更しません。</small></div>`
  }
  function localModelControls(project,record){
    if(!(root.location?.hostname==='127.0.0.1'||root.__NOVA_GENERATION_HOST__===true))return'';
    return `<details class="music-ai-generation-controls"><summary>AI model（実モデル作曲・端末内）</summary><p>SkyTNT MIDIモデル / Apache-2.0。旋律A/B/Cを生成し、既存の試聴・部分採用・保存へ送ります。</p><button class="music-secondary" type="button" onclick="MusicStudioAIAssistantPanel.generateLocalModel('${esc(project.projectId)}')" ${record.localModelBusy?'disabled':''}>${record.localModelBusy?'Generating（推論中）':'Generate model A/B/C（実モデルで生成）'}</button></details>`;
  }
  async function generateLocalModel(id){
    const p=project(id),session=app()?.state?.midiEditor;
    if(!p||!session||session.projectId!==id)return{ok:false,reason:'midi-session-required'};
    const record=stateFor(p);
    if(record.localModelBusy||!(root.location?.hostname==='127.0.0.1'||root.__NOVA_GENERATION_HOST__===true))return;
    const signature=JSON.stringify(session?.midiData),workspace=JSON.stringify(record.state.workspace),range=JSON.stringify(session?.editRange),track=core().currentTrackId(session);
    const current=()=>project(id)===p&&states.get(id)===record&&app().state.midiEditor===session&&JSON.stringify(session.midiData)===signature&&JSON.stringify(record.state.workspace)===workspace&&JSON.stringify(session.editRange)===range&&core().currentTrackId(session)===track;
    record.localModelBusy=true;record.message='実モデル推論中です。';refresh(id);
    try{
      const seedText=value('#aiGenerationSeed').trim(),seed=seedText===''?72:Number(seedText);
      const result=await app().localGenerationRequest('compose',{seed,events:64,max_ticks:Math.floor((session.editRange?composition().createContext(p,session,core()).range.endTick-composition().createContext(p,session,core()).range.startTick:7680)*480/(session.midiData.ppq||480)),bpm:Math.round(session.midiData.tempo||p.bpm||72)});
      if(!current())return;
      if(result.model!=='skytnt/midi-model-tv2o-medium'||result.synthetic!==false||result.candidates?.length!==3)throw Error('invalid-model-result');
      const files=result.candidates.map(c=>{const bytes=Uint8Array.from(root.atob(c.midiBase64),x=>x.charCodeAt(0));return new root.File([bytes],`${c.variant}-SkyTNT.mid`,{type:'audio/midi'})});
      await importMidiCandidates(id,{files,value:''});
      if(current())record.message='実モデルA/B/Cを生成しました。Preview→Listen→Applyで採用できます。';
    }catch(error){if(current())record.message=`実モデル生成: ${error.message}`}
    finally{record.localModelBusy=false;if(project(id)===p&&states.get(id)===record&&app().state.midiEditor===session)refresh(id)}
  }
  function candidates(project,record,session){
    const set=activeCandidateSet(record),kinds=[['melody','Melody'],['chord','Chord'],['section','Section'],['arrangement','Arrangement'],['continuation','Continuation'],['lyrics-structure','Lyrics / Melody']];
    const familyTools=`<div class="music-ai-actions"><button class="music-secondary" onclick="MusicStudioAIAssistantPanel.generateFamilyCandidates('${esc(project.projectId)}')">Family A/B/Cを生成</button><button class="music-secondary" onclick="MusicStudioAIAssistantPanel.previewFamily('${esc(project.projectId)}','A')">Family A Preview</button><button class="music-secondary" onclick="MusicStudioAIAssistantPanel.previewFamily('${esc(project.projectId)}','B')">Family B Preview</button><button class="music-secondary" onclick="MusicStudioAIAssistantPanel.previewFamily('${esc(project.projectId)}','C')">Family C Preview</button></div>`;
    return`${localModelControls(project,record)}<details class="music-ai-generation-controls"><summary>MIDI output（生成済み候補を読み込む）</summary><p>端末内の別ツール等で書き出した旋律MIDIを1〜3個選択。各1 MB・4096音まで。拍位置と休符を保ち、選択範囲の先頭に配置します。Projectのテンポ・拍子・音源を使います。CC・Pitch Bend・複数演奏Trackは通常のMIDI Importをご利用ください。</p><label>MIDI candidates（候補ファイル）<input type="file" accept=".mid,.midi,audio/midi" multiple onchange="MusicStudioAIAssistantPanel.importMidiCandidates('${esc(project.projectId)}',this)"></label><small>このファイル読み込みでは生成元・モデル・素材の利用条件を判定しません。端末内の実生成には専用ホストをご利用ください。</small></details>${generationControls(project,record,set)}<div class="music-ai-candidate-tools"><label>候補の種類<select id="aiCandidateKind">${kinds.map(([id,label])=>`<option value="${id}"${id===(set?.kind||'melody')?' selected':''}>${label}</option>`).join('')}</select></label><button class="music-primary" onclick="MusicStudioAIAssistantPanel.generateCandidates('${esc(project.projectId)}')">A/B/Cを生成</button></div>${record.message?`<p class="music-ai-status music-ai-candidate-status" role="status">${esc(record.candidatePreview?.kind==='lyrics-structure'&&record.message===candidatePreviewText(record.candidatePreview)?'Lyrics Preview / 小節anchor（音符割付は未実行）':record.message)}</p>`:''}${familyTools}${familyPreviewHtml(project,record)}${familyApplyHtml(project,record)}${set?`<div class="music-ai-candidates">${set.candidates.map(candidate=>{const selection=record.candidateSelections?.[candidate.candidateId],preview=record.candidatePreview?.candidateId===candidate.candidateId?record.candidatePreview:null,details=composition().detailLines(candidate.value).map(line=>`<li>${esc(line)}</li>`).join(''),midi=['melody','chord','continuation'].includes(set.kind);return`<article><b>${candidate.candidateId} / ${esc(set.kind)}</b><p>${esc(candidate.value.summary)}</p><ul>${details}</ul><small>${esc(candidate.provenance.adapter)} / ${esc(candidate.status)}</small><div class="music-ai-range"><label>開始小節<input id="aiFrom${candidate.candidateId}" ${set.kind==='arrangement'?`oninput="MusicStudioAIAssistantPanel.clearArrangementDestination('${esc(project.projectId)}')"`: ''} type="number" min="1" value="${esc(selection?.startMeasure??candidate.value.range?.startMeasure??'')}"></label><label>終了小節<input id="aiTo${candidate.candidateId}" ${set.kind==='arrangement'?`oninput="MusicStudioAIAssistantPanel.clearArrangementDestination('${esc(project.projectId)}')"`: ''} type="number" min="1" value="${esc(selection?.endMeasure??candidate.value.range?.endMeasure??'')}"></label></div><div class="music-ai-actions"><button class="music-secondary" onclick="MusicStudioAIAssistantPanel.previewCandidate('${esc(project.projectId)}','${candidate.candidateId}')">${midi?'MIDI Preview':'Preview'}</button>${preview?.type==='midi-preview'?`<button class="music-secondary" onclick="${esc(`MusicStudioAIAssistantPanel.auditionCandidate(${JSON.stringify(project.projectId)},${JSON.stringify(candidate.candidateId)})`)}">Listen（候補を試聴）</button><button class="music-secondary" onclick="MusicStudio.editorStopCandidateAudition()">Stop（試聴停止）</button><button class="music-primary" onclick="MusicStudioAIAssistantPanel.applyCandidatePreview('${esc(project.projectId)}','${candidate.candidateId}')">PreviewをApply</button><button class="music-secondary" onclick="MusicStudioAIAssistantPanel.cancelCandidatePreview('${esc(project.projectId)}')">Preview取消</button>`:!midi?`<button class="music-primary" onclick="MusicStudioAIAssistantPanel.decideCandidate('${esc(project.projectId)}','${candidate.candidateId}','adopt')">採用記録</button>`:''}<button class="music-secondary" onclick="MusicStudioAIAssistantPanel.decideCandidate('${esc(project.projectId)}','${candidate.candidateId}','reject')">Reject</button></div>${set.kind==='lyrics-structure'?`<button class="music-secondary" onclick="MusicStudioAIAssistantPanel.inspectLyricsMelody('${esc(project.projectId)}','${candidate.candidateId}')">Melody参照を確認</button><button class="music-secondary" onclick="MusicStudioAIAssistantPanel.listLyricsMelody('${esc(project.projectId)}','${candidate.candidateId}')">Melody参照候補を表示</button>${lyricsMelodyChoicesHtml(record,candidate,session)}${lyricsMelodyHtml(record,candidate,session)}`:''}${set.kind==='arrangement'?`<button class="music-secondary" onclick="MusicStudioAIAssistantPanel.inspectArrangementReference('${esc(project.projectId)}','${candidate.candidateId}')">Section / Chord参照を確認</button><button class="music-secondary" onclick="MusicStudioAIAssistantPanel.inspectArrangementTracks('${esc(project.projectId)}','${candidate.candidateId}')">Role / Track対応を確認</button>${arrangementReferenceHtml(record,candidate,session)}`:''}${midi?candidateEditHtml(project,candidate):''}${preview?candidatePreviewHtml(preview):''}</article>`}).join('')}</div>`:'<p class="music-ai-status">候補は原本と分離して保持します。PreviewまではMIDI原本を変更しません。</p>'}`
  }
  function projectSectionsHtml(project,session){
    const current=core()?.projectSectionsSnapshot?.(session,project),items=current?.items;
    if(!Array.isArray(items)||!items.length)return'';
    return`<details class="music-ai-project-sections"><summary>Project Sections（曲構成） / ${items.length}</summary><ul>${items.map(item=>`<li>${esc(item?.label||item?.id||'Section')} / M${esc(item?.startMeasure??'?')}-${esc(item?.endMeasure??'?')} / tick ${esc(item?.startTick??'?')}-${esc(item?.endTick??'?')}</li>`).join('')}</ul></details>`;
  }
  function render(project,session){if(!ui()||!ai())return'';const record=stateFor(project),tab=tabs.get(project.projectId)||'assistant';if(record.error)return`<section class="music-ai-panel is-error"><h2>AI Assistant</h2><p>AI制作データを安全に開けません：${esc(record.error)}</p><p>ProjectとMIDIは変更していません。</p></section>`;const body=tab==='song'?song(project,record):tab==='candidates'?candidates(project,record,session):assistant(project,session,record);
    // Preserve the AI drawer across preview/apply repaint; do not discard drafts
    // just because a different candidate tab or editor row refreshed.
    const previous=[...(root.document?.querySelectorAll?.('.music-ai-panel[data-project-id]')||[])].find(node=>node.dataset.projectId===project.projectId);
    const prior=previous?.querySelector?.('.music-ai-focus');
    const landscape=Boolean(root.matchMedia?.('(min-width:601px) and (orientation:landscape) and (hover:none) and (pointer:coarse)')?.matches);
    const expanded=prior?prior.open:!landscape;
    return`<section class="music-ai-panel" data-project-id="${esc(project.projectId)}"><details class="music-ai-focus" onkeydown="MusicStudioAIAssistantPanel.closeOnEscape(event,this)" ${expanded?'open':''}><summary aria-label="AI Assistant（AI制作パネルを開閉）">AI Assistant（AI制作）<span>Local only（端末内）</span></summary><header><div><p class="music-kicker">LOCAL-ONLY / MIDI CANDIDATES</p><h2>AI Assistant</h2></div><span class="music-ai-safe">External request 0</span></header><nav><button class="${tab==='assistant'?'music-primary':'music-secondary'}" onclick="MusicStudioAIAssistantPanel.setTab('${esc(project.projectId)}','assistant')">Assistant</button><button class="${tab==='song'?'music-primary':'music-secondary'}" onclick="MusicStudioAIAssistantPanel.setTab('${esc(project.projectId)}','song')">New Song（新しい曲）</button><button class="${tab==='candidates'?'music-primary':'music-secondary'}" onclick="MusicStudioAIAssistantPanel.setTab('${esc(project.projectId)}','candidates')">A/B/C候補</button></nav><div class="music-ai-body">${projectSectionsHtml(project,session)}${body}</div></details></section>`}
  function closeOnEscape(event,detail){
    if(event.key!=='Escape'||!detail?.open)return false;
    event.preventDefault();event.stopPropagation();detail.open=false;
    detail.querySelector?.('summary')?.focus?.();return true;
  }
  function refresh(id,{preserveCandidateDrafts=true}={}){
    const target=[...(root.document?.querySelectorAll?.('.music-ai-panel[data-project-id]')||[])].find(node=>node.dataset.projectId===id),
      p=project(id),s=app()?.state.midiEditor;
    if(!target||!p||!s)return;
    // Only preserve the editor's local, unsubmitted AI text fields when the
    // same tab is re-rendered. The persisted project and proposal results
    // remain controlled by their existing explicit preview/adoption paths.
    const drafts=Array.from(target.querySelectorAll?.('textarea[id],input[id],select[id]')||[])
      .filter(node=>node.id==='musicAIInstruction'||node.id.startsWith('aiSong')||(preserveCandidateDrafts&&/^ai(?:Transpose|Velocity|Length)[a-zA-Z0-9_-]+$/.test(node.id)))
      .map(node=>({id:node.id,value:node.value}));
    const editPanels=Array.from(target.querySelectorAll?.('details[data-candidate-edit]')||[]).filter(node=>node.open).map(node=>node.dataset.candidateEdit);
    captureNoteReview(id);
    const previousRequest=target.querySelector?.('.music-ai-note-choice')?.dataset?.requestId;
    const checkedNotes=new Map(Array.from(target.querySelectorAll?.('input[name="musicAINote"]')||[]).map(node=>[node.value,node.checked]));
    target.outerHTML=render(p,s);
    const fresh=[...(root.document?.querySelectorAll?.('.music-ai-panel[data-project-id]')||[])].find(node=>node.dataset.projectId===id);
    for(const draft of drafts){
      const node=Array.from(fresh?.querySelectorAll?.('textarea[id],input[id],select[id]')||[]).find(x=>x.id===draft.id);
      if(node&&typeof draft.value==='string')node.value=draft.value;
    }
    for(const node of Array.from(fresh?.querySelectorAll?.('details[data-candidate-edit]')||[]))
      if(editPanels.includes(node.dataset.candidateEdit))node.open=true;
    // Preserve users' note-by-note review choices on rejected adoption/error
    // repaints. Never auto-select a note that the user explicitly unchecked.
    for(const node of Array.from(fresh?.querySelectorAll?.('input[name="musicAINote"]')||[])){
      if(previousRequest===activeRequest(stateFor(p).state)?.requestId){if(checkedNotes.has(node.value))node.checked=checkedNotes.get(node.value);}
    }
  }
  function touch(id){const record=stateFor(project(id));record.pending=true;record.message='';return record}
  async function previewEdit(id){const p=project(id),record=touch(id),instruction=root.document.querySelector('#musicAIInstruction')?.value?.trim();try{ui().setInstruction(record.state,instruction);ui().previewEdit(record.state,p,app().state.midiEditor,core(),{reason:'User instruction / deterministic local preview'});await ui().runPreview(record.state,core(),ai().syntheticPitchAdapter(1));record.message='Previewを作成しました。原本は変更していません。'}catch(error){record.message=`Preview拒否: ${error.message}`}refresh(id)}
  function noteReviewInputs(id){
    const panel=[...(root.document?.querySelectorAll?.('.music-ai-panel[data-project-id]')||[])].find(node=>node.dataset.projectId===id);
    return Array.from(panel?.querySelectorAll?.('input[name="musicAINote"]')||[]);
  }
  function captureNoteReview(id){
    const record=states.get(id);if(!record)return;
    const panel=[...(root.document?.querySelectorAll?.('.music-ai-panel[data-project-id]')||[])].find(node=>node.dataset.projectId===id);
    const requestId=panel?.querySelector?.('.music-ai-note-choice')?.dataset?.requestId;if(!requestId)return;
    record.noteReviews||=new Map();record.noteReviews.set(requestId,new Map(noteReviewInputs(id).map(note=>[note.value,note.checked])));
    // Review state belongs to the current proposal, never to another preview.
    while(record.noteReviews.size>8)record.noteReviews.delete(record.noteReviews.keys().next().value);
  }
  function selectAllNotes(id,checked){
    const notes=noteReviewInputs(id);for(const note of notes)note.checked=Boolean(checked);
    captureNoteReview(id);return notes.length;
  }
  function applyEdit(id){
    const p=project(id),record=touch(id),notes=noteReviewInputs(id),ids=notes.filter(input=>input.checked).map(input=>input.value);
    try{
      if(notes.length&&!ids.length)throw Error('adoption-requires-selected-notes');
      ui().applyActive(record.state,p,app().state.midiEditor,core(),{updateIds:ids,addIds:[],deleteIds:[]});
      record.message='選択した提案だけをApplyしました。';app().repaintEditor()
    }catch(error){record.message=`Apply拒否: ${error.message}`;refresh(id)}
  }
  function rejectEdit(id){const record=touch(id);try{ui().rejectActive(record.state,'User rejected preview');record.message='Rejectしました。原本は変更していません。'}catch(error){record.message=`Reject拒否: ${error.message}`}refresh(id)}
  function value(selector){return root.document?.querySelector?.(selector)?.value||''}
  function previewSong(id){const record=touch(id),meter=value('#aiSongMeter').split('/').map(Number),tracks=value('#aiSongTracks').split(',').map(item=>item.trim()).filter(Boolean);try{ui().setNewSongDraft(record.state,{title:value('#aiSongTitle'),bpm:Number(value('#aiSongBpm')),numerator:meter[0],denominator:meter[1],key:value('#aiSongKey'),bars:Number(value('#aiSongBars')),mood:value('#aiSongMood'),genre:value('#aiSongGenre'),memo:value('#aiSongMemo'),tracks});ui().previewNewSong(record.state)}catch(error){record.message=`New Song Preview拒否: ${error.message}`}refresh(id)}
  async function confirmSong(id){const record=touch(id);try{const made=ui().confirmNewSong(record.state),created=await app().createAIProject(made);app().openMidiEditor(created.projectId)}catch(error){record.message=`新規作成拒否: ${error.message}`;refresh(id)}}
  async function importMidiCandidates(id,input){
    const files=Array.from(input?.files||[]);if(input)input.value='';if(!files.length)return;
    app()?.editorStopCandidateAudition?.();const p=project(id),record=stateFor(p),session=app().state.midiEditor;
    const token={};record.midiImportToken=token;
    const midiSignature=JSON.stringify(session.midiData),workspaceSignature=JSON.stringify(record.state.workspace),trackId=core().currentTrackId(session),rangeSignature=JSON.stringify(session.editRange);
    const current=()=>project(id)===p&&states.get(id)===record&&app()?.state.midiEditor===session&&record.midiImportToken===token&&JSON.stringify(session.midiData)===midiSignature&&JSON.stringify(record.state.workspace)===workspaceSignature&&core().currentTrackId(session)===trackId&&JSON.stringify(session.editRange)===rangeSignature;
    try{
      if(files.length>3||files.some(f=>f.size>1048576)||files.reduce((n,f)=>n+f.size,0)>3145728)throw Error('1 MB以下のMIDIを1〜3個選んでください。');
      const context=composition().createContext(p,session,core()),values=[];
      for(let i=0;i<files.length;i++){
        const bytes=await files[i].arrayBuffer();if(!current())return;
        const v=composition().midiCandidate(bytes,files[i],context,i,session.midiData.ppq);
        const bundle=materializer().createPreview(session,core(),{candidateId:v.variant,value:v},{project:p});
        materializer().auditionPlan(session,core(),bundle,null);values.push(v);
      }
      if(!current())return;
      touch(id);ui().createCandidates(record.state,'melody',{range:clone(session.editRange),music:{key:context.key,mode:context.mode,source:'imported-midi-output'}},values,{adapter:'local-midi-output-import-v1',reason:'User supplied MIDI output; model and license origin unverified'});
      record.candidatePreview=null;record.candidateSelections={};record.familyPreview=null;record.familyApplyPlan=null;record.familyApplyPreflight=null;record.arrangementReferencePreview=null;record.lyricsMelodyChoices=null;record.lyricsMelodyPreview=null;
      record.message=`MIDI候補${values.length}個を読み込みました。Preview→Listen→Applyで採用できます。既存音符は保持します。`;
    }catch(error){if(current())record.message=`MIDI候補Import拒否: ${error.message}`}
    finally{if(states.get(id)===record&&record.midiImportToken===token){record.midiImportToken=null;if(project(id)===p&&app()?.state.midiEditor===session)refresh(id)}}
  }
  function generateCandidates(id){app()?.editorStopCandidateAudition?.();const record=touch(id),kind=value('#aiCandidateKind')||'melody',p=project(id),session=app().state.midiEditor;try{const generation=captureGeneration(id,true),values=candidateValuesForProject(kind,p,session,generation),context=composition().createContext(p,session,core());ui().createCandidates(record.state,kind,{range:clone(session.editRange),music:{key:context.key,mode:context.mode,source:context.source}},values,{adapter:'deterministic-composition-v1',reason:'local deterministic composition candidate'});record.arrangementReferencePreview=null;record.lyricsMelodyChoices=null;record.lyricsMelodyPreview=null;record.candidatePreview=null;record.candidateSelections={};record.message='A/B/C候補を作成しました。原本は変更していません。'}catch(error){record.message=`候補生成拒否: ${error.message}`}refresh(id)}
  function generateFamilyCandidates(id){app()?.editorStopCandidateAudition?.();const record=touch(id),p=project(id),session=app().state.midiEditor;try{if(!familyPreview())throw Error('family-preview-unavailable');const generation=captureGeneration(id,true),context={...composition().createContext(p,session,core()),...(generation?{generation}:{})};let firstSet=null;for(const kind of familyPreview().KINDS){const set=ui().createCandidates(record.state,kind,{range:clone(session.editRange),music:{key:context.key,mode:context.mode,source:context.source}},composition().candidateValues(kind,context),{adapter:'deterministic-family-v1',reason:'linked local deterministic candidate family'});if(kind==='melody')firstSet=set}if(firstSet)record.state.activeCandidateSetId=firstSet.setId;record.arrangementReferencePreview=null;record.lyricsMelodyChoices=null;record.lyricsMelodyPreview=null;record.candidatePreview=null;record.candidateSelections={};record.familyPreview=null;record.familyApplyPlan=null;record.familyApplyPreflight=null;record.message='Family A/B/Cを生成しました。まだ原本は変更していません。'}catch(error){record.message=`Family生成拒否: ${error.message}`}refresh(id)}
  function previewFamily(id,variant){const record=stateFor(project(id)),p=project(id),session=app().state.midiEditor;try{if(!familyPreview())throw Error('family-preview-unavailable');record.familyApplyPlan=null;record.familyApplyPreflight=null;record.familyPreview=familyPreview().createFamilyPreview(record.state.workspace,variant,session,core(),p,{composition:composition(),materializer:materializer()});record.message=`Family ${variant}をまとめてPreviewしました。原本は変更していません。`}catch(error){record.familyPreview=null;record.message=`Family Preview拒否: ${error.message}`}refresh(id)}
  function selectFamilyComponents(id){const record=stateFor(project(id));record.familyKinds=[...root.document.querySelectorAll('input[name="musicAIFamilyComponent"]:checked')].map(input=>input.value);const from=value('#aiFamilyFrom').trim(),to=value('#aiFamilyTo').trim();record.familyMetadataOnly=root.document.querySelector('#aiFamilyMetadataOnly')?.checked===true;record.familyProjectSections=root.document.querySelector('#aiFamilyProjectSections')?.checked===true;record.familyRangeInput={from,to};record.familyRange=from&&to?{startMeasure:Number(from),endMeasure:Number(to)}:null;record.familyApplyPlan=null;record.familyApplyPreflight=null;refresh(id)}
  function familySelection(record){const raw=record.familyRangeInput;if(!raw||(!raw.from&&!raw.to))return null;const startMeasure=Number(raw.from),endMeasure=Number(raw.to);if(!raw.from||!raw.to||!Number.isInteger(startMeasure)||!Number.isInteger(endMeasure)||startMeasure<1||endMeasure<startMeasure)throw Error('invalid-family-selection');return{startMeasure,endMeasure}}
  function createFamilyApplyPlan(id){const record=stateFor(project(id)),p=project(id),session=app().state.midiEditor;try{if(!record.familyPreview)throw Error('family-preview-required');if(!familyApply())throw Error('family-apply-unavailable');record.projectId=id;record.familyApplyPlan=familyApply().createPlan(record.state.workspace,record.familyPreview.variant,p,session,core(),{kinds:record.familyKinds||familyApply().DEFAULT_KINDS,measureRange:familySelection(record),metadataOnly:record.familyMetadataOnly===true,applyProjectSections:record.familyProjectSections===true});record.familyApplyPreflight=null;record.message='Family Apply Planを作成しました。まだ原本は変更していません。'}catch(error){record.familyApplyPlan=null;record.familyApplyPreflight=null;record.message=`Family Apply Plan拒否: ${error.message}`}refresh(id)}
  function preflightFamilyApply(id){const record=stateFor(project(id)),p=project(id),session=app().state.midiEditor;try{if(!record.familyApplyPlan)throw Error('family-apply-plan-required');record.familyApplyPreflight=familyApply().simulate(record.familyApplyPlan,record.state.workspace,p,session,core());record.message=record.familyApplyPreflight.ok?'Preflight PASS。Confirm前なので原本は変更していません。':`Preflight BLOCKED: ${record.familyApplyPreflight.errors.join(', ')}`}catch(error){record.familyApplyPreflight={ok:false,errors:[error.message],mutates:false};record.message=`Preflight拒否: ${error.message}`}refresh(id)}
  function confirmFamilyApply(id){const record=touch(id),p=project(id),session=app().state.midiEditor;try{if(!record.familyApplyPlan||!record.familyApplyPreflight?.ok)throw Error('family-preflight-required');const result=familyApply().applyPlan(record.familyApplyPlan,record.state.workspace,p,session,core());if(!result.applied)throw Error(result.errors?.join(', ')||result.reason||'family-apply-rejected');record.familyApplyPlan=null;record.familyApplyPreflight=null;record.familyPreview=null;record.message=`Family ${result.variant}をatomic Applyしました。Undo単位 ${result.undoUnits}。`;app().repaintEditor()}catch(error){record.message=`Family Apply拒否: ${error.message}`;refresh(id)}}
  function cancelFamilyApply(id){const record=stateFor(project(id));record.familyApplyPlan=null;record.familyApplyPreflight=null;record.message='Family Apply Planを取消しました。原本は変更していません。';refresh(id)}
  function arrangementReferenceHtml(record,candidate,session){
    const saved=record.arrangementReferencePreview;if(!saved||saved.candidateId!==candidate.candidateId)return'';
    const current=saved.workspaceSignature===JSON.stringify(record.state.workspace)&&saved.midiSignature===JSON.stringify(session.midiData)&&saved.setId===activeCandidateSet(record)?.setId;
    return`<section class="music-ai-status"><p>${current?'Arrangement references（編成参照）':'参照が変更されました。再確認してください。'}</p>${current?`<ul>${composition().arrangementReferenceRows(saved.preview).map(row=>`<li>${esc(row)}</li>`).join('')}</ul>${saved.preview.trackTargets?`<label>Destination候補（既存Role / Track）<select id="aiDestinationChoice${candidate.candidateId}" onchange="MusicStudioAIAssistantPanel.clearArrangementDestination('${esc(record.state.workspace.projectId)}')"><option value="">明示選択してください</option>${saved.preview.trackTargets.map((item,index)=>`<option value="${index+1}"${saved.destinationChoice===index+1?' selected':''}>${esc(item.role)} / ${esc(item.trackId)}</option>`).join('')}</select></label><button class="music-secondary" onclick="MusicStudioAIAssistantPanel.inspectArrangementDestination('${esc(record.state.workspace.projectId)}','${candidate.candidateId}')">Destination identityを確認</button>`:''}`:''}<button class="music-secondary" onclick="MusicStudioAIAssistantPanel.cancelArrangementReference('${esc(record.state.workspace.projectId)}')">編成参照取消</button></section>`;
  }
  function clearArrangementDestination(id){
    const record=stateFor(project(id)),saved=record.arrangementReferencePreview,verified=!!saved?.preview.destinationInspection;
    if(saved){delete saved.preview.destinationInspection;delete saved.destinationChoice}
    if(verified)record.message='Destination選択・範囲が変更されました。再確認してください。';
    // Keep the DOM choice, but immediately remove the previously verified output.
    const panel=root.document?.querySelector?.('.music-ai-panel');
    if(verified&&panel?.querySelector){const status=panel.querySelector('.music-ai-candidate-status');if(status)status.textContent=record.message}
    if(panel?.querySelectorAll)for(const row of panel.querySelectorAll('li'))if(row.textContent.startsWith('Explicit destination identity verified:'))row.remove();
  }
  function inspectArrangementDestination(id,candidateId){
    const record=stateFor(project(id)),session=app().state.midiEditor,saved=record.arrangementReferencePreview;
    try{
      if(!saved||!saved.preview.trackTargets||saved.candidateId!==candidateId)throw Error('arrangement-track-inspection-required');
      delete saved.preview.destinationInspection;delete saved.destinationChoice;
      const selection=candidateSelection(candidateId),set=activeCandidateSet(record);
      if(saved.workspaceSignature!==JSON.stringify(record.state.workspace)||saved.midiSignature!==JSON.stringify(session.midiData)||saved.setId!==set?.setId||saved.preview.timeline.range.startMeasure!==selection?.startMeasure||saved.preview.timeline.range.endMeasure!==selection?.endMeasure)throw Error('stale-arrangement-destination');
      const text=value('#aiDestinationChoice'+candidateId),choice=Number(text);
      if(!/^[1-9][0-9]*$/.test(text)||!Number.isSafeInteger(choice)||choice>saved.preview.trackTargets.length)throw Error('explicit-arrangement-destination-required');
      const candidates=set.candidates.filter(item=>item.candidateId===candidateId);
      if(candidates.length!==1)throw Error('arrangement-candidate-required');
      saved.preview=composition().arrangementDestinationPreview(candidates[0].value,record.state.workspace,session,core(),saved.preview.trackTargets[choice-1],selection);saved.destinationChoice=choice;
      record.message='Destination identityを明示確認しました。読み取り専用です。';
    }catch(error){record.message=`Destination確認拒否: ${error.message}`;record.arrangementReferencePreview=null}
    refresh(id);
  }
  function inspectArrangementTracks(id,candidateId){return inspectArrangementReference(id,candidateId,true)}
  function inspectArrangementReference(id,candidateId,inspectTracks=false){
    const record=stateFor(project(id)),session=app().state.midiEditor,set=activeCandidateSet(record);record.arrangementReferencePreview=null;
    try{
      const candidates=set?.candidates.filter(item=>item.candidateId===candidateId)||[];
      if(set?.kind!=='arrangement'||candidates.length!==1)throw Error('arrangement-candidate-required');
      const selection=candidateSelection(candidateId),preview=composition()[inspectTracks?'arrangementTrackPreview':'arrangementReferencePreview'](candidates[0].value,record.state.workspace,session,core(),selection);
      (record.candidateSelections||(record.candidateSelections={}))[candidateId]=selection;
      record.arrangementReferencePreview={candidateId,setId:set.setId,preview,workspaceSignature:JSON.stringify(record.state.workspace),midiSignature:JSON.stringify(session.midiData)};record.message='編成参照のidentityを確認しました。楽器・演奏内容は未生成です。';
    }catch(error){record.message=`編成参照拒否: ${error.message}`}
    refresh(id);
  }
  function cancelArrangementReference(id){const record=stateFor(project(id));record.arrangementReferencePreview=null;record.message='編成参照Previewを取り消しました。';refresh(id)}
  function lyricsReferenceCurrent(record,saved,session){return saved.workspaceSignature===JSON.stringify(record.state.workspace)&&saved.midiSignature===JSON.stringify(session.midiData)&&saved.lyricsSetId===activeCandidateSet(record)?.setId}
  function lyricsMelodyChoicesHtml(record,candidate,session){
    const saved=record.lyricsMelodyChoices;if(!saved||saved.candidateId!==candidate.candidateId)return'';
    if(!lyricsReferenceCurrent(record,saved,session))return`<p class="music-ai-status">参照候補が変更されました。候補を再表示してください。</p><button class="music-secondary" onclick="MusicStudioAIAssistantPanel.cancelLyricsMelody('${esc(record.state.workspace.projectId)}')">参照候補取消</button>`;
    return`<section class="music-ai-status"><label>Melody reference（参照候補）<select id="aiMelodyChoice${candidate.candidateId}" onchange="MusicStudioAIAssistantPanel.clearLyricsMelodyChoice('${esc(record.state.workspace.projectId)}','${candidate.candidateId}')"><option value="">選択してください</option>${saved.choices.choices.map((choice,index)=>`<option value="${choice.setIndex}:${choice.candidateIndex}" ${choice.error?'disabled':''} ${saved.selectedChoice===`${choice.setIndex}:${choice.candidateIndex}`?'selected':''}>${esc(`${index+1} / ${choice.setId} / ${choice.candidateId} / ${choice.summary} / ${choice.error||choice.status}`)}</option>`).join('')}</select></label><small>この選択は参照Previewのみ。歌詞や音符の割付・採用記録は変更しません。</small><button class="music-secondary" onclick="MusicStudioAIAssistantPanel.inspectSelectedLyricsMelody('${esc(record.state.workspace.projectId)}','${candidate.candidateId}')">選択したMelody参照を確認</button><button class="music-secondary" onclick="MusicStudioAIAssistantPanel.cancelLyricsMelody('${esc(record.state.workspace.projectId)}')">参照候補取消</button></section>`;
  }
  function listLyricsMelody(id,candidateId){
    const record=stateFor(project(id)),session=app().state.midiEditor,set=activeCandidateSet(record);record.lyricsMelodyPreview=null;record.arrangementReferencePreview=null;record.lyricsMelodyChoices=null;
    try{
      const candidate=set?.candidates.find(item=>item.candidateId===candidateId);if(set?.kind!=='lyrics-structure'||!candidate)throw Error('lyrics-candidate-required');
      const selection=candidateSelection(candidateId),choices=composition().lyricsMelodyReferenceChoices(candidate.value,record.state.workspace,session,core(),selection);
      (record.candidateSelections||(record.candidateSelections={}))[candidateId]=selection;
      record.lyricsMelodyChoices={candidateId,lyricsSetId:set.setId,choices,workspaceSignature:JSON.stringify(record.state.workspace),midiSignature:JSON.stringify(session.midiData)};record.message='参照候補を表示しました。明示的に選択して確認してください。';
    }catch(error){record.message=`Melody参照候補表示拒否: ${error.message}`}refresh(id);
  }
  function clearLyricsMelodyChoice(id,candidateId){const record=stateFor(project(id));record.lyricsMelodyPreview=null;if(record.lyricsMelodyChoices)record.lyricsMelodyChoices.selectedChoice=value(`#aiMelodyChoice${candidateId}`);record.message='選択した候補は確認前です。';refresh(id)}
  function inspectSelectedLyricsMelody(id,candidateId){
    const record=stateFor(project(id)),session=app().state.midiEditor,saved=record.lyricsMelodyChoices;record.lyricsMelodyPreview=null;
    try{
      if(!saved||saved.candidateId!==candidateId)throw Error('lyrics-melody-choices-required');
      if(!lyricsReferenceCurrent(record,saved,session))throw Error('stale-lyrics-melody-choice');
      const chosen=value(`#aiMelodyChoice${candidateId}`),choice=saved.choices.choices.find(item=>`${item.setIndex}:${item.candidateIndex}`===chosen);
      if(!choice)throw Error('explicit-lyrics-melody-choice-required');saved.selectedChoice=chosen;if(choice.error)throw Error(choice.error);
      inspectLyricsMelody(id,candidateId,{setIndex:choice.setIndex,candidateIndex:choice.candidateIndex,workspaceSignature:saved.workspaceSignature});return;
    }catch(error){record.message=`Melody参照選択拒否: ${error.message}`}refresh(id);
  }
  function lyricsMelodyHtml(record,candidate,session){
    const saved=record.lyricsMelodyPreview;if(!saved||saved.candidateId!==candidate.candidateId)return'';
    if(!lyricsReferenceCurrent(record,saved,session))return'<p class="music-ai-status">参照が変更されました。Melody参照を再確認してください。</p>';
    return`<section class="music-ai-status"><ul>${composition().lyricsMelodyReferenceRows(saved.preview).map(row=>`<li>${esc(row)}</li>`).join('')}</ul><button class="music-secondary" onclick="MusicStudioAIAssistantPanel.cancelLyricsMelody('${esc(record.state.workspace.projectId)}')">参照Preview取消</button></section>`;
  }
  function inspectLyricsMelody(id,candidateId,explicit=null){
    const record=stateFor(project(id)),session=app().state.midiEditor,set=activeCandidateSet(record);
    record.lyricsMelodyPreview=null;
    try{
      const candidate=set?.candidates.find(item=>item.candidateId===candidateId);if(set?.kind!=='lyrics-structure'||!candidate)throw Error('lyrics-candidate-required');
      const selection=candidateSelection(candidateId),preview=composition().lyricsMelodyReferencePreview(candidate.value,record.state.workspace,session,core(),selection,explicit);
      (record.candidateSelections||(record.candidateSelections={}))[candidateId]=selection;
      record.lyricsMelodyPreview={candidateId,lyricsSetId:set.setId,preview,workspaceSignature:JSON.stringify(record.state.workspace),midiSignature:JSON.stringify(session.midiData)};record.message='Melody参照を確認しました。音符割付は未実行です。';
    }catch(error){record.message=`Melody参照確認拒否: ${error.message}`}
    refresh(id);
  }
  function cancelLyricsMelody(id){const record=stateFor(project(id));record.arrangementReferencePreview=null;record.lyricsMelodyChoices=null;record.lyricsMelodyPreview=null;record.message='参照Previewを取り消しました。';refresh(id)}
  function previewCandidate(id,candidateId){app()?.editorStopCandidateAudition?.();const p=project(id),record=stateFor(p),session=app().state.midiEditor,set=activeCandidateSet(record),candidate=set?.candidates.find(item=>item.candidateId===candidateId);try{if(!candidate)throw Error('candidate-required');const selection=candidateSelection(candidateId);(record.candidateSelections||(record.candidateSelections={}))[candidateId]=selection;if(!materializer())throw Error('candidate-preview-unavailable');const context=composition().createContext(p,session,core());record.candidatePreview=materializer().createPreview(session,core(),candidate,{project:p,context,measureRange:['section','lyrics-structure','arrangement'].includes(set.kind)?selection:null});record.message=candidatePreviewText(record.candidatePreview)}catch(error){record.message=`候補Preview拒否: ${error.message}`;record.arrangementReferencePreview=null;record.lyricsMelodyChoices=null;record.lyricsMelodyPreview=null;record.candidatePreview=null}refresh(id)}
  async function auditionCandidate(id,candidateId){
    const p=project(id),record=stateFor(p),bundle=record.candidatePreview,session=app().state.midiEditor;
    const generation=record.auditionGeneration=(record.auditionGeneration||0)+1;
    const current=()=>states.get(id)===record&&project(id)===p&&app()?.state.midiEditor===session&&record.candidatePreview===bundle&&record.auditionGeneration===generation;
    try{
      if(!bundle||bundle.candidateId!==candidateId)throw Error('candidate-preview-required');
      const plan=materializer().auditionPlan(session,core(),bundle,candidateSelection(candidateId));
      const result=await app().editorAuditionCandidate(plan,session);
      if(!current())return;
      record.message=result.ok?`候補${candidateId}を試聴中。MIDI原本は変更していません。`:`試聴停止: ${result.reason}`;
    }catch(error){if(!current())return;record.message=`候補試聴拒否: ${error.message}`}
    if(current())refresh(id);
  }
  function applyCandidatePreview(id,candidateId){app()?.editorStopCandidateAudition?.();const record=touch(id),bundle=record.candidatePreview,session=app().state.midiEditor,previousTrack=core().currentTrackId(session);try{const selection=candidateSelection(candidateId);if(!bundle||bundle.candidateId!==candidateId)throw Error('candidate-preview-required');if(previousTrack!==bundle.targetTrackId)core().selectTrackById(session,bundle.targetTrackId);const applied=materializer().applyPreview(session,core(),bundle,selection);ui().decideCandidate(record.state,candidateId,'adopt',selection?{measures:[selection.startMeasure,selection.endMeasure],mode:'midi-preview',targetTrackId:applied.targetTrackId}:{mode:'midi-preview',targetTrackId:applied.targetTrackId});record.arrangementReferencePreview=null;record.lyricsMelodyChoices=null;record.lyricsMelodyPreview=null;record.candidatePreview=null;record.message=selection?`${selection.startMeasure}–${selection.endMeasure}小節だけを${applied.targetTrackId}へ安全にApplyしました。`:`候補${candidateId}のPreviewを${applied.targetTrackId}へ安全にApplyしました。`;app().repaintEditor()}catch(error){if(previousTrack&&core().currentTrackId(session)!==previousTrack)core().selectTrackById(session,previousTrack);record.message=`候補Apply拒否: ${error.message}`;refresh(id)}}
  function cancelCandidatePreview(id){app()?.editorStopCandidateAudition?.();const record=stateFor(project(id));record.arrangementReferencePreview=null;record.lyricsMelodyChoices=null;record.lyricsMelodyPreview=null;record.candidatePreview=null;record.message='候補Previewを取り消しました。原本は変更していません。';refresh(id)}
  function decideCandidate(id,candidateId,decision){app()?.editorStopCandidateAudition?.();const record=touch(id);try{const selection=candidateSelection(candidateId),set=activeCandidateSet(record);if(decision==='adopt'&&['lyrics-structure','arrangement'].includes(set?.kind)){const candidate=set.candidates.find(item=>item.candidateId===candidateId);materializer().createPreview(app().state.midiEditor,core(),candidate,{project:project(id),measureRange:selection})}ui().decideCandidate(record.state,candidateId,decision,selection?{measures:[selection.startMeasure,selection.endMeasure]}:null);record.arrangementReferencePreview=null;record.lyricsMelodyChoices=null;record.lyricsMelodyPreview=null;record.candidatePreview=null;record.message=selection&&decision==='adopt'?`${selection.startMeasure}–${selection.endMeasure}小節だけを採用記録しました。`:`候補${candidateId}を${decision==='adopt'?'採用':'却下'}しました。`}catch(error){record.message=`候補判断拒否: ${error.message}`}refresh(id)}
  function workspaceForSave(project,revision){const record=states.get(project.projectId);if(!record?.state)return project.aiWorkspace?clone(project.aiWorkspace):null;return ui().workspaceForRevision(record.state,project.projectId,revision)}
  function workspaceContent(value){const result=clone(value);delete result.baseRevision;delete result.updatedAt;return JSON.stringify(result)}
  function markSaved(project,expectedWorkspace){const record=states.get(project.projectId);if(record){const workspace=record.state.workspace,changed=expectedWorkspace&&workspaceContent(workspace)!==workspaceContent(expectedWorkspace);if(changed){workspace.baseRevision=project.revision;record.pending=true}else{const next=ui().createState(project,{workspace:project.aiWorkspace});for(const key of Object.keys(workspace))delete workspace[key];Object.assign(workspace,next.workspace);next.workspace=workspace;record.state=next;record.pending=false}record.revision=project.revision;record.familyApplyPlan=null;record.familyApplyPreflight=null;record.familyPreview=null;record.arrangementReferencePreview=null;record.lyricsMelodyChoices=null;record.lyricsMelodyPreview=null;record.candidatePreview=null}}
  function historyChanged(id){const record=states.get(id);if(record?.state){record.pending=true;record.familyApplyPlan=null;record.familyApplyPreflight=null;record.familyPreview=null;record.arrangementReferencePreview=null;record.lyricsMelodyChoices=null;record.lyricsMelodyPreview=null;record.candidatePreview=null;record.message='MIDIとFamily採用metadataをEditor履歴から復元しました。'}}
  root.MusicStudioAIAssistantPanel={generateLocalModel,importMidiCandidates,editCandidate,auditionCandidate,captureGeneration,render,closeOnEscape,captureNoteReview,selectAllNotes,setTab(id,tab){app()?.editorStopCandidateAudition?.();captureNoteReview(id);tabs.set(id,tab);refresh(id)},previewEdit,applyEdit,rejectEdit,previewSong,confirmSong,generateCandidates,generateFamilyCandidates,previewFamily,selectFamilyComponents,createFamilyApplyPlan,preflightFamilyApply,confirmFamilyApply,cancelFamilyApply,clearArrangementDestination,inspectArrangementDestination,inspectArrangementTracks,inspectArrangementReference,cancelArrangementReference,listLyricsMelody,clearLyricsMelodyChoice,inspectSelectedLyricsMelody,inspectLyricsMelody,cancelLyricsMelody,previewCandidate,applyCandidatePreview,cancelCandidatePreview,decideCandidate,hasPending(id){return states.get(id)?.pending===true},workspaceForSave,markSaved,historyChanged,_states:states,_candidateValues:candidateValues};
})(typeof window!=='undefined'?window:globalThis);
