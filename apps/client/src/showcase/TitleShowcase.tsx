/**
 * タイトル画面の背景で流す見本の連鎖（遅延読み込み。盤面の描画はゲーム本体と同じ）
 * 音は鳴らさない（タイトルを開いただけで音が出ないように）
 */
import { ShowcasePlayer } from './ShowcasePlayer';
import { TITLE_SHOWCASE } from './boards';

export default function TitleShowcase() {
  return <ShowcasePlayer def={TITLE_SHOWCASE} start={1} loop muted />;
}
