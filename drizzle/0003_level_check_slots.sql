CREATE TABLE "level_check_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"lead_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "level_check_slots_startsAt_unique" UNIQUE("starts_at"),
	CONSTRAINT "level_check_slots_leadId_unique" UNIQUE("lead_id")
);
--> statement-breakpoint
ALTER TABLE "level_check_slots" ADD CONSTRAINT "level_check_slots_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "preferred_times";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "message";