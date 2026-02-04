-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "kysely_migration" (
	"name" varchar(255) PRIMARY KEY NOT NULL,
	"timestamp" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kysely_migration_lock" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"is_locked" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draft" (
	"author_id" uuid PRIMARY KEY NOT NULL,
	"author_handle" varchar(24) NOT NULL,
	"content" jsonb NOT NULL,
	"time_most_recently_edited" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"author_id" uuid NOT NULL,
	"author_handle" varchar(24) NOT NULL,
	"author_display_name" varchar(40) NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"content" jsonb NOT NULL,
	"replies" uuid[] DEFAULT '{"RAY"}'
);
--> statement-breakpoint
CREATE TABLE "like" (
	"post_id" uuid NOT NULL,
	"liker_id" uuid NOT NULL,
	"created_at" timestamp with time zone,
	CONSTRAINT "like_pkey" PRIMARY KEY("post_id","liker_id")
);
--> statement-breakpoint
CREATE TABLE "repost" (
	"post_id" uuid NOT NULL,
	"reposter_id" uuid NOT NULL,
	"created_at" timestamp with time zone,
	CONSTRAINT "repost_pkey" PRIMARY KEY("reposter_id","post_id")
);
--> statement-breakpoint
ALTER TABLE "like" ADD CONSTRAINT "like_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repost" ADD CONSTRAINT "repost_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE no action ON UPDATE no action;
*/