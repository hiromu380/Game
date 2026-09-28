/**
 * ゲーム本体の遅延読み込み（コード分割）
 *
 * PixiJS と盤面描画・演出はサイズが大きいので、最初の画面（タイトル）には含めない。
 * タイトルを出した直後から裏で読み込み始め、進捗をタイトルに表示する。
 *
 * 進捗は「読み込みが終わった部品の数 ÷ 全部品の数」:
 *   ゲーム本体のコード（1つ・重みは画像の数と同じ） + パーツ画像（アセットマニフェストの画像の数）
 *   + フォント（太さの数）
 *
 * フォントを先に読み込むのは、盤面の文字（キャンバス）はフォントが後から届いても描き直されないため。
 */
import { PART_IDS } from '@chain-factory/sim';
import type * as AppModule from '../App';
import { PART_ASSETS } from '../assets/manifest';
import { FONT_FAMILY_NAME, FONT_WEIGHTS } from '../config/fonts';
import { MESSAGES } from '../i18n';

export type GameModule = typeof AppModule;

let loading: Promise<GameModule> | null = null;

/** 画像を1枚読み込んでデコードしておく（盤面の初期化時にキャッシュから即座に使える） */
async function preloadImage(src: string): Promise<void> {
  const image = new Image();
  image.src = src;
  try {
    await image.decode();
  } catch {
    // 画像の失敗はゲーム本体の読み込みを止めない（盤面側で改めて読み込む）
  }
}

/**
 * 同梱フォントを、画面に出しうる文字の分だけ先に読み込む（文言ファイルの全文字 + 数字・記号）。
 * 失敗しても続ける（予備のフォントで描かれるだけ）
 */
async function preloadFont(weight: number): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const text = [
    ...new Set(
      Object.values(MESSAGES)
        .flatMap((m) => Object.values(m))
        .join(''),
    ),
  ].join('');
  try {
    await document.fonts.load(`${weight} 16px '${FONT_FAMILY_NAME}'`, `0123456789.,+-×%KMB${text}`);
  } catch {
    // 予備のフォントで続ける
  }
}

/** ゲーム本体を読み込む（何度呼んでも読み込みは1回）。onProgress には 0〜1 を渡す */
export function loadGame(onProgress: (ratio: number) => void = () => {}): Promise<GameModule> {
  if (loading) return loading;
  const images = PART_IDS.map((id) => PART_ASSETS[id].src);
  const codeWeight = images.length;
  const total = codeWeight + images.length + FONT_WEIGHTS.length;
  let done = 0;
  const advance = (weight: number) => {
    done += weight;
    onProgress(Math.min(1, done / total));
  };

  loading = Promise.all([
    import('../App').then((module) => {
      advance(codeWeight);
      return module;
    }),
    ...images.map((src) => preloadImage(src).then(() => advance(1))),
    ...FONT_WEIGHTS.map((weight) => preloadFont(weight).then(() => advance(1))),
  ]).then(([module]) => module);
  // 失敗したら次に呼ばれたときにやり直す（通信が一瞬切れた場合など）
  loading.catch(() => {
    loading = null;
  });
  return loading;
}
