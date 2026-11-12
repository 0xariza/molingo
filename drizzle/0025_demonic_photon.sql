CREATE TYPE "public"."credit_reason" AS ENUM('move', 'overpayment', 'applied', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."invoice_kind" AS ENUM('monthly', 'course');--> statement-breakpoint
CREATE TYPE "public"."invoice_line_kind" AS ENUM('session', 'course_fee', 'adjustment', 'credit');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'void');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('card', 'cash', 'bank', 'other');--> statement-breakpoint
CREATE TYPE "public"."receipt_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."sms_status" AS ENUM('logged', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "billed_sessions" (
	"session_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	CONSTRAINT "billed_sessions_session_id_student_id_pk" PRIMARY KEY("session_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "billing_exemptions" (
	"session_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	CONSTRAINT "billing_exemptions_session_id_student_id_pk" PRIMARY KEY("session_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "class_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"price_toman" bigint NOT NULL,
	"effective_from" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_prices_price_check" CHECK ("class_prices"."price_toman" > 0)
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"kind" "invoice_line_kind" NOT NULL,
	"description" text NOT NULL,
	"session_id" uuid,
	"amount_toman" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"kind" "invoice_kind" NOT NULL,
	"period" text,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"number" integer GENERATED ALWAYS AS IDENTITY (sequence name "invoices_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"short_code" text NOT NULL,
	"issued_at" timestamp with time zone,
	"due_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_shortCode_unique" UNIQUE("short_code"),
	CONSTRAINT "invoices_period_check" CHECK (("invoices"."kind" = 'monthly') = ("invoices"."period" is not null))
);
--> statement-breakpoint
CREATE TABLE "payment_settings" (
	"teacher_id" uuid PRIMARY KEY NOT NULL,
	"card_number" text,
	"card_holder" text,
	"sheba" text,
	"due_days" smallint DEFAULT 7 NOT NULL,
	"grace_days" smallint DEFAULT 3 NOT NULL,
	"round_to" integer DEFAULT 1000 NOT NULL,
	"auto_issue" boolean DEFAULT false NOT NULL,
	"sms_before" boolean DEFAULT true NOT NULL,
	"sms_overdue" boolean DEFAULT true NOT NULL,
	"sms_approved" boolean DEFAULT true NOT NULL,
	"sms_rejected" boolean DEFAULT true NOT NULL,
	"sms_manual" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_settings_due_check" CHECK ("payment_settings"."due_days" between 1 and 60),
	CONSTRAINT "payment_settings_grace_check" CHECK ("payment_settings"."grace_days" between 0 and 30),
	CONSTRAINT "payment_settings_round_check" CHECK ("payment_settings"."round_to" in (1000, 10000))
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"invoice_id" uuid,
	"amount_toman" bigint NOT NULL,
	"paid_on" date NOT NULL,
	"method" "payment_method" NOT NULL,
	"reference" text,
	"note" text,
	"receipt_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_receiptId_unique" UNIQUE("receipt_id"),
	CONSTRAINT "payments_amount_check" CHECK ("payments"."amount_toman" > 0)
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"amount_toman" bigint NOT NULL,
	"card_last4" text,
	"status" "receipt_status" DEFAULT 'pending' NOT NULL,
	"reject_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sms_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"student_id" uuid,
	"phone" text NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"status" "sms_status" NOT NULL,
	"error" text,
	"dedupe_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sms_messages_dedupeKey_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "student_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"amount_toman" bigint NOT NULL,
	"reason" "credit_reason" NOT NULL,
	"note" text,
	"invoice_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billed_sessions" ADD CONSTRAINT "billed_sessions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billed_sessions" ADD CONSTRAINT "billed_sessions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billed_sessions" ADD CONSTRAINT "billed_sessions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_exemptions" ADD CONSTRAINT "billing_exemptions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_exemptions" ADD CONSTRAINT "billing_exemptions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_prices" ADD CONSTRAINT "class_prices_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_settings" ADD CONSTRAINT "payment_settings_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_credits" ADD CONSTRAINT "student_credits_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_credits" ADD CONSTRAINT "student_credits_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_credits" ADD CONSTRAINT "student_credits_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "class_prices_class_id_effective_from_index" ON "class_prices" USING btree ("class_id","effective_from");--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_id_index" ON "invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_one_month_index" ON "invoices" USING btree ("student_id","class_id","period") WHERE "invoices"."kind" = 'monthly' and "invoices"."status" <> 'void';--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_one_course_index" ON "invoices" USING btree ("student_id","class_id") WHERE "invoices"."kind" = 'course' and "invoices"."status" <> 'void';--> statement-breakpoint
CREATE INDEX "invoices_teacher_id_status_index" ON "invoices" USING btree ("teacher_id","status");--> statement-breakpoint
CREATE INDEX "invoices_student_id_index" ON "invoices" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "payments_invoice_id_index" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payments_teacher_id_paid_on_index" ON "payments" USING btree ("teacher_id","paid_on");--> statement-breakpoint
CREATE INDEX "receipts_teacher_id_status_index" ON "receipts" USING btree ("teacher_id","status");--> statement-breakpoint
CREATE INDEX "receipts_invoice_id_index" ON "receipts" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "sms_messages_teacher_id_created_at_index" ON "sms_messages" USING btree ("teacher_id","created_at");--> statement-breakpoint
CREATE INDEX "student_credits_student_id_index" ON "student_credits" USING btree ("student_id");