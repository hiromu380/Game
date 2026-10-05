/**
 * 体験版（Web）と製品版の切り替え（ビルド時の設定）
 *
 * ビルド時に環境変数 VITE_EDITION=demo を付けると体験版になる（既定は製品版）。
 * 体験版は Web 体験版と Steam 体験版（Next Fest 用）で共通。
 * 体験版の通常ランは「初期パーツ・7×7・延長戦なし」（CLAUDE.md「配信と運用」）。
 * 週替わりは製品版と同じ条件なので、体験版と製品版で同じランキングを競える。
 */
export type Edition = 'demo' | 'full';

export const EDITION: Edition = import.meta.env.VITE_EDITION === 'demo' ? 'demo' : 'full';

export const EDITION_CONFIG = {
  /** 通常ランにメタ進行（新パーツ解放・工場拡張）を反映するか */
  metaProgression: EDITION === 'full',
  /** 全シフトクリア後に延長戦を選べるか */
  overtime: EDITION === 'full',
  /** 実績を記録・送信するか（体験版では無効） */
  achievements: EDITION === 'full',
  /** 製品版（Steam）への誘導を出すか */
  showStoreLink: EDITION === 'demo',
  /** 製品版のストアページ（未公開の間は空。空なら「近日発売」の表示だけ出す） */
  storeUrl: import.meta.env.VITE_STORE_URL ?? '',
} as const;
