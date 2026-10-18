CREATE TABLE "gym_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" date NOT NULL,
	"notes" text,
	"photo_b64" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "logs" ADD COLUMN "post_id" integer;--> statement-breakpoint
ALTER TABLE "gym_posts" ADD CONSTRAINT "gym_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gym_posts_created_idx" ON "gym_posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "gym_posts_user_idx" ON "gym_posts" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_post_id_gym_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."gym_posts"("id") ON DELETE cascade ON UPDATE no action;