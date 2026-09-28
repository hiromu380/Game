/**
 * 再生中の演出（発光・火花・パーティクル・数字ポップ・波紋・揺れ・スロー・連鎖カウンター・カットイン）
 *
 * BoardRenderer がイベントを受け取ってここを呼ぶ。どの演出をどれくらい強く出すかの閾値は
 * config/effects.ts に集約し、ユーザー設定（演出の強さ・揺れ）で弱められるようにしている。
 * ここはあくまで見た目の処理で、ゲームの計算はしない。
 */
import type { PartId, Score } from '@chain-factory/sim';
import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { BOARD_THEME, PART_ASSETS } from '../../assets/manifest';
import { EFFECTS_CONFIG, type EffectStrength } from '../../config/effects';
import { formatScore } from '../../ui/format';
import { CELL_SIZE, cellCenter } from '../layout';
import { easeOutCubic, type TweenManager } from '../tweens';

export interface EffectSettings {
  strength: EffectStrength;
  shake: boolean;
}

export interface EffectLabels {
  /** 連鎖数カウンターの文言（例: 12 連鎖） */
  chain: (count: number) => string;
  /** カットインの見出し（例: 大出荷！） */
  cutInTitle: () => string;
  /** 収入のポップアップ（例: +1円） */
  income: (amount: number) => string;
}

/** 値の桁数（演出の段階を決める） */
export const digitsOf = (value: Score): number => value.toString().length;

export class EffectsLayer {
  /** 盤面と一緒に揺れる演出（パーツの上に重ねる） */
  readonly boardLayer = new Container();
  /** 揺れない前面の演出（連鎖カウンター・カットイン） */
  readonly screenLayer = new Container();

  private settings: EffectSettings = { strength: 'full', shake: true };
  private shakePower = 0;
  /** スローモーションの残り時間（実時間ミリ秒） */
  private slowMoLeftMs = 0;
  /** この再生でカットインを出した最大の桁数（同じ規模で何度も出さないため） */
  private cutInShownDigits = 0;
  private chainCount = 0;
  private readonly counter: Text;

  constructor(
    private readonly tweens: TweenManager,
    private readonly mascotTexture: Texture,
    private readonly labels: EffectLabels,
    private readonly getPartView: (x: number, y: number) => Container | undefined,
    private readonly getScreenSize: () => { width: number; height: number },
  ) {
    this.counter = new Text({
      text: '',
      style: {
        fill: 0xffffff,
        fontSize: 28,
        fontWeight: '900',
        stroke: { color: 0x000000, width: 6 },
      },
    });
    this.counter.anchor.set(0, 0);
    this.counter.position.set(24, 22);
    this.counter.visible = false;
    this.screenLayer.addChild(this.counter);
  }

  setSettings(settings: EffectSettings): void {
    this.settings = settings;
  }

  private get power(): number {
    return EFFECTS_CONFIG.strength[this.settings.strength];
  }

  /** 再生の開始・終了時に状態を戻す */
  reset(): void {
    this.shakePower = 0;
    this.slowMoLeftMs = 0;
    this.cutInShownDigits = 0;
    this.chainCount = 0;
    this.counter.visible = false;
    this.boardLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.screenLayer.children
      .filter((c) => c !== this.counter)
      .forEach((c) => c.destroy({ children: true }));
  }

  /** この再生で今までに発動したパーツの数（効果音の音程に使う） */
  get chain(): number {
    return this.chainCount;
  }

  /** 時間の進み方（スロー中は遅くなる） */
  get timeScale(): number {
    return this.slowMoLeftMs > 0 ? EFFECTS_CONFIG.slowMo.timeScale : 1;
  }

  /**
   * 実時間で毎フレーム呼ぶ。揺れのずれ量を返す（盤面全体をこの分だけずらす）
   * 揺れの乱数は見た目専用で、シミュレーションとは無関係
   */
  update(realDeltaMs: number): { x: number; y: number } {
    this.slowMoLeftMs = Math.max(0, this.slowMoLeftMs - realDeltaMs);
    if (this.shakePower <= 0.1) {
      this.shakePower = 0;
      return { x: 0, y: 0 };
    }
    const offset = {
      x: (Math.random() - 0.5) * this.shakePower,
      y: (Math.random() - 0.5) * this.shakePower,
    };
    this.shakePower *= 0.86;
    return offset;
  }

  // ---------------------------------------------------------------------------
  // イベントごとの演出
  // ---------------------------------------------------------------------------

  /** パーツが発動した */
  onActivate(x: number, y: number, partId: PartId, durationMs: number): void {
    this.chainCount++;
    this.updateCounter();
    this.flashPart(x, y, partId, durationMs);

    if (partId === 'barrel') {
      const p = EFFECTS_CONFIG.particles;
      this.sparks(
        x,
        y,
        PART_ASSETS.barrel.color,
        Math.round(p.barrelSparks * this.power),
        durationMs * 2,
      );
      this.smoke(x, y, Math.round(p.barrelSmoke * this.power), durationMs * 3);
      this.addShake(EFFECTS_CONFIG.shake.barrel);
    }
    if ((EFFECTS_CONFIG.slowMo.chainMilestones as readonly number[]).includes(this.chainCount)) {
      this.startSlowMo();
    }
  }

  /** 出荷した */
  onShip(x: number, y: number, value: Score, durationMs: number): void {
    const digits = digitsOf(value);
    const tier = Math.min(digits - 1, 5);
    this.popText(x, y, `+${formatScore(value)}`, tier, durationMs * 2.5, BOARD_THEME.shipText);

    const p = EFFECTS_CONFIG.particles;
    const count = Math.min(p.max, p.shipBase + digits * p.shipPerDigit);
    this.coins(x, y, Math.round(count * this.power), durationMs * 2);

    const s = EFFECTS_CONFIG.shake;
    if (digits >= s.minShipDigits) this.addShake((digits - s.minShipDigits + 1) * s.perDigit);
    if (digits >= EFFECTS_CONFIG.slowMo.minShipDigits) this.startSlowMo();
    if (digits >= EFFECTS_CONFIG.cutIn.minShipDigits && digits > this.cutInShownDigits) {
      this.cutInShownDigits = digits;
      this.cutIn(value);
    }
  }

  /** 予算を生んだ（貯金箱） */
  onIncome(x: number, y: number, amount: number, durationMs: number): void {
    this.popText(x, y, this.labels.income(amount), 0, durationMs * 2.5, BOARD_THEME.incomeText);
  }

  /** 発動回数がリセットされた */
  onReset(x: number, y: number, durationMs: number): void {
    this.ripple(x, y, durationMs);
  }

  // ---------------------------------------------------------------------------
  // 個々の演出
  // ---------------------------------------------------------------------------

  private addShake(amount: number): void {
    if (!this.settings.shake) return;
    const scaled = amount * this.power;
    this.shakePower = Math.min(EFFECTS_CONFIG.shake.max, Math.max(this.shakePower, scaled));
  }

  private startSlowMo(): void {
    if (this.settings.strength === 'minimal') return;
    this.slowMoLeftMs = EFFECTS_CONFIG.slowMo.durationMs;
  }

  /** 連鎖数カウンター（節目で弾ませて色を変える） */
  private updateCounter(): void {
    const c = EFFECTS_CONFIG.chainCounter;
    if (this.chainCount < c.showFrom || this.settings.strength === 'minimal') return;
    this.counter.visible = true;
    this.counter.text = this.labels.chain(this.chainCount);
    const level = c.milestones.filter((m) => this.chainCount >= m).length;
    this.counter.style.fill = c.colors[Math.min(level, c.colors.length - 1)]!;

    const isMilestone = (c.milestones as readonly number[]).includes(this.chainCount);
    const peak = isMilestone ? 1.6 : 1.15;
    this.tweens.add({
      duration: isMilestone ? 500 : 200,
      onUpdate: (t) => this.counter.scale.set(1 + (peak - 1) * (1 - easeOutCubic(t))),
    });
  }

  /** パーツをテーマ色で光らせ、弾ませる */
  private flashPart(x: number, y: number, partId: PartId, durationMs: number): void {
    const { px, py } = cellCenter(x, y);
    const glow = new Graphics()
      .circle(0, 0, CELL_SIZE * 0.55)
      .fill({ color: PART_ASSETS[partId].color, alpha: 0.55 });
    glow.position.set(px, py);
    this.boardLayer.addChild(glow);

    const part = this.getPartView(x, y);
    this.tweens.add({
      duration: durationMs,
      onUpdate: (t) => {
        glow.alpha = 1 - t;
        glow.scale.set(0.6 + 0.6 * t);
        part?.scale.set(1 + 0.25 * (1 - t));
      },
      onComplete: () => {
        glow.destroy();
        part?.scale.set(1);
      },
    });
  }

  /** 火花（小さな粒が放射状に飛び散る） */
  private sparks(x: number, y: number, color: number, count: number, durationMs: number): void {
    const { px, py } = cellCenter(x, y);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const distance = CELL_SIZE * (0.5 + Math.random() * 0.9);
      const dot = new Graphics().circle(0, 0, 2.5 + Math.random() * 2.5).fill(color);
      dot.position.set(px, py);
      this.boardLayer.addChild(dot);
      this.tweens.add({
        duration: durationMs,
        onUpdate: (t) => {
          const e = easeOutCubic(t);
          dot.position.set(
            px + Math.cos(angle) * distance * e,
            py + Math.sin(angle) * distance * e,
          );
          dot.alpha = 1 - t;
        },
        onComplete: () => dot.destroy(),
      });
    }
  }

  /** コイン（出荷時。上に跳ねてから落ちる） */
  private coins(x: number, y: number, count: number, durationMs: number): void {
    const { px, py } = cellCenter(x, y);
    for (let i = 0; i < count; i++) {
      const vx = (Math.random() - 0.5) * CELL_SIZE * 1.6;
      const up = CELL_SIZE * (0.6 + Math.random() * 0.8);
      const coin = new Graphics()
        .rect(-3, -3, 6, 6)
        .fill(i % 3 === 0 ? BOARD_THEME.incomeText : BOARD_THEME.shipText);
      coin.position.set(px, py);
      coin.rotation = Math.random() * Math.PI;
      this.boardLayer.addChild(coin);
      this.tweens.add({
        duration: durationMs,
        onUpdate: (t) => {
          // 放物線: 上に跳ねて落ちる
          coin.position.set(px + vx * t, py - up * 4 * t * (1 - t) + CELL_SIZE * 0.4 * t);
          coin.rotation += 0.2;
          coin.alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
        },
        onComplete: () => coin.destroy(),
      });
    }
  }

  /** 煙（爆発時。ゆっくり広がって消える） */
  private smoke(x: number, y: number, count: number, durationMs: number): void {
    const { px, py } = cellCenter(x, y);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const puff = new Graphics()
        .circle(0, 0, 10 + Math.random() * 8)
        .fill({ color: 0x616161, alpha: 0.6 });
      puff.position.set(px, py);
      this.boardLayer.addChild(puff);
      this.tweens.add({
        duration: durationMs,
        onUpdate: (t) => {
          const e = easeOutCubic(t);
          puff.position.set(
            px + Math.cos(angle) * CELL_SIZE * 0.7 * e,
            py + Math.sin(angle) * CELL_SIZE * 0.7 * e - 20 * t,
          );
          puff.scale.set(1 + t);
          puff.alpha = 0.6 * (1 - t);
        },
        onComplete: () => puff.destroy(),
      });
    }
  }

  /** 数字を浮かび上がらせる（値が大きいほど大きく） */
  private popText(
    x: number,
    y: number,
    text: string,
    tier: number,
    durationMs: number,
    color: number,
  ): void {
    const { px, py } = cellCenter(x, y);
    const label = new Text({
      text,
      style: {
        fill: color,
        fontSize: 20 + tier * 5,
        fontWeight: '900',
        stroke: { color: BOARD_THEME.background, width: 5 },
      },
    });
    label.anchor.set(0.5);
    label.position.set(px, py - 10);
    this.boardLayer.addChild(label);
    this.tweens.add({
      duration: durationMs,
      onUpdate: (t) => {
        label.y = py - 10 - 40 * easeOutCubic(t);
        label.scale.set(t < 0.15 ? 0.5 + (t / 0.15) * 0.7 : 1.2 - Math.min(0.2, (t - 0.15) * 0.5));
        label.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      },
      onComplete: () => label.destroy(),
    });
  }

  /** 発動回数リセットの波紋 */
  private ripple(x: number, y: number, durationMs: number): void {
    const { px, py } = cellCenter(x, y);
    const ring = new Graphics()
      .circle(0, 0, CELL_SIZE / 2)
      .stroke({ width: 4, color: BOARD_THEME.reset });
    ring.position.set(px, py);
    this.boardLayer.addChild(ring);
    this.tweens.add({
      duration: durationMs,
      onUpdate: (t) => {
        ring.scale.set(0.4 + 0.8 * t);
        ring.alpha = 1 - t;
      },
      onComplete: () => ring.destroy(),
    });
  }

  /**
   * カットイン: 盤面の中央を帯が横切り、ポンコツロボと大出荷の数字を見せる
   * （仮素材。本番ではマスコットのボルトのイラストに差し替える想定）
   */
  private cutIn(value: Score): void {
    if (this.settings.strength === 'minimal') return;
    const { width, height } = this.getScreenSize();
    const band = new Container();
    const bandHeight = 96;
    band.addChild(
      new Graphics()
        .rect(0, 0, width, bandHeight)
        .fill({ color: 0x000000, alpha: 0.75 })
        .rect(0, 0, width, 5)
        .fill(BOARD_THEME.hazardYellow)
        .rect(0, bandHeight - 5, width, 5)
        .fill(BOARD_THEME.hazardYellow),
    );
    const mascot = new Sprite(this.mascotTexture);
    mascot.anchor.set(0.5);
    mascot.width = 76;
    mascot.height = 76;
    mascot.position.set(60, bandHeight / 2);
    const title = new Text({
      text: this.labels.cutInTitle(),
      style: { fill: BOARD_THEME.hazardYellow, fontSize: 22, fontWeight: '900' },
    });
    title.position.set(110, 14);
    const amount = new Text({
      text: `+${formatScore(value)}`,
      style: {
        fill: BOARD_THEME.shipText,
        fontSize: 36,
        fontWeight: '900',
        stroke: { color: 0x000000, width: 5 },
      },
    });
    amount.position.set(110, 40);
    band.addChild(mascot, title, amount);
    band.position.set(-width, height / 2 - bandHeight / 2);
    this.screenLayer.addChild(band);

    const duration = EFFECTS_CONFIG.cutIn.durationMs;
    this.tweens.add({
      duration,
      onUpdate: (t) => {
        // 素早く入って、真ん中で少し止まり、素早く抜ける
        const x =
          t < 0.2 ? -width * (1 - easeOutCubic(t / 0.2)) : t < 0.8 ? 0 : width * ((t - 0.8) / 0.2);
        band.x = x;
        mascot.rotation = Math.sin(t * Math.PI * 6) * 0.15;
      },
      onComplete: () => band.destroy({ children: true }),
    });
  }
}
