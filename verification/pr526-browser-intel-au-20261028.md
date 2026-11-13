# PR #526: 1180×820 と Intel AU 調査

- 基準: `49ab54763054f1ad442160748c17b08264b77757`
- 2026-10-28、ローカルの実ブラウザで表示領域を 1180×820 に設定し、既存の確認用プロジェクトから Export と Vocal を開いた。いずれも初期状態の主要操作は画面内に表示され、ドキュメントの表示・スクロール寸法は 1180×820。Export は Stem Auto-Finish を閉じた状態で Preview、History、Delivery まで見えた。ブラウザのコンソールエラーは確認されなかった。折りたたみを開いた状態や音声処理の実行はこの確認の範囲外。
- PR #526 の HEAD に対する GitHub の表示チェックは instrument-core と intel-inventory が成功。Intel AU 実機バイナリのワークフローはこの HEAD では実行されていない。
- 直前の `e19b8f93157ae2e7750fa6004ae2948100e113d0` の [Intel AU 実行](https://github.com/puitoybox-cloud/nova-studio/actions/runs/40626396243) は、Native AU view whole-song launch の `native controller grammar-only preflight` で失敗。テストは成功時のコールバックと応答内容をまとめて検査するが、失敗時に `offlineSummary` を出力していないため、ログだけでは失敗の具体的な理由を判別できない。
- 取得した実行成果物の `whole-ui` には request と音声だけがあり、bridge の結果・エラーログはない。これは起動前の検証失敗と整合するが、原因を確定しない。ダウンロードされた ZIP は隠しファイルを含まず、署名対象の `.empty` が欠落しているため、展開物の署名検証失敗を元の CI 失敗の証拠にはできない。
- AU 関連コードとワークフローは上記失敗コミットから基準 HEAD まで差分なし。原因が確定していないため、製品・CI コードの修正は行っていない。次回は失敗時の `offlineSummary` と、存在すれば bridge error log を記録した上で Intel 環境で再現する必要がある。
- 関連 Node テスト: `node --test tests/music-studio-auto-finish.test.js tests/music-production-tabs.test.js tests/music-nova-au-instructions.test.js tests/music-logic-instruments.test.js` — 48 件成功。Intel AU の完全な CI はローカルでは再実行していない。
