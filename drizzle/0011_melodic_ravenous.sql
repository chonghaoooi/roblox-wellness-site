CREATE TABLE "meal_votes" (
	"meal_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "meal_votes_meal_id_user_id_pk" PRIMARY KEY("meal_id","user_id"),
	CONSTRAINT "meal_votes_value_check" CHECK ("meal_votes"."value" in (-1, 1))
);
--> statement-breakpoint
ALTER TABLE "meal_votes" ADD CONSTRAINT "meal_votes_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_votes" ADD CONSTRAINT "meal_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meal_votes_user_idx" ON "meal_votes" USING btree ("user_id");