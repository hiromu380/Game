import { useState } from 'react';
import { rankValue, type Rank, type Rikishi } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { rankLabel, recordLabel } from '../format';
import { gradeOf, overallOf } from '../grade';
import { points } from '../points';

type Key = 'rank' | 'name' | 'age' | 'overall' | 'oshi' | 'yotsu' | 'waza' | 'last';
const KEYS: Key[] = ['rank', 'name', 'age', 'overall', 'oshi', 'yotsu', 'waza', 'last'];

/** 所属力士の表（見出しを押すと並べ替え。もう一度押すと逆順） */
export function RosterTable({
  mine,
  ranks,
  onOpen,
}: {
  mine: Rikishi[];
  ranks: ReadonlyMap<number, Rank>;
  onOpen: (id: number) => void;
}) {
  const { t } = useI18n();
  const [sort, setSort] = useState<{ key: Key; desc: boolean }>({ key: 'rank', desc: false });
  const rankOrder = (r: Rikishi) => {
    const k = ranks.get(r.id);
    return k ? rankValue(k) : Number.MAX_SAFE_INTEGER;
  };
  const value = (r: Rikishi, k: Key): number | string => {
    switch (k) {
      case 'rank':
        return rankOrder(r);
      case 'name':
        return r.name;
      case 'age':
        return r.age;
      case 'overall':
        return overallOf(r.abilities);
      case 'oshi':
      case 'yotsu':
      case 'waza':
        return r.abilities[k];
      case 'last':
        return r.recent[0] ? r.recent[0].wins - r.recent[0].losses : -99;
    }
  };
  // 数は大きい順が先、番付は上が先、名前は五十音順が先（rank の小さい値が上）
  const natural: Record<Key, 1 | -1> = {
    rank: 1,
    name: 1,
    age: 1,
    overall: -1,
    oshi: -1,
    yotsu: -1,
    waza: -1,
    last: -1,
  };
  const rows = [...mine].sort((a, b) => {
    const va = value(a, sort.key);
    const vb = value(b, sort.key);
    const c = typeof va === 'string' ? va.localeCompare(vb as string, 'ja') : va - (vb as number);
    return c * natural[sort.key] * (sort.desc ? -1 : 1) || rankOrder(a) - rankOrder(b);
  });
  const grade = (v: number) => (
    <>
      <span className={`grade grade--${gradeOf(v)}`}>{gradeOf(v)}</span> {points(v)}
    </>
  );
  return (
    <div className="roster">
      <table className="roster__table">
        <thead>
          <tr>
            {KEYS.map((k) => (
              <th
                key={k}
                scope="col"
                aria-sort={
                  sort.key === k
                    ? (natural[k] === 1) !== sort.desc
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <button
                  className="roster__sort"
                  onClick={() => setSort((s) => ({ key: k, desc: s.key === k ? !s.desc : false }))}
                >
                  {t(`roster.col.${k}`)}
                  {sort.key === k && (
                    <span aria-hidden="true">{(natural[k] === 1) !== sort.desc ? '▲' : '▼'}</span>
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{rankLabel(t, ranks.get(r.id) ?? null)}</td>
              <th scope="row">
                <button className="roster__name" onClick={() => onOpen(r.id)}>
                  {r.name}
                </button>
              </th>
              <td>{r.age}</td>
              <td>{grade(overallOf(r.abilities))}</td>
              <td>{grade(r.abilities.oshi)}</td>
              <td>{grade(r.abilities.yotsu)}</td>
              <td>{grade(r.abilities.waza)}</td>
              <td>{r.recent[0] ? recordLabel(t, r.recent[0]) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
