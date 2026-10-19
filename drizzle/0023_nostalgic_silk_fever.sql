CREATE TABLE "log_backgrounds" (
	"log_id" integer PRIMARY KEY NOT NULL,
	"data_b64" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "log_backgrounds" ADD CONSTRAINT "log_backgrounds_log_id_logs_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."logs"("id") ON DELETE cascade ON UPDATE no action;