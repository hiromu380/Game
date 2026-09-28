/**
 * 実績と統計をプラットフォーム（Steam）へ送る React フック
 *
 * - 解除済みの実績は、この起動中にまだ送れていないものだけ送る。起動直後は全部を送るので、
 *   Steam が動いていなかった間に解除した分もここで送り直される（Steam 側では二重に解除されない）
 * - 送信に失敗した実績は「未送信」に戻し、次に状態が変わったときにもう一度送る
 * - Web 版・体験版では何もしない
 */
import { achievementStats, type AchievementProgress, type MetaProgress } from '@chain-factory/sim';
import { useEffect, useRef } from 'react';
import { EDITION_CONFIG } from '../config/edition';
import { getPlatform } from '.';

export function useSteamAchievements(meta: MetaProgress, achievements: AchievementProgress): void {
  const sent = useRef(new Set<string>());
  useEffect(() => {
    const platform = getPlatform();
    if (!EDITION_CONFIG.achievements || platform.kind !== 'desktop') return;
    for (const id of achievements.unlocked) {
      if (sent.current.has(id)) continue;
      sent.current.add(id);
      void platform.unlockAchievement(id).then((ok) => {
        if (!ok) sent.current.delete(id);
      });
    }
    void platform.setStats(achievementStats(meta, achievements));
  }, [meta, achievements]);
}
