CREATE TYPE "public"."skill_result" AS ENUM('ready', 'again');--> statement-breakpoint
CREATE TABLE "student_skills" (
	"student_id" uuid NOT NULL,
	"station_skill_id" uuid NOT NULL,
	"result" "skill_result" NOT NULL,
	"session_id" uuid,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_skills_student_id_station_skill_id_pk" PRIMARY KEY("student_id","station_skill_id")
);
--> statement-breakpoint
ALTER TABLE "class_path_stations" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "student_skills" ADD CONSTRAINT "student_skills_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_skills" ADD CONSTRAINT "student_skills_station_skill_id_station_skills_id_fk" FOREIGN KEY ("station_skill_id") REFERENCES "public"."station_skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_skills" ADD CONSTRAINT "student_skills_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;