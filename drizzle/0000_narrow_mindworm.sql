CREATE TYPE "public"."pose" AS ENUM('front', 'side', 'back');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('coach', 'client');--> statement-breakpoint
CREATE TABLE "blood_markers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" uuid NOT NULL,
	"name" text NOT NULL,
	"value" real NOT NULL,
	"unit" text,
	"ref_low" real,
	"ref_high" real
);
--> statement-breakpoint
CREATE TABLE "blood_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"date" date NOT NULL,
	"lab" text,
	"file_key" text,
	"file_name" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"date" date NOT NULL,
	"weight_kg" real,
	"body_fat_pct" real,
	"waist_cm" real,
	"chest_cm" real,
	"hips_cm" real,
	"arm_cm" real,
	"thigh_cm" real,
	"energy" integer,
	"sleep" integer,
	"adherence" integer,
	"notes" text,
	"coach_feedback" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"date" date NOT NULL,
	"weight_kg" real,
	"steps" integer,
	"calories" integer,
	"protein" integer,
	"carbs" integer,
	"fat" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checkin_id" uuid NOT NULL,
	"pose" "pose" NOT NULL,
	"file_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "targets" (
	"client_id" uuid PRIMARY KEY NOT NULL,
	"calories" integer,
	"protein" integer,
	"carbs" integer,
	"fat" integer,
	"steps" integer,
	"goal_weight_kg" real,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"coach_id" uuid,
	"invite_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workout_id" uuid NOT NULL,
	"exercise" text NOT NULL,
	"set_number" integer NOT NULL,
	"reps" integer,
	"weight_kg" real,
	"rpe" real
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "blood_markers" ADD CONSTRAINT "blood_markers_test_id_blood_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."blood_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blood_tests" ADD CONSTRAINT "blood_tests_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_checkin_id_checkins_id_fk" FOREIGN KEY ("checkin_id") REFERENCES "public"."checkins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkins_client_date" ON "checkins" USING btree ("client_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_logs_client_date" ON "daily_logs" USING btree ("client_id","date");--> statement-breakpoint
CREATE INDEX "workouts_client_date" ON "workouts" USING btree ("client_id","date");