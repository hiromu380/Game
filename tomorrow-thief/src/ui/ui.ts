/**
 * 画面の UI（HTML を重ねる）。描き直しは中身が変わったときだけ（ボタンの押しやすさを保つ）
 *
 * 元金（賭け金）・払い戻し（元金込み）・利益を、すべて別の行で表示して混同させない
 */
import { BALANCE, SLOT_TABLE, collectSeconds } from '../config/balance';
import { itemDef, payoutFor, type ItemId } from '../core/items';
import {
  bankedAmount,
  betAmount,
  isPredicted,
  maxBet,
  nearbyFixture,
  nearbyMachine,
  noxIncomingDoor,
  type BetChoice,
} from '../core/run';
import { multiplierText, TOTAL_WEIGHT, type SymbolId } from '../core/slot';
import type { Machine, RunState } from '../core/types';
import type { SaveData, Settings } from '../save';
import { TEXT } from '../strings';
import { EYE, HEART, ITEM_ICON } from './icons';

const SYMBOL_TEXT: Record<SymbolId, string> = {
  seven: '7',
  bar: 'BAR',
  bell: '🔔',
  cherry: '🍒',
  clock: '🕰',
};

export const reelsText = (reels: readonly SymbolId[]) => reels.map((s) => SYMBOL_TEXT[s]).join(' ');

function el(id: string, root: HTMLElement): HTMLElement {
  let node = root.querySelector<HTMLElement>(`[data-id="${id}"]`);
  if (!node) {
    node = document.createElement('div');
    node.dataset.id = id;
    root.appendChild(node);
  }
  return node;
}

/** 中身が変わったときだけ書き換える */
function setHTML(node: HTMLElement, html: string, className: string) {
  if (node.dataset.html !== html) {
    node.innerHTML = html;
    node.dataset.html = html;
  }
  if (node.className !== className) node.className = className;
}

function hide(node: HTMLElement) {
  node.style.display = 'none';
}
function show(node: HTMLElement) {
  node.style.display = '';
}

const fmt = (n: number) => n.toLocaleString('ja-JP');

export interface UiHandlers {
  setBet: (choice: BetChoice) => void;
  pull: () => void;
  confirm: () => void;
  rewind: () => void;
  buy: (offer: number, replace?: number) => void;
  repair: () => void;
  bank: () => void;
}

export interface HudState {
  betChoice: BetChoice;
  /** 装備がいっぱいのときに買おうとしている品 */
  pendingBuy: number | null;
  subtitle: { text: string; nox: boolean; until: number } | null;
  toast: { text: string; until: number } | null;
  guide: { text: string; sub?: string } | null;
  time: number;
}

export class GameUi {
  constructor(
    private readonly root: HTMLElement,
    private readonly handlers: UiHandlers,
  ) {
    root.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!target || (target as HTMLButtonElement).disabled) return;
      const [act, a, b] = target.dataset.act!.split(':');
      switch (act) {
        case 'bet':
          this.handlers.setBet(a as BetChoice);
          break;
        case 'pull':
          this.handlers.pull();
          break;
        case 'confirm':
          this.handlers.confirm();
          break;
        case 'rewind':
          this.handlers.rewind();
          break;
        case 'buy':
          this.handlers.buy(Number(a), b === undefined ? undefined : Number(b));
          break;
        case 'repair':
          this.handlers.repair();
          break;
        case 'bank':
          this.handlers.bank();
          break;
      }
    });
  }

  clear() {
    this.root.innerHTML = '';
  }

  render(state: RunState, hud: HudState) {
    this.money(state);
    this.clock(state);
    this.bottom(state);
    this.panels(state, hud);
    this.overlays(hud);
  }

  private money(state: RunState) {
    const node = el('money', this.root);
    show(node);
    setHTML(
      node,
      `<div class="label">${TEXT.chips}</div>
       <div class="chips">${fmt(state.chips)}</div>
       <div class="row"><span>${TEXT.profit}</span><b>${state.profit >= 0 ? '+' : ''}${fmt(state.profit)}</b></div>
       ${state.safe > 0 ? `<div class="row"><span>${TEXT.safe}</span><b style="color:var(--teal)">${fmt(state.safe)}</b></div>` : ''}
       <div class="room">${TEXT.room[state.rooms[state.room]!.kind]}</div>`,
      'frame hud-money',
    );
  }

  /** 右上: 巻き戻しの痕跡を示す時計（針が逆回りに進み、支配人が近いと赤くなる） */
  private clock(state: RunState) {
    const node = el('clock', this.root);
    show(node);
    const stage = Math.min(BALANCE.nox.appearAt, state.trace);
    const hand = -(state.trace * 40) - 90;
    const r = (deg: number, len: number) => {
      const a = (deg * Math.PI) / 180;
      return `${50 + Math.cos(a) * len},${50 + Math.sin(a) * len}`;
    };
    const ticks = Array.from({ length: 12 }, (_, i) => {
      const a = i * 30;
      return `<line x1="${r(a, 38).split(',')[0]}" y1="${r(a, 38).split(',')[1]}" x2="${r(a, 44).split(',')[0]}" y2="${r(a, 44).split(',')[1]}" stroke="#D7AB52" stroke-width="${i % 3 ? 1.5 : 3}"/>`;
    }).join('');
    // 痕跡の弧（青緑。支配人が現れたら赤）
    const arcEnd = Math.min(state.trace, 9) * 40;
    const arcColor = state.nox.active ? '#E35A5F' : '#55DEE4';
    const arc =
      state.trace > 0
        ? `<path d="M50 6 A44 44 0 ${arcEnd > 180 ? 1 : 0} 0 ${r(-90 - arcEnd, 44)}" fill="none" stroke="${arcColor}" stroke-width="5" stroke-linecap="round"/>`
        : '';
    const incoming = noxIncomingDoor(state);
    const sameRoom = state.nox.active && state.nox.room === state.room;
    const status = sameRoom
      ? `<div class="label warn">ミスター・ノクス</div>`
      : incoming
        ? `<div class="label warn">${TEXT.story.noxIncoming}</div>`
        : stage > 0
          ? `<div class="label" style="color:var(--teal)">${['', '時計の異変', '視線', '足音'][stage]}</div>`
          : '';
    setHTML(
      node,
      `<svg viewBox="0 0 100 100" aria-hidden="true">
         <circle cx="50" cy="50" r="46" fill="#0B0F1A" stroke="${sameRoom ? '#E35A5F' : '#D7AB52'}" stroke-width="3"/>
         ${ticks}${arc}
         <line x1="50" y1="50" x2="${r(hand, 32).split(',')[0]}" y2="${r(hand, 32).split(',')[1]}" stroke="#EFE6D6" stroke-width="3" stroke-linecap="round"/>
         <circle cx="50" cy="50" r="4" fill="#FFD86A"/>
       </svg>
       <div class="label">${TEXT.trace} ${state.trace}　${TEXT.rewinds(state.rewinds)}</div>${status}`,
      `frame hud-clock${sameRoom ? ' red' : ''}`,
    );
  }

  private bottom(state: RunState) {
    const node = el('bottom', this.root);
    show(node);
    const hp = Array.from({ length: BALANCE.player.hp }, (_, i) => HEART(i < state.player.hp)).join('');
    const slots = Array.from({ length: BALANCE.items.maxEquipped }, (_, i) => {
      const id = state.items[i];
      if (!id) return `<div class="slot">${TEXT.emptySlot}</div>`;
      const badge = id === 'mirror' ? `<span class="badge">${state.mirrorCharges}</span>` : '';
      return `<div class="slot" title="${TEXT.item[id].name}: ${TEXT.item[id].desc}">${ITEM_ICON[id]}${badge}</div>`;
    }).join('');
    const p = state.player;
    const cd = (label: string, key: string, t: number) =>
      `<div class="${t <= 0 ? 'ready' : ''}"><kbd>${key}</kbd>${label} ${t <= 0 ? 'OK' : t.toFixed(1)}</div>`;
    setHTML(
      node,
      `<div><div style="font-size:16px;color:var(--muted)">${TEXT.hp}</div><div class="hp">${hp}</div></div>
       <div><div style="font-size:16px;color:var(--muted)">${TEXT.items}</div><div class="slots">${slots}</div></div>
       <div class="cooldowns">${cd('回避', 'Space', p.dodgeCooldown)}${cd('衝撃波', '左クリック', p.shockCooldown)}${p.boots > 0 ? `<div style="color:var(--teal)">秒針ブーツ ${p.boots.toFixed(1)}</div>` : ''}</div>`,
      'frame hud-bottom',
    );
  }

  private panels(state: RunState, hud: HudState) {
    const machineNode = el('machine', this.root);
    const shopNode = el('shop', this.root);
    const exitNode = el('exit', this.root);
    hide(machineNode);
    hide(shopNode);
    hide(exitNode);
    if (state.phase !== 'playing' && state.phase !== 'rewinding') return;

    const spinMachine = state.spin ? state.machines.find((m) => m.id === state.spin!.machineId)! : null;
    const m = spinMachine ?? nearbyMachine(state);
    if (m) {
      show(machineNode);
      this.machinePanel(machineNode, state, m, hud);
      return;
    }
    if (nearbyFixture(state, 'shopCounter')) {
      show(shopNode);
      this.shopPanel(shopNode, state, hud);
      return;
    }
    if (nearbyFixture(state, 'exitCounter')) {
      show(exitNode);
      const banked = state.chips + state.safe;
      setHTML(
        exitNode,
        `<h2>${TEXT.exit.title}</h2>
         <p class="hint" style="font-size:19px">${TEXT.exit.hint}</p>
         <div class="actions"><button class="primary" data-act="bank"><kbd>E</kbd>${TEXT.exit.take(fmt(banked))}</button></div>`,
        'frame machine-panel interactive',
      );
    }
  }

  private machinePanel(node: HTMLElement, state: RunState, m: Machine, hud: HudState) {
    const spin = state.spin?.machineId === m.id ? state.spin : null;
    const predicted = isPredicted(state, m);
    const limit = maxBet(state, m);
    const machineLimit = predicted && state.items.includes('glove') ? m.limit * BALANCE.items.glove.limitMul : m.limit;
    const title = m.broken ? (m.broken === 'dead' ? TEXT.machine.dead : TEXT.machine.broken) : TEXT.room[state.rooms[m.room]!.kind];
    const head = `<div class="head"><h3>${title}</h3><span class="limit${machineLimit > m.limit ? ' boost' : ''}">${
      machineLimit > m.limit ? TEXT.machine.limitBoosted(machineLimit) : TEXT.machine.limit(m.limit)
    }</span></div>`;

    // 抽選中・結果・回収中
    if (spin) {
      const p = spin.payout;
      const lines = `<dl class="breakdown">
          <dt>${TEXT.machine.bet}</dt><dd>${fmt(p.bet)}</dd>
          <dt>${TEXT.machine.payout}</dt><dd class="plus">${fmt(p.total)}${p.bonus > 0 ? `<small>（+${fmt(p.bonus)}）</small>` : ''}</dd>
          <dt>${TEXT.machine.profit}</dt><dd class="${p.profit >= 0 ? 'plus' : 'minus'}">${p.profit >= 0 ? '+' : ''}${fmt(p.profit)}</dd>
          ${p.safe > 0 ? `<dt>${TEXT.safe}</dt><dd style="color:var(--teal)">${fmt(p.safe)}</dd>` : ''}
        </dl>`;
      if (spin.phase === 'spinning' || state.phase === 'rewinding') {
        setHTML(node, `${head}<div class="result-name miss">${state.phase === 'rewinding' ? '……' : TEXT.machine.spinning}</div>`, 'frame machine-panel');
        return;
      }
      if (spin.phase === 'result') {
        const win = p.total > p.bet;
        setHTML(
          node,
          `${head}
           <div class="result-name ${win ? '' : 'miss'}">${spin.result.outcome === 'jackpot' ? TEXT.outcome.jackpot : `${TEXT.outcome[spin.result.outcome]}　${reelsText(spin.result.reels)}`}</div>
           ${lines}
           <div class="actions">
             <button class="primary" data-act="confirm"><kbd>E</kbd>${TEXT.machine.receive}</button>
             <button class="teal" data-act="rewind"><kbd>Q</kbd>${TEXT.machine.rewind}</button>
           </div>
           <div class="hint">回収 ${TEXT.machine.seconds(spin.collectSeconds)}　${win ? '' : '巻き戻せば、賭けた分が戻る'}</div>`,
          'frame machine-panel interactive',
        );
        return;
      }
      const target = p.total - p.safe;
      const pct = target > 0 ? Math.floor((spin.collected / target) * 100) : 100;
      setHTML(
        node,
        `${head}
         <div class="result-name">${TEXT.machine.collecting}　${fmt(Math.floor(spin.collected))} / ${fmt(target)}</div>
         <div class="collect-bar"><div style="width:${pct}%"></div></div>
         <div class="hint">${TEXT.machine.collectHint}</div>`,
        'frame machine-panel',
      );
      return;
    }

    if (m.broken === 'dead') {
      setHTML(node, `<div class="head"><h3>${TEXT.machine.dead}</h3></div><p class="hint">${TEXT.machine.deadHint}</p>`, 'frame machine-panel');
      return;
    }

    // 賭ける前
    const known = predicted ? state.knowledge[m.id]! : null;
    const future = known
      ? `<div class="future known">${EYE}<span>${TEXT.machine.next}: <b>${TEXT.outcome[known.outcome]}</b></span><span class="reels">${reelsText(known.reels)}</span></div>`
      : `<div class="future">${TEXT.machine.unknown}</div>`;
    const choices: BetChoice[] = ['small', 'half', 'all'];
    const bets = choices
      .map((c, i) => {
        const amount = betAmount(state, m, c);
        return `<button data-act="bet:${c}" class="${hud.betChoice === c ? 'selected' : ''}" ${amount <= 0 ? 'disabled' : ''}><kbd>${i + 1}</kbd>${TEXT.machine[c]}<small>${fmt(amount)}</small></button>`;
      })
      .join('');
    const bet = betAmount(state, m, hud.betChoice);
    let detail: string;
    if (known) {
      const p = payoutFor(bet, known.outcome, state.items);
      detail = `<dl class="breakdown">
          <dt>${TEXT.machine.bet}</dt><dd>${fmt(bet)}</dd>
          <dt>${TEXT.machine.payout}</dt><dd class="plus">${fmt(p.total)}</dd>
          <dt>${TEXT.machine.profit}</dt><dd class="${p.profit >= 0 ? 'plus' : 'minus'}">${p.profit >= 0 ? '+' : ''}${fmt(p.profit)}</dd>
          <dt>${TEXT.machine.collect}</dt><dd>${TEXT.machine.seconds(collectSeconds(p.total - p.safe))}</dd>
        </dl>`;
    } else {
      const rows = SLOT_TABLE.map((o) => {
        const p = payoutFor(bet, o.id, state.items);
        return `<b>${TEXT.outcome[o.id]}</b> ${((o.weight / TOTAL_WEIGHT) * 100).toFixed(0)}%・${multiplierText(o.id)}倍 → ${fmt(p.total)}`;
      }).join('<br>');
      detail = `<dl class="breakdown"><dt>${TEXT.machine.bet}</dt><dd>${fmt(bet)}</dd></dl><p class="odds">${rows}<br>${TEXT.machine.includesBet}</p>`;
    }
    setHTML(
      node,
      `${head}${future}<div class="bets">${bets}</div>${detail}
       <div class="actions"><button class="primary" data-act="pull" ${bet <= 0 || limit <= 0 ? 'disabled' : ''}><kbd>E</kbd>${bet <= 0 ? TEXT.machine.noChips : TEXT.machine.pull}</button></div>`,
      'frame machine-panel interactive',
    );
  }

  private shopPanel(node: HTMLElement, state: RunState, hud: HudState) {
    const offers = state.shop.offers
      .map((id, i) => {
        if (!id) return `<div class="offer"><div></div><div class="desc">${TEXT.shop.soldOut}</div><div></div></div>`;
        const price = itemDef(id).price;
        return `<div class="offer">${ITEM_ICON[id]}<div><div class="name">${TEXT.item[id].name}</div><div class="desc">${TEXT.item[id].desc}</div></div>
          <button data-act="buy:${i}" ${state.chips < price ? 'disabled' : ''}>${TEXT.shop.buy}<br><small>${TEXT.shop.price(price)}</small></button></div>`;
      })
      .join('');
    const repairDisabled = state.chips < BALANCE.items.repair.price || state.player.hp >= BALANCE.player.hp;
    const replace =
      hud.pendingBuy !== null && state.items.length >= BALANCE.items.maxEquipped
        ? `<div class="replace"><div>${TEXT.shop.replace}</div><div class="slots">${state.items
            .map((id: ItemId, i) => `<div class="slot" data-act="buy:${hud.pendingBuy}:${i}" title="${TEXT.item[id].name}">${ITEM_ICON[id]}</div>`)
            .join('')}</div></div>`
        : '';
    setHTML(
      node,
      `<h2>${TEXT.shop.title}</h2><p class="hint">${TEXT.shop.subtitle}</p>${offers}
       <div class="offer"><div></div><div class="name" style="font-size:18px">${TEXT.shop.repair}</div>
       <button data-act="repair" ${repairDisabled ? 'disabled' : ''}>${TEXT.shop.buy}<br><small>${TEXT.shop.price(BALANCE.items.repair.price)}</small></button></div>${replace}`,
      'frame shop-panel interactive',
    );
  }

  private overlays(hud: HudState) {
    const sub = el('subtitle', this.root);
    if (hud.subtitle && hud.subtitle.until > hud.time) {
      show(sub);
      setHTML(sub, hud.subtitle.text, `subtitle${hud.subtitle.nox ? ' nox' : ''}`);
    } else hide(sub);
    const guide = el('guide', this.root);
    if (hud.guide) {
      show(guide);
      setHTML(guide, `${hud.guide.text}${hud.guide.sub ? `<small>${hud.guide.sub}</small>` : ''}`, 'guide');
    } else hide(guide);
    const toast = el('toast', this.root);
    if (hud.toast && hud.toast.until > hud.time) {
      show(toast);
      setHTML(toast, hud.toast.text, 'toast');
    } else hide(toast);
  }
}

// -----------------------------------------------------------------------------
// 全画面のメニュー
// -----------------------------------------------------------------------------

export function titleScreen(save: SaveData): string {
  const left = Math.max(0, TEXT.ownershipGoal - save.bankedTotal);
  return `<div class="screen" data-screen="title">
    <div class="title-block"><h1>${TEXT.title}</h1><div class="en">${TEXT.titleEn}</div><div class="tag">${TEXT.tagline}</div></div>
    <div class="menu title-menu">
      <button class="primary" data-menu="start">${TEXT.start}</button>
      <button data-menu="records">${TEXT.records}</button>
      <button data-menu="controls">${TEXT.controls}</button>
      <button data-menu="settings">${TEXT.settings}</button>
    </div>
    <div class="title-progress">${TEXT.result.total(fmt(save.bankedTotal))}　／　${TEXT.result.goal(fmt(left))}</div>
  </div>`;
}

export function pauseScreen(): string {
  return `<div class="screen dim" data-screen="pause"><div class="frame dialog" style="position:relative"><h2>${TEXT.paused}</h2>
    <div class="menu">
      <button class="primary" data-menu="resume">${TEXT.resume}</button>
      <button data-menu="controls">${TEXT.controls}</button>
      <button data-menu="settings">${TEXT.settings}</button>
      <button data-menu="title">${TEXT.toTitle}</button>
    </div></div></div>`;
}

export function controlsScreen(): string {
  const rows = TEXT.controlsList.map(([k, v]) => `<tr><td><kbd>${k}</kbd></td><td style="text-align:left">${v}</td></tr>`).join('');
  return `<div class="screen dim" data-screen="controls"><div class="frame dialog" style="position:relative"><h2>${TEXT.controls}</h2>
    <table>${rows}</table><button data-menu="back">${TEXT.back}</button></div></div>`;
}

export function recordsScreen(save: SaveData): string {
  const r = TEXT.recordsList;
  const rows: [string, number][] = [
    [r.banked, save.bankedTotal],
    [r.runs, save.runs],
    [r.escapes, save.escapes],
    [r.captures, save.captures],
    [r.jackpots, save.jackpots],
    [r.best, save.bestHaul],
  ];
  return `<div class="screen dim" data-screen="records"><div class="frame dialog" style="position:relative"><h2>${TEXT.records}</h2>
    <table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${fmt(v)}</td></tr>`).join('')}</table>
    <button data-menu="back">${TEXT.back}</button></div></div>`;
}

export function settingsScreen(s: Settings): string {
  const L = TEXT.settingsList;
  const range = (key: 'master' | 'bgm' | 'se') =>
    `<label class="setting"><span>${L[key]}</span><input type="range" min="0" max="100" value="${Math.round(s[key] * 100)}" data-setting="${key}"><span>${Math.round(s[key] * 100)}</span></label>`;
  const check = (key: 'shake' | 'flash' | 'afterimage') =>
    `<label class="setting"><span>${L[key]}</span><input type="checkbox" ${s[key] ? 'checked' : ''} data-setting="${key}"><span></span></label>`;
  return `<div class="screen dim" data-screen="settings"><div class="frame dialog" style="position:relative"><h2>${TEXT.settings}</h2>
    ${range('master')}${range('bgm')}${range('se')}${check('shake')}${check('flash')}${check('afterimage')}
    <button data-menu="back">${TEXT.back}</button></div></div>`;
}

export function resultScreen(state: RunState, save: SaveData, unlocked: string[]): string {
  const banked = bankedAmount(state);
  const caught = state.phase === 'caught';
  const lines: string[] = [];
  if (caught) {
    lines.push(`<div class="nox">${state.caughtBy === 'nox' ? TEXT.story.noxCatch : TEXT.story.guardCatch}</div>`);
    lines.push(TEXT.result.lost(fmt(state.chips)));
    if (state.safe > 0) lines.push(`<span class="teal">${TEXT.result.safeKept(fmt(state.safe))}</span>`);
  }
  lines.push(TEXT.result.total(fmt(save.bankedTotal)));
  lines.push(TEXT.result.goal(fmt(Math.max(0, TEXT.ownershipGoal - save.bankedTotal))));
  for (const name of unlocked) lines.push(`<span class="teal">${TEXT.result.unlocked(name)}</span>`);
  return `<div class="screen dim" data-screen="result"><div class="frame dialog${caught ? ' red' : ''}" style="position:relative;text-align:center">
    <h2>${caught ? TEXT.result.caught : TEXT.result.escaped}</h2>
    <div class="result-big">${fmt(banked)}<small> ${TEXT.result.chipsUnit}</small></div>
    <div class="result-lines">${lines.join('<br>')}</div>
    <div class="menu" style="margin:0 auto;max-width:360px">
      <button class="primary" data-menu="again">${TEXT.result.again}</button>
      <button data-menu="title">${TEXT.toTitle}</button>
    </div></div></div>`;
}

export function itemName(id: ItemId) {
  return TEXT.item[id].name;
}
