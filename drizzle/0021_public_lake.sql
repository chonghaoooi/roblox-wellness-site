CREATE TABLE "gym_post_photos" (
	"post_id" integer NOT NULL,
	"position" integer NOT NULL,
	"data_b64" text NOT NULL,
	CONSTRAINT "gym_post_photos_post_id_position_pk" PRIMARY KEY("post_id","position"),
	CONSTRAINT "gym_post_photos_position_check" CHECK ("gym_post_photos"."position" in (1, 2))
);
--> statement-breakpoint
ALTER TABLE "gym_posts" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gym_post_photos" ADD CONSTRAINT "gym_post_photos_post_id_gym_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."gym_posts"("id") ON DELETE cascade ON UPDATE no action;