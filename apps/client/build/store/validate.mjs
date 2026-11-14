/**
 * 書き出したストア用の画像の検証（純粋な関数。generate.mjs とテストで使う）
 *
 * 画像のバイト列から形式（PNG / JPEG）と縦横の大きさを読み、capsules.json の規定（大きさ・形式・容量）と比べる。
 * 違反があればその理由の一覧を返す（空なら合格）。
 */

/** PNG・JPEG の形式と大きさを読む（読めなければ null） */
export function readImageInfo(bytes) {
  const b = bytes;
  // PNG: シグネチャ 8 バイト → IHDR（幅・高さは 16〜23 バイト目、ビッグエンディアン）
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const width = (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19];
    const height = (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23];
    return { format: 'png', width, height };
  }
  // JPEG: SOI（FFD8）のあと、セグメントをたどって SOF（C0〜CF。C4・C8・CC を除く）の大きさを読む
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      const length = (b[i + 2] << 8) | b[i + 3];
      const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSof) {
        const height = (b[i + 5] << 8) | b[i + 6];
        const width = (b[i + 7] << 8) | b[i + 8];
        return { format: 'jpg', width, height };
      }
      i += 2 + length;
    }
  }
  return null;
}

/** 規定（capsules.json の1件）と画像のバイト列を比べ、違反の理由を返す */
export function validateCapsule(spec, bytes, maxBytes) {
  const problems = [];
  const info = readImageInfo(bytes);
  if (!info) return [`${spec.file}: PNG・JPEG として読めない`];
  if (info.format !== spec.format)
    problems.push(`${spec.file}: 形式が ${info.format}（規定は ${spec.format}）`);
  if (info.width !== spec.width || info.height !== spec.height) {
    problems.push(
      `${spec.file}: 大きさが ${info.width}×${info.height}（規定は ${spec.width}×${spec.height}）`,
    );
  }
  if (bytes.length > maxBytes) {
    problems.push(
      `${spec.file}: 容量が ${(bytes.length / 1048576).toFixed(2)}MB（上限 ${(maxBytes / 1048576).toFixed(0)}MB）`,
    );
  }
  return problems;
}
