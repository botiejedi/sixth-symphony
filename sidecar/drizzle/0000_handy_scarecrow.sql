CREATE TABLE `examples` (
	`id` text PRIMARY KEY NOT NULL,
	`domain` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`model_suggested_workspace_id` text,
	`user_chose_workspace_id` text,
	`user_chose_action` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rules` (
	`id` text PRIMARY KEY NOT NULL,
	`domain` text NOT NULL,
	`workspace_id` text NOT NULL,
	`hit_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rules_domain_unique` ON `rules` (`domain`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`vivaldi_workspace_id` integer NOT NULL
);
