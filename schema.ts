import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  integer,
  boolean,
  decimal,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table (required for auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique().notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  gemBalance: integer("gem_balance").default(0).notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  verificationCode: varchar("verification_code"),
  status: varchar("status").default("active").notNull(), // active, banned, suspended
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Surveys table
export const surveys = pgTable("surveys", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  duration: integer("duration").notNull(), // in minutes
  reward: integer("reward").notNull(), // gems
  questions: jsonb("questions").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  participantCount: integer("participant_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Survey responses table
export const surveyResponses = pgTable("survey_responses", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  surveyId: integer("survey_id").references(() => surveys.id).notNull(),
  responses: jsonb("responses").notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  gemAwarded: integer("gem_awarded").notNull(),
});

// Transactions table
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: varchar("type").notNull(), // survey_reward, offerwall_reward, withdrawal_request, withdrawal_approved, withdrawal_rejected
  amount: integer("amount").notNull(),
  description: text("description").notNull(),
  surveyId: integer("survey_id").references(() => surveys.id),
  withdrawalId: integer("withdrawal_id"),
  offerwallProvider: varchar("offerwall_provider"), // cpx, bitlabs, theorem, adgem, lootably
  offerwallOfferId: varchar("offerwall_offer_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Withdrawal requests table
export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  amount: integer("amount").notNull(),
  walletAddress: varchar("wallet_address").notNull(),
  status: varchar("status").default("pending").notNull(), // pending, approved, rejected
  adminNotes: text("admin_notes"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  processedBy: varchar("processed_by").references(() => users.id),
});

// Security logs table
export const securityLogs = pgTable("security_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  action: varchar("action").notNull(),
  details: jsonb("details"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  surveyResponses: many(surveyResponses),
  transactions: many(transactions),
  withdrawalRequests: many(withdrawalRequests),
  securityLogs: many(securityLogs),
}));

export const surveysRelations = relations(surveys, ({ many }) => ({
  responses: many(surveyResponses),
  transactions: many(transactions),
}));

export const surveyResponsesRelations = relations(surveyResponses, ({ one }) => ({
  user: one(users, { fields: [surveyResponses.userId], references: [users.id] }),
  survey: one(surveys, { fields: [surveyResponses.surveyId], references: [surveys.id] }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  survey: one(surveys, { fields: [transactions.surveyId], references: [surveys.id] }),
}));

export const withdrawalRequestsRelations = relations(withdrawalRequests, ({ one }) => ({
  user: one(users, { fields: [withdrawalRequests.userId], references: [users.id] }),
  processedByUser: one(users, { fields: [withdrawalRequests.processedBy], references: [users.id] }),
}));

// Schemas
export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export const insertSurveyResponseSchema = createInsertSchema(surveyResponses).pick({
  surveyId: true,
  responses: true,
});

export const insertWithdrawalRequestSchema = createInsertSchema(withdrawalRequests).pick({
  amount: true,
  walletAddress: true,
});

export const updateWithdrawalStatusSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  adminNotes: z.string().optional(),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(["active", "banned", "suspended"]),
});

// Types
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type Survey = typeof surveys.$inferSelect;
export type SurveyResponse = typeof surveyResponses.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type SecurityLog = typeof securityLogs.$inferSelect;
export type InsertSurveyResponse = z.infer<typeof insertSurveyResponseSchema>;
export type InsertWithdrawalRequest = z.infer<typeof insertWithdrawalRequestSchema>;
export type UpdateWithdrawalStatus = z.infer<typeof updateWithdrawalStatusSchema>;
export type UpdateUserStatus = z.infer<typeof updateUserStatusSchema>;
