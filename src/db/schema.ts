import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** Prepaid shop credit in Singapore cents (S$0.01). Spent atomically with a conditional UPDATE, so it can never go negative. */
  balanceCents: integer("balance_cents").notNull().default(0),
  /** Short code a buyer puts in the Ko-fi message so a payment can be matched to their account. */
  payCode: text("pay_code").unique(),
  /** Legacy column retained for deployment compatibility; no longer read or used to block swaps. */
  prankProtected: boolean("prank_protected").notNull().default(false),
});

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  sessionVersion: integer("session_version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const siteConfig = pgTable("site_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const adminLoginLimits = pgTable("admin_login_limits", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});

export const adminAudit = pgTable("admin_audit", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull().references(() => admins.id),
  action: text("action").notNull(),
  target: text("target").notNull(),
  details: text("details").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  weightUnit: text("weight_unit").notNull().default("kg"),
  distanceUnit: text("distance_unit").notNull().default("km"),
  calorieGoal: integer("calorie_goal").notNull().default(2000),
  stepGoal: integer("step_goal").notNull().default(10000),
  caloriesPerStep: real("calories_per_step").notNull().default(0.04),
  strideLengthM: real("stride_length_m").notNull().default(0.762),
});

export type User = typeof users.$inferSelect;
export type Log = typeof logs.$inferSelect;
export type Settings = typeof settings.$inferSelect;

/** A gym blog post: notes, an optional photo, and the lifts logged with it (logs.post_id). */
export const gymPosts = pgTable(
  "gym_posts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    notes: text("notes"),
    photoB64: text("photo_b64"), // resized JPEG; retained until manually removed
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("gym_posts_created_idx").on(t.createdAt), index("gym_posts_user_idx").on(t.userId)],
);

/** One row per thing a user logged. Daily totals come from the `daily_stats` view (see migrations). */
export const logs = pgTable(
  "logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    kind: text("kind").notNull(), // 'meal' | 'steps' | 'weight' | 'gym' | 'lift'
    exercise: text("exercise"), // lifts only: 'bench' | 'squat' | 'deadlift'
    liftKg: real("lift_kg"),
    reps: integer("reps"),
    postId: integer("post_id").references((): AnyPgColumn => gymPosts.id, { onDelete: "cascade" }),
    calories: integer("calories"),
    steps: integer("steps"),
    weightKg: real("weight_kg"),
    heightCm: real("height_cm"),
    source: text("source").notNull().default("manual"), // 'ai' | 'manual'
    trackerSyncedAt: timestamp("tracker_synced_at", { withTimezone: true }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("logs_user_date_idx").on(t.userId, t.date), index("logs_date_idx").on(t.date),
    uniqueIndex("logs_tracker_daily_idx").on(t.userId, t.date, t.source).where(sql`${t.kind} = 'steps' and ${t.source} in ('apple_health', 'health_connect')`),
  ],
);

export const aiCalls = pgTable(
  "ai_calls",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_calls_user_idx").on(t.userId, t.createdAt)],
);

export const meals = pgTable(
  "meals",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    logId: integer("log_id").references(() => logs.id, { onDelete: "cascade" }),
    caption: text("caption"),
    // Resized JPEG, base64. Kept in Postgres so no separate blob store is needed.
    dataB64: text("data_b64").notNull(),
    /** Set when someone bought a photo swap: the uploader's own photo, so it can be restored. */
    originalB64: text("original_b64"),
    editedBy: integer("edited_by").references(() => users.id, { onDelete: "set null" }),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("meals_created_idx").on(t.createdAt), index("meals_user_idx").on(t.userId)],
);

export const mealVotes = pgTable(
  "meal_votes",
  {
    mealId: integer("meal_id").notNull().references(() => meals.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    value: integer("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.mealId, t.userId] }), index("meal_votes_user_idx").on(t.userId), check("meal_votes_value_check", sql`${t.value} in (-1, 1)`) ],
);

export const mealComments = pgTable("meal_comments", {
  id: serial("id").primaryKey(),
  mealId: integer("meal_id").notNull().references(() => meals.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("meal_comments_meal_idx").on(t.mealId, t.id), index("meal_comments_user_idx").on(t.userId, t.createdAt)]);

export const coachMessages = pgTable(
  "coach_messages",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'user' | 'assistant'
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("coach_messages_user_idx").on(t.userId, t.createdAt)],
);

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  publicKey: text("public_key").notNull(),
  meals: boolean("meals").notNull().default(true),
  gym: boolean("gym").notNull().default(true),
  steps: boolean("steps").notNull().default(true),
  weight: boolean("weight").notNull().default(true),
  reminders: boolean("reminders").notNull().default(true),
  updates: boolean("updates").notNull().default(true),
  lastTestAt: timestamp("last_test_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("push_subscriptions_user_idx").on(t.userId)]);

/** One row per reminder actually sent, so a retry or a second cron run never sends the same reminder twice in a day. */
export const reminderLog = pgTable("reminder_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  localDate: date("local_date", { mode: "string" }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("reminder_log_uq").on(t.userId, t.kind, t.localDate)]);

/** Tiny key/value store. Holds which deployment we last announced as "App updated!". */
export const appState = pgTable("app_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Profile pictures. `data_b64` is the person's own; `override_b64` is a purchased swap by someone else (restorable). */
export const avatars = pgTable("avatars", {
  userId: integer("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  dataB64: text("data_b64"),
  overrideB64: text("override_b64"),
  overrideBy: integer("override_by").references(() => users.id, { onDelete: "set null" }),
  overrideAt: timestamp("override_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Every credit and charge. `ref` is unique when set (e.g. a Ko-fi transaction id) so a payment can never be credited twice. */
export const walletLedger = pgTable("wallet_ledger", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(), // + credit / refund, - purchase
  kind: text("kind").notNull(), // 'credit' | 'purchase' | 'refund'
  item: text("item"),
  ref: text("ref").unique(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("wallet_ledger_user_idx").on(t.userId, t.createdAt)]);

/** Special shop items are requests the owner fulfils by hand; prices are saved when ordered. */
export const shopOrders = pgTable("shop_orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  item: text("item").notNull(),
  priceCents: integer("price_cents").notNull(),
  note: text("note"),
  status: text("status").notNull().default("pending"), // 'pending' | 'done' | 'refunded'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
