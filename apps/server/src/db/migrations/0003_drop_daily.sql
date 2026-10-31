-- デイリーチャレンジを週替わりチャレンジに置き換える。Web 版は未公開なので、デイリーのデータは移行せずに削除する（docs/plans/weekly-challenge-plan.md）
DROP TABLE `dailies`;--> statement-breakpoint
DROP TABLE `daily_results`;--> statement-breakpoint
DROP TABLE `daily_sessions`;--> statement-breakpoint
DROP TABLE `market_prices`;--> statement-breakpoint
DROP TABLE `shop_stats`;