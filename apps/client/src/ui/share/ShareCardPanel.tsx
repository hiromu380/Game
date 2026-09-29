/**
 * 共有カードの欄（結果画面・撮影モード）: カードのプレビュー、2つの大きさの切り替え、
 * 画像の保存・コピー、X の投稿画面を開く
 *
 * X の投稿画面へ画像を直接添付する方法はないので、「画像を貼り付けて投稿してください」と案内する。
 */
import { useEffect, useState } from 'react';
import { SHARE_CONFIG, type ShareCardSize } from '../../config/share';
import { useI18n } from '../../i18n';
import { xIntentUrl } from '../../online/shareText';
import { getPlatform } from '../../platform';
import { buildShareCard, type ShareCardInput } from '../../share/card';
import { renderCard } from '../../share/renderCard';
import { UiIcon } from '../UiIcon';

interface Props {
  card: ShareCardInput;
  /** 投稿の本文（URL は別枠で付ける） */
  text: string;
  url: string;
  /** 保存するファイル名（拡張子なし） */
  fileName: string;
}

const SIZES = Object.keys(SHARE_CONFIG.sizes) as ShareCardSize[];

export function ShareCardPanel({ card, text, url, fileName }: Props) {
  const { t } = useI18n();
  const [size, setSize] = useState<ShareCardSize>('landscape');
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    renderCard(buildShareCard(card, size), size)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setImage({ blob, url: objectUrl });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [card, size]);

  const copy = async () => {
    if (!image) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': image.blob })]);
      setCopied('ok');
    } catch {
      setCopied('failed');
    }
  };

  return (
    <div className="share-card">
      <div className="segmented share-card__sizes">
        {SIZES.map((s) => (
          <button key={s} className={size === s ? 'is-active' : ''} onClick={() => setSize(s)}>
            {t(`shareCard.size.${s}`)}
          </button>
        ))}
      </div>
      {image && <img className="share-card__preview" src={image.url} alt={t('shareCard.alt')} />}
      <div className="button-row share-card__actions">
        <button
          className="button--primary"
          onClick={() => void getPlatform().openExternal(xIntentUrl(text, url))}
        >
          <UiIcon name="share" />
          {t('shareCard.toX')}
        </button>
        <a
          className={`button ${image ? '' : 'is-disabled'}`}
          href={image?.url}
          download={`${fileName}-${SHARE_CONFIG.sizes[size].width}x${SHARE_CONFIG.sizes[size].height}.png`}
        >
          {t('shareCard.save')}
        </a>
        <button disabled={!image} onClick={() => void copy()}>
          {copied === 'ok'
            ? t('shareCard.copied')
            : copied === 'failed'
              ? t('shareCard.copyFailed')
              : t('shareCard.copy')}
        </button>
      </div>
      <p className="panel__hint">{t('shareCard.pasteHint')}</p>
      <pre className="share__preview">{`${text}\n${url}`}</pre>
    </div>
  );
}
