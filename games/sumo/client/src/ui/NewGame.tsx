import { useState } from 'react';
import { createGame, type GameState, type Style } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { TitleArt } from '../art/TitleArt';

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
        <div>
          <p className="newgame__kicker">{t('newGame.kicker')}</p>
          <h1 className="newgame__title">{t('app.title')}</h1>
        </div>
        <button className="button button--ghost" onClick={onToggleLang}>
          {t('lang.toggle')}
        </button>
      </div>
      <TitleArt title={t('newGame.artAria')} />
      <div className="newgame__intro">
        <h2>{t('newGame.promise')}</h2>
        <p className="newgame__lead">{t('newGame.lead')}</p>
      </div>
      <fieldset className="choice">
        <legend>{t('newGame.styleQuestion')}</legend>
        {STYLES.map((s) => (
          <label key={s} className={`choice__item ${style === s ? 'is-selected' : ''}`}>
            <input type="radio" name="style" checked={style === s} onChange={() => setStyle(s)} />
            <span className="choice__name">{t(`style.${s}`)}</span>
            <span className="choice__desc">{t(`newGame.style.${s}`)}</span>
          </label>
        ))}
      </fieldset>
      <button className="button button--primary button--large" onClick={start}>
        {t('newGame.start')}
      </button>
      <p className="note">{t('newGame.note')}</p>
    </main>
  );
}
