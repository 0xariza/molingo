CREATE TYPE "public"."attendance_event" AS ENUM('joined', 'left');--> statement-breakpoint
CREATE TABLE "attendance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"event" "attendance_event" NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"livekit_event_id" text NOT NULL,
	CONSTRAINT "attendance_events_livekitEventId_unique" UNIQUE("livekit_event_id")
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "topics" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "private_note" text;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_events_session_id_index" ON "attendance_events" USING btree ("session_id");