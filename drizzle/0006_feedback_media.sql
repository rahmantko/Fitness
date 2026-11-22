CREATE TABLE "checkin_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checkin_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checkins" ADD COLUMN "feedback_audio_key" text;--> statement-breakpoint
ALTER TABLE "checkins" ADD COLUMN "feedback_video_url" text;--> statement-breakpoint
ALTER TABLE "checkins" ADD COLUMN "feedback_at" timestamp;--> statement-breakpoint
ALTER TABLE "checkin_comments" ADD CONSTRAINT "checkin_comments_checkin_id_checkins_id_fk" FOREIGN KEY ("checkin_id") REFERENCES "public"."checkins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_comments" ADD CONSTRAINT "checkin_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkin_comments_checkin" ON "checkin_comments" USING btree ("checkin_id");