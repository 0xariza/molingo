ALTER TABLE "class_path_stations" DROP CONSTRAINT "class_path_stations_planned_check";--> statement-breakpoint
ALTER TABLE "stations" DROP CONSTRAINT "stations_planned_sessions_check";--> statement-breakpoint
ALTER TABLE "class_path_stations" ADD CONSTRAINT "class_path_stations_planned_check" CHECK ("class_path_stations"."planned_sessions" >= 1);--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_planned_sessions_check" CHECK ("stations"."planned_sessions" >= 1);