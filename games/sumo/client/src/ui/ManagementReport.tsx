import { MONEY_LOG_MAX, type GameState, type MoneyLogEntry } from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { bashoName, money } from '../format';

/** 前の場所との差の札（増えて良いものは緑・減ると朱。▲▼と字でも伝える） */
function Delta({
  now,
  before,
  fmt,
  goodUp = true,
}: {
  now: number;
  before: number | null;
  fmt: (n: number) => string;
  goodUp?: boolean;
}) {
  const { t } = useI18n();
  if (before === null) return <span className="muted">—</span>;
  const d = now - before;
  if (Math.abs(d) < 1e-9) return <span className="muted">{t('mgmt.same')}</span>;
  const good = d > 0 === goodUp;
  return (
    <span className={`rewards__chip is-${good ? 'good' : 'bad'}`}>
      {d > 0 ? '▲' : '▼'}
      {fmt(Math.abs(d))}
    </span>
  );
}

/** 場所ごとの部屋の収支の棒グラフ（0の線から上が黒字・下が赤字） */
function NetChart({ log }: { log: MoneyLogEntry[] }) {
  const { t, lang } = useI18n();
  const W = 320;
  const H = 96;
  const pad = 4;
  const nets = log.map((e) => e.income - e.expenses);
  const max = Math.max(1, ...nets.map(Math.abs));
  const zero = H / 2;
  // 枠は記録の上限ぶん（棒の太さを場所の数で変えない。左から古い順）
  const step = (W - pad * 2) / MONEY_LOG_MAX;
  const bw = Math.max(4, step - 4);
  return (
    <figure className="mgmt__chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t('mgmt.chartAria', { n: log.length })}
        preserveAspectRatio="none"
      >
        <line x1={0} x2={W} y1={zero} y2={zero} className="mgmt__zero" />
        {log.map((e, i) => {
          const v = nets[i]!;
          const h = (Math.abs(v) / max) * (H / 2 - pad);
          return (
            <rect
              key={e.bashoIndex}
              className={v >= 0 ? 'mgmt__bar is-good' : 'mgmt__bar is-bad'}
              x={pad + i * step + (step - bw) / 2}
              y={v >= 0 ? zero - h : zero}
              width={bw}
              height={Math.max(1, h)}
            >
              <title>{`${bashoName(t, e.bashoIndex)} ${money(t, v, lang)}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="mgmt__axis">
        {t('mgmt.range', {
          from: bashoName(t, log[0]!.bashoIndex),
          to: bashoName(t, log.at(-1)!.bashoIndex),
        })}
      </figcaption>
    </figure>
  );
}

/** 帳簿の先頭: その場所の経営報告（要点・前の場所との比べ・推移） */
export function ManagementReport({ game }: { game: GameState }) {
  const { t, lang } = useI18n();
  const log = game.moneyLog;
  const now = log.at(-1);
  if (!now) return null;
  const prev = log.length > 1 ? log.at(-2)! : null;
  const yen = (n: number) => money(t, n, lang);
  const rows: {
    key: string;
    now: number;
    before: number | null;
    fmt: (n: number) => string;
    goodUp?: boolean;
  }[] = [
    { key: 'income', now: now.income, before: prev?.income ?? null, fmt: yen },
    { key: 'expenses', now: now.expenses, before: prev?.expenses ?? null, fmt: yen, goodUp: false },
    {
      key: 'net',
      now: now.income - now.expenses,
      before: prev ? prev.income - prev.expenses : null,
      fmt: yen,
    },
    { key: 'stableMoney', now: now.stableMoney, before: prev?.stableMoney ?? null, fmt: yen },
    { key: 'personalMoney', now: now.personalMoney, before: prev?.personalMoney ?? null, fmt: yen },
    {
      key: 'prestige',
      now: now.prestige,
      before: prev?.prestige ?? null,
      fmt: (n) => (Math.round(n * 10) / 10).toString(),
    },
    {
      key: 'deshi',
      now: now.deshi,
      before: prev?.deshi ?? null,
      fmt: (n) => t('mgmt.people', { n }),
    },
  ];
  return (
    <section className="panel" aria-labelledby="mgmt-title">
      <h2 id="mgmt-title">{t('mgmt.title', { basho: bashoName(t, now.bashoIndex) })}</h2>
      <table className="ledger mgmt__table">
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">{t('mgmt.now')}</th>
            <th scope="col">{t('mgmt.vsPrev')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{t(`mgmt.row.${r.key}` as MessageKey)}</th>
              <td>{r.fmt(r.now)}</td>
              <td>
                <Delta now={r.now} before={r.before} fmt={r.fmt} goodUp={r.goodUp} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {log.length > 1 && (
        <>
          <h3>{t('mgmt.trend')}</h3>
          <NetChart log={log} />
        </>
      )}
    </section>
  );
}
