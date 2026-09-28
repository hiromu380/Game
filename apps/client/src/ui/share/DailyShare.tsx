/**
 * デイリーの結果のシェア（結果画面に出す）
 *
 * 上位○% はランキングから取る（取れなければ入れずにシェアできる）。
 */
import { getBestChain, type RunState } from '@chain-factory/sim';
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { api } from '../../online/api';
import { buildShareText, siteUrl, xIntentUrl } from '../../online/shareText';

interface Props {
  run: RunState;
  dailyId: string;
  number: number;
}

export function DailyShare({ run, dailyId, number }: Props) {
  const { t } = useI18n();
  const [topPercent, setTopPercent] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getRanking(dailyId)
      .then((r) => !cancelled && setTopPercent(r.me?.topPercent ?? null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dailyId]);

  const text = buildShareText(t, {
    number,
    history: run.history,
    shiftCount: run.config.shifts.length,
    maxChain: getBestChain(run),
    topPercent,
    url: siteUrl(),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="share">
      <pre className="share__preview">{text}</pre>
      <div className="button-row share__actions">
        <a
          className="button share__x"
          href={xIntentUrl(text)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('share.toX')}
        </a>
        <button onClick={() => void copy()}>{copied ? t('share.copied') : t('share.copy')}</button>
      </div>
    </div>
  );
}
