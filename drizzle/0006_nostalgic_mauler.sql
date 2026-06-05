CREATE TABLE "domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"status" "agent_status" DEFAULT 'unverified' NOT NULL,
	"verified_at" timestamp with time zone,
	"evidence" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_domain_owner" UNIQUE("owner_id","domain")
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "public_id" text;--> statement-breakpoint
UPDATE "agents" SET "public_id" = 'agt_' || substr(md5(random()::text || "id"::text), 1, 12) WHERE "public_id" IS NULL;--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "public_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "domain_id" uuid;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_public_id_unique" UNIQUE("public_id");