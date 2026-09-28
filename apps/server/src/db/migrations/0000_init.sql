CREATE TABLE `dailies` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`config_json` text NOT NULL,
	`seed_commitment` text NOT NULL,
	`sim_version` text NOT NULL,
	`opens_at` integer NOT NULL,
	`closes_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daily_results` (
	`daily_id` text NOT NULL,
	`player_id` text NOT NULL,
	`shifts_cleared` integer NOT NULL,
	`score_digits` integer NOT NULL,
	`score_head` integer NOT NULL,
	`score_text` text NOT NULL,
	`max_chain` integer NOT NULL,
	`submitted_at` integer NOT NULL,
	PRIMARY KEY(`daily_id`, `player_id`)
);
--> statement-breakpoint
CREATE INDEX `daily_results_rank` ON `daily_results` (`daily_id`,`shifts_cleared`,`score_digits`,`score_head`,`score_text`,`submitted_at`);--> statement-breakpoint
CREATE TABLE `daily_sessions` (
	`daily_id` text NOT NULL,
	`player_id` text NOT NULL,
	`ops_json` text NOT NULL,
	`shift_index` integer NOT NULL,
	`status` text NOT NULL,
	`ranked` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`daily_id`, `player_id`)
);
--> statement-breakpoint
CREATE TABLE `market_prices` (
	`date` text NOT NULL,
	`part_id` text NOT NULL,
	`multiplier_milli` integer NOT NULL,
	`price` integer NOT NULL,
	PRIMARY KEY(`date`, `part_id`)
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`hidden` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shop_stats` (
	`daily_id` text NOT NULL,
	`part_id` text NOT NULL,
	`offered` integer NOT NULL,
	`bought` integer NOT NULL,
	PRIMARY KEY(`daily_id`, `part_id`)
);
