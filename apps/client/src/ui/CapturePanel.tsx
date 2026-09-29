/**
 * 撮影モード（ストア用のスクリーンショット・動画を撮るための開発用パネル）
 *
 * VITE_CAPTURE=1 でビルドしたときだけ組み込む（App.tsx。通常のビルドでは読み込まれない）。
 * - UI の表示: 全部 / 最小限（盤面と HUD だけ）/ なし（盤面だけ）
 * - 再生速度: 0.25×〜2×（スローで撮る）
 * - 盤面の書き出し・読み込み（JSON）と、指定したシードでの本番: 見栄えの良い連鎖を何度でも再現する
 * - 共有カードの確認: 今の盤面・結果で、結果画面の共有カードを出す
 * パネル自体は C キーで出し入れする（撮影時は隠す）。画面の大きさはブラウザ・撮影ツール側で決める
 * （例: Playwright の viewport 1920×1080。docs/ops/store-assets.md）
 */
import { PART_IDS, type Board, type PartId } from '@chain-factory/sim';
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import type { PlaybackSpeed } from '../playback/timeline';

export type CaptureUi = 'full' | 'minimal' | 'none';

interface Props {
  board: Board;
  ui: CaptureUi;
  speed: PlaybackSpeed;
  onUiChange: (ui: CaptureUi) => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onLoadBoard: (board: Board) => void;
  onCommit: (seed: number) => void;
  /** 今の盤面で共有カードの見た目を確かめる */
  onPreviewShare: () => void;
}

/** 書き出した JSON を盤面として読む。形が違えば null（盤面の大きさは今のランと同じであること） */
export function parseBoard(text: string, width: number, height: number): Board | null {
  try {
    const raw = JSON.parse(text) as Partial<Board>;
    if (raw.width !== width || raw.height !== height || !Array.isArray(raw.cells)) return null;
    if (raw.cells.length !== width * height) return null;
    const ok = raw.cells.every(
      (c) =>
        c === null ||
        (typeof c === 'object' &&
          PART_IDS.includes(c.id as PartId) &&
          [0, 1, 2, 3].includes(c.dir as number)),
    );
    return ok ? (raw as Board) : null;
  } catch {
    return null;
  }
}

const SPEEDS: PlaybackSpeed[] = [0.25, 0.5, 1, 2];

export function CapturePanel(props: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);
  const [text, setText] = useState('');
  const [seed, setSeed] = useState('1');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === 'c' &&
        !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)
      ) {
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;
  const load = () => {
    const board = parseBoard(text, props.board.width, props.board.height);
    if (board) props.onLoadBoard(board);
    setMessage(t(board ? 'capture.loaded' : 'capture.invalid'));
  };

  return (
    <aside className="capture">
      <strong>{t('capture.title')}</strong>
      <div className="button-row">
        {(['full', 'minimal', 'none'] as const).map((ui) => (
          <button
            key={ui}
            className={props.ui === ui ? 'button--primary' : ''}
            onClick={() => props.onUiChange(ui)}
          >
            {t(`capture.ui.${ui}`)}
          </button>
        ))}
      </div>
      <div className="button-row">
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={props.speed === s ? 'button--primary' : ''}
            onClick={() => props.onSpeedChange(s)}
          >
            {s}x
          </button>
        ))}
      </div>
      <div className="button-row">
        <button onClick={() => setText(JSON.stringify(props.board))}>{t('capture.export')}</button>
        <button onClick={load}>{t('capture.import')}</button>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
      <div className="button-row">
        <input value={seed} onChange={(e) => setSeed(e.target.value)} size={10} />
        <button onClick={() => props.onCommit(Number(seed) >>> 0)}>
          {t('capture.commitWithSeed')}
        </button>
      </div>
      <button onClick={props.onPreviewShare}>{t('capture.shareCard')}</button>
      {message && <small>{message}</small>}
    </aside>
  );
}
