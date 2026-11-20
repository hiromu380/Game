/**
 * 残業レベル（段階式の高難度）: 通常ランをクリアすると次のレベルが解放され、ラン開始前に選べる。
 * Lv L では levels[0]〜levels[L-1] の条件をすべて重ねる（数値は仮: docs/balance-log.md）
 */
import type { Balance } from './types';

export const ASCENSION: Balance['ascension'] = {
  levels: [
    // Lv1 本社の目標修正
    { quotaPercent: 150 },
    // Lv2 経費削減
    { budgetDelta: -1 },
    // Lv3 リロールの手数料
    { rerollStepDelta: 1 },
    // Lv4 床の手入れ打ち切り
    { bonusFloorDelta: -1 },
    // Lv5 目標の再修正
    { quotaPercent: 200 },
    // Lv6 仕入れ値の高騰
    { priceDelta: 1 },
    // Lv7 秘宝の在庫切れ
    { relicChoicesDelta: -1 },
    // Lv8 出来事の予定変更
    { eventChoicesDelta: -1 },
    // Lv9 さらに経費削減
    { budgetDelta: -1 },
    // Lv10 本社の無茶ぶり
    { quotaPercent: 300 },
  ],
};
