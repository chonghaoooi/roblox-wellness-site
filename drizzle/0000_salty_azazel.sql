CREATE TABLE "entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" date NOT NULL,
	"weight_kg" real NOT NULL,
	"height_cm" real NOT NULL,
	"calories_in" integer NOT NULL,
	"steps" integer NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"weight_unit" text DEFAULT 'kg' NOT NULL,
	"distance_unit" text DEFAULT 'km' NOT NULL,
	"calorie_goal" integer DEFAULT 2000 NOT NULL,
	"step_goal" integer DEFAULT 10000 NOT NULL,
	"calories_per_step" real DEFAULT 0.04 NOT NULL,
	"stride_length_m" real DEFAULT 0.762 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entries_user_date_uq" ON "entries" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "entries_date_idx" ON "entries" USING btree ("date");--> statement-breakpoint
CREATE INDEX "entries_user_idx" ON "entries" USING btree ("user_id");