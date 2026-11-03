CREATE TYPE "public"."submission_status" AS ENUM('submitted', 'needs_revision', 'reviewed');--> statement-breakpoint
CREATE TABLE "assignment_files" (
	"assignment_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	CONSTRAINT "assignment_files_assignment_id_file_id_pk" PRIMARY KEY("assignment_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "assignment_recipients" (
	"assignment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	CONSTRAINT "assignment_recipients_assignment_id_student_id_pk" PRIMARY KEY("assignment_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"original_name" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_files" (
	"submission_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	CONSTRAINT "submission_files_submission_id_file_id_pk" PRIMARY KEY("submission_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"body" text,
	"status" "submission_status" DEFAULT 'submitted' NOT NULL,
	"feedback" text,
	"revision" smallint DEFAULT 1 NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "assignment_files" ADD CONSTRAINT "assignment_files_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_files" ADD CONSTRAINT "assignment_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_recipients" ADD CONSTRAINT "assignment_recipients_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_recipients" ADD CONSTRAINT "assignment_recipients_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignment_recipients_student_id_index" ON "assignment_recipients" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "assignments_teacher_id_created_at_index" ON "assignments" USING btree ("teacher_id","created_at");--> statement-breakpoint
CREATE INDEX "assignments_session_id_index" ON "assignments" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_assignment_id_student_id_index" ON "submissions" USING btree ("assignment_id","student_id");--> statement-breakpoint
CREATE INDEX "submissions_status_index" ON "submissions" USING btree ("status");