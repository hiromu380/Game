CREATE TABLE `market_prices` (
	`week_id` text NOT NULL,
	`part_id` text NOT NULL,
	`multiplier_milli` integer NOT NULL,
	`price` integer NOT NULL,
	PRIMARY KEY(`week_id`, `part_id`)
);
--> statement-breakpoint
CREATE TABLE `shop_stats` (
	`week_id` text NOT NULL,
	`part_id` text NOT NULL,
	`offered` integer NOT NULL,
	`bought` integer NOT NULL,
	PRIMARY KEY(`week_id`, `part_id`)
);
--> statement-breakpoint
CREATE TABLE `weekly_attempt_results` (
	`week_id` text NOT NULL,
	`day_id` text NOT NULL,
	`player_id` text NOT NULL,
	`shifts_cleared` integer NOT NULL,
	`score_digits` integer NOT NULL,
	`score_head` integer NOT NULL,
	`score_text` text NOT NULL,
	`max_chain` integer NOT NULL,
	`submitted_at` integer NOT NULL,
	PRIMARY KEY(`week_id`, `day_id`, `player_id`)
);
--> statement-breakpoint
CREATE TABLE `weekly_attempts` (
	`week_id` text NOT NULL,
	`day_id` text NOT NULL,
	`player_id` text NOT NULL,
	`ops_json` text NOT NULL,
	`shift_index` integer NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`week_id`, `day_id`, `player_id`)
);
--> statement-breakpoint
CREATE INDEX `weekly_attempts_player` ON `weekly_attempts` (`week_id`,`player_id`);--> statement-breakpoint
CREATE TABLE `weekly_bests` (
	`week_id` text NOT NULL,
	`player_id` text NOT NULL,
	`day_id` text NOT NULL,
	`shifts_cleared` integer NOT NULL,
	`score_digits` integer NOT NULL,
	`score_head` integer NOT NULL,
	`score_text` text NOT NULL,
	`max_chain` integer NOT NULL,
	`submitted_at` integer NOT NULL,
	`days_played` integer NOT NULL,
	PRIMARY KEY(`week_id`, `player_id`)
);
--> statement-breakpoint
CREATE INDEX `weekly_bests_rank` ON `weekly_bests` (`week_id`,`shifts_cleared`,`score_digits`,`score_head`,`score_text`,`submitted_at`);--> statement-breakpoint
CREATE TABLE `weekly_finalizations` (
	`week_id` text PRIMARY KEY NOT NULL,
	`total` integer NOT NULL,
	`processed` integer NOT NULL,
	`finished_at` integer
);
--> statement-breakpoint
CREATE TABLE `weekly_standings` (
	`week_id` text NOT NULL,
	`player_id` text NOT NULL,
	`rank` integer NOT NULL,
	`top_percent_milli` integer NOT NULL,
	`day_id` text NOT NULL,
	`shifts_cleared` integer NOT NULL,
	`score_digits` integer NOT NULL,
	`score_head` integer NOT NULL,
	`score_text` text NOT NULL,
	`max_chain` integer NOT NULL,
	`submitted_at` integer NOT NULL,
	`days_played` integer NOT NULL,
	PRIMARY KEY(`week_id`, `player_id`)
);
--> statement-breakpoint
CREATE INDEX `weekly_standings_rank` ON `weekly_standings` (`week_id`,`rank`);--> statement-breakpoint
CREATE TABLE `weeks` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`candidate` integer NOT NULL,
	`fallback` integer NOT NULL,
	`verify_json` text NOT NULL,
	`verify_state` text NOT NULL,
	`base_config_json` text NOT NULL,
	`config_json` text,
	`market_state` text NOT NULL,
	`seed_commitment` text NOT NULL,
	`sim_version` text NOT NULL,
	`opens_at` integer NOT NULL,
	`closes_at` integer NOT NULL
);
