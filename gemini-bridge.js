(() => {
  'use strict';

  const STORAGE_KEY = 'novaStudio.geminiBridge.v1';
  const DEFAULT_SETTINGS = {
    geminiUrl: 'https://gemini.google.com/app',
    includeProject: true,
    includeEpisode: true,
    includeCharacters: true,
    includeWorld: true,
    includeStoryArchive: true,
    lastMode: 'image'
  };

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  function loadSettings() {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
    } catch (_) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(next) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function selectedProject() {
    try {
      if (typeof currentProject === 'function') return currentProject();
      return state?.projects?.find(item => item.id === state?.activeContext?.projectId) || null;
    } catch (_) {
      return null;
    }
  }

  function selectedEpisode() {
    try {
      if (typeof currentEpisode === 'function') return currentEpisode();
      return state?.episodes?.find(item => item.id === state?.activeContext?.episodeId) || null;
    } catch (_) {
      return null;
    }
  }

  function listForProject(collection, projectId, episodeId = '') {
    try {
      return (state?.[collection] || []).filter(item => {
        if (item.isArchived) return false;
        if (projectId && item.projectId && item.projectId !== projectId) return false;
        if (episodeId && item.episodeId && item.episodeId !== episodeId) return false;
        return true;
      });
    } catch (_) {
      return [];
    }
  }

  function compactItem(item) {
    const title = item.title || item.name || item.numberLabel || item.id || '名称未設定';
    const body = item.body || item.description || item.summary || item.notes || item.personality || '';
    const tags = Array.isArray(item.tags) ? item.tags.join('、') : (item.tags || '');
    return `- ${title}${tags ? `（タグ：${tags}）` : ''}${body ? `\n  ${String(body).slice(0, 500)}` : ''}`;
  }

  function buildContext(settings) {
    const project = selectedProject();
    const episode = selectedEpisode();
    const projectId = project?.id || '';
    const episodeId = episode?.id || '';
    const sections = [];

    if (settings.includeProject) {
      sections.push(`【作品】\n${project ? compactItem(project) : '- 未選択'}`);
    }
    if (settings.includeEpisode) {
      sections.push(`【話数】\n${episode ? compactItem(episode) : '- 未選択'}`);
    }
    if (settings.includeCharacters) {
      const items = listForProject('characters', projectId, episodeId).slice(0, 20);
      sections.push(`【キャラクター】\n${items.length ? items.map(compactItem).join('\n') : '- 登録なし'}`);
    }
    if (settings.includeWorld) {
      const worlds = listForProject('worlds', projectId).slice(0, 12);
      const terms = listForProject('terms', projectId).slice(0, 12);
      sections.push(`【世界観・用語】\n${[...worlds, ...terms].length ? [...worlds, ...terms].map(compactItem).join('\n') : '- 登録なし'}`);
    }
    if (settings.includeStoryArchive) {
      const cards = listForProject('storyArchiveCards', projectId, episodeId).slice(0, 20);
      sections.push(`【Story Archive】\n${cards.length ? cards.map(compactItem).join('\n') : '- 登録なし'}`);
    }

    return sections.join('\n\n');
  }

  const modeInstructions = {
    image: 'Geminiで画像生成に使える、具体的で一貫性の高い日本語プロンプトを作成してください。構図、表情、衣装、背景、光、画角、除外事項を整理してください。',
    character: '既存キャラクターの外見と設定を崩さず、画像間の一貫性を最優先した日本語プロンプトを作成してください。固定要素と今回だけ変える要素を分けてください。',
    vidu: 'Viduへ渡す画像・動画制作を想定し、開始フレーム、動作、カメラ、背景、表情、禁止事項が明確な日本語プロンプトを作成してください。',
    consult: '以下の作品設定を根拠に、矛盾を避けながら制作案を複数提案してください。確定設定と提案を明確に分けてください。'
  };

  function buildPrompt(mode, request, settings) {
    const context = buildContext(settings);
    return [
      'あなたはNova Studioの制作支援AIです。',
      modeInstructions[mode] || modeInstructions.image,
      '',
      '【今回の依頼】',
      request.trim() || '現在選択中の作品情報を使い、次に制作すべき内容を提案してください。',
      '',
      context,
      '',
      '【出力ルール】',
      '- 日本語で出力する',
      '- 登録済み設定を勝手に変更しない',
      '- 不明点は推測と明記する',
      '- そのままコピーして使える完成プロンプトを最後にまとめる'
    ].join('\n');
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }

  function notify(message) {
    const toast = document.querySelector('#toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2200);
    }
  }

  function panelHtml() {
    const settings = loadSettings();
    const context = buildContext(settings);
    return `
      <section class="gemini-bridge" aria-labelledby="geminiBridgeTitle">
        <div class="gemini-bridge__hero">
          <div><p class="eyebrow">AI Connection</p><h2 id="geminiBridgeTitle">Gemini連携</h2></div>
          <span class="gemini-bridge__badge">安全なコピー連携</span>
        </div>
        <p>Nova Studioの選択中データからプロンプトを作り、クリップボードへコピーしてGeminiを開きます。APIキーは保存しません。</p>
        <label>用途
          <select id="geminiMode">
            <option value="image" ${settings.lastMode === 'image' ? 'selected' : ''}>画像生成プロンプト</option>
            <option value="character" ${settings.lastMode === 'character' ? 'selected' : ''}>キャラクター一貫性</option>
            <option value="vidu" ${settings.lastMode === 'vidu' ? 'selected' : ''}>Vidu用プロンプト</option>
            <option value="consult" ${settings.lastMode === 'consult' ? 'selected' : ''}>制作相談</option>
          </select>
        </label>
        <label>今回Geminiに頼みたいこと
          <textarea id="geminiRequest" rows="6" placeholder="例：ティアが白い空間で目を開く場面。16:9、アニメ塗り、余白を広く。"></textarea>
        </label>
        <details open>
          <summary>Geminiへ渡す情報</summary>
          <div class="gemini-bridge__checks">
            ${checkbox('includeProject', '作品', settings.includeProject)}
            ${checkbox('includeEpisode', '話数', settings.includeEpisode)}
            ${checkbox('includeCharacters', 'キャラクター', settings.includeCharacters)}
            ${checkbox('includeWorld', '世界観・用語', settings.includeWorld)}
            ${checkbox('includeStoryArchive', 'Story Archive', settings.includeStoryArchive)}
          </div>
          <pre class="gemini-bridge__preview">${escapeHtml(context || '選択中の情報はありません。')}</pre>
        </details>
        <details>
          <summary>接続設定</summary>
          <label>Gemini URL<input id="geminiUrl" value="${escapeHtml(settings.geminiUrl)}" inputmode="url"></label>
        </details>
        <div class="gemini-bridge__actions">
          <button id="geminiCopy">プロンプトをコピー</button>
          <button id="geminiOpen" class="primary-action">コピーしてGeminiを開く</button>
        </div>
        <p class="meta">Gemini側へ自動送信はしません。内容を確認してからGeminiの入力欄へ貼り付けてください。</p>
      </section>`;
  }

  function checkbox(id, label, checked) {
    return `<label class="gemini-bridge__check"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>${label}</label>`;
  }

  function readFormSettings() {
    const old = loadSettings();
    return {
      ...old,
      geminiUrl: document.querySelector('#geminiUrl')?.value.trim() || DEFAULT_SETTINGS.geminiUrl,
      includeProject: Boolean(document.querySelector('#includeProject')?.checked),
      includeEpisode: Boolean(document.querySelector('#includeEpisode')?.checked),
      includeCharacters: Boolean(document.querySelector('#includeCharacters')?.checked),
      includeWorld: Boolean(document.querySelector('#includeWorld')?.checked),
      includeStoryArchive: Boolean(document.querySelector('#includeStoryArchive')?.checked),
      lastMode: document.querySelector('#geminiMode')?.value || 'image'
    };
  }

  function openPanel() {
    if (typeof modal === 'function') {
      modal(panelHtml());
    } else {
      const fallback = document.createElement('div');
      fallback.className = 'gemini-bridge-fallback';
      fallback.innerHTML = `<div class="gemini-bridge-fallback__box"><button data-close>✕ 閉じる</button>${panelHtml()}</div>`;
      document.body.appendChild(fallback);
      fallback.querySelector('[data-close]').onclick = () => fallback.remove();
    }
    bindPanel();
  }

  function bindPanel() {
    const updatePreview = () => {
      const settings = readFormSettings();
      saveSettings(settings);
      const preview = document.querySelector('.gemini-bridge__preview');
      if (preview) preview.textContent = buildContext(settings) || '選択中の情報はありません。';
    };
    document.querySelectorAll('.gemini-bridge input, .gemini-bridge select').forEach(el => el.addEventListener('change', updatePreview));

    const perform = async openAfter => {
      const settings = readFormSettings();
      saveSettings(settings);
      const mode = document.querySelector('#geminiMode')?.value || 'image';
      const request = document.querySelector('#geminiRequest')?.value || '';
      const prompt = buildPrompt(mode, request, settings);
      try {
        await copyText(prompt);
        notify('Gemini用プロンプトをコピーしました');
        if (openAfter) window.open(settings.geminiUrl, '_blank', 'noopener,noreferrer');
      } catch (_) {
        notify('コピーできませんでした。ブラウザの許可を確認してください');
      }
    };

    document.querySelector('#geminiCopy')?.addEventListener('click', () => perform(false));
    document.querySelector('#geminiOpen')?.addEventListener('click', () => perform(true));
  }

  function injectButtons() {
    const header = document.querySelector('header');
    if (header && !header.querySelector('[data-gemini-bridge]')) {
      const button = document.createElement('button');
      button.dataset.geminiBridge = 'header';
      button.textContent = '✨ Gemini';
      button.addEventListener('click', openPanel);
      const settingsButton = [...header.querySelectorAll('button')].find(btn => btn.textContent.includes('設定'));
      header.insertBefore(button, settingsButton || null);
    }

    const nav = document.querySelector('nav');
    if (nav && !nav.querySelector('[data-gemini-bridge]')) {
      const button = document.createElement('button');
      button.dataset.geminiBridge = 'nav';
      button.textContent = '✨ Gemini連携';
      button.addEventListener('click', openPanel);
      nav.appendChild(button);
    }

    const bottom = document.querySelector('.bottom');
    if (bottom && !bottom.querySelector('[data-gemini-bridge]')) {
      const button = document.createElement('button');
      button.dataset.geminiBridge = 'bottom';
      button.textContent = 'Gemini';
      button.addEventListener('click', openPanel);
      bottom.appendChild(button);
    }
  }

  const observer = new MutationObserver(injectButtons);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', injectButtons);
  injectButtons();

  window.NovaGeminiBridge = { open: openPanel, buildPrompt };
})();
