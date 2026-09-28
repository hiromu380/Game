/**
 * ゲーム本体の遅延読み込み（コード分割）
 *
 * PixiJS と盤面描画・演出はサイズが大きいので、最初の画面（タイトル）には含めない。
 * タイトルを出した直後から裏で読み込み始め、進捗をタイトルに表示する。
 *
 * 進捗は「読み込みが終わった部品の数 ÷ 全部品の数」:
 *   ゲーム本体のコード（1つ・重みは画像の数と同じ） + パーツ画像（アセットマニフェストの画像の数）
 */
import { PART_IDS } from '@chain-factory/sim';
import type * as AppModule from '../App';
import { PART_ASSETS } from '../assets/manifest';

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

/** ゲーム本体を読み込む（何度呼んでも読み込みは1回）。onProgress には 0〜1 を渡す */
export function loadGame(onProgress: (ratio: number) => void = () => {}): Promise<GameModule> {
  if (loading) return loading;
  const images = PART_IDS.map((id) => PART_ASSETS[id].src);
  const codeWeight = images.length;
  const total = codeWeight + images.length;
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
  ]).then(([module]) => module);
  // 失敗したら次に呼ばれたときにやり直す（通信が一瞬切れた場合など）
  loading.catch(() => {
    loading = null;
  });
  return loading;
}
