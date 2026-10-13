CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'scheduled', 'converted', 'lost');--> statement-breakpoint
CREATE TYPE "public"."level_guess" AS ENUM('unsure', 'beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"preferred_times" text,
	"level_guess" "level_guess" DEFAULT 'unsure' NOT NULL,
	"message" text,
	"locale" "locale" NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"locale" "locale" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_emails_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "leads_status_created_at_index" ON "leads" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "leads_phone_index" ON "leads" USING btree ("phone");