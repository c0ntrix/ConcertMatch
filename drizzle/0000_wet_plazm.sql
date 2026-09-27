CREATE TABLE `cache` (
	`key` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner` text NOT NULL,
	`invite_hash` text NOT NULL,
	`preferences` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_groups_owner` ON `groups` (`owner`);--> statement-breakpoint
CREATE INDEX `idx_groups_expiry` ON `groups` (`expires_at`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`artists` text NOT NULL,
	`genres` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_members_group` ON `members` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_members_owner` ON `members` (`owner`);--> statement-breakpoint
CREATE TABLE `oauth` (
	`state` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`verifier` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saved` (
	`group_id` text NOT NULL,
	`event_id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`group_id`, `event_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`group_id` text NOT NULL,
	`event_id` text NOT NULL,
	`member_id` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`group_id`, `event_id`, `member_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
