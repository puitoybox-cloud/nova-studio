const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function verify() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE,
    args: ['--no-sandbox']
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto(process.env.MUSIC_STUDIO_URL || 'http://127.0.0.1:8765/music-studio.html');
    await page.waitForFunction(() => window.MusicStudio?.state.loaded);
    await page.evaluate(() => MusicStudio.goSettings());
    const voice = page.locator('#ms-setting-managed-voices');
    const billing = page.locator('#ms-setting-managed-billing');
    await voice.getByLabel('モデル名').fill('本人声テスト');
    await voice.getByLabel('モデル識別子').fill('local-voice-fixture');
    await voice.getByRole('button', {name: 'モデルを登録'}).click();
    const model = voice.locator('details').first();
    await model.locator('summary').click();
    await model.getByLabel('同意の証跡').fill('consent-fixture-01');
    await model.getByLabel('生成', {exact: true}).check();
    await model.getByLabel('本人の明示同意と上記の許諾範囲を確認した').check();
    await model.getByRole('button', {name: '同意を記録'}).click();
    await page.waitForFunction(() => MusicStudio.state.settings.productionManagement.models[0]?.consent);
    const oldSettings = await page.evaluate(() => JSON.stringify(MusicStudio.state.settings));
    const permission = () => page.evaluate(() => {
      const id = MusicStudio.state.settings.productionManagement.models[0].id;
      return ['train', 'generate'].map(scope => MusicStudio.managedVoicePermission(id, scope));
    });
    assert.deepEqual(await permission(), [false, true]);
    if (!(await model.locator('summary').evaluate(el => el.parentElement.open))) await model.locator('summary').click();
    await model.getByRole('button', {name: '同意を撤回'}).click();
    await page.waitForFunction(() => MusicStudio.state.settings.productionManagement.revocations.length === 1);
    assert.deepEqual(await permission(), [false, false]);
    const restore = await page.evaluate(text => MusicStudio.importSettingsText(text), oldSettings);
    assert.equal(restore.ok, true);
    assert.deepEqual(await permission(), [false, false]);

    await billing.getByLabel('テストプロバイダーの単価（円／回）').fill('4');
    await billing.getByLabel('テスト月額上限（円）').fill('8');
    await billing.getByLabel('作曲', {exact: true}).selectOption('test-provider');
    await billing.getByRole('button', {name: '料金と機能別設定を保存'}).click();
    await page.waitForFunction(() => MusicStudio.state.settings.productionManagement.billing.limit === 8);
    const quote = () => billing.getByRole('button', {name: 'テスト料金を見積もる'}).click();
    const approve = () => billing.getByRole('button', {name: '見積もりを承認して試す'}).click();
    const waitHistory = size => page.waitForFunction(n =>
      MusicStudio.state.settings.productionManagement.billing.history.length === n, size);
    await quote();
    await approve();
    await waitHistory(1);
    await billing.getByLabel('テスト応答').selectOption('failed');
    await quote();
    await approve();
    await waitHistory(2);
    await quote();
    await billing.getByRole('button', {name: '取り消す', exact: true}).click();
    await waitHistory(3);
    await quote();
    await approve();
    await waitHistory(4);
    await quote();
    await approve();
    await page.getByText('月額上限を超えるため実行できません。').waitFor();
    await page.reload();
    await page.waitForFunction(() => window.MusicStudio?.state.loaded);
    assert.deepEqual(await permission(), [false, false]);
    const history = await page.evaluate(() => MusicStudio.state.settings.productionManagement.billing.history);
    assert.deepEqual(history.map(entry => [entry.outcome, entry.amount]), [
      ['completed', 4], ['failed', 0], ['cancelled', 0], ['completed', 4]
    ]);
    assert.equal(new Set(history.map(entry => entry.id)).size, history.length);
    assert.deepEqual(errors, []);
    console.log('Chromium: consent scopes, revocation across restore/reload, quoting, success, failure, cancellation and monthly cap verified');
  } finally {
    await browser.close();
  }
}

verify().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
