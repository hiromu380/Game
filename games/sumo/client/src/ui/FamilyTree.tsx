import type { FamilyNode, GameState } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { bashoName, rankLabel } from '../format';

/** 系譜図: 師匠 → 弟子の親方 → …（分家・定年した親方も含む） */
export function FamilyTree({ game }: { game: GameState }) {
  const { t } = useI18n();
  const nodes = game.player.family;
  const children = new Map<number | null, FamilyNode[]>();
  for (const n of nodes) {
    const key = n.parentId !== null && nodes.some((x) => x.id === n.parentId) ? n.parentId : null;
    children.set(key, [...(children.get(key) ?? []), n]);
  }
  const stableName = new Map(game.stables.map((s) => [s.id, s.name]));
  const render = (n: FamilyNode) => {
    const kids = children.get(n.id) ?? [];
    const achievements = n.sekitori + n.sanyaku + n.yokozuna + n.makuuchiYusho > 0;
    return (
      <li key={n.id} className={`tree__node tree__node--${n.kind}`}>
        <div className="tree__card">
          <strong>
            {n.kind === 'waiting'
              ? t('lineage.waitingName', { shikona: n.shikona })
              : t('lineage.oyakata', { name: n.name, shikona: n.shikona })}
          </strong>
          <span className="tag">{t(`family.kind.${n.kind}`)}</span>
          <span className="tree__meta">
            {stableName.has(n.stableId)
              ? t('top.stable', { name: stableName.get(n.stableId)! })
              : t('family.closed')}
            {n.highestRank
              ? ` ・${t('family.highest', { rank: rankLabel(t, n.highestRank) })}`
              : ''}
            {' ・'}
            {bashoName(t, n.fromBashoIndex)}〜
            {n.toBashoIndex === null ? '' : bashoName(t, n.toBashoIndex)}
          </span>
          {achievements && (
            <span className="tree__meta">
              {t('lineage.stats', {
                sekitori: n.sekitori,
                sanyaku: n.sanyaku,
                yokozuna: n.yokozuna,
                yusho: n.makuuchiYusho,
              })}
            </span>
          )}
        </div>
        {kids.length > 0 && <ul className="tree__children">{kids.map(render)}</ul>}
      </li>
    );
  };
  return <ul className="tree">{(children.get(null) ?? []).map(render)}</ul>;
}
