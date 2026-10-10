/**
 * 起動・入力・ゲームループ・画面遷移
 *
 * ポーズ中は update を呼ばない（支配人も止まる）。演出中も移動・回避・衝撃波は止めない
 */
import { Audio } from './audio/audio';
import { BALANCE } from './config/balance';
import { ITEMS } from './core/items';
import {
  bankAndLeave,
  bankedAmount,
  buyItem,
  buyRepair,
  betAmount,
  confirmSpin,
  createRun,
  isPredicted,
  nearbyFixture,
  nearbyMachine,
  pullLever,
  startRewind,
  update,
  type BetChoice,
} from './core/run';
import type { RunEvent, RunState } from './core/types';
import { screenDirToRoom } from './render/iso';
import { Renderer } from './render/renderer';
import { clearRoomCache } from './render/room';
import { loadSave, loadSettings, storeSave, storeSettings, type SaveData, type Settings } from './save';
import { loadFonts } from './fonts';
import { TEXT } from './strings';
import {
  controlsScreen,
  GameUi,
  itemName,
  pauseScreen,
  recordsScreen,
  resultScreen,
  settingsScreen,
  titleScreen,
  type HudState,
} from './ui/ui';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const stage = document.getElementById('stage')!;
const uiRoot = document.getElementById('ui')!;

// 1920×1080 を画面に合わせて拡大縮小する
function fit() {
  const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  stage.style.transform = `scale(${s})`;
}
window.addEventListener('resize', fit);
fit();

let save: SaveData = loadSave();
let settings: Settings = loadSettings();
const audio = new Audio(settings);

type Screen = 'title' | 'game' | 'pause' | 'result';
let screen: Screen = 'title';
/** ポーズ・タイトルの上に重ねる小画面（操作方法・設定・記録） */
let modal: 'controls' | 'settings' | 'records' | null = null;

let state: RunState = createRun(Date.now() >>> 0, { bankedTotal: save.bankedTotal });
const renderer = new Renderer(ctx);
renderer.onFootstep = (v) => audio.play('footstep', v);

const hudLayer = document.createElement('div');
const menuLayer = document.createElement('div');
uiRoot.append(hudLayer, menuLayer);

const hud: HudState = { betChoice: 'small', pendingBuy: null, subtitle: null, toast: null, guide: null, time: 0 };
let unlocked: string[] = [];
let resultAt = 0;
/** 大当たりの演出（経過秒。null なら出ていない） */
let jackpot: { t: number; length: number; machineId: string; coins: number } | null = null;
/** この起動で大金の 777 を見たか（2回目からは演出を短くする） */
let bigJackpotSeen = false;
let shake = 0;
let coinTimer = 0;

const ui = new GameUi(hudLayer, {
  setBet: (c) => (hud.betChoice = c),
  pull: () => pull(),
  confirm: () => confirm(),
  rewind: () => rewind(),
  buy: (offer, replace) => buy(offer, replace),
  repair: () => buyRepair(state),
  bank: () => bankAndLeave(state),
});

// -----------------------------------------------------------------------------
// 操作
// -----------------------------------------------------------------------------

const keys = new Set<string>();
let dodgeQueued = false;
let shockQueued = false;

function say(text: string, seconds = 3.2, nox = false) {
  hud.subtitle = { text, nox, until: hud.time + seconds };
}
function toast(text: string, seconds = 2) {
  hud.toast = { text, until: hud.time + seconds };
}

function pull() {
  const m = nearbyMachine(state);
  if (!m || state.spin) return;
  const bet = betAmount(state, m, hud.betChoice);
  if (pullLever(state, m.id, bet)) audio.play('lever');
}

function confirm() {
  confirmSpin(state);
}

function rewind() {
  startRewind(state);
}

function buy(offer: number, replace?: number) {
  const full = state.items.length >= BALANCE.items.maxEquipped;
  if (full && replace === undefined) {
    hud.pendingBuy = offer;
    return;
  }
  if (buyItem(state, offer, replace)) hud.pendingBuy = null;
}

/** E: 近くの台・店・窓口への操作（状況でいちばん自然なもの） */
function interact() {
  if (state.spin?.phase === 'result') return confirm();
  if (state.spin) return;
  if (nearbyMachine(state)) return pull();
  if (nearbyFixture(state, 'exitCounter')) {
    bankAndLeave(state);
    return;
  }
}

window.addEventListener('keydown', (e) => {
  audio.unlock();
  const k = e.key.toLowerCase();
  if (e.repeat && k !== 'w' && k !== 'a' && k !== 's' && k !== 'd') return;
  if (k === 'escape') {
    e.preventDefault();
    if (modal) {
      modal = null;
      return renderMenu();
    }
    if (screen === 'game') setScreen('pause');
    else if (screen === 'pause') setScreen('game');
    return;
  }
  if (screen !== 'game') return;
  keys.add(k);
  if (k === ' ') {
    e.preventDefault();
    dodgeQueued = true;
  }
  if (k === 'e') interact();
  if (k === 'q') rewind();
  if (k === '1') hud.betChoice = 'small';
  if (k === '2') hud.betChoice = 'half';
  if (k === '3') hud.betChoice = 'all';
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => {
  keys.clear();
  if (screen === 'game') setScreen('pause');
});
canvas.addEventListener('mousedown', (e) => {
  audio.unlock();
  if (e.button === 0 && screen === 'game') shockQueued = true;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// -----------------------------------------------------------------------------
// 画面遷移
// -----------------------------------------------------------------------------

function setScreen(next: Screen) {
  screen = next;
  modal = null;
  audio.suspend(next === 'pause');
  renderMenu();
}

function startRun() {
  audio.unlock();
  audio.startBgm();
  clearRoomCache();
  state = createRun((Date.now() ^ (save.runs * 7919)) >>> 0, { bankedTotal: save.bankedTotal });
  save = { ...save, runs: save.runs + 1 };
  storeSave(save);
  renderer.particles.clear();
  hud.subtitle = null;
  hud.pendingBuy = null;
  hud.betChoice = 'small';
  jackpot = null;
  ui.clear();
  setScreen('game');
  // 物語は短く: 二言だけ
  say(TEXT.story.open[0]!, 3);
  window.setTimeout(() => screen === 'game' && say(TEXT.story.open[1]!, 3.5), 3200);
}

function finishRun() {
  const banked = bankedAmount(state);
  const before = save.bankedTotal;
  const caught = state.phase === 'caught';
  save = {
    ...save,
    bankedTotal: before + banked,
    escapes: save.escapes + (caught ? 0 : 1),
    captures: save.captures + (caught ? 1 : 0),
    bestHaul: Math.max(save.bestHaul, banked),
    introSeen: true,
  };
  storeSave(save);
  unlocked = ITEMS.filter((it) => it.unlockAt > before && it.unlockAt <= save.bankedTotal).map((it) => itemName(it.id));
  setScreen('result');
}

function renderMenu() {
  let html = '';
  if (screen === 'title') html = titleScreen(save);
  if (screen === 'pause') html = pauseScreen();
  if (screen === 'result') html = resultScreen(state, save, unlocked);
  if (modal === 'controls') html += controlsScreen();
  if (modal === 'records') html += recordsScreen(save);
  if (modal === 'settings') html += settingsScreen(settings);
  menuLayer.innerHTML = html;
  hudLayer.style.display = screen === 'title' ? 'none' : '';
}

menuLayer.addEventListener('click', (e) => {
  audio.unlock();
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-menu]');
  if (!btn) return;
  switch (btn.dataset.menu) {
    case 'start':
    case 'again':
      return startRun();
    case 'resume':
      return setScreen('game');
    case 'title':
      audio.stopBgm();
      return setScreen('title');
    case 'controls':
    case 'settings':
    case 'records':
      modal = btn.dataset.menu;
      return renderMenu();
    case 'back':
      modal = null;
      return renderMenu();
  }
});
menuLayer.addEventListener('input', (e) => {
  const input = e.target as HTMLInputElement;
  const key = input.dataset.setting as keyof Settings | undefined;
  if (!key) return;
  if (input.type === 'range') {
    settings = { ...settings, [key]: Number(input.value) / 100 };
    const label = input.nextElementSibling;
    if (label) label.textContent = input.value;
  } else {
    settings = { ...settings, [key]: input.checked };
  }
  storeSettings(settings);
  audio.apply(settings);
  audio.play('coin');
});

// -----------------------------------------------------------------------------
// ロジックのイベント → 音・演出・字幕
// -----------------------------------------------------------------------------

function handleEvent(e: RunEvent) {
  renderer.onEvent(e, state);
  switch (e.type) {
    case 'result': {
      audio.play('reelStop');
      if (e.outcome === 'jackpot') {
        // 一瞬の静けさ → 重い確定音 → 金管の歓声 → 金貨。
        // 大金の初めての 777 は長く（約4秒）、それ以外は短く。金貨の量は払い戻しの桁で決める
        const big = e.payout.total >= 500;
        const long = big && !bigJackpotSeen;
        if (long) bigJackpotSeen = true;
        jackpot = {
          t: 0,
          length: long ? 4.2 : 2.2,
          machineId: e.machineId,
          coins: Math.min(140, 12 + Math.round(Math.log10(Math.max(1, e.payout.total)) * 25)),
        };
      } else if (e.outcome === 'big') {
        audio.play('winBig');
        shake = 8;
      } else if (e.outcome === 'miss') audio.play('miss');
      else audio.play('winSmall');
      break;
    }
    case 'confirm':
      if (e.outcome === 'jackpot') {
        save = { ...save, jackpots: save.jackpots + 1 };
        storeSave(save);
      }
      if (e.payout.total > 0) audio.play('coin');
      if (e.payout.bonus > 0 && state.items.includes('echo')) window.setTimeout(() => audio.play('winSmall', 0.6), 350);
      break;
    case 'rewindStart':
      audio.play('rewind');
      break;
    case 'rewindEnd':
      if (state.rewinds <= BALANCE.safeRewinds && !state.introDone) {
        // 最初の2回は安全に試せる
      }
      break;
    case 'traceStage':
      if (e.stage === 1) {
        audio.play('clockGlitch');
        say(TEXT.story.stage1);
      } else if (e.stage === 2) say(TEXT.story.stage2);
      else if (e.stage === 3) {
        audio.play('footstep', 0.6);
        say(TEXT.story.stage3, 4);
      }
      break;
    case 'noxEnter':
      audio.play('door');
      say(TEXT.story.noxEnter, 3.5, true);
      break;
    case 'hurt':
      audio.play('hurt');
      shake = 10;
      break;
    case 'shockwave':
      audio.play('shockwave');
      break;
    case 'dodge':
      audio.play('dodge');
      break;
    case 'roomChange':
      audio.play('door');
      hud.pendingBuy = null;
      break;
    case 'buy':
      audio.play('buy');
      break;
    case 'mirror':
      audio.play('clockGlitch', 0.5);
      break;
    case 'blocked':
      toast(e.reason === 'collecting' ? TEXT.story.blockedCollecting : TEXT.story.blockedUnconfirmed);
      break;
    case 'caught':
      audio.play('hurt');
      say(e.by === 'nox' ? TEXT.story.noxCatch : TEXT.story.guardCatch, 4, e.by === 'nox');
      resultAt = hud.time + 2.2;
      break;
    case 'escaped':
      audio.play('jackpotBrass', 0.6);
      resultAt = hud.time + 0.6;
      break;
  }
}

/** 導入の案内（壊れた台で、1枚 → 巻き戻し → 全額 → 受け取る を実際に操作させる） */
function updateGuide() {
  hud.guide = null;
  if (state.phase === 'caught' || state.phase === 'escaped') return;
  const broken = state.machines.find((m) => m.broken)!;
  if (!state.introDone) {
    const spin = state.spin;
    const near = nearbyMachine(state)?.id === broken.id;
    if (spin?.machineId === broken.id && spin.phase === 'result') {
      const all = spin.bet >= Math.min(broken.limit, state.chips + spin.bet);
      hud.guide = { text: all ? TEXT.tutorial.receive : TEXT.tutorial.rewindNow };
      return;
    }
    if (spin) return;
    if (!near) {
      if (state.room === 'entrance') hud.guide = { text: TEXT.tutorial.goBroken };
      return;
    }
    hud.guide = isPredicted(state, broken)
      ? { text: TEXT.tutorial.betAll, sub: TEXT.tutorial.safeLeft(Math.max(0, BALANCE.safeRewinds - state.rewinds)) }
      : { text: TEXT.tutorial.pullOne };
    return;
  }
  if (state.items.length === 0 && state.chips >= 200 && !state.spin) hud.guide = { text: TEXT.tutorial.shop };
}

// -----------------------------------------------------------------------------
// ループ
// -----------------------------------------------------------------------------

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (screen === 'game') {
    hud.time += dt;
    let mx = 0;
    let my = 0;
    if (keys.has('w')) my -= 1;
    if (keys.has('s')) my += 1;
    if (keys.has('a')) mx -= 1;
    if (keys.has('d')) mx += 1;
    const move = screenDirToRoom(mx, my);
    const spinBefore = state.spin?.phase;
    update(state, dt, { move, dodge: dodgeQueued, shockwave: shockQueued });
    dodgeQueued = false;
    shockQueued = false;
    if (spinBefore === 'spinning' && state.spin?.phase === 'spinning') {
      if (Math.random() < 0.5) audio.play('reelTick');
    }
    for (const e of state.events) handleEvent(e);
    state.events.length = 0;

    // 回収中の金貨（払い出し口の近くにいるあいだ）
    const spin = state.spin;
    if (spin?.phase === 'collecting') {
      coinTimer -= dt;
      if (coinTimer <= 0) {
        coinTimer = 0.04;
        const m = state.machines.find((x) => x.id === spin.machineId)!;
        const px = state.player.pos;
        if (Math.hypot(px.x - (m.x + 0.5), px.y - (m.y + 0.5)) <= BALANCE.collect.radius) {
          renderer.emitCollectCoin(state, m);
          if (Math.random() < 0.35) audio.play('coin', 0.5);
        }
      }
    }

    // 大当たりの演出（ゲームは止めない）
    if (jackpot) {
      const before = jackpot.t;
      jackpot.t += dt;
      const m = state.machines.find((x) => x.id === jackpot!.machineId)!;
      if (before < 0.35 && jackpot.t >= 0.35) {
        audio.play('jackpotThud');
        shake = 16;
      }
      if (before < 0.6 && jackpot.t >= 0.6) {
        audio.play('jackpotBrass');
        renderer.jackpotBurst(state, m, jackpot.coins);
      }
      if (jackpot.length > 3 && before < 1.6 && jackpot.t >= 1.6) renderer.jackpotBurst(state, m, jackpot.coins);
      if (jackpot.t >= jackpot.length) jackpot = null;
    }
    shake = Math.max(0, shake - dt * 30);

    updateGuide();
    if (resultAt > 0 && hud.time >= resultAt) {
      resultAt = 0;
      finishRun();
    }
  }

  const glow = jackpot && jackpot.t > 0.35 ? Math.max(0, 1 - (jackpot.t - 0.35) / (jackpot.length - 0.35)) : null;
  renderer.draw(state, screen === 'game' ? dt : 0, {
    settings,
    jackpotGlow: glow,
    shake,
    guideMachine: !state.introDone ? (state.machines.find((m) => m.broken)?.id ?? null) : null,
  });
  if (screen === 'title') drawTitleOverlay();
  if (screen !== 'title') ui.render(state, hud);
  requestAnimationFrame(frame);
}

/** タイトル画面: 客席の上に、紺の幕を下ろす */
function drawTitleOverlay() {
  const g = ctx.createLinearGradient(0, 0, 1920, 0);
  g.addColorStop(0, 'rgba(11,15,26,0.95)');
  g.addColorStop(0.55, 'rgba(11,15,26,0.55)');
  g.addColorStop(1, 'rgba(11,15,26,0.2)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1920, 1080);
}

// 開発時だけ: 画面確認の自動操作用に状態を見せる（本番のビルドには含まれない）
if (import.meta.env.DEV) {
  (window as unknown as { __tt: unknown }).__tt = {
    get state() {
      return state;
    },
    get save() {
      return save;
    },
  };
}

// タイトルの背景: 入口の客席に主人公を立たせる
state.player.pos = { x: 5.5, y: 3.4 };
state.player.facing = { x: 0, y: -1 };
// 同梱フォントを読んでから描き始める（部屋の背景は文字ごと使い回すため）
void loadFonts().then(() => {
  clearRoomCache();
  renderMenu();
  requestAnimationFrame(frame);
});

export type { BetChoice };
