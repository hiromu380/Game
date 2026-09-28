CREATE TABLE `external_accounts` (
	`provider` text NOT NULL,
	`subject_hash` text NOT NULL,
	`player_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`provider`, `subject_hash`)
);
