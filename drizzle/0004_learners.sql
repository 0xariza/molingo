-- Learners (M4): Persian + English full names, one learner per mobile number, link to the
-- free-session booking they came from. The account language lives on users.locale only.
ALTER TABLE "students" RENAME COLUMN "full_name" TO "full_name_fa";--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "full_name_en" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "lead_id" uuid;--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "preferred_locale";--> statement-breakpoint
DROP INDEX "students_phone_index";--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_phone_unique" UNIQUE("phone");--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_leadId_unique" UNIQUE("lead_id");--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "students_started_at_index" ON "students" USING btree ("started_at");
