import type { GameState, Rank } from '@ichimon/sim';
import type { SceneAction } from '../art/hakoniwa/grid';
import { KeikobaScene } from './KeikobaScene';
import { lookOfRikishi } from '../art/Portraits';
import { RikishiDetail } from './RikishiDetail';
import { useState } from 'react';
import { PrepPanel } from './PrepPanel';
import { GuideCard } from './Guide';
import { NextGoalCard } from './GoalsPanel';
import { knownTraits } from './RikishiCard';

/**
 * 部屋: 1画面に「次の目標」・部屋の箱庭・場所前のコマンド窓だけを置く（狭い画面ではこの順に縦、広い画面では箱庭とコマンド窓を横に）。
 * 弟子の一覧は「弟子」タブ、返事が要るもの（入門希望者・出来事など）は1件ずつ窓で出す（EventDialogs）
 */
export function StableTab({
  game,
  ranks,
  setGame,
  onSceneAction,
}: {
  game: GameState;
  ranks: ReadonlyMap<number, Rank>;
  setGame: (g: GameState) => void;
  onSceneAction?: (a: SceneAction) => void;
}) {
  const [detail, setDetail] = useState<number | null>(null);
  const r = detail === null ? undefined : game.rikishi.find((x) => x.id === detail);
  return (
    <div className="stack room">
      <GuideCard game={game} />
      <NextGoalCard game={game} />
      <div className="room__main">
        <KeikobaScene
          game={game}
          ranks={ranks}
          setGame={setGame}
          onAction={onSceneAction}
          onDetail={setDetail}
        />
        <PrepPanel game={game} ranks={ranks} setGame={setGame} />
      </div>
      {r && (
        <RikishiDetail
          subject={{
            name: r.name,
            look: lookOfRikishi(r, ranks.get(r.id) ?? null),
            rank: ranks.get(r.id) ?? null,
            age: r.age,
            height: r.height,
            weight: r.weight,
            abilities: r.abilities,
            foreign: r.foreign,
            career: r.career,
            track: r.track,
            traits: knownTraits(r),
          }}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
