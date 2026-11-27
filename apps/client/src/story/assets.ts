/**
 * カットシーンの絵のキー → URL（アセットマニフェスト経由。必要なときに読み込む）
 *
 * - 'rocket-<0〜9>'・'flame'・'smoke': ロケット（上部の背景と同じ絵）
 * - 'part:<パーツID>': パーツのアイコン
 * - 'logo': ロゴ（暗い背景用）
 * - 'story:<名前>': カットシーン用の背景・小物（art/story/ で生成。src/assets/story/<名前>.svg）
 */
import type { PartId } from '@chain-factory/sim';
import { LOGO_ASSETS, PART_ASSETS, ROCKET_ASSETS } from '../assets/manifest';

const storyFiles = import.meta.glob<string>('../assets/story/*.svg', {
  query: '?url',
  import: 'default',
});

export async function resolveStoryAsset(key: string): Promise<string> {
  if (key.startsWith('rocket-')) {
    const src = ROCKET_ASSETS.stages[Number(key.slice(7))];
    if (src) return src;
  }
  if (key === 'flame') return ROCKET_ASSETS.flame;
  if (key === 'smoke') return ROCKET_ASSETS.smoke;
  if (key === 'logo') return LOGO_ASSETS.darkBackground;
  if (key.startsWith('part:')) {
    const part = PART_ASSETS[key.slice(5) as PartId];
    if (part) return part.src;
  }
  if (key.startsWith('story:')) {
    const load = storyFiles[`../assets/story/${key.slice(6)}.svg`];
    if (load) return load();
  }
  throw new Error(`unknown story asset: ${key}`);
}

/** カットシーン用の絵の名前の一覧（テストで参照切れを確かめる） */
export const STORY_ASSET_NAMES = Object.keys(storyFiles).map((k) =>
  k.replace('../assets/story/', '').replace('.svg', ''),
);
