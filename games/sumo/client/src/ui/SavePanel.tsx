import { useRef, useState } from 'react';
import type { GameState } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { downloadBlob } from '../download';
import { parseSaveFile, saveFileText } from '../save';

/** 読み込めるファイルの大きさの上限（バイト） */
const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** セーブの読み込みボタン（ファイルを選ぶ → 読めたら onLoad） */
export function LoadSaveButton({ onLoad }: { onLoad: (g: GameState) => void }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);
  const read = async (file: File | undefined) => {
    if (!file) return;
    setFailed(false);
    const g = file.size <= MAX_FILE_BYTES ? parseSaveFile(await file.text()) : null;
    if (g) onLoad(g);
    else setFailed(true);
  };
  return (
    <>
      <button className="button" onClick={() => input.current?.click()}>
        {t('save.import')}
      </button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(ev) => {
          void read(ev.target.files?.[0]);
          ev.target.value = '';
        }}
      />
      {failed && (
        <p className="warn" role="alert">
          {t('save.importError')}
        </p>
      )}
    </>
  );
}

/** セーブをファイルに書き出す・ファイルから読み込む（今の部屋と置き換える前に確かめる） */
export function SavePanel({ game, setGame }: { game: GameState; setGame: (g: GameState) => void }) {
  const { t } = useI18n();
  const [loaded, setLoaded] = useState<GameState | null>(null);
  const exportSave = () => {
    downloadBlob(
      new Blob([saveFileText(game)], { type: 'application/json' }),
      t('save.fileName', {
        generation: game.player.generation,
        year: Math.floor(game.bashoIndex / 6) + 1,
      }),
    );
  };
  return (
    <section className="panel">
      <h2>{t('save.title')}</h2>
      <p className="note">{t('save.note')}</p>
      <div className="row__actions">
        <button className="button" onClick={exportSave}>
          {t('save.export')}
        </button>
        <LoadSaveButton onLoad={setLoaded} />
      </div>
      {loaded && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="load-title">
          <div className="modal__box">
            <h2 id="load-title">{t('save.importTitle')}</h2>
            <p>
              {t('save.importConfirm', {
                stable: loaded.stables.find((s) => s.id === loaded.player.stableId)?.name ?? '',
                generation: loaded.player.generation,
                year: Math.floor(loaded.bashoIndex / 6) + 1,
              })}
            </p>
            <div className="modal__actions">
              <button className="button" onClick={() => setLoaded(null)}>
                {t('common.cancel')}
              </button>
              <button
                className="button button--danger"
                onClick={() => {
                  setGame(loaded);
                  setLoaded(null);
                }}
              >
                {t('save.importReplace')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
