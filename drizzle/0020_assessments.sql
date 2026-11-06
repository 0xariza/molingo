CREATE TYPE "public"."assessment_kind" AS ENUM('stage', 'final');--> statement-breakpoint
CREATE TYPE "public"."assessment_section" AS ENUM('reading', 'grammar', 'writing');--> statement-breakpoint
CREATE TYPE "public"."question_kind" AS ENUM('mc', 'short', 'essay');--> statement-breakpoint
CREATE TABLE "assessment_answers" (
	"question_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"choice" smallint,
	"text" text,
	"score" smallint,
	CONSTRAINT "assessment_answers_question_id_student_id_pk" PRIMARY KEY("question_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "assessment_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"section" "assessment_section" NOT NULL,
	"kind" "question_kind" NOT NULL,
	"prompt" text NOT NULL,
	"options" text[],
	"correct_index" smallint,
	"accepted_answers" text[],
	"points" smallint NOT NULL,
	CONSTRAINT "assessment_questions_points_check" CHECK ("assessment_questions"."points" between 1 and 20)
);
--> statement-breakpoint
CREATE TABLE "assessment_results" (
	"assessment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"feedback" text,
	"published_at" timestamp with time zone,
	CONSTRAINT "assessment_results_assessment_id_student_id_pk" PRIMARY KEY("assessment_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"kind" "assessment_kind" NOT NULL,
	"minutes" smallint NOT NULL,
	"opened_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessments_minutes_check" CHECK ("assessments"."minutes" between 5 and 180)
);
--> statement-breakpoint
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_question_id_assessment_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."assessment_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assessment_questions_assessment_id_position_index" ON "assessment_questions" USING btree ("assessment_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "assessments_session_id_index" ON "assessments" USING btree ("session_id");