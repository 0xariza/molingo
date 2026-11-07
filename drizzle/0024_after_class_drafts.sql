ALTER TABLE "sessions" ADD COLUMN "after_class_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "published_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "assignments" SET "published_at" = "created_at";--> statement-breakpoint
UPDATE "sessions" SET "after_class_sent_at" = now() WHERE "status" = 'held' AND ("topics" IS NOT NULL OR "summary" IS NOT NULL OR EXISTS (SELECT 1 FROM "assignments" a WHERE a."session_id" = "sessions"."id"));
