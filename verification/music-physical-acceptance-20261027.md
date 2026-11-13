# 10月27日 Intel Mac / Logic Pro 実機確認票

準備確認日：2026-10-26 JST。結論：導入前の読み取り検査から開始可能。ユーザー環境への導入可否とLogic成功は未確認。

## 回収・保護

- 残存する#513作業環境はクリーン。HEAD 5e741a817281ee6f277b959b02ad60a72027736f。GitHubの同ブランチ・PR headと一致。未保存変更・当該ブランチの未プッシュコミットなし。
- reflogと到達不能オブジェクトを確認。当該checkoutに回収対象は見つからなかった。停止した別環境にしか存在しなかった内容は確認できません。
- 他の残存checkoutは変更しない。旧#508 checkoutには代替object path欠落と未追跡画像一時ファイルがある。破棄・復元・統合していない。
- #510 27bfc24a013fa5377821fc30791ea9270882bcc4、#513、main 552d56eafddfd192970c09f7d6278696cf8775c3を変更しない。機能コード変更なし。

## 使用する固定配布物

[安定版Intelパッケージ](https://github.com/puitoybox-cloud/nova-studio/actions/runs/40189894661/artifacts/12598112157)

ZIP：53,915,236 bytes。SHA-256：
`6d351b3124eeeabcebdab514a330852f72b385f3f02e1ee321d0b6995e9713ae`

ZIP内の単一 `NOVA-Mix-Intel-development.tar.gz` を使用する。
TAR：48,788,368 bytes。SHA-256：
`68dfafdf3d87c5e5142a428fc78409bac41fcf834d128e10ff93f6fa581c718e`

今回ZIPを取得してCRC・両ハッシュ一致を確認。TARの絶対パス/親参照/リンクなし。
runtime全2,822ファイルの集合・サイズ・ハッシュ・実行属性一致。Mach-Oヘッダ36個はx86_64。
これはLinuxでのアーカイブ検査でありMac実行の代替ではない。

## 検証の出典と範囲

- [#510固定HEAD Intel CI](https://github.com/puitoybox-cloud/nova-studio/actions/runs/40189894661)：2/2 SUCCESS。ビルド、AudioComponent実音声処理、package-only runtime、Swift、保存復元経路が成功。
- 同成果物のauval.txtを取得：AU VALIDATION SUCCEEDED、WARNING行0。IntelログでSwift 107 tests / 0 failuresを確認。
- host-measurements.txt：実AU Gain/EQ、承認/Undo、インスタンス分離、状態保存テストPASS。Logic not tested。
- contained/result.json：PATH /nonexistent、空白を含む移動先で実行。欠落・破損・版違いを拒否。physicalLogic:false、publicationEligible:false。
- [#513固定HEAD CI](https://github.com/puitoybox-cloud/nova-studio/actions/runs/40271889584)：2/2 SUCCESS。今回ローカルnode --test 2614/2614、追跡JS262本node --check、git diff --check成功。
- 今回Apple AU/SwiftをLinux上で再実行したとは主張しない。Live Provider API呼び出しなし。一般GitHub取得通信とは区別する。

## 10月27日の順序と判定

全行を「成功 / 失敗 / 未実施」で記録。未実施を成功として扱わない。

|順|操作|成功条件・停止条件|結果|
|---|---|---|---|
|1|このMacについて・Logic Proについて|正確な版、Intel CPUを記録|未実施|
|2|制作物・外部音声をFinderで別場所にコピー|原本と別パス、コピーが開ける|未実施|
|3|ZIPとTARを照合、新規フォルダへTAR展開|上記SHA-256一致。ZIP内componentを直接使用しない|未実施|
|4|同梱INSTALL-JA.mdに従いprepare-install.py|manualInstallationAllowed:true、runtime検証true、scanErrorsなし、INCOMPLETEなし|未実施|
|5|既存AUがある場合の退避|Logic終了、bundle全体をComponents外へ移し元パス・ハッシュ記録。再preflight。上書き禁止|未実施|
|6|検査済みAUをユーザーComponentsへ手動配置|置換要求・OS拒否はキャンセルして停止|未実施|
|7|auval -a / auval -v aufx NvMx NvSt|認識・終了0・validation success。警告があれば記録して停止|未実施|
|8|Plug-in ManagerでNOVA: Mix確認|必要なら本AUのみ再スキャン。強制有効化なし|未実施|
|9|空のLogicプロジェクトにステレオ音声1本|低音量で再生・停止・再開、無音/異音なし|未実施|
|10|Gain 0→-6→0、Bypass|値と音量変化、継続再生を確認|未実施|
|11|別名保存→Logic終了→起動→再Open|音声・設定復元|未実施|
|12|上記成功後、コピーした曲でEQ/Compressor|小さな変更から聴感・読み戻し確認|未実施|
|13|処理前WAVを明示しA/B/C生成・比較|対象曲/Track/音声revision一致、承認前変更なし|未実施|
|14|設定差を確認→承認→Undo|対象インスタンスだけ変更、Undoで復帰|未実施|
|15|採用状態で別名保存→終了→再Open|状態復元。古い承認を再利用せず対象再確認|未実施|
|16|Logicから別WAV書き出し|再生と聴感、LUFS/True Peak再測定。原音・比較WAV保持|未実施|
|17|余裕があれば2インスタンス・Automation・各rate/buffer|分離・状態・急変更を確認。失敗は記録|未実施|

AU識別子 `aufx / NvMx / NvSt`、bundle ID `studio.nova.audio.NovaMix` は旧版と同一。
旧版と最新版を別名で同時配置してはいけない。実機上の競合有無はpreflightまで確認できません。
同梱スクリプトは同名・bundle ID・AU識別子で既存AUを検出し、読取不能も導入停止扱い。

## 診断と復旧

同梱INSTALL-JA.mdおよびcollect-diagnostics.pyを使用する。新規診断フォルダへmacOS/CPU/auval/Registrarログを採取。
OSが同梱Pythonを拒否した場合も迂回せず表示内容を記録。
Gatekeeper無効化、隔離属性削除、全AUキャッシュ削除、管理者権限による強制配置をしない。

復旧はLogic完全終了→今回AUのハッシュが検査キットと一致するか確認→Components外へ退避→元パスが空かと旧AUハッシュを確認→旧AUを元パスへ戻す。
別更新の可能性がある不一致は停止する。原本・コピー・旧AU・音声・比較音声・履歴を削除しない。

## 未確認事項

正確なユーザーmacOS/Logic版、実機AU競合、Gatekeeper/ホストの起動許可、日本語IME、実音源/録音ボーカル、実Logic Automation、保存終了再Open、最終WAVの聴感は未確認。
開発用ad-hoc署名でありDeveloper ID署名・公証・最低macOS実機・商用配布審査は未完了。拒否時は止める。
#513の指示プレビュー・区間保護を#510へ追加したものではない。安定版で新機能の動作を期待しない。
全曲オフラインMasteringの追加Gain/lookahead/TP補正はライブAUと同音ではない。Logic再出力を別途測定する。

開始可能なのは安全な事前検査から。導入と実音声確認への進行は各段階の実機結果で判断する。
