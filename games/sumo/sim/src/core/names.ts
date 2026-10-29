/**
 * 架空の四股名・年寄名を作る
 *
 * 実在の有名な力士名・年寄名にならないよう、よく知られた名前は除く（完全には防げないので、見つけたら足す）。
 */
import type { Prng } from './prng';

const HEADS = [
  '若',
  '朝',
  '大',
  '高',
  '豊',
  '栄',
  '翔',
  '剛',
  '天',
  '雷',
  '嵐',
  '光',
  '輝',
  '鉄',
  '岩',
  '玉',
  '錦',
  '旭',
  '鷹',
  '鷲',
  '鶴',
  '松',
  '竹',
  '桜',
  '梅',
  '浪',
  '海',
  '山',
  '峰',
  '嶺',
  '川',
  '星',
  '雲',
  '風',
  '稲',
  '富',
  '誉',
  '晴',
  '凰',
  '鳳',
  '虎',
  '獅',
  '琳',
  '藍',
  '紺',
  '白',
  '黒',
  '紅',
  '青',
  '金',
  '銀',
  '武',
  '勇',
  '隼',
];
const TAILS = [
  '山',
  '海',
  '川',
  '龍',
  '錦',
  '若',
  '峰',
  '嶺',
  '岳',
  '浪',
  '風',
  '光',
  '輝',
  '王',
  '翔',
  '城',
  '国',
  '島',
  '里',
  '丸',
  '鵬',
  '旺',
  '昇',
  '桜',
  '花',
  '心',
  '力',
  '雄',
  '剛',
  '虎',
  '鷹',
  '神',
  '星',
  '雲',
  '湖',
  '洋',
];
/** 3文字にするときの間の字 */
const MIDDLES = ['の', 'ノ', 'ケ'];

/** 実在の有名な四股名（ここに当たったら作り直す） */
const BLOCKED_SHIKONA = new Set([
  '大鵬',
  '白鵬',
  '朝青龍',
  '貴乃花',
  '若乃花',
  '北の湖',
  '曙',
  '武蔵丸',
  '照ノ富士',
  '稀勢の里',
  '鶴竜',
  '日馬富士',
  '豊昇龍',
  '大の里',
  '霧島',
  '琴櫻',
  '朝乃山',
  '貴景勝',
  '若隆景',
  '御嶽海',
  '正代',
  '高安',
  '豪栄道',
  '把瑠都',
  '琴欧洲',
  '魁皇',
  '千代大海',
  '栃東',
  '雅山',
  '武双山',
  '出島',
  '千代の富士',
  '若嶋津',
  '北勝海',
  '大乃国',
  '旭富士',
  '小錦',
  '霧島',
  '朝潮',
  '若三杉',
  '輪島',
  '北天佑',
  '琴風',
  '大錦',
  '旭天鵬',
  '若の里',
  '海鵬',
  '高見盛',
  '安美錦',
  '翔猿',
  '若元春',
  '王鵬',
  '宇良',
  '玉鷲',
  '錦木',
  '隆の勝',
  '大栄翔',
]);

const TOSHIYORI_HEADS = [
  '大',
  '小',
  '白',
  '青',
  '高',
  '浜',
  '松',
  '竹',
  '梅',
  '桜',
  '鶴',
  '亀',
  '立',
  '春',
  '秋',
  '朝',
  '夕',
  '若',
  '岩',
  '浦',
];
const TOSHIYORI_TAILS = [
  '浦',
  '岡',
  '崎',
  '森',
  '原',
  '野',
  '瀬',
  '沢',
  '浜',
  '谷',
  '江',
  '波',
  '嶺',
  '船',
  '里',
  '根',
  '木',
  '津',
  '宮',
  '石',
];
const BLOCKED_TOSHIYORI = new Set([
  '大島',
  '高田',
  '浦風',
  '立浪',
  '春日野',
  '松根',
  '若松',
  '大嶽',
  '立田川',
  '高崎',
  '浜風',
]);

/** 四股名。lineageChar があれば、その字を頭か尻に入れる（親方の一字） */
export function makeShikona(rng: Prng, used: ReadonlySet<string>, lineageChar?: string): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let head = rng.pick(HEADS);
    let tail = rng.pick(TAILS);
    if (lineageChar) {
      if (rng.chance(0.7)) head = lineageChar;
      else tail = lineageChar;
    }
    if (head === tail) continue;
    const name = rng.chance(0.12) ? `${head}${rng.pick(MIDDLES)}${tail}` : `${head}${tail}`;
    if (!used.has(name) && !BLOCKED_SHIKONA.has(name)) return name;
  }
  // どうしても重なるときは字を足す
  return `${rng.pick(HEADS)}${rng.pick(HEADS)}${rng.pick(TAILS)}`;
}

/** 年寄名（部屋の名前にもなる） */
export function makeToshiyoriName(rng: Prng, used: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    const name = `${rng.pick(TOSHIYORI_HEADS)}${rng.pick(TOSHIYORI_TAILS)}`;
    if (!used.has(name) && !BLOCKED_TOSHIYORI.has(name)) return name;
  }
  return `${rng.pick(TOSHIYORI_HEADS)}${rng.pick(TOSHIYORI_HEADS)}${rng.pick(TOSHIYORI_TAILS)}`;
}

/** 四股名から一字を選ぶ（「の」などは除く） */
export function lineageCharOf(shikona: string, rng: Prng): string {
  const chars = [...shikona].filter((c) => !MIDDLES.includes(c));
  return chars.length ? rng.pick(chars) : shikona.slice(0, 1);
}
