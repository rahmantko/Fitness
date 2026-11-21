ALTER TABLE "foods" ADD COLUMN "serving_qty" real;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "barcode" text;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "source" text DEFAULT 'custom' NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_barcode_unique" UNIQUE("barcode");--> statement-breakpoint
UPDATE "foods" SET "source" = 'library' WHERE "created_by" IS NULL;