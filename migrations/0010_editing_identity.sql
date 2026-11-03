CREATE TABLE `story_presence` (
	`story_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`seen_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`story_id`, `person_id`),
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `people` ADD `can_edit` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `stories` ADD `share_title` text;--> statement-breakpoint
ALTER TABLE `stories` ADD `share_summary` text;--> statement-breakpoint
ALTER TABLE `stories` ADD `updated_by_person_id` integer REFERENCES people(id);--> statement-breakpoint
ALTER TABLE `story_versions` ADD `person_id` integer REFERENCES people(id);--> statement-breakpoint
ALTER TABLE `story_versions` ADD `note` text;--> statement-breakpoint
ALTER TABLE `activity_log` ADD `person_id` integer REFERENCES people(id);--> statement-breakpoint
ALTER TABLE `activity_log` ADD `area` text;--> statement-breakpoint
ALTER TABLE `activity_log` ADD `undo` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `person_id` integer REFERENCES people(id);--> statement-breakpoint
ALTER TABLE `sessions` ADD `remember` integer DEFAULT true NOT NULL;