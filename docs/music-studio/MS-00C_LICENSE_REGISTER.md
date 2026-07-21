# Music Studio ライセンス・素材台帳

作業番号：MS-00C

状態：🔵 ティア確認待ち

最終更新日：2026-07-20

販売ビルドへ含めてよいのは、商用利用と再配布条件を確認済みの項目だけとする。`未確認` は許可を意味しない。

| ID | 対象 | 種類 | 出所 | 現在の判定 | Music Studioへの扱い |
| --- | --- | --- | --- | --- | --- |
| MS-LIC-001 | `ai-music-helper` のHTML / CSS / JavaScript | 既存コード | `puitoybox-cloud/ai-music-helper` | 未確認（LICENSEなし） | コピーしない。権利確認後に移植判断 |
| MS-LIC-002 | `nova-studio` の連携コード | 既存コード | `puitoybox-cloud/nova-studio` | 未確認（LICENSEなし） | 契約を参考にし、直接コピーは権利確認後 |
| MS-LIC-003 | Nova / Tia画像と背景画像 | 画像素材 | `puitoybox-cloud/nova-studio` | 未確認 | Music Studioへ同梱しない |
| MS-LIC-004 | ブラウザ標準API | プラットフォームAPI | Web Audio、File、IndexedDB等 | ライブラリ同梱なし | 利用可。対応ブラウザを記録 |
| MS-LIC-005 | MIDI / 音声のテスト素材 | 制作素材 | 未選定 | 未確認 | 自作または明示許諾済み素材だけ採用 |
| MS-LIC-006 | MS-03 / MS-03N設定・保存・バックアップ | 自作コード | `nova-studio` Music Studio専用実装 | 第三者ライブラリ追加なし | ブラウザ標準APIだけを使用。外部素材を追加しない |

## 新規登録テンプレート

```text
ID:
名称:
種類:
ファイル / パッケージ:
版:
出所URL:
作者・権利者:
ライセンス:
商用利用:
改変:
再配布:
表示・NOTICE義務:
取得日:
証跡保存先:
対象エディション:
checksum:
判定: approved / restricted / rejected / unknown
確認者:
備考:
```

## 販売前の機械的チェック対象

- 依存関係lockfileから第三者パッケージ一覧を生成する。
- `public/`、サンプル、フォント、MIDI、音声を台帳と照合する。
- `unknown`、`non-commercial`、`no-redistribution` を販売ビルドから除外する。
- 必要なライセンス本文とNOTICEを配布物へ含める。
- 無料版・有料版・セット版で同梱物が異なる場合はエディションごとに再確認する。
