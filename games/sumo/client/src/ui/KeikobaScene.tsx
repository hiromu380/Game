import type { GameState } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { sprite } from '../art/sprites';
import { KEIKOBA_STAGE, keikobaLayout } from '../art/sprites/keikoba';

/** 稽古場の絵（ドット絵）。絵がまだ取り込まれていなければ出さない */
export function KeikobaScene({ game }: { game: GameState }) {
  const { t } = useI18n();
  const placed = keikobaLayout(game)
    .map((p) => ({ p, s: sprite(p.sprite) }))
    .filter((x) => x.s !== null);
  if (!placed.some((x) => x.p.sprite === 'keikoba_back')) return null;
  const { width: W, height: H } = KEIKOBA_STAGE;
  return (
    <div className="scene" role="img" aria-label={t('scene.keikoba')}>
      {placed.map(({ p, s }) => (
        <img
          key={p.sprite}
          className="scene__sprite"
          src={s!.url}
          alt=""
          draggable={false}
          style={{
            left: `${((p.x - s!.anchor[0]) / W) * 100}%`,
            top: `${((p.y - s!.anchor[1]) / H) * 100}%`,
            width: `${(s!.size[0] / W) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}
