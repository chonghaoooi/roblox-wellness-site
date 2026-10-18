CREATE TABLE "meal_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"meal_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meal_comments" ADD CONSTRAINT "meal_comments_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_comments" ADD CONSTRAINT "meal_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meal_comments_meal_idx" ON "meal_comments" USING btree ("meal_id","id");--> statement-breakpoint
CREATE INDEX "meal_comments_user_idx" ON "meal_comments" USING btree ("user_id","created_at");