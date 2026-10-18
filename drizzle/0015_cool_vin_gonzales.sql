CREATE TABLE "avatars" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"data_b64" text,
	"override_b64" text,
	"override_by" integer,
	"override_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"item" text NOT NULL,
	"price_cents" integer NOT NULL,
	"note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"kind" text NOT NULL,
	"item" text,
	"ref" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_ledger_ref_unique" UNIQUE("ref")
);
--> statement-breakpoint
ALTER TABLE "meals" ADD COLUMN "original_b64" text;--> statement-breakpoint
ALTER TABLE "meals" ADD COLUMN "edited_by" integer;--> statement-breakpoint
ALTER TABLE "meals" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "balance_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pay_code" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "prank_protected" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "avatars" ADD CONSTRAINT "avatars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatars" ADD CONSTRAINT "avatars_override_by_users_id_fk" FOREIGN KEY ("override_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wallet_ledger_user_idx" ON "wallet_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_pay_code_unique" UNIQUE("pay_code");