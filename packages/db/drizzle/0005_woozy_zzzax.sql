ALTER TABLE "bots" ADD COLUMN "home_room_id" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "kind" text DEFAULT 'board' NOT NULL;--> statement-breakpoint
ALTER TABLE "bots" ADD CONSTRAINT "bots_home_room_id_rooms_id_fk" FOREIGN KEY ("home_room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bots_home_room_id_unique" ON "bots" USING btree ("home_room_id");