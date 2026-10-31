import { useState } from 'react';
import { createGame, type GameState, type Style } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { TitleArt } from '../art/TitleArt';
import { Mon } from '../art/Mon';
import { LoadSaveButton } from './SavePanel';

const STYLES: Style[] = ['oshi', 'yotsu', 'waza'];

/** 新しく部屋を開く: 親方の現役時代の型を選ぶ */
export function NewGame({
  onStart,
  onToggleLang,
}: {
  onStart: (g: GameState) => void;
  onToggleLang: () => void;
}) {
  const { t } = useI18n();
  const [style, setStyle] = useState<Style>('oshi');
  const start = () => {
    // シードは開始のときだけ乱数で決める（シミュレーションの中では使わない）
    const seed = Math.floor(Math.random() * 0xffffffff) >>> 0;
    onStart(createGame({ seed, oyakataStyle: style }));
  };
  return (
    <main className="newgame">
      <div className="newgame__head">
        <div className="newgame__brand">
          <svg className="newgame__mon" viewBox="0 0 40 40" aria-hidden="true">
            <Mon />
          </svg>
          <div>
            <p className="newgame__kicker">{t('newGame.kicker')}</p>
            <h1 className="newgame__title">
              {t('app.title')}
              <span className="newgame__seal" aria-hidden="true">
                {t('newGame.seal')}
              </span>
            </h1>
          </div>
        </div>
        <button className="button button--ghost" onClick={onToggleLang}>
          {t('lang.toggle')}
        </button>
      </div>
      <figure className="newgame__picture">
        <TitleArt title={t('newGame.artAria')} />
        <figcaption>{t('newGame.artCaption')}</figcaption>
      </figure>
      <div className="newgame__setup">
        <div className="newgame__intro">
          <h2>{t('newGame.promise')}</h2>
          <p className="newgame__lead">{t('newGame.lead')}</p>
        </div>
        <fieldset className="choice">
          <legend>{t('newGame.styleQuestion')}</legend>
          <p className="choice__help">{t('newGame.styleHelp')}</p>
          {STYLES.map((s, i) => (
            <label key={s} className={`choice__item ${style === s ? 'is-selected' : ''}`}>
              <input type="radio" name="style" checked={style === s} onChange={() => setStyle(s)} />
              <span className="choice__number" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="choice__name">{t(`style.${s}`)}</span>
              <span className="choice__desc">{t(`newGame.style.${s}`)}</span>
            </label>
          ))}
        </fieldset>
        <button className="button button--primary button--large" onClick={start}>
          {t('newGame.start')}
          <span aria-hidden="true">↗</span>
        </button>
      </div>
      <p className="note">{t('newGame.note')}</p>
      <div className="newgame__load">
        <LoadSaveButton onLoad={onStart} />
      </div>
    </main>
  );
}
