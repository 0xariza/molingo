CREATE TYPE "public"."recording_kind" AS ENUM('before', 'after');--> statement-breakpoint
CREATE TABLE "voice_recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"kind" "recording_kind" NOT NULL,
	"file_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "voice_recordings" ADD CONSTRAINT "voice_recordings_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_recordings" ADD CONSTRAINT "voice_recordings_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "voice_recordings_student_id_created_at_index" ON "voice_recordings" USING btree ("student_id","created_at");