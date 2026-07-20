# Dream Architect Studio ロードマップ

Dream Architect Studioは、用途別の制作アプリをまとめる制作室である。作品・設定・素材・記憶を管理するNova Studioとは役割を分け、既存アプリを作り直したり、一つの複雑な画面へ混在させたりしない。

状態：✅ 利用可能 / 🟣 優先制作 / 🟡 連携準備中 / ⬜ 未実装 / 🔵 確認待ち

| 制作アプリ | 状態 | 優先順位 | 入口・方針 |
| --- | --- | --- | --- |
| 音楽制作 | 🟣 優先制作 | 1 | 既存Music Studioを安全に利用。Logic Pro連携は今回対象外 |
| MIDI Composer | 🟣 優先制作 | 1 | 既存Music Studioの試作を利用 |
| 歌詞・音符割付 | ✅ 既存アプリあり | 1 | 既存Music Studioの歌詞変換・割付を利用 |
| ボイス制作 | ⬜ 未実装 | 3 | 共通準備中画面 |
| 画像制作 | 🟡 連携準備中 | 2 | 共通準備中画面 |
| 漫画制作 | ⬜ 未実装 | 3 | 共通準備中画面 |
| LINEスタンプ制作 | ⬜ 未実装 | 3 | 共通準備中画面 |
| AIアニメ制作 | ✅ 既存アプリあり | 2 | Production Dashboardを利用 |
| Viduプロンプト作成 | ✅ 既存アプリあり | 2 | Prompt Studioを利用 |
| 動画制作 | 🟡 連携準備中 | 3 | 共通準備中画面 |
| ホームページ制作 | ⬜ 未実装 | 3 | 共通準備中画面 |
| プロンプト管理 | 🟡 連携準備中 | 3 | 共通準備中画面 |
| 今後追加する制作アプリ | 🔵 確認待ち | 4 | 追加候補と接続仕様を確認 |

## Music Studio 正式ロードマップ Version 1.0

| 作業番号 | 状態 | 結果 |
| --- | --- | --- |
| MS-00 | ✅ 完成 | 制作方針と優先順位を確定 |
| MS-00A | 🔵 ティア確認待ち | 独立リポジトリを正本とし、Dream Architect Studio / Nova Studioは入口とアダプターに限定する設計を作成 |
| MS-00B | 🔵 ティア確認待ち | 専用保存領域、Version 1プロジェクト契約、旧Version 4互換、確認型handoffを設計 |
| MS-00C | 🔵 ティア確認待ち | 製品設定、feature ID、ライセンス台帳、販売ビルド除外基準を設計 |
| MS-01 | ⬜ 未着手 | MS-00A〜MS-00C確認後にMusic Studio単体ホームを実装 |

設計記録：

- `docs/music-studio/MS-00_FOUNDATION_DESIGN.md`
- `docs/music-studio/MS-00B_PROJECT_DATA_CONTRACT.md`
- `docs/music-studio/MS-00C_LICENSE_REGISTER.md`

## Nova Studioとの関係

- Nova Studioは作品、話数、設定、素材、記憶と保存を管理する本部。
- Dream Architect Studioは制作アプリの状態と入口を示す制作室。
- `novaStudio_dreamArchitectLink_v2` を優先して読み、旧v1を互換読込する。
- 制作結果は `novaStudio_dreamArchitectResults_v1` の候補件数だけを表示し、自動登録・正式採用しない。
- `novaStudio_v01` と既存バックアップJSONは変更しない。

## 次の正式作業

1. ティアがMac・iPad実機でホーム、13入口、戻る導線を受入確認する。
2. ティアがMS-00A〜MS-00Cの3つの設計判断を確認する。
3. 確認後、独立Music StudioリポジトリでMS-01ホームと仮ページを実装する。
4. Logic Pro周辺はファイル受渡し、起動方式、保存責務を先に設計し、自動接続は別作業とする。
5. URL未設定の既存外部アプリは接続先を正式確認してから登録する。

最終更新日：2026-07-20
