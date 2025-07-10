import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin } from "./auth";
import {
  insertSurveyResponseSchema,
  insertWithdrawalRequestSchema,
  updateWithdrawalStatusSchema,
  updateUserStatusSchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Survey routes
  app.get("/api/surveys", isAuthenticated, async (req, res) => {
    try {
      const surveys = await storage.getActiveSurveys();
      res.json(surveys);
    } catch (error) {
      console.error("Error fetching surveys:", error);
      res.status(500).json({ message: "Failed to fetch surveys" });
    }
  });

  app.get("/api/surveys/:id", isAuthenticated, async (req, res) => {
    try {
      const surveyId = parseInt(req.params.id);
      const survey = await storage.getSurvey(surveyId);
      
      if (!survey) {
        return res.status(404).json({ message: "Survey not found" });
      }
      
      res.json(survey);
    } catch (error) {
      console.error("Error fetching survey:", error);
      res.status(500).json({ message: "Failed to fetch survey" });
    }
  });

  app.post("/api/surveys/:id/complete", isAuthenticated, async (req: any, res) => {
    try {
      const surveyId = parseInt(req.params.id);
      const userId = req.user.id;
      
      // Validate request body
      const validatedData = insertSurveyResponseSchema.parse({
        surveyId,
        responses: req.body.responses,
      });

      // Get survey to determine reward
      const survey = await storage.getSurvey(surveyId);
      if (!survey) {
        return res.status(404).json({ message: "Survey not found" });
      }

      // Check if user already completed this survey
      const existingResponses = await storage.getUserSurveyResponses(userId);
      const alreadyCompleted = existingResponses.some(r => r.surveyId === surveyId);
      
      if (alreadyCompleted) {
        return res.status(400).json({ message: "Survey already completed" });
      }

      // Create survey response
      const response = await storage.createSurveyResponse(userId, {
        ...validatedData,
        gemAwarded: survey.reward,
      });

      // Create transaction record
      await storage.createTransaction({
        userId,
        type: "survey_reward",
        amount: survey.reward,
        description: `Survey completed: ${survey.title}`,
        surveyId: surveyId,
      });

      // Log security event
      await storage.createSecurityLog({
        userId,
        action: "survey_completed",
        details: { surveyId, reward: survey.reward },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });

      res.json({ response, gemsEarned: survey.reward });
    } catch (error) {
      console.error("Error completing survey:", error);
      res.status(500).json({ message: "Failed to complete survey" });
    }
  });

  // Transaction routes
  app.get("/api/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const transactions = await storage.getUserTransactions(userId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Withdrawal routes
  app.post("/api/withdrawals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = req.user;
      
      // Validate request body
      const validatedData = insertWithdrawalRequestSchema.parse(req.body);

      // Check if user has pending withdrawal
      const pendingWithdrawal = await storage.getUserPendingWithdrawal(userId);
      if (pendingWithdrawal) {
        return res.status(400).json({ 
          message: "You already have a pending withdrawal request" 
        });
      }

      // Check if user has enough gems
      if (user.gemBalance < validatedData.amount) {
        return res.status(400).json({ 
          message: "Insufficient gem balance" 
        });
      }

      // Minimum withdrawal check
      if (validatedData.amount < 100) {
        return res.status(400).json({ 
          message: "Minimum withdrawal amount is 100 gems" 
        });
      }

      // Create withdrawal request
      const withdrawal = await storage.createWithdrawalRequest(userId, validatedData);

      // Create transaction record
      await storage.createTransaction({
        userId,
        type: "withdrawal_request",
        amount: -validatedData.amount,
        description: `Withdrawal requested: ${validatedData.amount} gems`,
        withdrawalId: withdrawal.id,
      });

      // Update user gem balance (deduct requested amount)
      await storage.updateUserGemBalance(userId, user.gemBalance - validatedData.amount);

      // Log security event
      await storage.createSecurityLog({
        userId,
        action: "withdrawal_requested",
        details: { amount: validatedData.amount, walletAddress: validatedData.walletAddress },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });

      res.json(withdrawal);
    } catch (error) {
      console.error("Error creating withdrawal:", error);
      res.status(500).json({ message: "Failed to create withdrawal request" });
    }
  });

  app.get("/api/withdrawals/pending", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const pendingWithdrawal = await storage.getUserPendingWithdrawal(userId);
      res.json(pendingWithdrawal);
    } catch (error) {
      console.error("Error fetching pending withdrawal:", error);
      res.status(500).json({ message: "Failed to fetch pending withdrawal" });
    }
  });

  // Offerwall routes
  app.post("/api/offerwall/complete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { offerId, provider, reward, title } = req.body;

      // Award gems to user
      const user = req.user;
      await storage.updateUserGemBalance(userId, user.gemBalance + reward);

      // Create transaction record
      await storage.createTransaction({
        userId,
        type: "offerwall_reward",
        amount: reward,
        description: `Offerwall: ${title}`,
        offerwallProvider: provider,
        offerwallOfferId: offerId,
      });

      // Log the action
      await storage.createSecurityLog({
        userId,
        action: "offerwall_completed",
        details: { offerId, provider, reward, title },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });

      res.json({ success: true, reward });
    } catch (error) {
      console.error("Error completing offerwall:", error);
      res.status(500).json({ message: "Failed to complete offerwall" });
    }
  });

  app.post("/api/offerwall/earnings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { amount, description } = req.body;

      // Award gems to user
      const user = req.user;
      await storage.updateUserGemBalance(userId, user.gemBalance + amount);

      // Create transaction record
      await storage.createTransaction({
        userId,
        type: "offerwall_reward",
        amount,
        description: description || "Offerwall earnings",
      });

      // Log the action
      await storage.createSecurityLog({
        userId,
        action: "offerwall_earnings",
        details: { amount, description },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });

      res.json({ success: true, amount });
    } catch (error) {
      console.error("Error processing earnings:", error);
      res.status(500).json({ message: "Failed to process earnings" });
    }
  });

  // Admin routes
  app.get("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/withdrawals", isAdmin, async (req, res) => {
    try {
      const withdrawals = await storage.getPendingWithdrawals();
      res.json(withdrawals);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });

  app.patch("/api/admin/withdrawals/:id", isAdmin, async (req: any, res) => {
    try {
      const withdrawalId = parseInt(req.params.id);
      const adminId = req.user.id;
      
      // Validate request body
      const validatedData = updateWithdrawalStatusSchema.parse(req.body);

      const withdrawal = await storage.updateWithdrawalStatus(
        withdrawalId,
        validatedData,
        adminId
      );

      // Create transaction record
      await storage.createTransaction({
        userId: withdrawal.userId,
        type: `withdrawal_${validatedData.status}`,
        amount: validatedData.status === "approved" ? 0 : withdrawal.amount,
        description: `Withdrawal ${validatedData.status}: ${withdrawal.amount} gems`,
        withdrawalId: withdrawal.id,
      });

      // If rejected, return gems to user
      if (validatedData.status === "rejected") {
        const user = await storage.getUser(withdrawal.userId);
        if (user) {
          await storage.updateUserGemBalance(
            withdrawal.userId,
            user.gemBalance + withdrawal.amount
          );
        }
      }

      // Log security event
      await storage.createSecurityLog({
        userId: adminId,
        action: `withdrawal_${validatedData.status}`,
        details: { 
          withdrawalId, 
          amount: withdrawal.amount, 
          userId: withdrawal.userId,
          notes: validatedData.adminNotes 
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });

      res.json(withdrawal);
    } catch (error) {
      console.error("Error updating withdrawal:", error);
      res.status(500).json({ message: "Failed to update withdrawal" });
    }
  });

  app.patch("/api/admin/users/:id/status", isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const adminId = req.user.id;
      
      // Validate request body
      const validatedData = updateUserStatusSchema.parse(req.body);

      const user = await storage.updateUserStatus(userId, validatedData);

      // Log security event
      await storage.createSecurityLog({
        userId: adminId,
        action: `user_status_changed`,
        details: { 
          targetUserId: userId, 
          newStatus: validatedData.status 
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });

      res.json(user);
    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  app.get("/api/admin/stats", isAdmin, async (req, res) => {
    try {
      const stats = await storage.getUserStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
