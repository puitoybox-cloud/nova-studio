(() => {
  'use strict';

  const waitForBridge = setInterval(() => {
    if (!window.NovaGeminiBridge) return;
    clearInterval(waitForBridge);
    installEnhancement();
  }, 120);

  function installEnhancement() {
    const originalOpen = window.NovaGeminiBridge.open;
    const originalBuild = window.NovaGeminiBridge.buildPrompt;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const project = () => typeof currentProject === 'function' ? currentProject() : null;
    const episode = () => typeof currentEpisode === 'function' ? currentEpisode() : null;
    const items = name => (window.state?.[name] || []).filter(item => !item.isArchived && (!project()?.id || !item.projectId || item.projectId === project().id));

    function optionList(list, label) {
      return list.map(item => `<option value="${esc(item.id)}">${esc(item.title || item.name || item.numberLabel || label)}</option>`).join('');
    }

    function selectedById(collection, id) {
      return (window.state?.[collection] || []).find(item => item.id === id) || null;
    }

    function imageReferenceSummary(card) {
      const images = Array.isArray(card?.images) ? card.images : [];
      if (!images.length) return '- 参照画像なし';
      return images.slice(0, 10).map((img, index) => {
        const flags = [img.isOfficial || img.state === '正式採用' ? '正式採用' : '', img.isViduReference ? 'Vidu参照' : ''].filter(Boolean).join('・');
        return `- 画像${index + 1}: ${img.name || img.title || img.filename || '名称未設定'}${img.type ? ` / 種類:${img.type}` : ''}${img.angle ? ` / 角度:${img.angle}` : ''}${flags ? ` / ${flags}` : ''}`;
      }).join('\n');
    }

    function buildAdvancedPrompt() {
      const baseMode = document.querySelector('#geminiMode')?.value || 'image';
      const request = document.querySelector('#geminiRequest')?.value || '';
      const ratio = document.querySelector('#geminiAspect')?.value || '16:9';
      const style = document.querySelector('#geminiStyle')?.value || 'アニメ塗り（自然なグラデーション）';
      const negative = document.querySelector('#geminiNegative')?.value || '';
      const character = selectedById('characters', document.querySelector('#geminiCharacter')?.value || '');
      const card = selectedById('storyArchiveCards', document.querySelector('#geminiArchiveCard')?.value || '');
      const settings = {
        includeProject: Boolean(document.querySelector('#includeProject')?.checked),
        includeEpisode: Boolean(document.querySelector('#includeEpisode')?.checked),
        includeCharacters: Boolean(document.querySelector('#includeCharacters')?.checked),
        includeWorld: Boolean(document.querySelector('#includeWorld')?.checked),
        includeStoryArchive: Boolean(document.querySelector('#includeStoryArchive')?.checked)
      };
      const base = originalBuild(baseMode, request, settings);
      const focus = [
        '',
        '【今回の生成条件】',
        `- 画面比率: ${ratio}`,
        `- 表現スタイル: ${style}`,
        character ? `- 主役キャラクター: ${character.title || character.name}\n  ${character.body || character.description || character.personality || ''}` : '- 主役キャラクター: 指定なし',
        card ? `- 使用するStory Archiveカード: ${card.title || '無題'}\n  ${card.body || ''}` : '- Story Archiveカード: 指定なし',
        card ? `【参照画像チェックリスト】\n${imageReferenceSummary(card)}` : '',
        negative ? `【避ける内容】\n${negative}` : '',
        '',
        '【Geminiへの最終指示】',
        '- 固定設定と今回だけ変更する要素を分ける',
        '- 添付すべき参照画像がある場合は、上のチェックリストに沿ってユーザーへ案内する',
        '- 完成プロンプトは日本語版を先に、その後に英語版も出す',
        '- Vidu用の場合は静止画生成用と動画化用を分ける'
      ].filter(Boolean).join('\n');
      return `${base}\n${focus}`;
    }

    function enhancePanel() {
      const root = document.querySelector('.gemini-bridge');
      if (!root || root.dataset.enhanced) return;
      root.dataset.enhanced = 'true';
      const requestLabel = document.querySelector('#geminiRequest')?.closest('label');
      if (!requestLabel) return;
      const advanced = document.createElement('section');
      advanced.className = 'gemini-advanced';
      advanced.innerHTML = `
        <div class="gemini-advanced__grid">
          <label>主役キャラクター<select id="geminiCharacter"><option value="">指定なし</option>${optionList(items('characters'), 'キャラクター')}</select></label>
          <label>Story Archiveカード<select id="geminiArchiveCard"><option value="">指定なし</option>${optionList(items('storyArchiveCards'), 'カード')}</select></label>
          <label>画面比率<select id="geminiAspect"><option>16:9</option><option>9:16</option><option>1:1</option><option>4:3</option><option>3:2</option></select></label>
          <label>表現スタイル<select id="geminiStyle"><option>アニメ塗り（自然なグラデーション）</option><option>繊細なアニメ映画風</option><option>幻想的な光表現</option><option>シンプルな白背景</option><option>実写的</option></select></label>
        </div>
        <label>避ける内容・絶対に変えないこと<textarea id="geminiNegative" rows="4" placeholder="例：猫耳を動かさない、衣装を変更しない、文字を入れない"></textarea></label>
        <label>完成プロンプト（編集できます）<textarea id="geminiFinalPrompt" rows="14"></textarea></label>
        <div class="gemini-advanced__actions"><button id="geminiGeneratePreview" type="button">完成プロンプトを作る</button><button id="geminiCopyFinal" type="button">完成版をコピー</button><button id="geminiOpenFinal" type="button" class="primary-action">コピーしてGeminiを開く</button></div>
        <p class="meta">参照画像そのものは自動送信しません。Geminiを開いた後、チェックリストにある画像を手動で添付してください。</p>`;
      requestLabel.insertAdjacentElement('afterend', advanced);

      const finalArea = document.querySelector('#geminiFinalPrompt');
      const refresh = () => { if (finalArea) finalArea.value = buildAdvancedPrompt(); };
      document.querySelector('#geminiGeneratePreview')?.addEventListener('click', refresh);
      document.querySelector('#geminiCharacter')?.addEventListener('change', refresh);
      document.querySelector('#geminiArchiveCard')?.addEventListener('change', refresh);
      document.querySelector('#geminiAspect')?.addEventListener('change', refresh);
      document.querySelector('#geminiStyle')?.addEventListener('change', refresh);
      refresh();

      const copy = async open => {
        const text = finalArea?.value || buildAdvancedPrompt();
        try {
          await navigator.clipboard.writeText(text);
        } catch (_) {
          finalArea?.focus(); finalArea?.select(); document.execCommand('copy');
        }
        if (open) window.open('https://gemini.google.com/app', '_blank', 'noopener,noreferrer');
      };
      document.querySelector('#geminiCopyFinal')?.addEventListener('click', () => copy(false));
      document.querySelector('#geminiOpenFinal')?.addEventListener('click', () => copy(true));
    }

    window.NovaGeminiBridge.open = function() {
      originalOpen();
      setTimeout(enhancePanel, 0);
    };
  }
})();
