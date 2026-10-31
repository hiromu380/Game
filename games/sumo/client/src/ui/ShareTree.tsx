import { useState } from 'react';
import type { GameState } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { svgToPng, treeSvg } from '../share/treeImage';
import { downloadBlob } from '../download';

/** 系譜図を PNG で保存する */
export function ShareTree({ game }: { game: GameState }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const save = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const { svg, width, height } = treeSvg(game, t);
      const blob = await svgToPng(svg, width, height);
      downloadBlob(
        blob,
        t('share.fileName', {
          stable: game.stables.find((x) => x.id === game.player.stableId)?.name ?? '',
        }),
      );
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="share">
      <button className="button" onClick={() => void save()} disabled={busy}>
        {busy ? t('share.saving') : t('share.saveTree')}
      </button>
      {failed && (
        <span className="warn" role="alert">
          {t('share.failed')}
        </span>
      )}
    </div>
  );
}
