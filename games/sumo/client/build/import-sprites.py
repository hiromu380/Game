#!/usr/bin/env python3
"""
生成した絵（sprites/raw/）を、ゲームで使うドット絵に仕上げる。仕様は docs/sprites/spec.md

  python3 games/sumo/client/build/import-sprites.py            # raw にある絵をすべて取り込む
  python3 games/sumo/client/build/import-sprites.py pine dohyo  # 指定した絵だけ
  python3 games/sumo/client/build/import-sprites.py --selftest # 合成した絵で動作を確かめる

手順（絵ごと）:
  1. 背景のマゼンタ（#FF00FF）を抜く。縁に残ったマゼンタのにじみも消す
  2. frames が 2 以上なら、絵のかたまりを左から順に切り分ける
  3. かたまりごとに余白を切り、仕上がりの大きさ（size）に収まるよう縮める（足元を下の中央にそろえる）
  4. 色をゲームの和色パレット（src/art/palette.ts）と、その陰の色に寄せる。半透明は残さない
  5. outline が true なら、輪郭の外側1ドットを墨色で縁取る
  6. src/assets/sprites/ に PNG を書き、src/art/sprites/manifest.json に一覧を書く

必要なもの: Python 3 と Pillow（pip install pillow）
"""
from __future__ import annotations

import json
import re
import sys
import tempfile
from collections import deque
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
CLIENT = HERE.parent
CATALOG = CLIENT / 'sprites' / 'catalog.json'
RAW = CLIENT / 'sprites' / 'raw'
OUT = CLIENT / 'src' / 'assets' / 'sprites'
MANIFEST = CLIENT / 'src' / 'art' / 'sprites' / 'manifest.json'
PALETTE_TS = CLIENT / 'src' / 'art' / 'palette.ts'

KEY = (255, 0, 255)
# 背景とみなす距離（RGB のユークリッド距離）
KEY_DISTANCE = 120
# 縮めたあと、これより薄い所は透明にする
ALPHA_CUT = 110
SUMI = (42, 36, 32)
EXTS = ('.png', '.webp', '.jpg', '.jpeg')


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip('#')
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def load_palette(path: Path = PALETTE_TS) -> list[tuple[int, int, int]]:
    """palette.ts の色と、それぞれの陰（少し暗い色）。版画の2段の明暗にする"""
    colors = {hex_rgb(m) for m in re.findall(r"#[0-9a-fA-F]{6}\b", path.read_text(encoding='utf-8'))}
    shades = {tuple(int(c * 0.78) for c in rgb) for rgb in colors}
    return sorted(colors | shades)


def nearest(rgb: tuple[int, int, int], palette: list[tuple[int, int, int]], cache: dict) -> tuple[int, int, int]:
    hit = cache.get(rgb)
    if hit is not None:
        return hit
    r, g, b = rgb
    best = min(
        palette,
        # 人の目に近い重み（緑に敏感・青に鈍い）
        key=lambda p: 2 * (p[0] - r) ** 2 + 4 * (p[1] - g) ** 2 + 3 * (p[2] - b) ** 2,
    )
    cache[rgb] = best
    return best


def border_color(img: Image.Image) -> tuple[int, int, int]:
    """四辺の色の中央値（背景の色）"""
    rgb = img.convert('RGB')
    w, h = rgb.size
    px = rgb.load()
    ring = [px[x, y] for x in range(w) for y in (0, 1, h - 2, h - 1)] + [px[x, y] for y in range(h) for x in (0, 1, w - 2, w - 1)]
    return tuple(sorted(c[i] for c in ring)[len(ring) // 2] for i in range(3))


def dist(a: tuple, b: tuple) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


# マゼンタでない背景（くすんだ赤紫など）: 外からつながる背景と、それにごく近い色だけを抜く
FLOOD_DISTANCE = 55
HOLE_DISTANCE = 25


def key_out_flood(img: Image.Image, bg: tuple[int, int, int]) -> Image.Image:
    """背景が純粋なマゼンタでない絵。赤い物が背景と近い色でも消えないよう、外側からつながる所だけを抜く"""
    img = img.convert('RGBA')
    px = img.load()
    w, h = img.size
    clear = [[False] * w for _ in range(h)]
    q = deque((x, y) for x in range(w) for y in (0, h - 1)) + deque((x, y) for y in range(h) for x in (0, w - 1))
    while q:
        x, y = q.popleft()
        if clear[y][x] or dist(px[x, y], bg) > FLOOD_DISTANCE:
            continue
        clear[y][x] = True
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not clear[ny][nx]:
                q.append((nx, ny))
    for y in range(h):
        for x in range(w):
            # 囲まれた隙間に残った背景（背景の色とほとんど同じ所だけ）
            if clear[y][x] or dist(px[x, y], bg) <= HOLE_DISTANCE:
                px[x, y] = (0, 0, 0, 0)
    # 縁のにじみ: 抜いた所に接する、背景の色みの残った所（2周）
    for _ in range(2):
        drop = []
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                r, g, b, a = px[x, y]
                if a == 0 or not (r - g > 50 and b - g > 25):
                    continue
                if any(px[nx, ny][3] == 0 for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))):
                    drop.append((x, y))
        for x, y in drop:
            px[x, y] = (0, 0, 0, 0)
    return img


def key_out(img: Image.Image) -> Image.Image:
    """マゼンタの背景とにじみを透明に。背景がマゼンタから外れた絵は、外からつながる背景を抜く"""
    bg = border_color(img)
    if dist(bg, KEY) > 60:
        return key_out_flood(img, bg)
    img = img.convert('RGBA')
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            d = ((r - KEY[0]) ** 2 + (g - KEY[1]) ** 2 + (b - KEY[2]) ** 2) ** 0.5
            # にじみ: 赤と青が緑よりずっと強い（紫・桜色は対象外になる程度の差）
            fringe = r - g > 70 and b - g > 70 and abs(r - b) < 90
            if d < KEY_DISTANCE or fringe:
                px[x, y] = (0, 0, 0, 0)
    return img


def blobs(img: Image.Image, count: int) -> list[tuple[int, int, int, int]]:
    """不透明なかたまりを大きい順に count 個（左から順・同じ列なら上から順）。小さな切れ端は近いかたまりに含める"""
    # 速くするため縮めた図で数える
    scale = max(1, max(img.size) // 256)
    small = img.resize((max(1, img.width // scale), max(1, img.height // scale)), Image.NEAREST)
    a = small.getchannel('A').load()
    w, h = small.size
    seen = [[False] * w for _ in range(h)]
    found: list[tuple[int, tuple[int, int, int, int]]] = []
    for y in range(h):
        for x in range(w):
            if seen[y][x] or a[x, y] == 0:
                continue
            q = deque([(x, y)])
            seen[y][x] = True
            n = 0
            x0 = x1 = x
            y0 = y1 = y
            while q:
                cx, cy = q.popleft()
                n += 1
                x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                # 斜め・2ドット先までつなぐ（細い棒や離れた湯気も同じかたまりに）
                for dx in (-2, -1, 0, 1, 2):
                    for dy in (-2, -1, 0, 1, 2):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and a[nx, ny] > 0:
                            seen[ny][nx] = True
                            q.append((nx, ny))
            found.append((n, (x0, y0, x1, y1)))
    found.sort(key=lambda f: -f[0])
    main = [box for _, box in found[:count]]
    if len(main) < count:
        raise ValueError(f'絵のかたまりが {count} 個に足りません（{len(main)} 個）。コマの間をあけて生成し直してください')
    # 残りの切れ端は、中心がいちばん近いかたまりに足す
    merged = [list(b) for b in main]
    for _, (x0, y0, x1, y1) in found[count:]:
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        k = min(range(count), key=lambda i: ((merged[i][0] + merged[i][2]) / 2 - cx) ** 2 + ((merged[i][1] + merged[i][3]) / 2 - cy) ** 2)
        m = merged[k]
        m[0], m[1], m[2], m[3] = min(m[0], x0), min(m[1], y0), max(m[2], x1), max(m[3], y1)
    # 横に並んでいれば左から、縦に並んでいれば上から
    merged.sort(key=lambda b: (b[0] + b[2]) / 2 if img.width >= img.height else (b[1] + b[3]) / 2)
    return [(b[0] * scale, b[1] * scale, (b[2] + 1) * scale, (b[3] + 1) * scale) for b in merged]


def finish(piece: Image.Image, size: tuple[int, int], outline: bool, palette, cache) -> Image.Image:
    """余白を切り、size に収めて足元を下の中央にそろえ、パレットに寄せる"""
    bbox = piece.getchannel('A').getbbox()
    if bbox is None:
        raise ValueError('絵が空です（背景しかありません）')
    piece = piece.crop(bbox)
    tw, th = size
    # 縁取りの1ドットを残して収める
    room = 2 if outline else 0
    k = min((tw - room) / piece.width, (th - room) / piece.height)
    nw, nh = max(1, round(piece.width * k)), max(1, round(piece.height * k))
    # 面積で平均して縮める（細い線が消えにくい）
    small = piece.resize((nw, nh), Image.BOX)
    canvas = Image.new('RGBA', size, (0, 0, 0, 0))
    canvas.paste(small, ((tw - nw) // 2, th - nh - (1 if outline else 0)))
    px = canvas.load()
    for y in range(th):
        for x in range(tw):
            r, g, b, a = px[x, y]
            px[x, y] = (*nearest((r, g, b), palette, cache), 255) if a >= ALPHA_CUT else (0, 0, 0, 0)
    if outline:
        edge = []
        for y in range(th):
            for x in range(tw):
                if px[x, y][3]:
                    continue
                if any(0 <= x + dx < tw and 0 <= y + dy < th and px[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    edge.append((x, y))
        for x, y in edge:
            px[x, y] = (*SUMI, 255)
    return canvas


def find_raw(name: str, raw: Path) -> Path | None:
    for ext in EXTS:
        p = raw / f'{name}{ext}'
        if p.exists():
            return p
    return None


def catalog_items(catalog: Path = CATALOG):
    data = json.loads(catalog.read_text(encoding='utf-8'))
    for g in data['groups']:
        for item in g['items']:
            yield item


def import_all(only: list[str], raw: Path = RAW, out: Path = OUT, manifest: Path = MANIFEST, catalog: Path = CATALOG, palette_ts: Path = PALETTE_TS) -> dict:
    palette = load_palette(palette_ts)
    cache: dict = {}
    entries = json.loads(manifest.read_text(encoding='utf-8')) if manifest.exists() else {}
    out.mkdir(parents=True, exist_ok=True)
    done, missing = [], []
    for item in catalog_items(catalog):
        if only and item['id'] not in only:
            continue
        for variant in item.get('variants', [None]):
            name = item['id'] if variant is None else f"{item['id']}__{variant}"
            src = find_raw(name, raw)
            if src is None:
                missing.append(name)
                continue
            img = key_out(Image.open(src))
            frames = item['frames']
            boxes = blobs(img, frames) if frames > 1 else [img.getchannel('A').getbbox() or (0, 0, *img.size)]
            files = []
            for i, b in enumerate(boxes):
                sprite = finish(img.crop(b), tuple(item['size']), item.get('outline', False), palette, cache)
                file = f'{name}.png' if frames == 1 else f'{name}_{i}.png'
                sprite.save(out / file, optimize=True)
                files.append(file)
            w, h = item['size']
            entries[name] = {'files': files, 'size': [w, h], 'anchor': [w // 2, h - 1]}
            done.append(name)
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(json.dumps(dict(sorted(entries.items())), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return {'done': done, 'missing': missing}


def selftest() -> None:
    """マゼンタの背景に、にじみのある図形を2つ描いて取り込む"""
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        (t / 'raw').mkdir()
        (t / 'catalog.json').write_text(json.dumps({'groups': [{'items': [
            {'id': 'one', 'size': [16, 24], 'frames': 1, 'outline': True},
            {'id': 'two', 'size': [16, 16], 'frames': 2, 'outline': False, 'variants': ['a']},
        ]}]}), encoding='utf-8')
        (t / 'palette.ts').write_text("const P = { a: '#1f4466', b: '#b3322a', c: '#f4ecdc' };", encoding='utf-8')
        img = Image.new('RGB', (400, 300), KEY)
        px = img.load()
        for y in range(40, 260):
            for x in range(150, 250):
                px[x, y] = (40, 70, 100)  # 藍に近い色
        # にじみ（マゼンタと藍の中間）
        for y in range(40, 260):
            px[149, y] = (150, 40, 180)
        img.save(t / 'raw' / 'one.png')
        two = Image.new('RGB', (400, 200), KEY)
        p2 = two.load()
        for y in range(50, 150):
            for x in list(range(40, 140)) + list(range(260, 360)):
                p2[x, y] = (180, 50, 40) if x < 200 else (240, 235, 220)
        two.save(t / 'raw' / 'two__a.png')
        res = import_all([], raw=t / 'raw', out=t / 'out', manifest=t / 'manifest.json', catalog=t / 'catalog.json', palette_ts=t / 'palette.ts')
        assert res['done'] == ['one', 'two__a'], res
        one = Image.open(t / 'out' / 'one.png').convert('RGBA')
        assert one.size == (16, 24)
        colors = {c for _, c in one.getcolors(1000)}
        assert (0, 0, 0, 0) in colors, '背景が抜けていない'
        assert all(c[3] in (0, 255) for c in colors), '半透明が残っている'
        assert (*SUMI, 255) in colors, '縁取りがない'
        assert (0x1f, 0x44, 0x66, 255) in colors, '藍に寄っていない'
        assert not any(c[0] > 200 and c[2] > 200 and c[1] < 80 for c in colors), 'マゼンタが残っている'
        assert one.getpixel((8, 22))[3] == 255, '足元が下にそろっていない'
        left = Image.open(t / 'out' / 'two__a_0.png').convert('RGBA')
        right = Image.open(t / 'out' / 'two__a_1.png').convert('RGBA')
        assert left.getpixel((8, 12))[:3] == (0xb3, 0x32, 0x2a), '左のコマが紅でない'
        assert right.getpixel((8, 12))[:3] == (0xf4, 0xec, 0xdc), '右のコマが和紙色でない'
        m = json.loads((t / 'manifest.json').read_text(encoding='utf-8'))
        assert m['two__a'] == {'files': ['two__a_0.png', 'two__a_1.png'], 'size': [16, 16], 'anchor': [8, 15]}
        # くすんだ赤紫の背景: 墨の縁で囲んだ紅は残り、背景は抜ける
        bg = (180, 55, 119)
        dull = Image.new('RGB', (300, 300), bg)
        p3 = dull.load()
        for y in range(60, 240):
            for x in range(60, 240):
                edge = x < 66 or x > 233 or y < 66 or y > 233
                p3[x, y] = SUMI if edge else (190, 60, 45)
        assert border_color(dull) == bg
        keyed = key_out(dull)
        assert keyed.getpixel((5, 5))[3] == 0, '赤紫の背景が抜けていない'
        assert keyed.getpixel((150, 150))[3] == 255, '背景に近い紅まで抜けた'

    print('selftest ok')


if __name__ == '__main__':
    args = sys.argv[1:]
    if args == ['--selftest']:
        selftest()
        sys.exit(0)
    result = import_all(args)
    print('取り込んだ:', ', '.join(result['done']) or 'なし')
    if result['missing']:
        print('まだない:', ', '.join(result['missing']))
