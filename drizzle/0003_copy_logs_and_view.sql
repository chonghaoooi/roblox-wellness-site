INSERT INTO "logs" ("user_id", "date", "kind", "weight_kg", "height_cm", "source", "note")
SELECT "user_id", "date", 'weight', "weight_kg", "height_cm", 'manual', "notes" FROM "entries";--> statement-breakpoint
INSERT INTO "logs" ("user_id", "date", "kind", "steps", "source")
SELECT "user_id", "date", 'steps', "steps", 'manual' FROM "entries";--> statement-breakpoint
INSERT INTO "logs" ("user_id", "date", "kind", "calories", "source")
SELECT "user_id", "date", 'meal', "calories_in", 'manual' FROM "entries";--> statement-breakpoint
CREATE VIEW "daily_stats" AS
WITH d AS (
  SELECT user_id, date,
    (array_agg(weight_kg ORDER BY created_at DESC, id DESC) FILTER (WHERE weight_kg IS NOT NULL))[1] AS weight_kg,
    (array_agg(height_cm ORDER BY created_at DESC, id DESC) FILTER (WHERE height_cm IS NOT NULL))[1] AS day_height,
    sum(calories)::int AS calories_in,
    max(steps)::int AS steps
  FROM logs GROUP BY user_id, date
)
SELECT d.user_id, d.date, d.weight_kg,
  coalesce(d.day_height, (
    SELECT l.height_cm FROM logs l
    WHERE l.user_id = d.user_id AND l.height_cm IS NOT NULL AND l.date <= d.date
    ORDER BY l.date DESC, l.id DESC LIMIT 1
  )) AS height_cm,
  d.calories_in, d.steps
FROM d;
