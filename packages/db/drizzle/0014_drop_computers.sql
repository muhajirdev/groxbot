ALTER TABLE "bots" DROP CONSTRAINT "bots_computer_id_computers_id_fk";--> statement-breakpoint
ALTER TABLE "bots" DROP COLUMN "computer_id";--> statement-breakpoint
DROP TABLE "computers";
