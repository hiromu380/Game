/**
 * 道具アイコン（512×512 基準の SVG。48〜64px でも種類が分かる形）
 * 深い紺の輪郭、金と青緑の小さな光で統一する
 */
import type { ItemId } from '../core/items';
import { PALETTE as C } from '../render/palette';

const wrap = (body: string) =>
  `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">${body}</svg>`;

const O = `stroke="${C.navy}" stroke-width="22" stroke-linejoin="round" stroke-linecap="round"`;

export const ITEM_ICON: Record<ItemId, string> = {
  boots: wrap(
    `<path d="M170 90 h120 v210 l120 40 q40 14 40 60 v32 H120 v-70 q0-30 30-40 z" fill="#3A4A72" ${O}/>
     <path d="M120 432 H450" ${O} fill="none"/>
     <path d="M80 300 a110 110 0 0 1 60 -130" fill="none" stroke="${C.teal}" stroke-width="20" stroke-linecap="round"/>
     <path d="M60 380 a160 160 0 0 1 30 -120" fill="none" stroke="${C.teal}" stroke-width="14" stroke-linecap="round" opacity="0.7"/>`,
  ),
  glove: wrap(
    `<circle cx="256" cy="256" r="200" fill="none" stroke="${C.gold}" stroke-width="16" opacity="0.6"/>
     <circle cx="256" cy="256" r="150" fill="none" stroke="${C.gold}" stroke-width="10" opacity="0.4"/>
     <path d="M190 420 v-150 l-30-60 q-10-30 15-35 q20-4 35 25 l20 40 v-150 q0-25 22-25 q22 0 22 25 v120 v-150 q0-25 22-25 q22 0 22 25 v150 v-120 q0-25 22-25 q22 0 22 25 v200 q0 60-50 90 v35 z" fill="${C.ivory}" ${O}/>`,
  ),
  mirror: wrap(
    `<ellipse cx="256" cy="230" rx="140" ry="180" fill="#9FE9EC" ${O}/>
     <path d="M256 50 v-0" ${O}/>
     <path d="M200 120 l60 100 l-40 60 l70 90" fill="none" stroke="${C.navy}" stroke-width="12"/>
     <rect x="226" y="400" width="60" height="70" rx="10" fill="${C.oldGold}" ${O}/>
     <text x="300" y="250" font-size="120" font-weight="700" fill="${C.red}" font-family="Georgia">7</text>`,
  ),
  echo: wrap(
    `<circle cx="300" cy="280" r="150" fill="${C.oldGold}" opacity="0.35"/>
     <circle cx="230" cy="250" r="160" fill="${C.gold}" ${O}/>
     <circle cx="230" cy="250" r="105" fill="none" stroke="${C.brass}" stroke-width="16"/>
     <text x="230" y="300" font-size="150" font-weight="700" text-anchor="middle" fill="${C.navy}" font-family="Georgia">¢</text>`,
  ),
  receipt: wrap(
    `<rect x="70" y="140" width="372" height="250" rx="20" fill="${C.oldGold}" ${O}/>
     <path d="M70 160 L256 300 L442 160" fill="none" ${O}/>
     <circle cx="256" cy="250" r="36" fill="${C.navy}"/>
     <circle cx="256" cy="250" r="22" fill="${C.teal}"/>
     <path d="M256 250 v-14 M256 250 h12" stroke="${C.navy}" stroke-width="6"/>`,
  ),
  contract: wrap(
    `<path d="M120 60 h220 l60 60 v330 H120 z" fill="${C.ivory}" ${O}/>
     <path d="M340 60 v60 h60" fill="none" ${O}/>
     <path d="M165 180 h190 M165 230 h190 M165 280 h150" stroke="${C.oldGold}" stroke-width="16" stroke-linecap="round"/>
     <path d="M120 360 q140 -60 280 0 v90 H120 z" fill="${C.red}" opacity="0.85"/>
     <path d="M170 400 q40 -40 80 0 t80 0" fill="none" stroke="${C.gold}" stroke-width="12"/>`,
  ),
};

/** 体力のアイコン（懐中時計の形） */
export const HEART = (full: boolean) =>
  `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="18" r="11" fill="${full ? C.oldGold : 'none'}" stroke="${full ? C.gold : '#5A5A6A'}" stroke-width="3"/><rect x="13" y="3" width="6" height="5" rx="1" fill="${full ? C.gold : '#5A5A6A'}"/>${full ? `<path d="M16 18 v-6 M16 18 h5" stroke="${C.navy}" stroke-width="2"/>` : ''}</svg>`;

/** 予知の目 */
export const EYE = `<svg viewBox="0 0 32 20" aria-hidden="true"><path d="M2 10 Q16 -4 30 10 Q16 24 2 10 Z" fill="none" stroke="${C.teal}" stroke-width="2.5"/><circle cx="16" cy="10" r="4" fill="${C.teal}"/></svg>`;
