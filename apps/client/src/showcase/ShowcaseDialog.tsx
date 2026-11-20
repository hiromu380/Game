/**
 * チュートリアルの締め: ボルトの「本気の工場」で、プレイヤーがスイッチを押して大連鎖を体験する。
 * 見本を動かすだけで、ランの状態・記録・実績には何も残さない
 */
import { useMemo, useState } from 'react';
import { MASCOT_ASSETS } from '../assets/manifest';
import { useI18n } from '../i18n';
import { runShowcase, TUTORIAL_SHOWCASE } from './boards';
import { ShowcasePlayer } from './ShowcasePlayer';

type Phase = 'ready' | 'playing' | 'done';

export default function ShowcaseDialog({ onClose }: { onClose: () => void }) {
  const { t, formatMeasured } = useI18n();
  const [phase, setPhase] = useState<Phase>('ready');
  const total = useMemo(() => runShowcase(TUTORIAL_SHOWCASE).score, []);

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal__body panel showcase-dialog">
        <h2 className="panel__title">{t('showcase.title')}</h2>
        <div className="showcase-dialog__bolt" role="status">
          <img
            src={MASCOT_ASSETS[phase === 'done' ? 'happy' : 'idle']}
            alt=""
            width={44}
            height={44}
          />
          <p>
            {phase === 'done'
              ? t('showcase.done', { score: formatMeasured(total) })
              : t(`showcase.${phase}`)}
          </p>
        </div>
        <div className="showcase-dialog__board">
          <ShowcasePlayer
            def={TUTORIAL_SHOWCASE}
            start={phase === 'ready' ? 0 : 1}
            onFinish={() => setPhase('done')}
          />
        </div>
        <div className="button-row">
          {phase === 'ready' && (
            <button className="button--primary" autoFocus onClick={() => setPhase('playing')}>
              {t('showcase.press')}
            </button>
          )}
          {phase === 'done' && (
            <button className="button--primary" autoFocus data-close onClick={onClose}>
              {t('showcase.close')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
