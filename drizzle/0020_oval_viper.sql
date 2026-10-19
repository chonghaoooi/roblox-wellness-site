CREATE TABLE "meal_photos" (
	"meal_id" integer NOT NULL,
	"position" integer NOT NULL,
	"data_b64" text NOT NULL,
	CONSTRAINT "meal_photos_meal_id_position_pk" PRIMARY KEY("meal_id","position"),
	CONSTRAINT "meal_photos_position_check" CHECK ("meal_photos"."position" in (1, 2))
);
--> statement-breakpoint
ALTER TABLE "meal_photos" ADD CONSTRAINT "meal_photos_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE cascade ON UPDATE no action;