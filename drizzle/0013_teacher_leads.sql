CREATE TABLE "teacher_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"learners" smallint NOT NULL,
	"locale" "locale" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
