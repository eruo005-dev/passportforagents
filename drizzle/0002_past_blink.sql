ALTER TABLE "api_keys" ADD COLUMN "key_prefix" text NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "revoked_at" timestamp with time zone;