/**
 * 思い出: 見たカットシーンを選んで見直す（タイトル画面から）
 */
import { useI18n } from '../../i18n';
import type { SceneId } from '../../story/playback';

interface Props {
  scenes: SceneId[];
  onPlay: (scene: SceneId) => void;
  onClose: () => void;
}

export function MemoriesDialog({ scenes, onPlay, onClose }: Props) {
  const { t } = useI18n();
  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal__body panel memories" onClick={(e) => e.stopPropagation()}>
        <h2 className="panel__title">{t('story.memoriesTitle')}</h2>
        {scenes.length === 0 ? (
          <p className="panel__hint">{t('story.memoriesEmpty')}</p>
        ) : (
          <ul className="item-list">
            {scenes.map((scene) => (
              <li key={scene}>
                <button className="item-button" onClick={() => onPlay(scene)}>
                  {t(`story.scene.${scene}`)}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="button-row" style={{ marginTop: 12 }}>
          <button data-close onClick={onClose}>
            {t('howTo.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
