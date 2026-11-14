/** 絵柄の確認用: 力士・親方の見た目を一覧にした HTML を書き出す（node で実行。製品には入らない） */
import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { Figure } from '../src/art/Figure';
import { oyakataLook, rikishiLook } from '../src/art/look';

const cases = [
  {
    id: 1,
    weight: 95,
    careerBasho: 2,
    sekitori: false,
    yokozuna: false,
    injured: false,
    fatigue: 10,
  },
  {
    id: 2,
    weight: 120,
    careerBasho: 20,
    sekitori: false,
    yokozuna: false,
    injured: true,
    fatigue: 70,
  },
  {
    id: 3,
    weight: 150,
    careerBasho: 40,
    sekitori: true,
    yokozuna: false,
    injured: false,
    fatigue: 0,
  },
  {
    id: 4,
    weight: 175,
    careerBasho: 60,
    sekitori: true,
    yokozuna: true,
    injured: false,
    fatigue: 0,
  },
  {
    id: 5,
    weight: 135,
    careerBasho: 30,
    sekitori: true,
    yokozuna: false,
    injured: false,
    fatigue: 65,
  },
  {
    id: 6,
    weight: 105,
    careerBasho: 8,
    sekitori: false,
    yokozuna: false,
    injured: false,
    fatigue: 0,
  },
];
const html = renderToStaticMarkup(
  <div style={{ background: '#f4ecdc', padding: 16, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
    {cases.map((c) => (
      <div key={c.id} style={{ textAlign: 'center' }}>
        <Figure look={rikishiLook({ ...c, stableId: c.id })} size={140} />
        <div>
          <Figure look={rikishiLook({ ...c, stableId: c.id })} variant="bust" size={70} />
        </div>
      </div>
    ))}
    <Figure look={oyakataLook({ id: 7, age: 45, stableId: 1 })} size={140} />
    <Figure look={oyakataLook({ id: 8, age: 62, stableId: 2 })} size={140} />
    <Figure look={rikishiLook({ ...cases[2]!, stableId: 3 })} arms="push" size={140} />
  </div>,
);
writeFileSync(
  process.argv[2]!,
  `<!doctype html><meta charset="utf-8"><body style="margin:0">${html}</body>`,
);
