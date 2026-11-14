import { useCallback, useEffect, useMemo, useState } from 'react';
import { createGame } from '@ichimon/sim';
import { amongPieces, COMPOUND_SPOTS, type Actor } from '../art/hakoniwa/actors';
import { compoundPieces } from '../art/hakoniwa/compound';
import { drawGround } from '../art/hakoniwa/ground';
import { depthOrder, frontCorner, toScreen } from '../art/hakoniwa/grid';
import type { PersonLook } from '../art/hakoniwa/people';
import { Hakoniwa, type Drawn } from './Hakoniwa';

/** 表紙の部屋を作るシード（いつも同じ部屋・同じ四股名になる） */
const TITLE_SEED = 20261111;

/** 表紙に見せる範囲（舞台のドット）: 門・母屋・前庭の幟を中心に */
export const TITLE_VIEW = { x0: -214, x1: 206, y0: 18, y1: 318 } as const;
/** 狭い画面では、人が見分けられるように門と前庭へ寄る */
export const TITLE_VIEW_NARROW = { x0: -206, x1: 114, y0: 62, y1: 318 } as const;
const NARROW = '(max-width: 600px)';

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof matchMedia === 'function' && matchMedia(NARROW).matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(NARROW);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

type Look = Omit<PersonLook, 'frame'>;

function person(
  key: string,
  look: Look,
  at: readonly number[],
  phase: number,
  to?: readonly number[],
): Actor {
  const p = toScreen(at[0]!, at[1]!);
  return {
    key,
    rikishiId: null,
    look,
    x: p.x,
    y: p.y,
    z: at[0]! + at[1]! + 0.01,
    g: { gx: at[0]!, gy: at[1]! },
    to: to ? toScreen(to[0]!, to[1]!) : undefined,
    phase,
  };
}

function rikishi(
  pose: Look['pose'],
  skin: Look['skin'],
  build: Look['build'],
  sekitori = false,
  newcomer = false,
): Look {
  return {
    pose,
    skin,
    build,
    mawashi: sekitori ? 'white' : 'black',
    hair: newcomer ? 'zanbara' : 'mage',
  };
}

/** 表紙の人: 親方・庭で四股を踏む弟子・門の前を掃く新弟子・縁側で休む弟子・ちゃんこ番（決まった並び。乱数を使わない） */
export function titleCast(): Actor[] {
  return [
    person(
      'oyakata',
      { pose: 'oyakata', skin: 1, build: 1, mawashi: 'black', hair: 'zanbara' },
      COMPOUND_SPOTS.oyakata,
      0,
    ),
    person('sweep', rikishi('sweep', 0, 0, false, true), [9.4, 19], 1, [11.6, 19.2]),
    person('shiko0', rikishi('shiko', 1, 2, true), [12.8, 14.6], 0),
    person('shiko1', rikishi('shiko', 0, 2, true), [14.3, 15.6], 2),
    person('shiko2', rikishi('shiko', 2, 1), [4.6, 16.8], 1),
    person('rest', rikishi('sit', 0, 1), [5.6, 12.5], 0),
    person('chanko', rikishi('idle', 2, 0, false, true), [17.3, 13.6], 3),
  ];
}

/** 表紙の絵: 春の部屋の箱庭。ゲームの中と同じ絵・同じ描き方で、弟子が動く */
export function TitleScene({ label }: { label: string }) {
  const { items, cast } = useMemo(() => {
    const game = createGame({ seed: TITLE_SEED });
    // 春場所の前・寮を1段増築した部屋
    game.bashoIndex = 1;
    game.player.facilities = { ...game.player.facilities, dorm: 1 };
    const names = game.rikishi
      .filter((r) => r.stableId === game.player.stableId)
      .slice(0, 2)
      .map((r) => r.name);
    const pieces = [
      ...compoundPieces(game),
      // 関取の幟（表紙では、はじめの弟子2人の名前で立てる）
      ...names.map((name, i) => ({
        sprite: 'nobori',
        gx: 15.5 + i * 1.5,
        gy: 16.5,
        w: 1,
        d: 1,
        label: name,
      })),
    ];
    const ordered = depthOrder(pieces);
    const drawn: Drawn[] = ordered.map((p) => ({
      sprite: p.sprite,
      ...frontCorner(p),
      anchor: 'tip',
      label: p.label,
    }));
    return { items: drawn, cast: amongPieces(titleCast(), ordered) };
  }, []);
  const drawBase = useCallback((ctx: CanvasRenderingContext2D) => drawGround(ctx, 'spring'), []);
  const narrow = useNarrow();
  return (
    <div className="title-scene">
      <Hakoniwa
        items={items}
        actors={cast}
        base="omoya"
        drawBase={drawBase}
        view={narrow ? TITLE_VIEW_NARROW : TITLE_VIEW}
        label={label}
        season="spring"
      />
    </div>
  );
}
