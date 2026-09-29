/**
 * パーティクルの使い回し（火花・コイン・煙）
 *
 * 大きな連鎖で毎回 Graphics を作って捨てると GC が頻発するため、形ごとに作り置きして使い回す。
 * 同時に出せる数には上限があり（config/effects.ts の particles.maxAlive）、超えた分は出さない。
 */
import { Graphics, type Container } from 'pixi.js';

export type ParticleShape = 'dot' | 'square' | 'puff';

function create(shape: ParticleShape): Graphics {
  switch (shape) {
    case 'dot':
      return new Graphics().circle(0, 0, 4).fill(0xffffff);
    case 'square':
      return new Graphics().rect(-3, -3, 6, 6).fill(0xffffff);
    case 'puff':
      return new Graphics().circle(0, 0, 14).fill(0xffffff);
  }
}

export class ParticlePool {
  private readonly free: Record<ParticleShape, Graphics[]> = { dot: [], square: [], puff: [] };
  private alive = 0;

  constructor(
    private readonly layer: Container,
    private readonly maxAlive: number,
  ) {}

  /** 1つ取り出す（上限に達していれば null）。色は tint、大きさは scale で変える */
  acquire(shape: ParticleShape, color: number): Graphics | null {
    if (this.alive >= this.maxAlive) return null;
    const g = this.free[shape].pop() ?? create(shape);
    g.tint = color;
    g.alpha = 1;
    g.scale.set(1);
    g.rotation = 0;
    g.visible = true;
    this.layer.addChild(g);
    this.alive++;
    (g as Graphics & { shape?: ParticleShape }).shape = shape;
    return g;
  }

  release(g: Graphics): void {
    const shape = (g as Graphics & { shape?: ParticleShape }).shape;
    if (!shape) return;
    g.visible = false;
    g.removeFromParent();
    this.free[shape].push(g);
    this.alive = Math.max(0, this.alive - 1);
  }

  /** 再生の終わりに、出ているものをすべて戻す */
  releaseAll(): void {
    for (const child of [...this.layer.children]) {
      if ((child as Graphics & { shape?: ParticleShape }).shape) this.release(child as Graphics);
    }
    this.alive = 0;
  }

  get aliveCount(): number {
    return this.alive;
  }
}
