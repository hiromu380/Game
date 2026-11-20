# Steamworks 登録用: 実績・統計の一覧（自動生成）

<!-- このファイルは `pnpm --filter @chain-factory/desktop achievements:export` で生成する。手で編集しない -->

登録の手順は docs/ops/steam-achievements.md。API 名は大文字小文字を含めてそのまま入力する。

## 実績

| API 名 | 名前（日本語） | 説明（日本語） | 名前（English） | 説明（English） | 隠し | 進捗の統計 |
| --- | --- | --- | --- | --- | --- | --- |
| ACH_FIRST_SHIP | はじめての出荷 | 出荷量が 1 以上になる | First Shipment | Ship at least 1 unit |  |  |
| ACH_FIRST_SHIFT | 初仕事 | シフトを初めてクリアする | First Day on the Job | Clear a shift for the first time |  |  |
| ACH_FIRST_NIGHT | 夜勤明け | 夜（ボス）のシフトをクリアする | Night Shift Survivor | Clear a night (boss) shift |  |  |
| ACH_FULL_CLEAR | 定時退社 | 9シフトすべてクリアする | Clocking Out on Time | Clear all 9 shifts |  |  |
| ACH_FULL_CLEAR_10 | ベテラン工場長 | 全シフトクリアを10回達成する | Veteran Plant Manager | Clear all shifts 10 times |  | STAT_FULL_CLEARS（0〜10） |
| ACH_BOSS_LOWOIL | 油切れでも回る | ボス「油切れ」のシフトをクリアする | Running on Empty | Clear a "Low Oil" boss shift |  |  |
| ACH_BOSS_REPAIR | 工事中も出荷 | ボス「床の補修工事」のシフトをクリアする | Shipping Through Repairs | Clear a "Floor Repairs" boss shift |  |  |
| ACH_BOSS_INSPECTION | 検査合格 | ボス「出荷検査強化」のシフトをクリアする | Inspection Passed | Clear a "Strict Inspection" boss shift |  |  |
| ACH_BOSS_SHORT | 時短の達人 | ボス「短縮営業」のシフトをクリアする | Master of Short Hours | Clear a "Short Shift" boss shift |  |  |
| ACH_BOSS_SHORTAGE | あるもので回す | ボス「部品不足」のシフトをクリアする | Make Do | Clear a "Part Shortage" boss shift |  |  |
| ACH_CHAIN_25 | 連鎖反応 | 1回の稼働で連鎖 25 を出す | Chain Reaction | Reach a 25 chain in one run of the factory |  |  |
| ACH_CHAIN_100 | 大連鎖 | 1回の稼働で連鎖 100 を出す | Mega Chain | Reach a 100 chain in one run of the factory |  |  |
| ACH_CHAIN_300 | 止まらない工場 | 1回の稼働で連鎖 300 を出す | The Factory Never Stops | Reach a 300 chain in one run of the factory |  |  |
| ACH_SHIFT_1M | 百万出荷 | 1シフトで 100万 出荷する | A Million Shipped | Ship 1 million in a single shift |  |  |
| ACH_SHIFT_1B | 十億出荷 | 1シフトで 10億 出荷する | A Billion Shipped | Ship 1 billion in a single shift |  |  |
| ACH_SHIFT_1T | 兆の工場 | 1シフトで 1兆 出荷する | Trillion-Unit Factory | Ship 1 trillion in a single shift |  |  |
| ACH_TOTAL_1B | 累計十億 | 累計で 10億 出荷する | Billion in the Books | Ship 1 billion in total |  |  |
| ACH_RUNS_10 | 常連 | ランを10回遊ぶ | Regular | Play 10 runs |  | STAT_RUNS（0〜10） |
| ACH_RUNS_50 | 工場に住む | ランを50回遊ぶ | Living at the Factory | Play 50 runs |  | STAT_RUNS（0〜50） |
| ACH_FACTORY_8 | 工場拡張 | 工場を 8×8 に広げる | Expansion | Expand the factory to 8×8 |  |  |
| ACH_FACTORY_9 | 大工場 | 工場を 9×9 に広げる | Big Factory | Expand the factory to 9×9 |  |  |
| ACH_ALL_PARTS | 全部そろった | すべてのパーツを解放する | Full Catalog | Unlock every part |  |  |
| ACH_OVERTIME_3 | 残業開始 | 延長戦で3シフト生き残る | Overtime Begins | Survive 3 shifts of overtime |  |  |
| ACH_OVERTIME_9 | 終わらない残業 | 延長戦で9シフト生き残る | Endless Overtime | Survive 9 shifts of overtime |  |  |
| ACH_DAILY_FIRST | 今週の工場 | 週替わりチャレンジに参加する | This Week's Factory | Take part in a Weekly Challenge |  |  |
| ACH_DAILY_CLEAR | 今週の最優秀 | 週替わりチャレンジの3シフトをすべてクリアする | Employee of the Week | Clear all 3 shifts in a Weekly Challenge run |  |  |
| ACH_DAILY_TOP10 | 上位 10% | 週替わりチャレンジの結果発表で上位10%に入る | Top 10% | Finish in the top 10% of a Weekly Challenge (final results) |  |  |
| ACH_DAILY_7 | 皆勤賞 | 週替わりチャレンジに合計7日参加する | Perfect Attendance | Take part in Weekly Challenges on 7 days |  | STAT_DAILY_DAYS（0〜7） |
| ACH_JUNKBOT_JACKPOT | ポンコツの本気 | ポンコツロボが1回の稼働で3回続けて ×3 を出す | Junkbot Jackpot | Have Junkbots roll ×3 three times in a row in one run of the factory | はい |  |
| ACH_ZERO | 何も起きない | スイッチを押して、出荷量 0 で終わる | Nothing Happened | Press the switch and ship nothing at all | はい |  |
| ACH_UNMEASURABLE | 計測不能 | 1シフトの出荷量でメーターを振り切る | Unmeasurable | Max out the shipping meter in a single shift | はい |  |

## 統計（回数系のみ）

| API 名 | 型 | 既定値 | 最小 | 増加のみ | 内容 |
| --- | --- | --- | --- | --- | --- |
| STAT_RUNS | INT | 0 | 0 | はい | 遊んだランの回数 |
| STAT_FULL_CLEARS | INT | 0 | 0 | はい | 全シフトをクリアした回数 |
| STAT_DAILY_DAYS | INT | 0 | 0 | はい | 週替わりチャレンジに参加した日数 |
