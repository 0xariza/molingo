CREATE TYPE "public"."homework_type" AS ENUM('listening', 'writing', 'speaking', 'reading');--> statement-breakpoint
CREATE TABLE "session_skills" (
	"session_id" uuid NOT NULL,
	"station_skill_id" uuid NOT NULL,
	CONSTRAINT "session_skills_session_id_station_skill_id_pk" PRIMARY KEY("session_id","station_skill_id")
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "type" "homework_type" DEFAULT 'writing' NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "station_skill_id" uuid;--> statement-breakpoint
ALTER TABLE "session_skills" ADD CONSTRAINT "session_skills_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_skills" ADD CONSTRAINT "session_skills_station_skill_id_station_skills_id_fk" FOREIGN KEY ("station_skill_id") REFERENCES "public"."station_skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_station_skill_id_station_skills_id_fk" FOREIGN KEY ("station_skill_id") REFERENCES "public"."station_skills"("id") ON DELETE set null ON UPDATE no action;