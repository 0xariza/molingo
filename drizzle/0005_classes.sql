CREATE TYPE "public"."attendance_status" AS ENUM('present', 'absent', 'excused');--> statement-breakpoint
CREATE TYPE "public"."cefr_level" AS ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2');--> statement-breakpoint
CREATE TYPE "public"."class_type" AS ENUM('private', 'group');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'ended');--> statement-breakpoint
CREATE TYPE "public"."session_kind" AS ENUM('class', 'makeup');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('scheduled', 'held', 'cancelled');--> statement-breakpoint
CREATE TABLE "attendance" (
	"session_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" "attendance_status" NOT NULL,
	CONSTRAINT "attendance_session_id_student_id_pk" PRIMARY KEY("session_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "class_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	CONSTRAINT "class_slots_weekday_check" CHECK ("class_slots"."weekday" between 0 and 6)
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"name" text NOT NULL,
	"level" "cefr_level" NOT NULL,
	"type" "class_type" NOT NULL,
	"capacity" smallint NOT NULL,
	"session_count" smallint NOT NULL,
	"session_minutes" smallint NOT NULL,
	"starts_on" date NOT NULL,
	"price_toman" bigint NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classes_capacity_check" CHECK (("classes"."type" = 'private' and "classes"."capacity" = 1) or ("classes"."type" = 'group' and "classes"."capacity" between 2 and 4)),
	CONSTRAINT "classes_session_count_check" CHECK ("classes"."session_count" between 1 and 60),
	CONSTRAINT "classes_session_minutes_check" CHECK ("classes"."session_minutes" between 15 and 240),
	CONSTRAINT "classes_price_check" CHECK ("classes"."price_toman" > 0),
	CONSTRAINT "classes_public_check" CHECK (not ("classes"."is_public" and "classes"."type" = 'private'))
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "session_participants" (
	"session_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	CONSTRAINT "session_participants_session_id_student_id_pk" PRIMARY KEY("session_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"kind" "session_kind" DEFAULT 'class' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "session_status" DEFAULT 'scheduled' NOT NULL,
	"cancel_reason" text,
	"replaces_session_id" uuid,
	"held_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_time_check" CHECK ("sessions"."ends_at" > "sessions"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_slots" ADD CONSTRAINT "class_slots_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_replaces_session_id_sessions_id_fk" FOREIGN KEY ("replaces_session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "class_slots_class_id_weekday_index" ON "class_slots" USING btree ("class_id","weekday");--> statement-breakpoint
CREATE INDEX "classes_archived_at_index" ON "classes" USING btree ("archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_one_active_index" ON "enrollments" USING btree ("class_id","student_id") WHERE "enrollments"."status" = 'active';--> statement-breakpoint
CREATE INDEX "enrollments_student_id_index" ON "enrollments" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "sessions_class_id_starts_at_index" ON "sessions" USING btree ("class_id","starts_at");--> statement-breakpoint
CREATE INDEX "sessions_starts_at_index" ON "sessions" USING btree ("starts_at");