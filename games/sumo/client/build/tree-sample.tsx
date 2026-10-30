/** 系譜図の画像の確認用: ボットで長く遊んだ一門の SVG を書き出す（製品には入らない） */
import { writeFileSync } from 'node:fs';
import { advanceBasho, createGame } from '@ichimon/sim';
import { decide } from '../../sim/tools/bots';
import { makeT } from '../src/i18n';
import { treeSvg } from '../src/share/treeImage';

let s = createGame({ seed: Number(process.argv[3] ?? 3) });
for (let i = 0; i < 300 && !s.gameOver; i++) s = advanceBasho(decide(s, 'careful'));
const { svg } = treeSvg(s, makeT('ja'));
writeFileSync(process.argv[2]!, svg);
console.log(s.player.family.length, 'nodes', s.player.generation, 'gen');
