-- Hard guarantee against double-booking: a teacher's sessions that aren't cancelled can't overlap.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_no_overlap" EXCLUDE USING gist (
  "teacher_id" WITH =,
  tstzrange("starts_at", "ends_at") WITH &&
) WHERE ("status" <> 'cancelled');
