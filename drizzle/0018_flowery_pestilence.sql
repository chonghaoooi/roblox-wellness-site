CREATE TABLE "gym_post_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gym_post_votes" (
	"post_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "gym_post_votes_post_id_user_id_pk" PRIMARY KEY("post_id","user_id"),
	CONSTRAINT "gym_post_votes_value_check" CHECK ("gym_post_votes"."value" in (-1, 1))
);
--> statement-breakpoint
ALTER TABLE "gym_post_comments" ADD CONSTRAINT "gym_post_comments_post_id_gym_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."gym_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_post_comments" ADD CONSTRAINT "gym_post_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_post_votes" ADD CONSTRAINT "gym_post_votes_post_id_gym_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."gym_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_post_votes" ADD CONSTRAINT "gym_post_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gym_post_comments_post_idx" ON "gym_post_comments" USING btree ("post_id","id");--> statement-breakpoint
CREATE INDEX "gym_post_comments_user_idx" ON "gym_post_comments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "gym_post_votes_user_idx" ON "gym_post_votes" USING btree ("user_id");