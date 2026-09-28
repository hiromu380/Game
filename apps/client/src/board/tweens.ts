/**
 * ごく小さなトゥイーン（時間経過で値を変化させる）管理
 * 演出専用。ゲームロジックには使わない。
 */

interface Tween {
  delay: number;
  duration: number;
  elapsed: number;
  started: boolean;
  onStart?: () => void;
  /** t は 0〜1 */
  onUpdate?: (t: number) => void;
  onComplete?: () => void;
}

export type TweenOptions = Partial<Pick<Tween, 'delay' | 'onStart' | 'onUpdate' | 'onComplete'>> & {
  duration: number;
};

/** 減速カーブ */
export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

export class TweenManager {
  private tweens: Tween[] = [];

  add(options: TweenOptions): void {
    this.tweens.push({ delay: 0, elapsed: 0, started: false, ...options });
  }

  update(deltaMs: number): void {
    // コールバック内で add されても安全なよう、処理前に配列を入れ替える
    const current = this.tweens;
    this.tweens = [];
    for (const tween of current) {
      if (tween.delay > 0) {
        tween.delay -= deltaMs;
        if (tween.delay > 0) {
          this.tweens.push(tween);
          continue;
        }
      }
      if (!tween.started) {
        tween.started = true;
        tween.onStart?.();
      }
      tween.elapsed += deltaMs;
      const t = tween.duration <= 0 ? 1 : Math.min(1, tween.elapsed / tween.duration);
      tween.onUpdate?.(t);
      if (t >= 1) tween.onComplete?.();
      else this.tweens.push(tween);
    }
  }

  /** すべてのトゥイーンを即座に完了させる（スキップ用） */
  finishAll(): void {
    while (this.tweens.length > 0) this.update(Number.MAX_SAFE_INTEGER);
  }

  get isIdle(): boolean {
    return this.tweens.length === 0;
  }
}
