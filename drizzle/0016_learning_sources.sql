CREATE TABLE "learning_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"title" text NOT NULL,
	"level" "cefr_level" NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"source_unit" text DEFAULT '' NOT NULL,
	"planned_sessions" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stations_planned_sessions_check" CHECK ("stations"."planned_sessions" between 1 and 4)
);
--> statement-breakpoint
ALTER TABLE "learning_sources" ADD CONSTRAINT "learning_sources_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_skills" ADD CONSTRAINT "station_skills_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_source_id_learning_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."learning_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "learning_sources_teacher_id_level_index" ON "learning_sources" USING btree ("teacher_id","level");--> statement-breakpoint
CREATE INDEX "station_skills_station_id_position_index" ON "station_skills" USING btree ("station_id","position");--> statement-breakpoint
CREATE INDEX "stations_source_id_position_index" ON "stations" USING btree ("source_id","position");