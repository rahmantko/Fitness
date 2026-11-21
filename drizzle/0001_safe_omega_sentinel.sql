CREATE TYPE "public"."day_type" AS ENUM('training', 'rest');--> statement-breakpoint
CREATE TABLE "cardio_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"date" date NOT NULL,
	"activity" text NOT NULL,
	"duration_min" integer,
	"distance_km" real,
	"avg_hr" integer,
	"kcal" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cardio_plan" (
	"client_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"task" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"plan_meal_id" uuid,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"base_qty" real NOT NULL,
	"unit" text NOT NULL,
	"kcal" real NOT NULL,
	"protein" real NOT NULL,
	"carbs" real NOT NULL,
	"fat" real NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day_meal_id" uuid NOT NULL,
	"food_id" uuid,
	"name" text NOT NULL,
	"qty" real NOT NULL,
	"unit" text NOT NULL,
	"kcal" real NOT NULL,
	"protein" real NOT NULL,
	"carbs" real NOT NULL,
	"fat" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutrition_days" (
	"client_id" uuid NOT NULL,
	"date" date NOT NULL,
	"day_type" "day_type" NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_meal_id" uuid NOT NULL,
	"food_id" uuid NOT NULL,
	"qty" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"day_type" "day_type" NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "cardio_logs" ADD CONSTRAINT "cardio_logs_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardio_plan" ADD CONSTRAINT "cardio_plan_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_meals" ADD CONSTRAINT "day_meals_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_meals" ADD CONSTRAINT "day_meals_plan_meal_id_plan_meals_id_fk" FOREIGN KEY ("plan_meal_id") REFERENCES "public"."plan_meals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_day_meal_id_day_meals_id_fk" FOREIGN KEY ("day_meal_id") REFERENCES "public"."day_meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_days" ADD CONSTRAINT "nutrition_days_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_plan_meal_id_plan_meals_id_fk" FOREIGN KEY ("plan_meal_id") REFERENCES "public"."plan_meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_meals" ADD CONSTRAINT "plan_meals_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cardio_logs_client_date" ON "cardio_logs" USING btree ("client_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "cardio_plan_client_weekday" ON "cardio_plan" USING btree ("client_id","weekday");--> statement-breakpoint
CREATE INDEX "day_meals_client_date" ON "day_meals" USING btree ("client_id","date");--> statement-breakpoint
CREATE INDEX "foods_name" ON "foods" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "nutrition_days_client_date" ON "nutrition_days" USING btree ("client_id","date");--> statement-breakpoint
CREATE INDEX "plan_meals_client" ON "plan_meals" USING btree ("client_id","day_type");