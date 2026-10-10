/**
 * 粒子（金貨・火花・輪・浮かぶ文字）。画面の座標で動かす
 *
 * 巻き戻しのあいだは、飛んでいる金貨が逆向きに戻る（reverse）
 */
import { PALETTE as C } from './palette';

type Ctx = CanvasRenderingContext2D;

interface Particle {
  kind: 'coin' | 'spark' | 'ring' | 'text' | 'arc';
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 地面の高さ（金貨の跳ね） */
  z: number;
  vz: number;
  age: number;
  life: number;
  color: string;
  size: number;
  text?: string;
  /** 目標へ吸い込まれる（払い出し → 主人公） */
  target?: { x: number; y: number };
  spin: number;
}

const MAX = 600;

export class Particles {
  private list: Particle[] = [];
  reverse = false;

  clear() {
    this.list = [];
  }

  private add(p: Partial<Particle> & Pick<Particle, 'kind' | 'x' | 'y' | 'life'>) {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      age: 0,
      color: C.gold,
      size: 6,
      spin: Math.random() * 6,
      ...p,
    });
  }

  /** 払い出し口から主人公へ飛ぶ金貨 */
  coinTo(from: { x: number; y: number }, to: { x: number; y: number }) {
    this.add({
      kind: 'coin',
      x: from.x + (Math.random() - 0.5) * 16,
      y: from.y,
      vx: (Math.random() - 0.5) * 120,
      vy: 0,
      z: 10,
      vz: 220 + Math.random() * 120,
      life: 0.8 + Math.random() * 0.3,
      size: 5 + Math.random() * 3,
      target: to,
    });
  }

  /** 大当たりの金貨の噴き出し */
  burst(at: { x: number; y: number }, count: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 260;
      this.add({
        kind: 'coin',
        x: at.x,
        y: at.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.5,
        z: 40,
        vz: 200 + Math.random() * 380,
        life: 1.2 + Math.random() * 1,
        size: 5 + Math.random() * 4,
      });
    }
  }

  sparks(at: { x: number; y: number }, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 200;
      this.add({ kind: 'spark', x: at.x, y: at.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4 + Math.random() * 0.4, color, size: 2 + Math.random() * 2 });
    }
  }

  ring(at: { x: number; y: number }, color: string, size: number, life = 0.5) {
    this.add({ kind: 'ring', x: at.x, y: at.y, life, color, size });
  }

  text(at: { x: number; y: number }, text: string, color: string, size = 26) {
    this.add({ kind: 'text', x: at.x, y: at.y, vy: -40, life: 1.4, color, size, text });
  }

  /** 秒針ブーツの足跡（青緑の時計の弧） */
  arc(at: { x: number; y: number }) {
    this.add({ kind: 'arc', x: at.x, y: at.y, life: 0.6, color: C.teal, size: 10 });
  }

  update(dt: number) {
    const sign = this.reverse ? -1 : 1;
    for (const p of this.list) {
      p.age += dt * (p.kind === 'coin' && this.reverse ? 1.6 : 1);
      if (p.kind === 'coin') {
        if (p.target && p.age > p.life * 0.45 && !this.reverse) {
          const k = Math.min(1, dt * 9);
          p.x += (p.target.x - p.x) * k;
          p.y += (p.target.y - 40 - p.y) * k;
          p.z *= 1 - k;
        } else {
          p.x += p.vx * dt * sign;
          p.y += p.vy * dt * sign;
          p.vz -= 900 * dt * sign;
          p.z += p.vz * dt * sign;
          if (p.z < 0) {
            p.z = 0;
            p.vz = Math.abs(p.vz) * 0.35;
            p.vx *= 0.6;
            p.vy *= 0.6;
          }
        }
        p.spin += dt * 12;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
    this.list = this.list.filter((p) => p.age < p.life);
  }

  draw(ctx: Ctx) {
    for (const p of this.list) {
      const k = p.age / p.life;
      ctx.save();
      switch (p.kind) {
        case 'coin': {
          ctx.globalAlpha = k > 0.8 ? (1 - k) * 5 : 1;
          if (this.reverse) ctx.globalAlpha *= 0.85;
          const w = Math.abs(Math.cos(p.spin)) * p.size + 1;
          ctx.fillStyle = this.reverse ? C.teal : C.gold;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y - p.z, w, p.size, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = this.reverse ? '#2A8A90' : C.brassDark;
          ctx.lineWidth = 1;
          ctx.stroke();
          break;
        }
        case 'spark':
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          break;
        case 'ring':
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 4 * (1 - k) + 1;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size * (0.2 + k), p.size * 0.5 * (0.2 + k), 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'text':
          ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
          ctx.font = `700 ${p.size}px "Segoe UI", "Hiragino Sans", sans-serif`;
          ctx.textAlign = 'center';
          ctx.lineWidth = 5;
          ctx.strokeStyle = C.navyDeep;
          ctx.strokeText(p.text!, p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text!, p.x, p.y);
          break;
        case 'arc':
          ctx.globalAlpha = (1 - k) * 0.8;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size, p.size * 0.5, 0, Math.PI * 1.1, Math.PI * 1.9);
          ctx.stroke();
          break;
      }
      ctx.restore();
    }
  }
}
