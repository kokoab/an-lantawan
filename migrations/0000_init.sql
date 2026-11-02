CREATE TABLE `issues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`published_on` text NOT NULL,
	`pdf_id` integer NOT NULL,
	`cover_id` integer,
	`archived_at` integer,
	FOREIGN KEY (`pdf_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`cover_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "issues_kind" CHECK("issues"."kind" in ('newsletter', 'special'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `issues_slug_unique` ON `issues` (`slug`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`kind` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer NOT NULL,
	`width` integer,
	`height` integer,
	`alt` text,
	`caption` text,
	`credit_person_id` integer,
	`credit_text` text,
	`focal_x` real DEFAULT 0.5 NOT NULL,
	`focal_y` real DEFAULT 0.5 NOT NULL,
	`uploaded_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`credit_person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`uploaded_by`) REFERENCES `editors`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "media_kind" CHECK("media"."kind" in ('image', 'pdf'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_key_unique` ON `media` (`key`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`bio` text,
	`photo_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`photo_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_slug_unique` ON `people` (`slug`);--> statement-breakpoint
CREATE TABLE `sections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`parent_id` integer,
	`sort` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`parent_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sections_slug_unique` ON `sections` (`slug`);--> statement-breakpoint
CREATE TABLE `staff_terms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` integer NOT NULL,
	`school_year` text NOT NULL,
	`position` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_terms_unique` ON `staff_terms` (`person_id`,`school_year`,`position`);--> statement-breakpoint
CREATE TABLE `stories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`section_id` integer NOT NULL,
	`kind` text DEFAULT 'article' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`dek` text,
	`body` text NOT NULL,
	`cover_id` integer,
	`cartoon_on_top` integer DEFAULT false NOT NULL,
	`writer_photo` integer DEFAULT false NOT NULL,
	`video_url` text,
	`published_at` integer,
	`scheduled_for` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`source_message_id` integer,
	`wp_id` integer,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`cover_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_message_id`) REFERENCES `sumat_messages`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "stories_kind" CHECK("stories"."kind" in ('article', 'opinion', 'editorial', 'cartoon', 'explainer', 'photo', 'video', 'letter')),
	CONSTRAINT "stories_status" CHECK("stories"."status" in ('draft', 'scheduled', 'published', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stories_slug_unique` ON `stories` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `stories_source_message_id_unique` ON `stories` (`source_message_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `stories_wp_id_unique` ON `stories` (`wp_id`);--> statement-breakpoint
CREATE INDEX `stories_feed` ON `stories` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `stories_section_feed` ON `stories` (`section_id`,`status`,`published_at`);--> statement-breakpoint
CREATE TABLE `story_authors` (
	`story_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`role` text DEFAULT 'writer' NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`story_id`, `person_id`, `role`),
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "story_authors_role" CHECK("story_authors"."role" in ('writer', 'photographer', 'artist', 'editor'))
);
--> statement-breakpoint
CREATE INDEX `story_authors_person` ON `story_authors` (`person_id`);--> statement-breakpoint
CREATE TABLE `story_media` (
	`story_id` integer NOT NULL,
	`media_id` integer NOT NULL,
	PRIMARY KEY(`story_id`, `media_id`),
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `story_media_media` ON `story_media` (`media_id`);--> statement-breakpoint
CREATE TABLE `story_tags` (
	`story_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`story_id`, `tag_id`),
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `story_tags_tag` ON `story_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `story_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`story_id` integer NOT NULL,
	`title` text NOT NULL,
	`dek` text,
	`body` text NOT NULL,
	`saved_by` integer,
	`saved_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`saved_by`) REFERENCES `editors`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `story_versions_story` ON `story_versions` (`story_id`,`saved_at`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_slug_unique` ON `tags` (`slug`);--> statement-breakpoint
CREATE TABLE `activity_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`editor_id` integer,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer,
	`summary` text NOT NULL,
	`at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`editor_id`) REFERENCES `editors`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `activity_log_at` ON `activity_log` (`at`);--> statement-breakpoint
CREATE INDEX `activity_log_entity` ON `activity_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `editors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`archived_at` integer
);
--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group` text NOT NULL,
	`label` text NOT NULL,
	`href` text,
	`section_id` integer,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "menu_items_group" CHECK("menu_items"."group" in ('header', 'sections', 'sportsfest', 'publication', 'write', 'footer'))
);
--> statement-breakpoint
CREATE INDEX `menu_items_group_sort` ON `menu_items` (`group`,`sort`);--> statement-breakpoint
CREATE TABLE `redirects` (
	`from_path` text PRIMARY KEY NOT NULL,
	`to_path` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_by` integer,
	FOREIGN KEY (`updated_by`) REFERENCES `editors`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`name` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sportsfest_id` integer NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`venue` text,
	`starts_at` integer,
	`note` text,
	FOREIGN KEY (`sportsfest_id`) REFERENCES `sportsfests`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "events_type" CHECK("events"."type" in ('bracket', 'race', 'judged', 'mind')),
	CONSTRAINT "events_status" CHECK("events"."status" in ('scheduled', 'ongoing', 'done', 'postponed', 'cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug` ON `events` (`sportsfest_id`,`slug`);--> statement-breakpoint
CREATE TABLE `match_sets` (
	`match_id` integer NOT NULL,
	`n` integer NOT NULL,
	`home` integer NOT NULL,
	`away` integer NOT NULL,
	PRIMARY KEY(`match_id`, `n`),
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`stage_id` integer NOT NULL,
	`round` integer NOT NULL,
	`position` integer NOT NULL,
	`home_tribu_id` integer,
	`away_tribu_id` integer,
	`home_score` integer,
	`away_score` integer,
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
	CONSTRAINT "matches_status" CHECK("matches"."status" in ('scheduled', 'ongoing', 'done', 'postponed', 'cancelled', 'bye')),
	CONSTRAINT "matches_teams_differ" CHECK("matches"."home_tribu_id" is null or "matches"."home_tribu_id" <> "matches"."away_tribu_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matches_slot` ON `matches` (`stage_id`,`round`,`position`);--> statement-breakpoint
CREATE TABLE `placements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`tribu_id` integer NOT NULL,
	`place` integer NOT NULL,
	`mark` text,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tribu_id`) REFERENCES `tribus`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "placements_place" CHECK("placements"."place" between 1 and 3)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `placements_tribu` ON `placements` (`category_id`,`tribu_id`);--> statement-breakpoint
CREATE TABLE `sportsfest_tribus` (
	`sportsfest_id` integer NOT NULL,
	`tribu_id` integer NOT NULL,
	PRIMARY KEY(`sportsfest_id`, `tribu_id`),
	FOREIGN KEY (`sportsfest_id`) REFERENCES `sportsfests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tribu_id`) REFERENCES `tribus`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `sportsfests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`year` integer NOT NULL,
	`name` text NOT NULL,
	`theme` text,
	`status` text DEFAULT 'upcoming' NOT NULL,
	`starts_on` text,
	`ends_on` text,
	CONSTRAINT "sportsfests_status" CHECK("sportsfests"."status" in ('upcoming', 'ongoing', 'final'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sportsfests_year_unique` ON `sportsfests` (`year`);--> statement-breakpoint
CREATE TABLE `stage_entries` (
	`stage_id` integer NOT NULL,
	`tribu_id` integer NOT NULL,
	`seed` integer,
	PRIMARY KEY(`stage_id`, `tribu_id`),
	FOREIGN KEY (`stage_id`) REFERENCES `stages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tribu_id`) REFERENCES `tribus`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `stages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "stages_kind" CHECK("stages"."kind" in ('single', 'upper', 'lower', 'final', 'group'))
);
--> statement-breakpoint
CREATE TABLE `story_events` (
	`story_id` integer NOT NULL,
	`event_id` integer NOT NULL,
	PRIMARY KEY(`story_id`, `event_id`),
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `story_events_event` ON `story_events` (`event_id`);--> statement-breakpoint
CREATE TABLE `tribus` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`color` text NOT NULL,
	`logo_id` integer,
	`sort` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`logo_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tribus_slug_unique` ON `tribus` (`slug`);--> statement-breakpoint
CREATE TABLE `sumat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prompt_id` integer,
	`prompt_text` text NOT NULL,
	`body` text NOT NULL,
	`sent_as` text NOT NULL,
	`name` text,
	`course_year` text,
	`status` text DEFAULT 'new' NOT NULL,
	`notes` text,
	`received_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`prompt_id`) REFERENCES `sumat_prompts`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "sumat_messages_sent_as" CHECK("sumat_messages"."sent_as" in ('anonymous', 'named')),
	CONSTRAINT "sumat_messages_status" CHECK("sumat_messages"."status" in ('new', 'shortlisted', 'published', 'archived'))
);
--> statement-breakpoint
CREATE INDEX `sumat_messages_inbox` ON `sumat_messages` (`status`,`received_at`);--> statement-breakpoint
CREATE TABLE `sumat_prompts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`opens_at` integer NOT NULL,
	`closes_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
