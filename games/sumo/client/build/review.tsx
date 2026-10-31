/** 開発時専用の造形・取組検証画面。Viteの製品エントリには含めない。 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThreePortrait } from '../src/art/ThreePortrait';
import { rikishiLook, oyakataLook } from '../src/art/look';
import { applyPalette } from '../src/art/palette';
import '../src/styles.css';
applyPalette();
const cases = [
  {
    id: 1,
    weight: 95,
    careerBasho: 2,
    sekitori: false,
    yokozuna: false,
    injured: false,
    fatigue: 0,
  },
  {
    id: 2,
    weight: 125,
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
];
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="content">
      <h1>造形検証</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {cases.map((c) => (
          <ThreePortrait
            key={c.id}
            look={rikishiLook({ ...c, stableId: c.id })}
            size={160}
            variant="full"
          />
        ))}
        <ThreePortrait
          look={oyakataLook({ id: 7, age: 45, stableId: 1 })}
          size={160}
          variant="full"
        />
        <ThreePortrait
          look={oyakataLook({ id: 8, age: 62, stableId: 2 })}
          size={160}
          variant="full"
        />
      </div>
      <canvas
        id="test-stage"
        className="dohyo dohyo--3d"
        style={{ maxWidth: 720 }}
        aria-label="取組検証"
      />
    </main>
  </StrictMode>,
);
