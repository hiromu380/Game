/**
 * カットシーンの定義: 安全（長さの上限・光の回数と明るさ）・参照切れ（絵・ポーズ・効果音・文言）・必ず終わる
 */
import { describe, expect, it } from 'vitest';
import ja from '../src/i18n/ja.json';
import { SOUND_ASSETS } from '../src/audio/manifest';
import { CUTSCENE_CONFIG } from '../src/config/cutscene';
import { STORY_ASSET_NAMES } from '../src/story/assets';
import { SCENE_IDS } from '../src/story/playback';
import { RIGS } from '../src/story/rig';
import { demoTeaser } from '../src/story/scenes/demoTeaser';
import { ending } from '../src/story/scenes/ending';
import { gameOver } from '../src/story/scenes/gameOver';
import { SCENE_LOADERS } from '../src/story/scenes';
import { interlude1, interlude2 } from '../src/story/scenes/interludes';
import { opening } from '../src/story/scenes/opening';
import { checkScene, sampleScene, type Scene } from '../src/story/timeline';

const SCENES: Scene[] = [opening, interlude1, interlude2, gameOver, ending, demoTeaser];
const FULL = { strength: 'full' as const, shake: true, reduceFlashes: false };

/** 絵のキーが解決できるか（story/assets.ts の規則） */
function assetExists(key: string): boolean {
  if (/^rocket-[0-9]$/.test(key) || ['flame', 'smoke', 'logo'].includes(key)) return true;
  if (key.startsWith('part:')) return true;
  if (key.startsWith('story:')) return STORY_ASSET_NAMES.includes(key.slice(6));
  return false;
}

describe('カットシーンの定義', () => {
  it('すべてのシーンを一覧に登録している', () => {
    expect(Object.keys(SCENE_LOADERS).sort()).toEqual([...SCENE_IDS].sort());
    expect(SCENES.map((s) => s.id).sort()).toEqual([...SCENE_IDS].sort());
  });

  it.each(SCENES)('$id: 長さの上限・光の回数と明るさ・キーの順番', (scene) => {
    expect(checkScene(scene)).toEqual([]);
    expect(scene.duration).toBeLessThanOrEqual(CUTSCENE_CONFIG.maxDurationSec);
  });

  it.each(SCENES)('$id: 絵・ポーズ・表情・効果音・文言がすべてある', (scene) => {
    for (const track of scene.tracks) {
      if (track.kind === 'prop') {
        expect(assetExists(track.asset), `${scene.id}: ${track.asset}`).toBe(true);
        for (const k of track.keys)
          if (k.value.asset) expect(assetExists(k.value.asset), k.value.asset).toBe(true);
        continue;
      }
      const rig = RIGS[track.character];
      const faces = rig.parts.find(
        (p) => p.id === (track.character === 'bolt' ? 'head' : 'cab'),
      )!.files;
      for (const k of track.keys) {
        expect(
          k.value.pose in rig.poses || k.value.pose in (rig.views ?? {}),
          `${scene.id}: ${k.value.pose}`,
        ).toBe(true);
        if (k.value.face)
          expect(Object.keys(faces), `${scene.id}: ${k.value.face}`).toContain(k.value.face);
      }
    }
    for (const s of scene.sounds) expect(Object.keys(SOUND_ASSETS), s.key).toContain(s.key);
    for (const c of scene.captions ?? []) expect(Object.keys(ja), c.key).toContain(c.key);
  });

  it.each(SCENES)('$id: 長さを過ぎると必ず終わる（途中では終わらない）', (scene) => {
    expect(sampleScene(scene, scene.duration - 0.01, FULL).done).toBe(false);
    expect(sampleScene(scene, scene.duration, FULL).done).toBe(true);
  });

  it('幕間は短く（テンポを損なわない）、ゲームオーバーは数秒', () => {
    expect(interlude1.duration).toBeLessThanOrEqual(10);
    expect(interlude2.duration).toBeLessThanOrEqual(10);
    expect(gameOver.duration).toBeLessThanOrEqual(5);
  });
});
