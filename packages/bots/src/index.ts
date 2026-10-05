/**
 * 自動プレイのボット（純粋: sim だけに依存。Node・Workers のどちらでも動く）
 *
 * - tools/balance: たくさんのシードで遊ばせ、クリア率・パーツの採用率をレポートする
 * - apps/server: 週替わりチャレンジの盤面を、公開前に「クリアできるか」自動で検証する
 */
export * from './bots';
export * from './evaluate';
export * from './moves';
export * from './permit';
export * from './runner';
