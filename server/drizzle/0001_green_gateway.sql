ALTER TABLE "users" ADD COLUMN "recovery_vault" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "recovery_hash" text NOT NULL;