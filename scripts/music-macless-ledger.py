#!/usr/bin/env python3
"""Validate stable acceptance IDs and render counts; never infer completion from file presence."""
import argparse, hashlib, json
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
 parser=argparse.ArgumentParser(); parser.add_argument('--write',action='store_true'); args=parser.parse_args()
 ledger=json.loads((ROOT/'docs/music-studio/MACLESS_REQUIREMENTS_V1.json').read_text()); rows=ledger['requirements']; ids={r['id'] for r in rows}
 assert len({r['requirement'] for r in rows})==len(rows),'duplicate requirement counted twice'
 assert len(ids)==len(rows) and {r['feature'] for r in rows}==set(range(1,31))
 for row in rows:
  assert row['category'] in ('A','B','C') and row['status'] in ('open','verified')
  assert all(ref in ids for ref in row['dependsOn'])
  if row.get('triage'):
   assert row['category']=='A' and row['triage']['classification'] in ('実装が必要','実装済み・検証不足','仕様判断待ち')
   assert all((ROOT/path).is_file() for path in row['triage']['reviewedSource'])
  if row['status']=='verified':
   assert row['category']=='A' and row['evidence']
   for e in row['evidence']:
    source=ROOT/e['path']; proof=json.loads((ROOT/e['run']).read_text())
    assert e.get('declaration',e['acceptance']) in source.read_text(), row['id']
    assert proof['failed']==0 and proof['passed']>0, row['id']
    assert proof['sourceHashes'].get(e['path'])==hashlib.sha256(source.read_bytes()).hexdigest(),row['id']
    assert e['acceptance'] in proof['acceptedCases'],row['id']
    for path,digest in proof['runtimeHashes'].items():
     assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==digest, path
 a=[r for r in rows if r['category']=='A']; done=sum(r['status']=='verified' for r in a); counts=Counter(r['category'] for r in rows)
 output=['# Macなし開発・受入台帳 v1','',f"確認日：{ledger['date']}。基準：[PR #{ledger['baselinePR']}](https://github.com/puitoybox-cloud/nova-studio/pull/{ledger['baselinePR']})、HEAD `{ledger['baselineHead']}`。",'',ledger['scope'],'',f"A：総数 **{len(a)}**、証拠付き完了 **{done}**、残数 **{len(a)-done}**、受入確認率 **{100*done/len(a):.2f}%**。B：{counts['B']}。C：{counts['C']}。",'',
 'この数字は初版台帳の受入確認率であり、製品の実装量・30機能の最終完成率ではない。既存コードにあるが全受入を照合していない項目もopenに残す。C依存の実装作業はAから除外せずdependsOnで保持する。B/Cを完了に読み替えない。追加発見時は既存IDを変えず追記し、分母の変更理由を記録する。', '',
 f'優先順：①既存実装{sum(r["status"]=="open" and r.get("triage",{}).get("classification")=="実装済み・検証不足" for r in rows)}件の全受入証明（true peak参照・修復transaction・編集状態別遷移・保存再開）、②C依存63件の契約・品質・許諾の確定と共通処理。今回の受入根拠はverification/music-macless-acceptance-batch-20261031.md。要件IDは下表の正本を参照。モデル選定が必要なAは、C解消までopenのまま。', '',
 '更新手順：production入口と保存/失敗/取消/再開を確認→具体的受入testを実行→source hashと実行結果を証拠JSONに記録→要件ごとにverifiedへ変更→本CLIを実行。テスト数をそのまま機能数に換算しない。','',
 '| No. | A総数 | 完了 | 残数 | B | C |','|---|---:|---:|---:|---:|---:|']
 for no in range(1,31):
  group=[r for r in rows if r['feature']==no]; aa=[r for r in group if r['category']=='A']; dd=sum(r['status']=='verified' for r in aa)
  output.append(f"| {no} | {len(aa)} | {dd} | {len(aa)-dd} | {sum(r['category']=='B' for r in group)} | {sum(r['category']=='C' for r in group)} |")
 output += ['', '| ID | 分類 | 受入要件 | 状態 | 根拠/依存 |','|---|---|---|---|---|']
 for r in rows:
  refs='; '.join(f"[{e['path']}](../../{e['path']}) — `{e['acceptance']}`" for e in r['evidence']) or ', '.join(r['dependsOn']) or '未確認'
  output.append(f"| {r['id']} | {r['category']} | {r['requirement'].replace('|','/')} | {r['status']} | {refs} |")
 output += ['', '## 未完了項目の分類（PR #550開始時点98件）', '', '| 分類 | 開始時点 | 現在の未完了 |', '|---|---:|---:|']
 for group in ['実装が必要','実装済み・検証不足','仕様判断待ち']:
  initial=[r for r in rows if r.get('triage',{}).get('classification')==group]
  output.append(f"| {group} | {len(initial)} | {sum(r['status']=='open' for r in initial)} |")
 output += ['', '仕様判断待ちはC依存の全受入を指す。共通の非破壊保存・中断処理は改善可能。関連実装の存在を要件全体の受入成功とは扱わない。', '', '| ID | 分類 | 現在の状態 |', '|---|---|---|']
 for r in rows:
  if r.get('triage'): output.append(f"| {r['id']} | {r['triage']['classification']} | {r['status']} |")
 target=ROOT/'docs/music-studio/MACLESS_REQUIREMENTS_V1.md'; result='\n'.join(output)+'\n'
 if args.write: target.write_text(result)
 else: assert target.read_text()==result,'stale ledger markdown; run --write after evidence validation'
 print(json.dumps({'A':len(a),'verified':done,'remaining':len(a)-done,'rate':round(100*done/len(a),2),'B':counts['B'],'C':counts['C']}))
if __name__=='__main__': main()
