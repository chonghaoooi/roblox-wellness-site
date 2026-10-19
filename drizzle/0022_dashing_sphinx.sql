CREATE TABLE "log_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"log_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "log_votes" (
	"log_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "log_votes_log_id_user_id_pk" PRIMARY KEY("log_id","user_id"),
	CONSTRAINT "log_votes_value_check" CHECK ("log_votes"."value" in (-1, 1))
);
--> statement-breakpoint
ALTER TABLE "log_comments" ADD CONSTRAINT "log_comments_log_id_logs_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_comments" ADD CONSTRAINT "log_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_votes" ADD CONSTRAINT "log_votes_log_id_logs_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_votes" ADD CONSTRAINT "log_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "log_comments_log_idx" ON "log_comments" USING btree ("log_id","id");--> statement-breakpoint
CREATE INDEX "log_comments_user_idx" ON "log_comments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "log_votes_user_idx" ON "log_votes" USING btree ("user_id");