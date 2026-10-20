-- Class names in Persian (required) and English (optional), like learners' names.
ALTER TABLE "classes" RENAME COLUMN "name" TO "name_fa";--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "name_en" text;
