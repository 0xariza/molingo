-- M6c: several teachers. Everything that exists today belongs to the first (and only) teacher, Mona.
-- Roles: the old `admin` (Mona) becomes an ordinary `teacher`; `owner` is the new platform role.
ALTER TYPE "public"."user_role" RENAME VALUE 'admin' TO 'owner';--> statement-breakpoint
UPDATE "users" SET "role" = 'teacher' WHERE "role" = 'owner';--> statement-breakpoint
-- Every teacher has a teachers row (Mona's was made on her first class), with a page address and brand.
INSERT INTO "teachers" ("user_id") SELECT "id" FROM "users" WHERE "role" = 'teacher' ON CONFLICT ("user_id") DO NOTHING;--> statement-breakpoint
ALTER TABLE "teachers" ADD COLUMN "slug" "citext";--> statement-breakpoint
ALTER TABLE "teachers" ADD COLUMN "brand_name" text;--> statement-breakpoint
ALTER TABLE "teachers" ADD COLUMN "name_fa" text;--> statement-breakpoint
ALTER TABLE "teachers" ADD COLUMN "name_en" text;--> statement-breakpoint
UPDATE "teachers" t SET
  "slug" = CASE WHEN t."id" = (SELECT "id" FROM "teachers" ORDER BY "created_at", "id" LIMIT 1) THEN 'mona' ELSE 't-' || left(t."id"::text, 8) END,
  "brand_name" = CASE WHEN t."id" = (SELECT "id" FROM "teachers" ORDER BY "created_at", "id" LIMIT 1) THEN 'Mona English' ELSE (SELECT "display_name" FROM "users" u WHERE u."id" = t."user_id") END,
  "name_fa" = CASE WHEN t."id" = (SELECT "id" FROM "teachers" ORDER BY "created_at", "id" LIMIT 1) THEN 'مونا' ELSE (SELECT "display_name" FROM "users" u WHERE u."id" = t."user_id") END,
  "name_en" = CASE WHEN t."id" = (SELECT "id" FROM "teachers" ORDER BY "created_at", "id" LIMIT 1) THEN 'Mona' ELSE (SELECT "display_name" FROM "users" u WHERE u."id" = t."user_id") END;--> statement-breakpoint
ALTER TABLE "teachers" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "teachers" ALTER COLUMN "brand_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "teachers" ALTER COLUMN "name_fa" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "teachers" ALTER COLUMN "name_en" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_slug_unique" UNIQUE("slug");--> statement-breakpoint
-- Per-teacher learner data moves from students to the teacher–learner link.
CREATE TABLE "teacher_learners" (
	"teacher_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" "student_status" DEFAULT 'lead' NOT NULL,
	"notes" text,
	"lead_id" uuid,
	"started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_learners_teacher_id_student_id_pk" PRIMARY KEY("teacher_id","student_id"),
	CONSTRAINT "teacher_learners_leadId_unique" UNIQUE("lead_id")
);--> statement-breakpoint
ALTER TABLE "teacher_learners" ADD CONSTRAINT "teacher_learners_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_learners" ADD CONSTRAINT "teacher_learners_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_learners" ADD CONSTRAINT "teacher_learners_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "teacher_learners_teacher_id_status_index" ON "teacher_learners" USING btree ("teacher_id","status");--> statement-breakpoint
CREATE INDEX "teacher_learners_teacher_id_started_at_index" ON "teacher_learners" USING btree ("teacher_id","started_at");--> statement-breakpoint
INSERT INTO "teacher_learners" ("teacher_id", "student_id", "status", "notes", "lead_id", "started_at", "created_at", "updated_at")
  SELECT (SELECT "id" FROM "teachers" ORDER BY "created_at", "id" LIMIT 1), s."id", s."status", s."notes", s."lead_id", s."started_at", s."created_at", s."updated_at"
  FROM "students" s;--> statement-breakpoint
ALTER TABLE "students" DROP CONSTRAINT "students_leadId_unique";--> statement-breakpoint
ALTER TABLE "students" DROP CONSTRAINT "students_lead_id_leads_id_fk";--> statement-breakpoint
DROP INDEX "students_status_index";--> statement-breakpoint
DROP INDEX "students_started_at_index";--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "notes";--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "lead_id";--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "started_at";--> statement-breakpoint
-- Bookings and level-check times belong to a teacher.
ALTER TABLE "leads" ADD COLUMN "teacher_id" uuid;--> statement-breakpoint
UPDATE "leads" SET "teacher_id" = (SELECT "id" FROM "teachers" ORDER BY "created_at", "id" LIMIT 1);--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "teacher_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
DROP INDEX "leads_status_created_at_index";--> statement-breakpoint
CREATE INDEX "leads_teacher_id_status_created_at_index" ON "leads" USING btree ("teacher_id","status","created_at");--> statement-breakpoint
ALTER TABLE "level_check_slots" ADD COLUMN "teacher_id" uuid;--> statement-breakpoint
UPDATE "level_check_slots" SET "teacher_id" = (SELECT "id" FROM "teachers" ORDER BY "created_at", "id" LIMIT 1);--> statement-breakpoint
ALTER TABLE "level_check_slots" ALTER COLUMN "teacher_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "level_check_slots" ADD CONSTRAINT "level_check_slots_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_check_slots" DROP CONSTRAINT "level_check_slots_startsAt_unique";--> statement-breakpoint
ALTER TABLE "level_check_slots" ADD CONSTRAINT "level_check_slots_teacherId_startsAt_unique" UNIQUE("teacher_id","starts_at");
