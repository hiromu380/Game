/**
 * 画面の文言（すべてここに置く。コードに直書きしない）
 */
import { BALANCE, type OutcomeId } from './config/balance';
import type { ItemId } from './core/items';
import type { RoomKind } from './core/types';

export const TEXT = {
  title: '未来泥棒',
  titleEn: 'TOMORROW THIEF',
  tagline: '大当たりを見てから時間を戻し、全財産を賭け直せ。',
  start: 'カジノへ入る',
  records: '記録',
  settings: '設定',
  controls: '操作方法',
  back: '戻る',
  resume: '再開',
  toTitle: 'タイトルへ',
  paused: 'ポーズ中',

  chips: '所持チップ',
  profit: '確定利益',
  safe: '安全保管',
  trace: '痕跡',
  rewinds: (n: number) => `巻き戻し ${n} 回`,
  hp: '体力',
  items: '道具',
  emptySlot: '空き',

  room: {
    entrance: '客席・入口',
    hall: '客席',
    workshop: '時計工房',
    highRoller: '大口客の間',
    lobby: '搬出ロビー',
  } satisfies Record<RoomKind, string>,

  outcome: {
    miss: 'ハズレ',
    small: '小当たり',
    medium: '中当たり',
    big: '大当たり',
    jackpot: '777',
  } satisfies Record<OutcomeId, string>,

  machine: {
    limit: (n: number) => `賭け金上限 ${n}`,
    limitBoosted: (n: number) => `上限 ${n}（追い賭け手袋）`,
    broken: '壊れた台',
    dead: '故障中',
    predicted: '予知済み',
    unknown: '次の結果: 未知',
    next: '次の結果',
    small: '小額',
    half: '半分',
    all: '全額',
    bet: '賭け金',
    payout: '払い戻し',
    profit: '利益',
    collect: '回収',
    seconds: (s: number) => `${s.toFixed(1)}秒`,
    pull: 'レバーを引く',
    spinning: '抽選中…',
    receive: '受け取る',
    rewind: '巻き戻す',
    collecting: '回収中',
    collectHint: '払い出し口から離れると、回収が止まる',
    noChips: 'チップがない',
    odds: '抽選表',
    oddsRow: (name: string, pct: string, mul: string) => `${name}　${pct}%　${mul}倍`,
    includesBet: '払い戻しは元金込み',
  },

  shop: {
    title: '時計工房',
    subtitle: '道具は3つまで。すでに見た絵柄は変わらない',
    buy: '買う',
    soldOut: '売り切れ',
    replace: '入れ替える道具を選ぶ',
    repair: '懐中時計の油差し（体力 +1）',
    price: (n: number) => `${n} チップ`,
    leave: '店を出る',
  },

  exit: {
    title: '搬出ロビー',
    take: (n: number) => `持ち帰る（${n} チップ）`,
    hint: '持ち帰れば成功。続けるなら、扉から客席へ戻る',
  },

  item: {
    boots: { name: '秒針ブーツ', desc: '巻き戻した直後、短いあいだ足が速くなる' },
    glove: {
      name: '追い賭け手袋',
      desc: `予知済みの抽選で、賭け金の上限が${BALANCE.items.glove.limitMul}倍になる`,
    },
    mirror: {
      name: '割れた鏡',
      desc: `結果を見るたびに、隣の台の次の結果も覗ける（${BALANCE.items.mirror.charges}回）`,
    },
    echo: {
      name: '残響コイン',
      desc: `当たりを確定すると、払い戻しの${BALANCE.items.echo.bonusPercent}%が後から追加で出てくる`,
    },
    receipt: {
      name: '退避用の領収書',
      desc: `確定した利益の${BALANCE.items.receipt.safePercent}%を、先に安全な場所へ保管する`,
    },
    contract: {
      name: '白紙の契約',
      desc: `払い出しが${BALANCE.items.contract.payoutPercent / 100}倍。ただし支配人の接近が速くなる`,
    },
  } satisfies Record<ItemId, { name: string; desc: string }>,
  mirrorCharges: (n: number) => `残り${n}回`,

  /** 導入の案内（実際に操作させる） */
  tutorial: {
    goBroken: '奥の壊れた台へ。　E: 台を操作',
    pullOne: '1枚だけ賭けて、レバーを引こう。　1: 小額 → E: レバー',
    rewindNow: '777。……でも、賭けたのは1枚だけ。　Q: 巻き戻す',
    betAll: '時計が戻った。結果は覚えている。今度は全額で。　3: 全額 → E: レバー',
    receive: '同じ777。　E: 受け取る（払い出し口の近くで回収）',
    shop: '大金だ。時計工房で道具を買おう。予知した台は目の印で分かる',
    safeLeft: (n: number) => `巻き戻しを安全に試せるのは、あと${n}回`,
  },

  story: {
    open: [
      'リオ: 直した懐中時計は、針を少しだけ戻せる。',
      'リオ: この街の幸運は、全部あのカジノに吸い上げられた。返してもらう。',
    ],
    stage1: '……壁の時計が、一瞬だけ逆に回った。',
    stage2: 'どこかから、見られている。',
    stage3: 'コツ、コツ、と。巻き戻らない足音が近づいてくる。',
    noxEnter: 'ノクス: いらっしゃいませ。良い夜ですね、お客様。',
    noxCatch: 'ノクス: お客様。その勝ちは、いつのものですか。',
    guardCatch: '警備員に取り押さえられた。',
    noxIncoming: '扉の向こうに、足音。',
    blockedUnconfirmed: '結果を受け取るか、巻き戻すまで動けない',
    blockedCollecting: '払い出しを回収しきるまで、部屋を出られない',
    contract: '契約書: 「客の負けは、明日の幸運をもって支払うものとする」',
  },

  result: {
    escaped: '持ち帰った',
    caught: '捕まった',
    banked: (n: number) => `持ち帰り ${n} チップ`,
    lost: (n: number) => `失ったチップ ${n}`,
    safeKept: (n: number) => `安全保管で残った ${n} チップ`,
    total: (n: number) => `これまでに持ち帰った合計 ${n}`,
    goal: (n: number) => `カジノの所有権まで あと ${n}`,
    unlocked: (name: string) => `時計工房に新しい道具が並ぶ: ${name}`,
    again: 'もう一度挑む',
  },

  recordsList: {
    banked: '持ち帰った合計',
    runs: '挑戦回数',
    escapes: '持ち帰り成功',
    captures: '捕まった回数',
    jackpots: '777 を当てた回数',
    best: '1回の最高額',
  },

  settingsList: {
    master: '全体の音量',
    bgm: '音楽',
    se: '効果音',
    shake: '画面の揺れ',
    flash: '閃光',
    afterimage: '残像',
  },

  controlsList: [
    ['WASD', '移動'],
    ['E', '台・店・窓口の操作／レバー／受け取る'],
    ['1 / 2 / 3', '賭け金: 小額・半分・全額'],
    ['Q', '確定前の抽選を巻き戻す'],
    ['Space', '回避ステップ'],
    ['マウス左', '時計の衝撃波（警備を押し返す）'],
    ['Esc', 'ポーズ'],
  ] as [string, string][],

  /** 所有権を買い取るのに必要な額（仮。最終契約は未実装） */
  ownershipGoal: 1_000_000,
} as const;
