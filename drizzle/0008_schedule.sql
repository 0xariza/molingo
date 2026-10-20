CREATE TYPE "public"."lead_source" AS ENUM('online', 'manual');--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "source" "lead_source" DEFAULT 'online' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "moved_from" timestamp with time zone;