ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint
UPDATE "account" SET "issuer" = CASE
	WHEN "provider_id" = 'credential' THEN 'local:credential'
	ELSE 'local:oauth:' || replace("provider_id", '/', '%2F')
END
WHERE "issuer" IS NULL;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_account_id" ON "account" USING btree ("issuer","account_id");