ALTER TABLE `projects` ADD `live_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `repo_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `owner_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `dashboard_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `tier` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `renewal_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `last_reminder_sent_at` integer;