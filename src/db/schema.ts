import {
  boolean,
  pgTable,
  text,
  integer,
  real,
  timestamp,
  date,
  uuid,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["coach", "client"]);
export const poseEnum = pgEnum("pose", ["front", "side", "back"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  // Clients belong to one coach. Coaches have an invite code clients sign up with.
  coachId: uuid("coach_id"),
  inviteCode: text("invite_code").unique(),
  // Set after a coach (or the recovery command) gives out a temporary password.
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  // Logins made before this moment are signed out (set whenever the password changes).
  passwordChangedAt: timestamp("password_changed_at"),
  // Profile
  avatarKey: text("avatar_key"),
  phone: text("phone"),
  dateOfBirth: date("date_of_birth", { mode: "string" }),
  heightCm: real("height_cm"),
  bio: text("bio"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Targets a coach sets for a client. One row per client.
export const targets = pgTable("targets", {
  clientId: uuid("client_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  calories: integer("calories"),
  protein: integer("protein"),
  carbs: integer("carbs"),
  fat: integer("fat"),
  steps: integer("steps"),
  goalWeightKg: real("goal_weight_kg"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Daily log: morning weight, step count and nutrition totals. One row per client per day.
export const dailyLogs = pgTable(
  "daily_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    weightKg: real("weight_kg"),
    steps: integer("steps"),
    calories: integer("calories"),
    protein: integer("protein"),
    carbs: integer("carbs"),
    fat: integer("fat"),
    notes: text("notes"),
  },
  (t) => [uniqueIndex("daily_logs_client_date").on(t.clientId, t.date)],
);

// Weekly (or ad hoc) check-in with measurements, photos and subjective ratings.
export const checkins = pgTable(
  "checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    weightKg: real("weight_kg"),
    bodyFatPct: real("body_fat_pct"),
    waistCm: real("waist_cm"),
    chestCm: real("chest_cm"),
    hipsCm: real("hips_cm"),
    armCm: real("arm_cm"),
    thighCm: real("thigh_cm"),
    energy: integer("energy"), // 1-10
    sleep: integer("sleep"), // 1-10
    adherence: integer("adherence"), // 1-10
    notes: text("notes"),
    coachFeedback: text("coach_feedback"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("checkins_client_date").on(t.clientId, t.date)],
);

export const photos = pgTable("photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  checkinId: uuid("checkin_id")
    .notNull()
    .references(() => checkins.id, { onDelete: "cascade" }),
  pose: poseEnum("pose").notNull(),
  fileKey: text("file_key").notNull(),
});

export const workouts = pgTable(
  "workouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    name: text("name").notNull(),
    notes: text("notes"),
  },
  (t) => [index("workouts_client_date").on(t.clientId, t.date)],
);

export const workoutSets = pgTable("workout_sets", {
  id: uuid("id").primaryKey().defaultRandom(),
  workoutId: uuid("workout_id")
    .notNull()
    .references(() => workouts.id, { onDelete: "cascade" }),
  exercise: text("exercise").notNull(),
  setNumber: integer("set_number").notNull(),
  reps: integer("reps"),
  weightKg: real("weight_kg"),
  rpe: real("rpe"),
});

export const bloodTests = pgTable("blood_tests", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  lab: text("lab"),
  fileKey: text("file_key"),
  fileName: text("file_name"),
  notes: text("notes"),
});

export const bloodMarkers = pgTable("blood_markers", {
  id: uuid("id").primaryKey().defaultRandom(),
  testId: uuid("test_id")
    .notNull()
    .references(() => bloodTests.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  value: real("value").notNull(),
  unit: text("unit"),
  refLow: real("ref_low"),
  refHigh: real("ref_high"),
});

export type User = typeof users.$inferSelect;
export type Checkin = typeof checkins.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type DailyLog = typeof dailyLogs.$inferSelect;

// ---------- Nutrition: food library, meal plans, meal-by-meal log ----------

export const dayTypeEnum = pgEnum("day_type", ["training", "rest"]);

// Nutrition per `baseQty` of `unit` (e.g. per 100 g, per 1 biscuit, per 30 g scoop).
export const foods = pgTable(
  "foods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    brand: text("brand"),
    baseQty: real("base_qty").notNull(),
    unit: text("unit").notNull(),
    kcal: real("kcal").notNull(),
    protein: real("protein").notNull(),
    carbs: real("carbs").notNull(),
    fat: real("fat").notNull(),
    // Typical serving in `unit`, used as the default amount when adding the food.
    servingQty: real("serving_qty"),
    barcode: text("barcode").unique(),
    // "library" (starter list), "openfoodfacts" (imported by barcode/search) or "custom".
    source: text("source").notNull().default("custom"),
    // null = shared library food; otherwise a custom food made by this user.
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("foods_name").on(t.name)],
);

// Coach-built meal plan: named meals per day type, each with planned foods.
export const planMeals = pgTable(
  "plan_meals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dayType: dayTypeEnum("day_type").notNull(),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    notes: text("notes"),
  },
  (t) => [index("plan_meals_client").on(t.clientId, t.dayType)],
);

export const planItems = pgTable("plan_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  planMealId: uuid("plan_meal_id")
    .notNull()
    .references(() => planMeals.id, { onDelete: "cascade" }),
  foodId: uuid("food_id")
    .notNull()
    .references(() => foods.id, { onDelete: "cascade" }),
  qty: real("qty").notNull(),
});

// One row per client per day once they start logging food.
export const nutritionDays = pgTable(
  "nutrition_days",
  {
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    dayType: dayTypeEnum("day_type").notNull(),
    completedAt: timestamp("completed_at"),
  },
  (t) => [uniqueIndex("nutrition_days_client_date").on(t.clientId, t.date)],
);

export const dayMeals = pgTable(
  "day_meals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    planMealId: uuid("plan_meal_id").references(() => planMeals.id, { onDelete: "set null" }),
    completedAt: timestamp("completed_at"),
  },
  (t) => [index("day_meals_client_date").on(t.clientId, t.date)],
);

// Logged food. Name, unit and macros are copied in so history survives food edits.
export const mealItems = pgTable("meal_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  dayMealId: uuid("day_meal_id")
    .notNull()
    .references(() => dayMeals.id, { onDelete: "cascade" }),
  foodId: uuid("food_id").references(() => foods.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  qty: real("qty").notNull(),
  unit: text("unit").notNull(),
  kcal: real("kcal").notNull(),
  protein: real("protein").notNull(),
  carbs: real("carbs").notNull(),
  fat: real("fat").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- Cardio ----------

// Coach's weekly cardio/steps plan. weekday: 0 = Monday … 6 = Sunday.
export const cardioPlan = pgTable(
  "cardio_plan",
  {
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    task: text("task").notNull(),
  },
  (t) => [uniqueIndex("cardio_plan_client_weekday").on(t.clientId, t.weekday)],
);

export const cardioLogs = pgTable(
  "cardio_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    activity: text("activity").notNull(),
    durationMin: integer("duration_min"),
    distanceKm: real("distance_km"),
    avgHr: integer("avg_hr"),
    kcal: integer("kcal"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("cardio_logs_client_date").on(t.clientId, t.date)],
);

export type Food = typeof foods.$inferSelect;
export type DayType = (typeof dayTypeEnum.enumValues)[number];

// One-time "forgot password" links. Only a hash of the token is stored.
export const passwordResets = pgTable(
  "password_resets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("password_resets_user").on(t.userId)],
);
