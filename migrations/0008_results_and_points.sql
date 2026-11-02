PRAGMA defer_foreign_keys = on;--> statement-breakpoint
-- Dropping `matches` cascades to set scores and clears bracket links, so both are copied first.
CREATE TABLE `__matches_backup` AS SELECT `id`, `winner_to_match_id`, `loser_to_match_id` FROM `matches`;--> statement-breakpoint
CREATE TABLE `__match_sets_backup` AS SELECT * FROM `match_sets`;--> statement-breakpoint
CREATE TABLE `__new_placements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`tribu_id` integer NOT NULL,
	`place` integer NOT NULL,
	`mark` text,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tribu_id`) REFERENCES `tribus`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "placements_place" CHECK("__new_placements"."place" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_placements`("id", "category_id", "tribu_id", "place", "mark") SELECT "id", "category_id", "tribu_id", "place", "mark" FROM `placements`;--> statement-breakpoint
DROP TABLE `placements`;--> statement-breakpoint
ALTER TABLE `__new_placements` RENAME TO `placements`;--> statement-breakpoint
CREATE UNIQUE INDEX `placements_tribu` ON `placements` (`category_id`,`tribu_id`);--> statement-breakpoint
CREATE TABLE `__new_matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`stage_id` integer NOT NULL,
	`round` integer NOT NULL,
	`position` integer NOT NULL,
	`home_tribu_id` integer,
	`away_tribu_id` integer,
	`home_score` real,
	`away_score` real,
	`winner_tribu_id` integer,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`starts_at` integer,
	`venue` text,
	`winner_to_match_id` integer,
	`winner_to_slot` text,
	`loser_to_match_id` integer,
	`loser_to_slot` text,
	FOREIGN KEY (`stage_id`) REFERENCES `stages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`home_tribu_id`) REFERENCES `tribus`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`away_tribu_id`) REFERENCES `tribus`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`winner_tribu_id`) REFERENCES `tribus`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`winner_to_match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`loser_to_match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "matches_status" CHECK("__new_matches"."status" in ('scheduled', 'ongoing', 'done', 'postponed', 'cancelled', 'bye')),
	CONSTRAINT "matches_teams_differ" CHECK("__new_matches"."home_tribu_id" is null or "__new_matches"."home_tribu_id" <> "__new_matches"."away_tribu_id")
);
--> statement-breakpoint
INSERT INTO `__new_matches`("id", "stage_id", "round", "position", "home_tribu_id", "away_tribu_id", "home_score", "away_score", "winner_tribu_id", "status", "starts_at", "venue", "winner_to_match_id", "winner_to_slot", "loser_to_match_id", "loser_to_slot") SELECT "id", "stage_id", "round", "position", "home_tribu_id", "away_tribu_id", "home_score", "away_score", "winner_tribu_id", "status", "starts_at", "venue", "winner_to_match_id", "winner_to_slot", "loser_to_match_id", "loser_to_slot" FROM `matches`;--> statement-breakpoint
DROP TABLE `matches`;--> statement-breakpoint
ALTER TABLE `__new_matches` RENAME TO `matches`;--> statement-breakpoint
CREATE UNIQUE INDEX `matches_slot` ON `matches` (`stage_id`,`round`,`position`);--> statement-breakpoint
UPDATE `matches` SET
  `winner_to_match_id` = (SELECT b.`winner_to_match_id` FROM `__matches_backup` b WHERE b.`id` = `matches`.`id`),
  `loser_to_match_id` = (SELECT b.`loser_to_match_id` FROM `__matches_backup` b WHERE b.`id` = `matches`.`id`);--> statement-breakpoint
INSERT OR IGNORE INTO `match_sets` SELECT * FROM `__match_sets_backup`;--> statement-breakpoint
DROP TABLE `__matches_backup`;--> statement-breakpoint
DROP TABLE `__match_sets_backup`;--> statement-breakpoint
ALTER TABLE `stages` ADD `points_win` real DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `stages` ADD `points_draw` real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `stages` ADD `points_loss` real DEFAULT 0 NOT NULL;