/**
 * 1フレームの描画（部屋 → 床の上の光 → 奥行き順の人物と台 → 台の上の表示 → 粒子 → 画面の効果）
 *
 * 巻き戻しのあいだは、主人公と通常の警備を「戻る前」から「記録時点」へ逆再生して見せる。
 * 支配人だけは普通の向きに歩いて見える（ロジックでも巻き戻しの影響を受けない）
 */
import { BALANCE } from '../config/balance';
import { isPredicted, isSuspicious, nearbyMachine, noxIncomingDoor, traceStage } from '../core/run';
import type { Guard, Machine, RunEvent, RunState, Vec } from '../core/types';
import type { Settings } from '../save';
import { TEXT } from '../strings';
import { Particles } from './fx';
import { roomDirToScreen, SCREEN_H, SCREEN_W, TILE_H, TILE_W, toScreen } from './iso';
import { PALETTE as C } from './palette';
import { drawDoorGlow, roomBackground } from './room';
import {
  drawBouncer,
  drawCounter,
  drawGuard,
  drawMachine,
  drawNox,
  drawPillar,
  drawReelWindow,
  drawRio,
  MACHINE_TOP,
} from './sprites';

type Ctx = CanvasRenderingContext2D;

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const lerp = (a: Vec, b: Vec, k: number): Vec => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

export interface FrameView {
  settings: Settings;
  /** 大当たりの演出（0〜1。null なら出ていない） */
  jackpotGlow: number | null;
  /** 画面の揺れの強さ（px） */
  shake: number;
  /** 導入の案内で光らせる台 */
  guideMachine: string | null;
}

export class Renderer {
  readonly particles = new Particles();
  private walk = new Map<string, { phase: number; last: Vec }>();
  private lever = new Map<string, number>();
  private time = 0;
  private hurtFlash = 0;
  private noxFootstep = 0;
  /** 支配人の足音を鳴らすタイミング（呼び出し側が音を出す） */
  onFootstep: ((volume: number) => void) | null = null;

  constructor(private readonly ctx: Ctx) {}

  /** ロジックのイベントから演出を起こす */
  onEvent(e: RunEvent, state: RunState) {
    switch (e.type) {
      case 'spinStart':
        this.lever.set(e.machineId, 1);
        break;
      case 'result': {
        const m = state.machines.find((x) => x.id === e.machineId)!;
        const top = this.machineTop(m);
        if (e.outcome === 'big' || e.outcome === 'medium') this.particles.sparks(top, C.gold, 24);
        if (e.outcome === 'big') this.particles.burst(this.tray(m), 30);
        break;
      }
      case 'confirm': {
        // リールの表示（台の上）よりさらに上に出す
        const top = this.machineTop(m0(state, e.machineId));
        const at = { x: top.x, y: top.y - 110 };
        if (e.payout.total > 0) this.particles.text(at, `+${e.payout.total}`, C.gold, 34);
        if (e.payout.safe > 0) this.particles.text({ x: at.x, y: at.y + 34 }, `${TEXT.safe} ${e.payout.safe}`, C.teal, 20);
        if (e.payout.bonus > 0) this.particles.text({ x: at.x + 90, y: at.y + 12 }, `+${e.payout.bonus}`, 'rgba(255,216,106,0.75)', 22);
        break;
      }
      case 'rewindStart':
        this.particles.reverse = true;
        this.particles.ring(this.screenOf(state.player.pos), C.teal, 220, 0.8);
        break;
      case 'rewindEnd':
        this.particles.reverse = false;
        this.particles.clear();
        break;
      case 'shockwave':
        this.particles.ring(this.screenOf(state.player.pos), C.teal, BALANCE.player.shockwave.radius * TILE_W * 1.1, 0.45);
        this.particles.ring(this.screenOf(state.player.pos), C.ivory, BALANCE.player.shockwave.radius * TILE_W * 0.7, 0.35);
        break;
      case 'hurt':
        this.hurtFlash = 0.4;
        break;
      case 'mirror': {
        const m = state.machines.find((x) => x.id === e.machineId)!;
        this.particles.sparks(this.machineTop(m), C.teal, 16);
        break;
      }
      case 'roomChange':
        this.particles.clear();
        break;
    }
  }

  /** 払い出し中の金貨（呼び出し側が回収の進みに合わせて呼ぶ） */
  emitCollectCoin(state: RunState, m: Machine) {
    this.particles.coinTo(this.tray(m), this.screenOf(state.player.pos));
  }

  /** 大当たりの金貨の噴き出し */
  jackpotBurst(state: RunState, m: Machine, count: number) {
    this.particles.burst(this.tray(m), count);
    this.particles.sparks(this.machineTop(m), C.gold, 40);
  }

  screenOf(pos: Vec): Vec {
    return toScreen(pos.x, pos.y);
  }

  machineTop(m: Machine): Vec {
    const p = toScreen(m.x + 0.5, m.y + 0.5);
    return { x: p.x, y: p.y - MACHINE_TOP - 20 };
  }

  private tray(m: Machine): Vec {
    const face = machineFace(m);
    const p = face === 's' ? toScreen(m.x + 0.5, m.y + 0.95) : toScreen(m.x + 0.95, m.y + 0.5);
    return { x: p.x, y: p.y - 20 };
  }

  private advanceWalk(id: string, pos: Vec): number | null {
    const w = this.walk.get(id) ?? { phase: 0, last: { ...pos } };
    const d = Math.hypot(pos.x - w.last.x, pos.y - w.last.y);
    w.phase += d * 7;
    const moving = d > 0.0005;
    w.last = { ...pos };
    this.walk.set(id, w);
    return moving ? w.phase : null;
  }

  draw(state: RunState, dt: number, view: FrameView) {
    const ctx = this.ctx;
    this.time += dt;
    this.particles.update(dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    for (const [id, v] of this.lever) this.lever.set(id, Math.max(0, v - dt * 2.5));

    const room = state.rooms[state.room]!;
    ctx.save();
    if (view.settings.shake && view.shake > 0) {
      ctx.translate((Math.random() - 0.5) * view.shake, (Math.random() - 0.5) * view.shake);
    }
    ctx.drawImage(roomBackground(room, state.rooms), 0, 0);

    // 巻き戻しの補間
    const rewinding = state.phase === 'rewinding' && state.rewind && state.rewindPoint;
    const k = rewinding ? ease(state.rewind!.t) : 0;
    const playerPos = rewinding ? lerp(state.rewind!.from.player.pos, state.rewindPoint!.player.pos, k) : state.player.pos;
    const guardPos = (g: Guard, i: number): Vec => {
      if (!rewinding) return g.pos;
      const from = state.rewind!.from.guards[i];
      const to = state.rewindPoint!.guards[i];
      return from && to ? lerp(from.pos, to.pos, k) : g.pos;
    };

    // 支配人が来る扉の光・足音
    const incoming = noxIncomingDoor(state);
    if (incoming) {
      const door = room.doors.find((d) => d.x === incoming.x && d.y === incoming.y)!;
      const strength = Math.max(0.2, 1 - incoming.eta / BALANCE.nox.roomTravelSeconds);
      drawDoorGlow(ctx, room, door, 'rgba(227,90,95,ALPHA)', strength * (0.75 + 0.25 * Math.sin(this.time * 6)));
      this.footsteps(dt, strength * 0.5);
    }

    // 床の上: 警備の視界・回収の範囲
    for (const [i, g] of state.guards.entries()) {
      if (g.room !== state.room || g.kind !== 'patrol' || g.stun > 0) continue;
      this.visionCone(g, guardPos(g, i), g.state === 'chase', isSuspicious(state));
    }
    if (state.spin?.phase === 'collecting') {
      const m = state.machines.find((x) => x.id === state.spin!.machineId)!;
      const c = toScreen(m.x + 0.5, m.y + 0.5);
      ctx.save();
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = 'rgba(255,216,106,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, BALANCE.collect.radius * TILE_W * 0.7, BALANCE.collect.radius * TILE_H * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 奥行き順に描く
    type Drawable = { depth: number; draw: () => void };
    const items: Drawable[] = [];
    const near = nearbyMachine(state);
    for (const m of state.machines) {
      if (m.room !== state.room) continue;
      items.push({ depth: m.x + m.y + 1.2, draw: () => this.machine(state, m, m === near || view.guideMachine === m.id) });
    }
    const playerDepth = playerPos.x + playerPos.y;
    for (const f of room.fixtures) {
      if (f.kind === 'pillar') {
        const occludes = f.x + f.y + 1 > playerDepth && Math.abs(f.x - f.y - (playerPos.x - playerPos.y)) < 2.2;
        items.push({ depth: f.x + f.y + 1.6, draw: () => drawPillar(ctx, f.x, f.y, occludes ? 0.35 : 1) });
      } else {
        items.push({ depth: f.x + f.y + 1.2, draw: () => drawCounter(ctx, f.x, f.y, f.kind === 'shopCounter' ? 'shop' : 'exit', this.time) });
      }
    }
    state.guards.forEach((g, i) => {
      if (g.room !== state.room) return;
      const pos = guardPos(g, i);
      const walk = this.advanceWalk(g.id, pos);
      items.push({
        depth: pos.x + pos.y,
        draw: () => {
          const s = toScreen(pos.x, pos.y);
          const opts = {
            facing: roomDirToScreen(g.facing),
            walk,
            alert: g.state === 'chase',
            stunned: g.stun > 0,
          };
          if (rewinding && view.settings.afterimage) this.ghosts(g, i, state, k, opts);
          (g.kind === 'bouncer' ? drawBouncer : drawGuard)(ctx, s.x, s.y, opts);
        },
      });
    });
    const pWalk = this.advanceWalk('player', playerPos);
    if (state.player.boots > 0 && pWalk !== null && Math.random() < 0.3) this.particles.arc(this.screenOf(playerPos));
    items.push({
      depth: playerDepth,
      draw: () => {
        const s = toScreen(playerPos.x, playerPos.y);
        if (rewinding && view.settings.afterimage) {
          for (let j = 1; j <= 3; j++) {
            const kk = Math.max(0, k - j * 0.12);
            const gp = toScreen(...xy(lerp(state.rewind!.from.player.pos, state.rewindPoint!.player.pos, kk)));
            drawRio(ctx, gp.x, gp.y, { facing: { x: 1, y: 1 }, walk: null, alpha: 0.25, tint: C.teal, watch: 0 });
          }
        }
        const blink = state.player.invuln > 0 && Math.floor(this.time * 12) % 2 === 0;
        drawRio(ctx, s.x, s.y, {
          facing: roomDirToScreen(state.player.facing),
          walk: pWalk,
          alpha: blink ? 0.5 : state.player.dodge > 0 ? 0.7 : 1,
          watch: rewinding ? 1 : state.spin?.phase === 'result' ? 0.4 + 0.2 * Math.sin(this.time * 5) : 0,
          hurt: this.hurtFlash > 0,
        });
      },
    });
    if (state.nox.active && state.nox.room === state.room) {
      const nox = state.nox;
      const walk = this.advanceWalk('nox', nox.pos);
      if (walk !== null) this.footsteps(dt, 1);
      items.push({
        depth: nox.pos.x + nox.pos.y,
        draw: () => {
          const s = toScreen(nox.pos.x, nox.pos.y);
          drawNox(ctx, s.x, s.y, { facing: roomDirToScreen(nox.facing), walk, glow: 0.6 + 0.4 * Math.sin(this.time * 2), alpha: nox.slow > 0 ? 0.75 : 1 });
        },
      });
    }
    items.sort((a, b) => a.depth - b.depth);
    for (const it of items) it.draw();

    // 台の上の表示（予知の目・リール）
    for (const m of state.machines) if (m.room === state.room) this.machineDisplay(state, m, m === near);

    this.particles.draw(ctx);
    ctx.restore();

    this.screenEffects(state, view, rewinding ? state.rewind!.t : null);
  }

  private footsteps(dt: number, volume: number) {
    this.noxFootstep -= dt;
    if (this.noxFootstep <= 0) {
      this.noxFootstep = 0.55;
      this.onFootstep?.(volume);
    }
  }

  private visionCone(g: Guard, pos: Vec, chasing: boolean, suspicious: boolean) {
    const ctx = this.ctx;
    const cfg = BALANCE.guards.patrol;
    const half = ((cfg.fovDeg / 2) * Math.PI) / 180;
    const base = Math.atan2(g.facing.y, g.facing.x);
    ctx.save();
    ctx.fillStyle = chasing ? 'rgba(227,90,95,0.22)' : suspicious ? 'rgba(255,216,106,0.16)' : 'rgba(239,230,214,0.07)';
    ctx.beginPath();
    const o = toScreen(pos.x, pos.y);
    ctx.moveTo(o.x, o.y);
    for (let i = 0; i <= 12; i++) {
      const a = base - half + (i * 2 * half) / 12;
      const p = toScreen(pos.x + Math.cos(a) * cfg.vision, pos.y + Math.sin(a) * cfg.vision);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private ghosts(g: Guard, i: number, state: RunState, k: number, opts: { facing: Vec; walk: number | null; alert: boolean; stunned: boolean }) {
    const from = state.rewind!.from.guards[i];
    const to = state.rewindPoint!.guards[i];
    if (!from || !to) return;
    for (let j = 1; j <= 3; j++) {
      const p = toScreen(...xy(lerp(from.pos, to.pos, Math.max(0, k - j * 0.12))));
      (g.kind === 'bouncer' ? drawBouncer : drawGuard)(this.ctx, p.x, p.y, { ...opts, walk: null, alpha: 0.22, tint: C.teal });
    }
  }

  private machine(state: RunState, m: Machine, highlight: boolean) {
    const spin = state.spin?.machineId === m.id ? state.spin : null;
    const win = spin && spin.phase !== 'spinning' && spin.payout.total > spin.bet;
    const look =
      m.broken === 'dead'
        ? 'dead'
        : m.broken === 'fixed'
          ? 'broken'
          : win
            ? 'win'
            : isPredicted(state, m)
              ? 'predicted'
              : 'idle';
    drawMachine(this.ctx, m.x, m.y, { face: machineFace(m), state: look, lever: this.lever.get(m.id) ?? 0, highlight, time: this.time });
  }

  /** 台の上: 抽選中・結果のリール（大）と、予知済みの目の印と次の絵柄（小） */
  private machineDisplay(state: RunState, m: Machine, near: boolean) {
    const ctx = this.ctx;
    const top = this.machineTop(m);
    const spin = state.spin?.machineId === m.id ? state.spin : null;
    const rewinding = state.phase === 'rewinding' && spin;
    if (spin) {
      const w = 170;
      const h = 62;
      const x = top.x - w / 2;
      const y = top.y - h - 12;
      this.frame(x - 8, y - 8, w + 16, h + 16, spin.phase !== 'spinning' && spin.payout.total > spin.bet ? C.gold : C.oldGold);
      let rot: number[] | null = null;
      if (rewinding) {
        // 逆回転して止まる
        const t = state.rewind!.t;
        rot = [0, 1, 2].map((i) => -(t * 14 + i * 1.3));
      } else if (spin.phase === 'spinning') {
        const t = spin.t;
        // 左から順に止まる
        rot = [0, 1, 2].map((i) => (t < BALANCE.spinSeconds * (0.45 + i * 0.25) ? t * 16 + i * 1.7 : NaN));
      }
      drawReelWindow(ctx, x, y, w, h, spin.result.reels, rot);
      if (spin.phase !== 'spinning' && !rewinding) {
        const name = TEXT.outcome[spin.result.outcome];
        this.tag(top.x, y - 22, name, spin.payout.total > spin.bet ? C.gold : C.ivory);
      }
      return;
    }
    const known = state.knowledge[m.id];
    if (known && known.index === m.index && m.broken !== 'dead') {
      // 予知済み: 目の印と次の絵柄
      const w = 96;
      const h = 34;
      const x = top.x - w / 2;
      const y = top.y - h + 6;
      this.frame(x - 4, y - 4, w + 8, h + 8, C.teal);
      drawReelWindow(ctx, x, y, w, h, known.reels, null);
      this.eye(top.x, y - 20);
    } else if (near && m.broken !== 'dead') {
      const w = 96;
      const h = 34;
      const x = top.x - w / 2;
      const y = top.y - h + 6;
      this.frame(x - 4, y - 4, w + 8, h + 8, C.oldGold);
      drawReelWindow(ctx, x, y, w, h, null, null);
    }
  }

  private frame(x: number, y: number, w: number, h: number, color: string) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(11,15,26,0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    // アールデコの角飾り
    ctx.fillStyle = color;
    for (const [cx, cy] of [
      [x, y],
      [x + w, y],
      [x, y + h],
      [x + w, y + h],
    ]) {
      ctx.fillRect(cx! - 3, cy! - 3, 6, 6);
    }
  }

  private tag(x: number, y: number, text: string, color: string) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = '700 24px "Hiragino Mincho ProN", "Yu Mincho", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 6;
    ctx.strokeStyle = C.navyDeep;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  private eye(x: number, y: number) {
    const ctx = this.ctx;
    ctx.save();
    const bob = Math.sin(this.time * 2.5) * 3;
    ctx.translate(x, y + bob);
    ctx.fillStyle = 'rgba(11,15,26,0.9)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.teal;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.quadraticCurveTo(0, -12, 15, 0);
    ctx.quadraticCurveTo(0, 12, -15, 0);
    ctx.stroke();
    ctx.fillStyle = C.teal;
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private screenEffects(state: RunState, view: FrameView, rewindT: number | null) {
    const ctx = this.ctx;
    // 巻き戻し: 青緑に染まり、時計の弧が逆に回る
    if (rewindT !== null) {
      const a = Math.sin(Math.min(1, rewindT) * Math.PI);
      ctx.save();
      ctx.fillStyle = `rgba(20,60,70,${0.32 * a})`;
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(85,222,228,${0.55 * a})`;
      ctx.lineWidth = 3;
      const c = this.screenOf(state.player.pos);
      for (let i = 0; i < 3; i++) {
        const r = 180 + i * 120;
        const start = -rewindT * Math.PI * 2 * (1 + i * 0.3);
        ctx.beginPath();
        ctx.ellipse(c.x, c.y - 40, r, r * 0.55, 0, start, start + Math.PI * 0.9);
        ctx.stroke();
      }
      ctx.restore();
    }
    // 痕跡の段階: 視線（周りが暗くなる）
    const stage = traceStage(state);
    const nox = state.nox;
    let red = 0;
    if (nox.active && nox.room === state.room) {
      const d = Math.hypot(nox.pos.x - state.player.pos.x, nox.pos.y - state.player.pos.y);
      red = Math.max(0, 1 - d / 7);
    }
    if (stage >= 2 || red > 0) {
      const g = ctx.createRadialGradient(SCREEN_W / 2, SCREEN_H / 2, SCREEN_H * 0.35, SCREEN_W / 2, SCREEN_H / 2, SCREEN_H * 0.95);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, red > 0 ? `rgba(110,15,25,${0.25 + red * 0.4})` : 'rgba(5,5,12,0.45)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    }
    // 大当たりの光（閃光の設定に従い、明るさに上限）
    if (view.jackpotGlow !== null && view.settings.flash) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,216,106,${0.22 * view.jackpotGlow})`;
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      ctx.restore();
    }
    if (this.hurtFlash > 0 && view.settings.flash) {
      ctx.fillStyle = `rgba(227,90,95,${this.hurtFlash * 0.4})`;
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    }
  }
}

const m0 = (state: RunState, id: string) => state.machines.find((x) => x.id === id)!;

function xy(v: Vec): [number, number] {
  return [v.x, v.y];
}

/** 台の窓のある面（奥左の壁際の台は右手前、それ以外は左手前） */
export function machineFace(m: Machine): 's' | 'e' {
  return m.x === 1 && m.y > 1 ? 'e' : 's';
}
