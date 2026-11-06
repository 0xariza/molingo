CREATE TABLE "class_path_stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"included" boolean DEFAULT true NOT NULL,
	"planned_sessions" smallint NOT NULL,
	CONSTRAINT "class_path_stations_planned_check" CHECK ("class_path_stations"."planned_sessions" between 1 and 4)
);
--> statement-breakpoint
CREATE TABLE "class_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_paths_classId_unique" UNIQUE("class_id")
);
--> statement-breakpoint
ALTER TABLE "stations" ALTER COLUMN "source_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "path_station_id" uuid;--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "class_id" uuid;--> statement-breakpoint
ALTER TABLE "class_path_stations" ADD CONSTRAINT "class_path_stations_path_id_class_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."class_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_path_stations" ADD CONSTRAINT "class_path_stations_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_paths" ADD CONSTRAINT "class_paths_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_paths" ADD CONSTRAINT "class_paths_source_id_learning_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."learning_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "class_path_stations_path_id_station_id_index" ON "class_path_stations" USING btree ("path_id","station_id");--> statement-breakpoint
CREATE INDEX "class_path_stations_path_id_position_index" ON "class_path_stations" USING btree ("path_id","position");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_path_station_id_class_path_stations_id_fk" FOREIGN KEY ("path_station_id") REFERENCES "public"."class_path_stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_owner_check" CHECK (("stations"."source_id" is null) <> ("stations"."class_id" is null));