/**
 * カットシーンの描画（PixiJS）。timeline.ts で求めた状態を描くだけで、動きは計算しない
 *
 * - シーンの座標（1280×720）を画面に収まるように拡大縮小する（はみ出す部分は背景色）
 * - キャラクターは部品の絵を rig.ts の変換行列で並べる（切り絵アニメ）
 */
import { Application, Assets, Container, Graphics, Matrix, Sprite, Text, Texture } from 'pixi.js';
import { loadCharacterAsset } from '../assets/manifest';
import { hex } from '../assets/palette';
import { CUTSCENE_CONFIG } from '../config/cutscene';
import { resolveStoryAsset } from './assets';
import { blendPose, placeParts, resolvePose, RIG_GROUND, RIG_HEIGHT, RIGS } from './rig';
import type { CharacterId, FrameState, Scene } from './timeline';

const { width: W, height: H } = CUTSCENE_CONFIG.stage;

/**
 * SVG を読み込む解像度。小さな絵（部品・小物）は拡大しても粗くならないよう高く、
 * 画面いっぱいの背景（すでに大きい）は等倍にする（大きなテクスチャで重くならないように）
 */
const SVG_RESOLUTION = { small: 3, large: 1.25 };
const LARGE_ASSETS = [
  'story:night-sky',
  'story:earth-night',
  'story:workshop',
  'story:moon',
  'story:town',
  'story:roof',
];

async function loadTexture(url: string, large = false): Promise<Texture> {
  return Assets.load<Texture>({
    src: url,
    data: { resolution: large ? SVG_RESOLUTION.large : SVG_RESOLUTION.small },
  });
}

/** シーンで使う絵（キャラクターの部品・背景・小物）をすべて読み込む */
async function loadSceneTextures(scene: Scene) {
  const props = new Map<string, Texture>();
  const parts = new Map<string, Texture>();
  const propKeys = new Set<string>();
  const characters = new Set<CharacterId>();
  for (const track of scene.tracks) {
    if (track.kind === 'prop') {
      propKeys.add(track.asset);
      for (const k of track.keys) if (k.value.asset) propKeys.add(k.value.asset);
    } else {
      characters.add(track.character);
    }
  }
  await Promise.all([
    ...[...propKeys].map(async (key) =>
      props.set(key, await loadTexture(await resolveStoryAsset(key), LARGE_ASSETS.includes(key))),
    ),
    ...[...characters].flatMap((character) =>
      RIGS[character].parts.flatMap((part) =>
        Object.values(part.files).map(async (file) =>
          parts.set(
            `${character}/${file}`,
            await loadTexture(await loadCharacterAsset(character, file)),
          ),
        ),
      ),
    ),
  ]);
  return { props, parts };
}

export class CutsceneRenderer {
  private readonly world = new Container();
  private readonly stage = new Container();
  private readonly overlay = new Graphics();
  private readonly sprites = new Map<string, Sprite>();
  private readonly texts = new Map<string, Text>();

  private constructor(
    private readonly app: Application,
    private readonly scene: Scene,
    private readonly textures: Awaited<ReturnType<typeof loadSceneTextures>>,
    private readonly translate: (key: string) => string,
  ) {
    this.stage.sortableChildren = true;
    this.world.addChild(this.stage, this.overlay);
    app.stage.addChild(this.world);
    this.resize();
  }

  /** 生成（PixiJS の初期化と絵の読み込みは非同期）。読み込みが上限時間を過ぎたら失敗にする */
  static async create(
    parent: HTMLElement,
    scene: Scene,
    translate: (key: string) => string,
  ): Promise<CutsceneRenderer> {
    const app = new Application();
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('cutscene load timeout')), CUTSCENE_CONFIG.loadTimeoutMs),
    );
    const [, textures] = await Promise.race([
      Promise.all([
        app.init({
          resizeTo: parent,
          background: scene.background,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        }),
        loadSceneTextures(scene),
      ]),
      timeout,
    ]);
    app.canvas.classList.add('cutscene__canvas');
    parent.appendChild(app.canvas);
    return new CutsceneRenderer(app, scene, textures, translate);
  }

  /** 画面の大きさに合わせて、シーン全体（16:9）が収まる倍率と位置にする */
  resize(): void {
    const { width, height } = this.app.screen;
    const s = Math.min(width / W, height / H);
    this.world.scale.set(s);
    this.world.position.set((width - W * s) / 2, (height - H * s) / 2);
  }

  /** 状態を描く */
  render(frame: FrameState): void {
    this.resize();
    const used = new Set<string>();
    const { camera, shake } = frame;
    // カメラ: 見る位置を画面の中心へ、拡大・揺れ
    this.stage.scale.set(camera.zoom);
    this.stage.position.set(
      W / 2 - camera.x * camera.zoom + shake.x,
      H / 2 - camera.y * camera.zoom + shake.y,
    );

    let order = 0;
    for (const item of this.scene.tracks) {
      if (item.kind === 'prop') {
        const p = frame.props.find((x) => x.id === item.id);
        if (!p) continue;
        const sprite = this.sprite(`prop/${p.id}`, this.textures.props.get(p.asset));
        sprite.zIndex = order++;
        sprite.anchor.set(0.5);
        sprite.position.set(p.x + p.width / 2, p.y + p.height / 2);
        sprite.setSize(p.width, p.height);
        sprite.rotation = (p.rotation * Math.PI) / 180;
        sprite.alpha = p.alpha;
        used.add(`prop/${p.id}`);
        continue;
      }
      const a = frame.actors.find((x) => x.id === item.id);
      if (!a) continue;
      let pose = resolvePose(a.character, a.pose, a.face);
      if (a.blend) pose = blendPose(pose, resolvePose(a.character, a.blend.to, a.face), a.blend.k);
      const s = a.height / RIG_HEIGHT[a.character];
      // キャラクターの位置: 足もと (x, y)。左右反転は横の倍率を負に
      const actor = new Matrix(a.flip ? -s : s, 0, 0, s, a.x, a.y - RIG_GROUND[a.character] * s);
      for (const part of placeParts(a.character, pose)) {
        const key = `actor/${a.id}/${part.id}`;
        const texture = this.textures.parts.get(`${a.character}/${part.file}`);
        const sprite = this.sprite(key, texture);
        const [bx = 0, by = 0, bw = 1, bh = 1] = part.box;
        const [pa, pb, pc, pd, ptx, pty] = part.matrix;
        // 部品の絵（関節が原点の範囲 box）→ 部品の変換 → キャラクターの位置
        const m = actor
          .clone()
          .append(new Matrix(pa, pb, pc, pd, ptx, pty))
          .append(new Matrix(bw / sprite.texture.width, 0, 0, bh / sprite.texture.height, bx, by));
        sprite.anchor.set(0);
        sprite.setFromMatrix(m);
        sprite.alpha = a.alpha;
        sprite.zIndex = order + part.z / 100;
        used.add(key);
      }
      order++;
    }
    for (const [key, sprite] of this.sprites) sprite.visible = used.has(key);

    // 数字・文字（i18n の文言）
    const shown = new Set<string>();
    for (const n of frame.numbers)
      this.text(`n/${n.text}/${n.x}`, n.text, n.x, n.y, n.size, shown, 1000);
    for (const c of frame.captions)
      this.text(`c/${c.key}`, this.translate(c.key), c.x, c.y, c.size, shown, 1001);
    for (const [key, text] of this.texts) text.visible = shown.has(key);

    // 色味・光（シーンの範囲だけ。画面全体の白いフラッシュにはしない）
    this.overlay.clear();
    if (frame.tint)
      this.overlay.rect(0, 0, W, H).fill({ color: hex(frame.tint.color), alpha: frame.tint.alpha });
    if (frame.flash)
      this.overlay
        .rect(0, 0, W, H)
        .fill({ color: hex(frame.flash.color), alpha: frame.flash.alpha });
  }

  private sprite(key: string, texture: Texture | undefined): Sprite {
    let sprite = this.sprites.get(key);
    if (!sprite) {
      sprite = new Sprite(texture ?? Texture.EMPTY);
      this.sprites.set(key, sprite);
      this.stage.addChild(sprite);
    } else if (texture && sprite.texture !== texture) {
      sprite.texture = texture;
    }
    sprite.visible = true;
    return sprite;
  }

  private text(
    key: string,
    value: string,
    x: number,
    y: number,
    size: number,
    shown: Set<string>,
    z: number,
  ) {
    let text = this.texts.get(key);
    if (!text) {
      text = new Text({
        text: value,
        style: {
          fill: 0xffb74d,
          fontFamily: 'M PLUS Rounded 1c, sans-serif',
          fontWeight: '800',
          fontSize: size,
          stroke: { color: 0x1b1f27, width: Math.max(4, size / 10) },
        },
      });
      text.anchor.set(0.5);
      this.texts.set(key, text);
      this.stage.addChild(text);
    }
    text.text = value;
    text.position.set(x, y);
    text.zIndex = z;
    shown.add(key);
  }

  /** 毎フレームの処理を登録する（経過ミリ秒を渡す） */
  onTick(callback: (deltaMs: number) => void): void {
    this.app.ticker.add((ticker) => callback(ticker.deltaMS));
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}
