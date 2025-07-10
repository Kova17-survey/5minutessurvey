import {
  users,
  surveys,
  surveyResponses,
  transactions,
  withdrawalRequests,
  securityLogs,
  type User,
  type UpsertUser,
  type Survey,
  type SurveyResponse,
  type Transaction,
  type WithdrawalRequest,
  type SecurityLog,
  type InsertSurveyResponse,
  type InsertWithdrawalRequest,
  type UpdateWithdrawalStatus,
  type UpdateUserStatus,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User operations (required for auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserGemBalance(userId: string, amount: number): Promise<void>;
  updateUserStatus(userId: string, status: UpdateUserStatus): Promise<User>;
  verifyUser(userId: string): Promise<void>;
  
  // Survey operations
  getActiveSurveys(): Promise<Survey[]>;
  getSurvey(id: number): Promise<Survey | undefined>;
  createSurveyResponse(userId: string, response: InsertSurveyResponse & { gemAwarded: number }): Promise<SurveyResponse>;
  getUserSurveyResponses(userId: string): Promise<SurveyResponse[]>;
  
  // Transaction operations
  createTransaction(transaction: {
    userId: string;
    type: string;
    amount: number;
    description: string;
    surveyId?: number;
    withdrawalId?: number;
    offerwallProvider?: string;
    offerwallOfferId?: string;
  }): Promise<Transaction>;
  getUserTransactions(userId: string, limit?: number): Promise<Transaction[]>;
  
  // Withdrawal operations
  createWithdrawalRequest(userId: string, request: InsertWithdrawalRequest): Promise<WithdrawalRequest>;
  getPendingWithdrawals(): Promise<WithdrawalRequest[]>;
  updateWithdrawalStatus(id: number, status: UpdateWithdrawalStatus, processedBy: string): Promise<WithdrawalRequest>;
  getUserPendingWithdrawal(userId: string): Promise<WithdrawalRequest | undefined>;
  
  // Security operations
  createSecurityLog(log: {
    userId?: string;
    action: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<SecurityLog>;
  
  // Admin operations
  getAllUsers(): Promise<User[]>;
  getUserStats(): Promise<{
    totalUsers: number;
    pendingWithdrawals: number;
    totalPayouts: string;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        isAdmin: userData.email === "5minutessurvey@gmail.com",
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserGemBalance(userId: string, amount: number): Promise<void> {
    await db
      .update(users)
      .set({
        gemBalance: amount,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async updateUserStatus(userId: string, statusUpdate: UpdateUserStatus): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...statusUpdate,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async verifyUser(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        isVerified: true,
        verificationCode: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async getActiveSurveys(): Promise<Survey[]> {
    return await db
      .select()
      .from(surveys)
      .where(eq(surveys.isActive, true))
      .orderBy(desc(surveys.createdAt));
  }

  async getSurvey(id: number): Promise<Survey | undefined> {
    const [survey] = await db.select().from(surveys).where(eq(surveys.id, id));
    return survey;
  }

  async createSurveyResponse(
    userId: string,
    response: InsertSurveyResponse & { gemAwarded: number }
  ): Promise<SurveyResponse> {
    const [surveyResponse] = await db
      .insert(surveyResponses)
      .values({
        userId,
        surveyId: response.surveyId,
        responses: response.responses,
        gemAwarded: response.gemAwarded,
      })
      .returning();

    // Update user gem balance
    const user = await this.getUser(userId);
    if (user) {
      await this.updateUserGemBalance(userId, user.gemBalance + response.gemAwarded);
    }

    // Update survey participant count
    const survey = await this.getSurvey(response.surveyId);
    if (survey) {
      await db
        .update(surveys)
        .set({
          participantCount: survey.participantCount + 1,
        })
        .where(eq(surveys.id, response.surveyId));
    }

    return surveyResponse;
  }

  async getUserSurveyResponses(userId: string): Promise<SurveyResponse[]> {
    return await db
      .select()
      .from(surveyResponses)
      .where(eq(surveyResponses.userId, userId))
      .orderBy(desc(surveyResponses.completedAt));
  }

  async createTransaction(transaction: {
    userId: string;
    type: string;
    amount: number;
    description: string;
    surveyId?: number;
    withdrawalId?: number;
    offerwallProvider?: string;
    offerwallOfferId?: string;
  }): Promise<Transaction> {
    const [newTransaction] = await db
      .insert(transactions)
      .values(transaction)
      .returning();
    return newTransaction;
  }

  async getUserTransactions(userId: string, limit = 10): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
  }

  async createWithdrawalRequest(
    userId: string,
    request: InsertWithdrawalRequest
  ): Promise<WithdrawalRequest> {
    const [withdrawal] = await db
      .insert(withdrawalRequests)
      .values({
        userId,
        ...request,
      })
      .returning();
    return withdrawal;
  }

  async getPendingWithdrawals(): Promise<WithdrawalRequest[]> {
    return await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.status, "pending"))
      .orderBy(desc(withdrawalRequests.requestedAt));
  }

  async updateWithdrawalStatus(
    id: number,
    status: UpdateWithdrawalStatus,
    processedBy: string
  ): Promise<WithdrawalRequest> {
    const [withdrawal] = await db
      .update(withdrawalRequests)
      .set({
        ...status,
        processedBy,
        processedAt: new Date(),
      })
      .where(eq(withdrawalRequests.id, id))
      .returning();
    return withdrawal;
  }

  async getUserPendingWithdrawal(userId: string): Promise<WithdrawalRequest | undefined> {
    const [withdrawal] = await db
      .select()
      .from(withdrawalRequests)
      .where(
        and(
          eq(withdrawalRequests.userId, userId),
          eq(withdrawalRequests.status, "pending")
        )
      );
    return withdrawal;
  }

  async createSecurityLog(log: {
    userId?: string;
    action: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<SecurityLog> {
    const [securityLog] = await db
      .insert(securityLogs)
      .values(log)
      .returning();
    return securityLog;
  }

  async getAllUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    pendingWithdrawals: number;
    totalPayouts: string;
  }> {
    const totalUsersResult = await db.select().from(users);
    const pendingWithdrawalsResult = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.status, "pending"));
    
    // Calculate total payouts (approved withdrawals)
    const approvedWithdrawals = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.status, "approved"));
    
    const totalPayouts = approvedWithdrawals.reduce((sum, w) => sum + w.amount, 0);
    
    return {
      totalUsers: totalUsersResult.length,
      pendingWithdrawals: pendingWithdrawalsResult.length,
      totalPayouts: (totalPayouts * 0.05).toFixed(2), // Convert gems to dollars (approximate)
    };
  }
}

export const storage = new DatabaseStorage();
