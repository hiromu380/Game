import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const client = join(__dirname, '..');
const catalog = JSON.parse(readFileSync(join(client, 'sprites/catalog.json'), 'utf8')) as {
  groups: {
    items: { id: string; size: [number, number]; frames: number; variants?: string[] }[];
  }[];
};
const items = catalog.groups.flatMap((g) => g.items);

describe('絵の一覧（sprites/catalog.json）', () => {
  it('ID は重ならず、大きさとコマ数がある', () => {
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    for (const i of items) {
      expect(i.id).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(i.size[0]).toBeGreaterThan(0);
      expect(i.size[1]).toBeGreaterThan(0);
      expect(i.frames).toBeGreaterThanOrEqual(1);
    }
  });

  it('プロンプト集と仕様書に、すべての絵（種類ごと）が載っている', () => {
    const prompts = readFileSync(join(client, '../docs/sprites/prompts.md'), 'utf8');
    const spec = readFileSync(join(client, '../docs/sprites/spec.md'), 'utf8');
    for (const i of items) {
      expect(spec).toContain(`\`${i.id}\``);
      for (const v of i.variants ?? [null]) {
        const name = v ? `${i.id}__${v}` : i.id;
        expect(prompts).toContain(`\`${name}\``);
      }
    }
  });

  it('取り込んだ絵の一覧（manifest.json）のファイルがそろっている', () => {
    const path = join(client, 'src/art/sprites/manifest.json');
    if (!existsSync(path)) return;
    const manifest = JSON.parse(readFileSync(path, 'utf8')) as Record<string, { files: string[] }>;
    for (const entry of Object.values(manifest))
      for (const f of entry.files)
        expect(existsSync(join(client, 'src/assets/sprites', f))).toBe(true);
  });
});

describe('稽古場の絵の並べ方', () => {
  it('奥の壁を先に置き、筋トレの器具は稽古場の改修2段目から', async () => {
    const { keikobaLayout, WEIGHTS_FROM_DOJO } = await import('../src/art/sprites/keikoba');
    const at = (dojo: number) =>
      keikobaLayout({ player: { facilities: { dojo } } } as never).map((p) => p.sprite);
    expect(at(0)[0]).toBe('keikoba_back');
    expect(at(0)).not.toContain('weights');
    expect(at(WEIGHTS_FROM_DOJO)).toContain('weights');
  });

  it('改修3段目は今どきの稽古場。外観の寮は増築の段で変わる', async () => {
    const { keikobaLayout, exteriorLayout, MODERN_FROM_DOJO } =
      await import('../src/art/sprites/keikoba');
    const g = (dojo: number, dorm: number) =>
      ({ bashoIndex: 0, player: { facilities: { dojo, dorm, trainer: 0 } } }) as never;
    expect(keikobaLayout(g(MODERN_FROM_DOJO, 0))[0]!.sprite).toBe('keikoba_modern');
    const sprites = exteriorLayout(g(0, 0)).map((p) => p.sprite);
    expect(sprites).toContain('dorm_0');
    expect(sprites).toContain('omoya');
    expect(sprites).toContain('gate');
    expect(sprites).not.toContain('clinic');
    expect(exteriorLayout(g(0, 2)).map((p) => p.sprite)).toContain('dorm_2');
    // 治療院はトレーナー契約のとき。奥から順（足元の y が増える順）に描く
    const withClinic = exteriorLayout({
      bashoIndex: 0,
      player: { facilities: { dojo: 0, dorm: 0, trainer: 1 } },
    } as never);
    expect(withClinic.map((p) => p.sprite)).toContain('clinic');
    const ys = withClinic.map((p) => p.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });

  it('季節の木は場所の季節に合わせる（春場所は桜）', async () => {
    const { exteriorLayout, seasonOf } = await import('../src/art/sprites/keikoba');
    expect([0, 1, 2, 3, 4, 5].map(seasonOf)).toEqual([
      'winter',
      'spring',
      'summer',
      'summer',
      'autumn',
      'autumn',
    ]);
    const at = (bashoIndex: number) =>
      exteriorLayout({
        bashoIndex,
        player: { facilities: { dojo: 0, dorm: 0, trainer: 0 } },
      } as never).map((p) => p.sprite);
    expect(at(7)).toContain('tree_season__spring');
    expect(at(6)).toContain('tree_season__winter');
  });
});
