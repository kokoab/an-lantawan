CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`editor_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`editor_id`) REFERENCES `editors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_editor` ON `sessions` (`editor_id`);--> statement-breakpoint
PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__new_editors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`archived_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_editors`("id", "name", "email", "created_at", "archived_at") SELECT "id", "name", "email", "created_at", "archived_at" FROM `editors`;--> statement-breakpoint
DROP TABLE `editors`;--> statement-breakpoint
ALTER TABLE `__new_editors` RENAME TO `editors`;--> statement-breakpoint
CREATE UNIQUE INDEX `editors_email_unique` ON `editors` (`email`);