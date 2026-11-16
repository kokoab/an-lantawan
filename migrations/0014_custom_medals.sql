PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__new_placements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`tribu_id` integer NOT NULL,
	`place` integer NOT NULL,
	`mark` text,
	`count` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tribu_id`) REFERENCES `tribus`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "placements_place" CHECK("__new_placements"."place" >= 1),
	CONSTRAINT "placements_count" CHECK("__new_placements"."count" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_placements`("id", "category_id", "tribu_id", "place", "mark", "count") SELECT "id", "category_id", "tribu_id", "place", "mark", 1 FROM `placements`;--> statement-breakpoint
DROP TABLE `placements`;--> statement-breakpoint
ALTER TABLE `__new_placements` RENAME TO `placements`;--> statement-breakpoint
CREATE UNIQUE INDEX `placements_tribu_place` ON `placements` (`category_id`,`tribu_id`,`place`);--> statement-breakpoint
ALTER TABLE `categories` ADD `custom_medals` integer DEFAULT false NOT NULL;