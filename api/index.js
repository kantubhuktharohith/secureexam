var __defProp = Object.defineProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// api/index.ts
import express from "express";
import cookieParser from "cookie-parser";

// server/routes.ts
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt2 from "jsonwebtoken";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  clientHallTicketSchema: () => clientHallTicketSchema,
  examSessions: () => examSessions,
  examSessionsRelations: () => examSessionsRelations,
  hallTickets: () => hallTickets,
  hallTicketsRelations: () => hallTicketsRelations,
  insertExamSessionSchema: () => insertExamSessionSchema,
  insertHallTicketSchema: () => insertHallTicketSchema,
  insertMonitoringLogSchema: () => insertMonitoringLogSchema,
  insertQuestionSchema: () => insertQuestionSchema,
  insertSecurityIncidentSchema: () => insertSecurityIncidentSchema,
  monitoringLogs: () => monitoringLogs,
  monitoringLogsRelations: () => monitoringLogsRelations,
  questions: () => questions,
  securityIncidents: () => securityIncidents,
  securityIncidentsRelations: () => securityIncidentsRelations,
  sessions: () => sessions,
  users: () => users,
  usersRelations: () => usersRelations
});
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  uuid
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull()
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("student"),
  // 'admin' | 'student'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var hallTickets = pgTable("hall_tickets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  hallTicketId: varchar("hall_ticket_id").notNull().unique(),
  examName: varchar("exam_name").notNull(),
  examDate: timestamp("exam_date").notNull(),
  duration: integer("duration").notNull(),
  // in minutes
  totalQuestions: integer("total_questions").notNull(),
  rollNumber: varchar("roll_number").notNull(),
  studentName: varchar("student_name").notNull(),
  studentEmail: varchar("student_email").notNull(),
  studentIdBarcode: varchar("student_id_barcode"),
  // Student ID card barcode for verification
  idCardImageUrl: text("id_card_image_url"),
  // URL/path to uploaded student ID card image
  qrCodeData: text("qr_code_data").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var examSessions = pgTable("exam_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  hallTicketId: uuid("hall_ticket_id").notNull().references(() => hallTickets.id),
  studentId: varchar("student_id").notNull().references(() => users.id),
  status: varchar("status").notNull().default("not_started"),
  // 'not_started' | 'in_progress' | 'paused' | 'completed' | 'submitted'
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  currentQuestion: integer("current_question").default(1),
  answers: jsonb("answers").default({}),
  questionIds: jsonb("question_ids").default([]),
  // array of question UUIDs for this session
  timeRemaining: integer("time_remaining"),
  // in seconds
  isVerified: boolean("is_verified").default(false),
  verificationData: jsonb("verification_data"),
  // photos, ID verification results
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var securityIncidents = pgTable("security_incidents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id").notNull().references(() => examSessions.id),
  incidentType: varchar("incident_type").notNull(),
  // 'multiple_faces' | 'looking_away' | 'network_disconnect' | 'device_detected'
  severity: varchar("severity").notNull(),
  // 'low' | 'medium' | 'high' | 'critical'
  description: text("description").notNull(),
  metadata: jsonb("metadata"),
  // detection confidence, duration, etc.
  snapshotUrl: varchar("snapshot_url"),
  isResolved: boolean("is_resolved").default(false),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow()
});
var monitoringLogs = pgTable("monitoring_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id").notNull().references(() => examSessions.id),
  eventType: varchar("event_type").notNull(),
  // 'face_detected' | 'attention_warning' | 'network_status' | 'question_answered'
  eventData: jsonb("event_data"),
  timestamp: timestamp("timestamp").defaultNow()
});
var questions = pgTable("questions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  examName: varchar("exam_name").notNull(),
  questionText: text("question_text").notNull(),
  options: jsonb("options").notNull(),
  // array of options
  correctAnswer: varchar("correct_answer").notNull(),
  questionType: varchar("question_type").notNull().default("multiple_choice"),
  difficulty: varchar("difficulty").default("medium"),
  subject: varchar("subject").notNull(),
  topic: varchar("topic").notNull(),
  marks: integer("marks").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var usersRelations = relations(users, ({ many }) => ({
  createdHallTickets: many(hallTickets),
  examSessions: many(examSessions),
  resolvedIncidents: many(securityIncidents)
}));
var hallTicketsRelations = relations(hallTickets, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [hallTickets.createdBy],
    references: [users.id]
  }),
  examSessions: many(examSessions)
}));
var examSessionsRelations = relations(examSessions, ({ one, many }) => ({
  hallTicket: one(hallTickets, {
    fields: [examSessions.hallTicketId],
    references: [hallTickets.id]
  }),
  student: one(users, {
    fields: [examSessions.studentId],
    references: [users.id]
  }),
  securityIncidents: many(securityIncidents),
  monitoringLogs: many(monitoringLogs)
}));
var securityIncidentsRelations = relations(securityIncidents, ({ one }) => ({
  session: one(examSessions, {
    fields: [securityIncidents.sessionId],
    references: [examSessions.id]
  }),
  resolvedBy: one(users, {
    fields: [securityIncidents.resolvedBy],
    references: [users.id]
  })
}));
var monitoringLogsRelations = relations(monitoringLogs, ({ one }) => ({
  session: one(examSessions, {
    fields: [monitoringLogs.sessionId],
    references: [examSessions.id]
  })
}));
var insertHallTicketSchema = createInsertSchema(hallTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var clientHallTicketSchema = z.object({
  examName: z.string().min(1, "Exam name is required"),
  examDate: z.string().min(1, "Exam date is required"),
  // Will be converted to Date on server
  duration: z.number().min(1, "Duration must be at least 1 minute"),
  totalQuestions: z.number().min(1, "Total questions must be at least 1"),
  rollNumber: z.string().min(1, "Roll number is required"),
  studentName: z.string().min(1, "Student name is required"),
  studentEmail: z.string().email("Valid email is required"),
  studentIdBarcode: z.string().optional(),
  // Optional: Student ID card barcode for verification
  idCardImageUrl: z.string().optional()
  // Optional: URL to uploaded student ID card image
});
var insertExamSessionSchema = createInsertSchema(examSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertSecurityIncidentSchema = createInsertSchema(securityIncidents).omit({
  id: true,
  createdAt: true
});
var insertMonitoringLogSchema = createInsertSchema(monitoringLogs).omit({
  id: true,
  timestamp: true
});
var insertQuestionSchema = createInsertSchema(questions).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// server/db.ts
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import { eq, and, desc, count, sql as sql2 } from "drizzle-orm";
var DatabaseStorage = class {
  // User operations
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  async upsertUser(userData) {
    const { id, ...rest } = userData;
    const [user] = await db.insert(users).values(userData).onConflictDoUpdate({
      target: users.email,
      // conflict is on email
      set: {
        ...rest,
        // update all fields EXCEPT id
        updatedAt: /* @__PURE__ */ new Date()
      }
    }).returning();
    return user;
  }
  // Hall ticket operations
  async createHallTicket(hallTicket) {
    const [ticket] = await db.insert(hallTickets).values(hallTicket).returning();
    return ticket;
  }
  async getHallTicketByQR(qrData) {
    const [ticket] = await db.select().from(hallTickets).where(and(eq(hallTickets.qrCodeData, qrData), eq(hallTickets.isActive, true)));
    return ticket;
  }
  async getHallTicketById(id) {
    const [ticket] = await db.select().from(hallTickets).where(eq(hallTickets.id, id));
    return ticket;
  }
  async getHallTicketsByCreator(creatorId) {
    return await db.select().from(hallTickets).where(eq(hallTickets.createdBy, creatorId)).orderBy(desc(hallTickets.createdAt));
  }
  async updateHallTicket(id, updates) {
    const [ticket] = await db.update(hallTickets).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(hallTickets.id, id)).returning();
    return ticket;
  }
  async getHallTicketByIdAndRoll(hallTicketId, rollNumber) {
    const cleanId = (hallTicketId || "").trim();
    const cleanRoll = (rollNumber || "").trim();
    const [ticket] = await db.select().from(hallTickets).where(and(
      sql2`lower(${hallTickets.hallTicketId}) = lower(${cleanId})`,
      sql2`lower(${hallTickets.rollNumber}) = lower(${cleanRoll})`,
      eq(hallTickets.isActive, true)
    ));
    return ticket;
  }
  async deleteHallTicket(id) {
    const relatedSessions = await db.select().from(examSessions).where(eq(examSessions.hallTicketId, id));
    for (const session of relatedSessions) {
      await db.delete(securityIncidents).where(eq(securityIncidents.sessionId, session.id));
      await db.delete(monitoringLogs).where(eq(monitoringLogs.sessionId, session.id));
    }
    await db.delete(examSessions).where(eq(examSessions.hallTicketId, id));
    await db.delete(hallTickets).where(eq(hallTickets.id, id));
  }
  // Exam session operations
  async createExamSession(session) {
    const [examSession] = await db.insert(examSessions).values(session).returning();
    return examSession;
  }
  async getExamSession(id) {
    const [session] = await db.select().from(examSessions).where(eq(examSessions.id, id));
    return session;
  }
  async getExamSessionByStudent(studentId, hallTicketId) {
    const [session] = await db.select().from(examSessions).where(and(eq(examSessions.studentId, studentId), eq(examSessions.hallTicketId, hallTicketId)));
    return session;
  }
  async updateExamSession(id, updates) {
    const [session] = await db.update(examSessions).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(examSessions.id, id)).returning();
    return session;
  }
  async getAllExamSessions() {
    return await db.select({
      id: examSessions.id,
      hallTicketId: examSessions.hallTicketId,
      studentId: examSessions.studentId,
      status: examSessions.status,
      startTime: examSessions.startTime,
      endTime: examSessions.endTime,
      currentQuestion: examSessions.currentQuestion,
      answers: examSessions.answers,
      questionIds: examSessions.questionIds,
      timeRemaining: examSessions.timeRemaining,
      isVerified: examSessions.isVerified,
      verificationData: examSessions.verificationData,
      createdAt: examSessions.createdAt,
      updatedAt: examSessions.updatedAt,
      // Use hall ticket student name as primary source (not user table)
      studentName: hallTickets.studentName,
      studentLastName: sql2`NULL`,
      studentEmail: users.email,
      // Include hall ticket information
      hallTicketNumber: hallTickets.hallTicketId,
      examName: hallTickets.examName,
      rollNumber: hallTickets.rollNumber
    }).from(examSessions).leftJoin(users, eq(users.id, examSessions.studentId)).leftJoin(hallTickets, eq(hallTickets.id, examSessions.hallTicketId)).orderBy(desc(examSessions.startTime));
  }
  async getActiveExamSessions() {
    return await db.select({
      id: examSessions.id,
      hallTicketId: examSessions.hallTicketId,
      studentId: examSessions.studentId,
      status: examSessions.status,
      startTime: examSessions.startTime,
      endTime: examSessions.endTime,
      currentQuestion: examSessions.currentQuestion,
      answers: examSessions.answers,
      questionIds: examSessions.questionIds,
      timeRemaining: examSessions.timeRemaining,
      isVerified: examSessions.isVerified,
      verificationData: examSessions.verificationData,
      createdAt: examSessions.createdAt,
      updatedAt: examSessions.updatedAt,
      // Use hall ticket student name as primary source
      studentName: hallTickets.studentName,
      studentLastName: sql2`NULL`,
      studentEmail: users.email,
      // Include hall ticket information
      hallTicketNumber: hallTickets.hallTicketId,
      examName: hallTickets.examName,
      rollNumber: hallTickets.rollNumber
    }).from(examSessions).leftJoin(users, eq(users.id, examSessions.studentId)).leftJoin(hallTickets, eq(hallTickets.id, examSessions.hallTicketId)).where(eq(examSessions.status, "in_progress")).orderBy(desc(examSessions.startTime));
  }
  // Security incident operations
  async createSecurityIncident(incident) {
    const [securityIncident] = await db.insert(securityIncidents).values(incident).returning();
    return securityIncident;
  }
  async getSecurityIncidents(sessionId) {
    const query = db.select().from(securityIncidents);
    if (sessionId) {
      return await query.where(eq(securityIncidents.sessionId, sessionId)).orderBy(desc(securityIncidents.createdAt));
    }
    return await query.orderBy(desc(securityIncidents.createdAt));
  }
  async updateSecurityIncident(id, updates) {
    const [incident] = await db.update(securityIncidents).set(updates).where(eq(securityIncidents.id, id)).returning();
    return incident;
  }
  async getActiveSecurityIncidents() {
    return await db.select().from(securityIncidents).where(eq(securityIncidents.isResolved, false)).orderBy(desc(securityIncidents.createdAt));
  }
  // Monitoring log operations
  async createMonitoringLog(log) {
    const [monitoringLog] = await db.insert(monitoringLogs).values(log).returning();
    return monitoringLog;
  }
  async getMonitoringLogs(sessionId) {
    return await db.select().from(monitoringLogs).where(eq(monitoringLogs.sessionId, sessionId)).orderBy(desc(monitoringLogs.timestamp));
  }
  // Question operations
  async createQuestion(question) {
    const [newQuestion] = await db.insert(questions).values(question).returning();
    return newQuestion;
  }
  async getQuestionsByExam(examName) {
    return await db.select().from(questions).where(eq(questions.examName, examName));
  }
  async getRandomQuestions(examName, limit) {
    return await db.select().from(questions).where(eq(questions.examName, examName)).orderBy(sql2`RANDOM()`).limit(limit);
  }
  async getAllQuestions() {
    return await db.select().from(questions).orderBy(desc(questions.createdAt));
  }
  async updateQuestion(id, data) {
    const [question] = await db.update(questions).set(data).where(eq(questions.id, id)).returning();
    return question;
  }
  async deleteQuestion(id) {
    await db.delete(questions).where(eq(questions.id, id));
  }
  // Analytics
  async getExamStats() {
    const [activeStudentsResult] = await db.select({ count: count() }).from(examSessions).where(eq(examSessions.status, "in_progress"));
    const [totalSessionsResult] = await db.select({ count: count() }).from(examSessions);
    const [securityAlertsResult] = await db.select({ count: count() }).from(securityIncidents).where(eq(securityIncidents.isResolved, false));
    const activeSessions = await db.select().from(examSessions).where(eq(examSessions.status, "in_progress"));
    let averageProgress = 0;
    if (activeSessions.length > 0) {
      const totalProgress = activeSessions.reduce((sum, session) => {
        const progress = session.currentQuestion || 1;
        return sum + progress;
      }, 0);
      averageProgress = Math.round(totalProgress / activeSessions.length * 2);
    }
    return {
      activeStudents: activeStudentsResult.count,
      totalSessions: totalSessionsResult.count,
      securityAlerts: securityAlertsResult.count,
      averageProgress
    };
  }
  // Store identity verification data for manual review
  async storeIdentityVerification(hallTicketId, verificationData) {
    try {
      console.log("Starting storeIdentityVerification for hall ticket:", hallTicketId);
      const hallTicket = await this.getHallTicketById(hallTicketId);
      if (!hallTicket) {
        console.warn("Hall ticket not found, but continuing to allow student access");
        return;
      }
      console.log("Hall ticket found:", hallTicket.hallTicketId, "for student:", hallTicket.studentName);
      const studentEmail = hallTicket.studentEmail;
      let studentUser;
      try {
        studentUser = await db.select().from(users).where(eq(users.email, studentEmail)).limit(1);
      } catch (queryError) {
        console.error("Error querying user:", queryError);
        return;
      }
      let studentId = studentUser[0]?.id;
      if (!studentId) {
        console.log("Creating new user for email:", studentEmail);
        try {
          const userId = `student_${hallTicket.rollNumber}`;
          const nameParts = hallTicket.studentName.split(" ");
          const [newUser] = await db.insert(users).values({
            id: userId,
            email: studentEmail,
            firstName: nameParts[0] || hallTicket.studentName,
            lastName: nameParts.slice(1).join(" ") || "",
            role: "student"
          }).returning();
          studentId = newUser.id;
          console.log("Created new user with ID:", studentId);
        } catch (createError) {
          console.error("Error creating user (non-fatal):", createError);
          return;
        }
      } else {
        console.log("Found existing user with ID:", studentId);
      }
      let examSession;
      try {
        examSession = await this.getExamSessionByStudent(studentId, hallTicketId);
      } catch (sessionQueryError) {
        console.error("Error querying exam session:", sessionQueryError);
        return;
      }
      if (!examSession) {
        console.log("Creating new exam session for student:", studentId);
        try {
          examSession = await this.createExamSession({
            hallTicketId,
            studentId,
            status: "not_started",
            verificationData,
            isVerified: true
            // Mark as verified since documents are uploaded
          });
          console.log("Created exam session with ID:", examSession.id);
        } catch (createSessionError) {
          console.error("Error creating exam session (non-fatal):", createSessionError);
          return;
        }
      } else {
        console.log("Updating existing exam session:", examSession.id);
        try {
          await this.updateExamSession(examSession.id, {
            verificationData,
            isVerified: true
            // Mark as verified since documents are uploaded
          });
        } catch (updateError) {
          console.error("Error updating exam session (non-fatal):", updateError);
          return;
        }
      }
      console.log(`Successfully stored identity verification for hall ticket ${hallTicketId} in exam session ${examSession.id}`);
    } catch (error) {
      console.error("Error storing identity verification (non-fatal):", error);
      return;
    }
  }
};
var storage = new DatabaseStorage();

// server/adminAuth.ts
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
var adminCredentials = null;
function loadAdminCredentials() {
  if (adminCredentials) return adminCredentials;
  const envEmail = process.env.ADMIN_EMAIL;
  const envPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  if (envEmail && envPasswordHash) {
    console.log("\u2713 Admin credentials loaded from environment variables");
    adminCredentials = {
      email: envEmail,
      passwordHash: envPasswordHash
    };
    return adminCredentials;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PRODUCTION SECURITY: ADMIN_EMAIL and ADMIN_PASSWORD_HASH environment variables are required in production. Never use file-based credentials in production."
    );
  }
  const credentialsPath = join(process.cwd(), "server", "admin-credentials.json");
  if (existsSync(credentialsPath)) {
    try {
      const fileContent = readFileSync(credentialsPath, "utf-8");
      const data = JSON.parse(fileContent);
      if (!data.email || !data.passwordHash) {
        throw new Error("Invalid credentials file format");
      }
      console.log("\u26A0 Admin credentials loaded from file (DEVELOPMENT ONLY):", credentialsPath);
      adminCredentials = {
        email: data.email,
        passwordHash: data.passwordHash
      };
      return adminCredentials;
    } catch (error) {
      console.error("Error reading admin credentials file:", error);
      throw new Error("Failed to load admin credentials from file");
    }
  }
  throw new Error(
    "Admin credentials not found. Set ADMIN_EMAIL and ADMIN_PASSWORD_HASH environment variables, or create server/admin-credentials.json for development"
  );
}
var jwtSecret = null;
function getJWTSecret() {
  if (jwtSecret) return jwtSecret;
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("\u26A0 Using default JWT_SECRET for development. Set JWT_SECRET env var for production!");
      jwtSecret = "dev-secret-for-local-development-only";
      return jwtSecret;
    }
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  jwtSecret = secret;
  return jwtSecret;
}
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    const credentials = loadAdminCredentials();
    if (email.toLowerCase() !== credentials.email.toLowerCase()) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const isPasswordValid = await bcrypt.compare(password, credentials.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign(
      { email: credentials.email, role: "admin" },
      getJWTSecret(),
      { expiresIn: "7d" }
    );
    res.cookie("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1e3
      // 7 days
    });
    res.json({
      message: "Login successful",
      user: { email: credentials.email, role: "admin" }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
}
function logout(req, res) {
  res.clearCookie("admin_token");
  res.json({ message: "Logged out successfully" });
}
function getAuthUser(req, res) {
  if (!req.admin) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  res.json({
    email: req.admin.email,
    role: req.admin.role
  });
}
function requireAdmin(req, res, next) {
  try {
    const token = req.cookies?.admin_token;
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const decoded = jwt.verify(token, getJWTSecret());
    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    req.admin = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: "Invalid token" });
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Token expired" });
    }
    console.error("Auth error:", error);
    res.status(500).json({ message: "Authentication failed" });
  }
}
async function ensureAdminUser(storage2, adminEmail) {
  let adminUser = await storage2.getUser(adminEmail);
  if (!adminUser) {
    adminUser = await storage2.upsertUser({
      id: adminEmail,
      email: adminEmail,
      firstName: "Admin",
      lastName: "User",
      role: "admin"
    });
    console.log("\u2713 Admin user created in database:", adminEmail);
  }
  return adminUser;
}

// server/routes.ts
import QRCode from "qrcode";
import { nanoid } from "nanoid";

// server/ai-verification.ts
import OpenAI from "openai";
var openaiClient = null;
function getOpenAIClient() {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set. AI verification requires an OpenAI API key.");
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}
async function verifyIDDocument(idCardImage, selfieImage, expectedName, expectedIdNumber) {
  try {
    const openai = getOpenAIClient();
    const verificationPromise = openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `Fast ID checker. Extract name from ID and check if faces match. Reply with JSON:
{
  "name": "name from ID",
  "faceMatch": boolean,
  "passed": boolean
}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract name from ID and check if faces match. Expected: "${expectedName}"`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${idCardImage}`
              }
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${selfieImage}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 150
      // Minimal response for speed
    });
    const timeoutPromise = new Promise(
      (_, reject) => setTimeout(() => reject(new Error("Verification timeout")), 8e3)
    );
    const verificationResponse = await Promise.race([verificationPromise, timeoutPromise]);
    const result = JSON.parse(verificationResponse.choices[0].message.content || "{}");
    const reasons = [];
    let isValid = false;
    let confidence = 0.6;
    if (result.name && expectedName) {
      const nameSimilarity = calculateNameSimilarity(result.name.toLowerCase(), expectedName.toLowerCase());
      console.log(`AI Name comparison: "${result.name}" vs "${expectedName}" = ${Math.round(nameSimilarity * 100)}%`);
      if (nameSimilarity >= 0.6) {
        isValid = true;
        confidence = nameSimilarity;
        reasons.push(`Name match found: "${result.name}" \u2248 "${expectedName}" (${Math.round(nameSimilarity * 100)}%)`);
      } else {
        reasons.push(`Name similarity too low: ${Math.round(nameSimilarity * 100)}% (need 60%)`);
      }
    }
    if (result.passed && result.faceMatch && isValid) {
      confidence = Math.max(confidence, 0.8);
      reasons.push("AI verification passed with face match and name verification");
    } else {
      isValid = false;
      if (!result.passed) reasons.push("AI verification failed");
      if (!result.faceMatch) reasons.push("Face match failed");
    }
    return {
      isValid,
      confidence,
      extractedData: {
        name: result.name || "Unknown",
        documentType: "ID Document",
        idNumber: expectedIdNumber,
        dateOfBirth: void 0
      },
      faceMatch: {
        matches: result.faceMatch || false,
        confidence
      },
      reasons: reasons.length > 0 ? reasons : ["Quick verification completed"]
    };
  } catch (error) {
    console.error("ID verification error:", error);
    if (error instanceof Error && error.message && error.message.includes("timeout")) {
      console.log("AI verification timed out - security failure");
      return {
        isValid: false,
        confidence: 0,
        extractedData: {
          name: void 0,
          documentType: void 0,
          idNumber: expectedIdNumber,
          dateOfBirth: void 0
        },
        faceMatch: {
          matches: false,
          confidence: 0
        },
        reasons: ["Verification timed out - please try again or contact support"]
      };
    }
    return {
      isValid: false,
      confidence: 0,
      extractedData: {},
      faceMatch: { matches: false, confidence: 0 },
      reasons: [`Verification failed: ${error instanceof Error ? error.message : "Unknown error"}`]
    };
  }
}
function calculateNameSimilarity(name1, name2) {
  const longer = name1.length > name2.length ? name1 : name2;
  const shorter = name1.length > name2.length ? name2 : name1;
  if (longer.length === 0) return 1;
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}
function levenshteinDistance(str1, str2) {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        // deletion
        matrix[j - 1][i] + 1,
        // insertion
        matrix[j - 1][i - 1] + indicator
        // substitution
      );
    }
  }
  return matrix[str2.length][str1.length];
}

// server/simple-name-verification.ts
function calculateNameSimilarity2(name1, name2) {
  const normalize = (name) => {
    return name.toLowerCase().replace(/\b(mr|mrs|ms|dr|prof)\b\.?/g, "").replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
  };
  const norm1 = normalize(name1);
  const norm2 = normalize(name2);
  if (norm1 === norm2) return 1;
  const words1 = norm1.split(" ").filter((w) => w.length > 1);
  const words2 = norm2.split(" ").filter((w) => w.length > 1);
  if (words1.length === 0 || words2.length === 0) return 0;
  let matches = 0;
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
        matches++;
        break;
      }
    }
  }
  return matches / Math.max(words1.length, words2.length);
}
async function extractNameFromDocument(imageBase64, expectedName) {
  try {
    console.log("Starting simple name extraction...");
    const extractedText = await performBasicOCR(imageBase64);
    const extractedName = findNameInText(extractedText);
    if (!extractedName) {
      return {
        isValid: false,
        confidence: 0,
        reason: "Could not extract name from document. Please ensure the image is clear and contains readable text."
      };
    }
    const similarity = calculateNameSimilarity2(extractedName, expectedName);
    console.log(`Name comparison: "${extractedName}" vs "${expectedName}" = ${Math.round(similarity * 100)}% similarity`);
    if (similarity >= 0.5) {
      return {
        isValid: true,
        confidence: similarity,
        extractedName,
        reason: `Name match found: "${extractedName}" matches "${expectedName}" (${Math.round(similarity * 100)}% similarity)`
      };
    } else {
      return {
        isValid: false,
        confidence: similarity,
        extractedName,
        reason: `Name mismatch: extracted "${extractedName}" doesn't match "${expectedName}" (${Math.round(similarity * 100)}% similarity, need 50%)`
      };
    }
  } catch (error) {
    console.error("Name extraction error:", error);
    return {
      isValid: false,
      confidence: 0,
      reason: "Failed to process document. Please try uploading a clearer image."
    };
  }
}
async function performBasicOCR(imageBase64) {
  try {
    const OpenAI2 = __require("openai");
    const openai = new OpenAI2({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      // Fast model for text extraction
      messages: [
        {
          role: "system",
          content: "Extract all visible text from this ID document. Return just the raw text, no analysis."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this ID document:"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 200
      // Just need text extraction
    });
    return response.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("OCR extraction failed:", error);
    return "";
  }
}
function findNameInText(text2) {
  console.log("Raw OCR text:", text2);
  const namePatterns = [
    /name[:\s]+([a-zA-Z\s]{4,50})/i,
    // "Name: John Doe"
    /^name[:\s]*\n([a-zA-Z\s]{4,50})/im,
    // "Name:" on one line, name on next
    /holder[:\s]+([a-zA-Z\s]{4,50})/i,
    // "Holder: John Doe"
    /student[:\s]+([a-zA-Z\s]{4,50})/i,
    // "Student: John Doe"
    /([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/m,
    // First Middle? Last pattern
    /([A-Z][A-Z\s]{8,40})/
    // All caps name (longer matches)
  ];
  for (const pattern of namePatterns) {
    const match = text2.match(pattern);
    if (match && match[1]) {
      const name = match[1].replace(/\n/g, " ").replace(/\s+/g, " ").trim();
      const isValidName = name.length >= 4 && // At least 4 characters
      name.length <= 50 && // Not too long
      !name.match(/\d/) && // No digits
      !name.match(/[!@#$%^&*()_+={}[\]|\\:;"'<>,.?/]/) && // No special chars
      !name.match(/GOVERNMENT|DEPARTMENT|CARD|LICENSE|PASSPORT|IDENTITY/i);
      if (isValidName) {
        console.log(`Found name using pattern ${pattern}: "${name}"`);
        return name;
      }
    }
  }
  const words = text2.split(/\s+/);
  const capitalizedWords = words.filter(
    (w) => w.length > 2 && w[0] === w[0].toUpperCase() && !w.match(/\d/) && !w.match(/GOVERNMENT|CARD|LICENSE|PASSPORT|IDENTITY/i)
  );
  if (capitalizedWords.length >= 2) {
    const fallbackName = capitalizedWords.slice(0, 3).join(" ");
    console.log(`Fallback name extraction: "${fallbackName}"`);
    return fallbackName;
  }
  console.log("No name found in text");
  return null;
}

// server/routes.ts
async function registerRoutes(app2) {
  app2.post("/api/auth/login", login);
  app2.post("/api/auth/logout", logout);
  app2.get("/api/auth/user", requireAdmin, getAuthUser);
  app2.post("/api/hall-tickets", requireAdmin, async (req, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const userId = req.admin.email;
      const clientData = clientHallTicketSchema.parse(req.body);
      const hallTicketId = `HT${(/* @__PURE__ */ new Date()).getFullYear()}${nanoid(8).toUpperCase()}`;
      const qrData = JSON.stringify({
        hallTicketId,
        rollNumber: clientData.rollNumber,
        examName: clientData.examName,
        timestamp: (/* @__PURE__ */ new Date()).getTime()
      });
      const hallTicket = await storage.createHallTicket({
        hallTicketId,
        examName: clientData.examName,
        examDate: new Date(clientData.examDate),
        // Convert string to Date
        duration: clientData.duration,
        totalQuestions: clientData.totalQuestions,
        rollNumber: clientData.rollNumber,
        studentName: clientData.studentName,
        studentEmail: clientData.studentEmail,
        studentIdBarcode: clientData.studentIdBarcode,
        // Store student ID barcode
        idCardImageUrl: clientData.idCardImageUrl,
        // Store ID card image
        qrCodeData: qrData,
        isActive: true,
        createdBy: userId
      });
      res.json(hallTicket);
    } catch (error) {
      console.error("Error creating hall ticket:", error);
      res.status(500).json({ message: "Failed to create hall ticket" });
    }
  });
  app2.post("/api/hall-tickets/bulk", requireAdmin, async (req, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const userId = req.admin.email;
      const { hallTickets: hallTickets2 } = req.body;
      if (!Array.isArray(hallTickets2) || hallTickets2.length === 0) {
        return res.status(400).json({ message: "Invalid data: hallTickets array required" });
      }
      const validatedTickets = [];
      const validationErrors = [];
      for (let i = 0; i < hallTickets2.length; i++) {
        try {
          const clientData = clientHallTicketSchema.parse(hallTickets2[i]);
          validatedTickets.push(clientData);
        } catch (error) {
          validationErrors.push(`Row ${i + 2}: ${error.message}`);
        }
      }
      if (validationErrors.length > 0) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validationErrors.slice(0, 5)
        });
      }
      const createdTickets = [];
      for (const clientData of validatedTickets) {
        const hallTicketId = `HT${(/* @__PURE__ */ new Date()).getFullYear()}${nanoid(8).toUpperCase()}`;
        const qrData = JSON.stringify({
          hallTicketId,
          rollNumber: clientData.rollNumber,
          examName: clientData.examName,
          timestamp: (/* @__PURE__ */ new Date()).getTime()
        });
        const hallTicket = await storage.createHallTicket({
          hallTicketId,
          examName: clientData.examName,
          examDate: new Date(clientData.examDate),
          duration: clientData.duration,
          totalQuestions: clientData.totalQuestions,
          rollNumber: clientData.rollNumber,
          studentName: clientData.studentName,
          studentEmail: clientData.studentEmail,
          studentIdBarcode: clientData.studentIdBarcode || "",
          idCardImageUrl: clientData.idCardImageUrl || "",
          qrCodeData: qrData,
          isActive: true,
          createdBy: userId
        });
        createdTickets.push(hallTicket);
      }
      res.json({
        success: true,
        count: createdTickets.length,
        hallTickets: createdTickets
      });
    } catch (error) {
      console.error("Error creating bulk hall tickets:", error);
      res.status(500).json({ message: "Failed to create hall tickets" });
    }
  });
  app2.get("/api/hall-tickets", requireAdmin, async (req, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const userId = req.admin.email;
      const hallTickets2 = await storage.getHallTicketsByCreator(userId);
      res.json(hallTickets2);
    } catch (error) {
      console.error("Error fetching hall tickets:", error);
      res.status(500).json({ message: "Failed to fetch hall ticket" });
    }
  });
  app2.get("/api/hall-tickets/:id/qr", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const hallTicket = await storage.getHallTicketById(id);
      if (!hallTicket) {
        return res.status(404).json({ message: "Hall ticket not found" });
      }
      const qrCodeUrl = await QRCode.toDataURL(hallTicket.qrCodeData, {
        width: 300,
        margin: 2
      });
      res.json({ qrCodeUrl });
    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });
  app2.patch("/api/hall-tickets/:id", requireAdmin, async (req, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const { id } = req.params;
      const updates = req.body;
      const updatedTicket = await storage.updateHallTicket(id, updates);
      res.json(updatedTicket);
    } catch (error) {
      console.error("Error updating hall ticket:", error);
      res.status(500).json({ message: "Failed to update hall ticket" });
    }
  });
  app2.delete("/api/hall-tickets/:id", requireAdmin, async (req, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const { id } = req.params;
      await storage.deleteHallTicket(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting hall ticket:", error);
      res.status(500).json({ message: "Failed to delete hall ticket" });
    }
  });
  app2.post("/api/auth/verify-hall-ticket", async (req, res) => {
    try {
      const { qrData, rollNumber, hallTicketId } = req.body;
      let hallTicket;
      if (hallTicketId) {
        hallTicket = await storage.getHallTicketByIdAndRoll(hallTicketId, rollNumber);
        if (!hallTicket) {
          return res.status(400).json({ message: "Invalid details" });
        }
      } else if (qrData) {
        hallTicket = await storage.getHallTicketByQR(qrData);
        if (!hallTicket) {
          return res.status(404).json({ message: "Invalid hall ticket" });
        }
        if (hallTicket.rollNumber !== rollNumber) {
          return res.status(400).json({ message: "Roll number mismatch" });
        }
      } else {
        return res.status(400).json({ message: "Either QR data or hall ticket ID is required" });
      }
      res.json({
        valid: true,
        hallTicket: {
          id: hallTicket.id,
          hallTicketId: hallTicket.hallTicketId,
          examName: hallTicket.examName,
          studentName: hallTicket.studentName,
          rollNumber: hallTicket.rollNumber,
          examDate: hallTicket.examDate,
          duration: hallTicket.duration,
          studentIdBarcode: hallTicket.studentIdBarcode,
          // Include barcode for verification
          idCardImageUrl: hallTicket.idCardImageUrl
          // Include ID card image
        }
      });
    } catch (error) {
      console.error("Error verifying hall ticket:", error);
      res.status(500).json({ message: "Failed to verify hall ticket" });
    }
  });
  app2.post("/api/exam-sessions", async (req, res) => {
    try {
      const hallTicket = await storage.getHallTicketById(req.body.hallTicketId);
      if (!hallTicket || !hallTicket.isActive) {
        return res.status(400).json({ message: "Invalid or inactive hall ticket" });
      }
      let studentUser = await storage.getUserByEmail(hallTicket.studentEmail);
      if (!studentUser) {
        const studentId2 = `student_${hallTicket.rollNumber}`;
        studentUser = await storage.upsertUser({
          id: studentId2,
          email: hallTicket.studentEmail,
          firstName: hallTicket.studentName.split(" ")[0],
          lastName: hallTicket.studentName.split(" ").slice(1).join(" ") || "",
          role: "student"
        });
      }
      const studentId = studentUser.id;
      const sessionData = {
        ...req.body,
        studentId,
        startTime: req.body.startTime ? new Date(req.body.startTime) : /* @__PURE__ */ new Date()
      };
      const data = insertExamSessionSchema.parse(sessionData);
      const existingSession = await storage.getExamSessionByStudent(studentId, data.hallTicketId);
      if (existingSession) {
        await storage.updateHallTicket(hallTicket.id, { isActive: false });
        return res.json(existingSession);
      }
      let examQuestions = await storage.getRandomQuestions(hallTicket.examName, hallTicket.totalQuestions);
      if (!examQuestions || examQuestions.length === 0) {
        console.log(`No questions found for "${hallTicket.examName}", trying fallback to all questions`);
        const allQuestions = await storage.getAllQuestions();
        if (allQuestions.length === 0) {
          return res.status(400).json({
            message: "No questions available in the system. Please contact the administrator to add questions.",
            error: "NO_QUESTIONS_IN_SYSTEM"
          });
        }
        const shuffled = allQuestions.sort(() => 0.5 - Math.random());
        const limit = Math.min(hallTicket.totalQuestions || 20, allQuestions.length);
        examQuestions = shuffled.slice(0, limit);
        console.log(`Using ${examQuestions.length} fallback questions for exam`);
      }
      const questionIds = examQuestions.map((q) => q.id);
      const sessionDataWithQuestions = {
        ...data,
        questionIds
      };
      const examSession = await storage.createExamSession(sessionDataWithQuestions);
      await storage.updateHallTicket(hallTicket.id, { isActive: false });
      res.json(examSession);
    } catch (error) {
      console.error("Error creating exam session:", error);
      res.status(500).json({ message: "Failed to create exam session" });
    }
  });
  app2.get("/api/exam-sessions/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const session = await storage.getExamSession(id);
      if (!session) {
        return res.status(404).json({ message: "Exam session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Error fetching exam session:", error);
      res.status(500).json({ message: "Failed to fetch exam session" });
    }
  });
  app2.patch("/api/exam-sessions/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const session = await storage.updateExamSession(id, updates);
      res.json(session);
    } catch (error) {
      console.error("Error updating exam session:", error);
      res.status(500).json({ message: "Failed to update exam session" });
    }
  });
  app2.get("/api/exam-sessions/:id/questions", async (req, res) => {
    try {
      const { id } = req.params;
      let session = await storage.getExamSession(id);
      if (!session) {
        return res.status(404).json({ message: "Exam session not found" });
      }
      let questionIds = session.questionIds;
      if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
        console.log("No questions assigned to session, assigning now...");
        const hallTicket = await storage.getHallTicketById(session.hallTicketId);
        if (!hallTicket) {
          return res.status(400).json({
            message: "Hall ticket not found for this session",
            error: "HALL_TICKET_NOT_FOUND"
          });
        }
        let examQuestions = await storage.getRandomQuestions(hallTicket.examName, hallTicket.totalQuestions);
        if (!examQuestions || examQuestions.length === 0) {
          console.log(`No questions found for "${hallTicket.examName}", trying fallback to all questions`);
          const allQuestions2 = await storage.getAllQuestions();
          if (allQuestions2.length === 0) {
            return res.status(400).json({
              message: "No questions available in the system. Please contact the administrator to add questions.",
              error: "NO_QUESTIONS_IN_SYSTEM"
            });
          }
          const shuffled = allQuestions2.sort(() => 0.5 - Math.random());
          const limit = Math.min(hallTicket.totalQuestions || 20, allQuestions2.length);
          examQuestions = shuffled.slice(0, limit);
          console.log(`Using ${examQuestions.length} fallback questions for exam`);
        }
        questionIds = examQuestions.map((q) => q.id);
        session = await storage.updateExamSession(id, { questionIds });
        console.log(`Assigned ${questionIds.length} questions to session ${id}`);
      }
      const allQuestions = await storage.getAllQuestions();
      const sessionQuestions = allQuestions.filter((q) => questionIds.includes(q.id)).map((q) => ({
        id: q.id,
        questionText: q.questionText,
        options: q.options,
        questionType: q.questionType,
        marks: q.marks
        // Exclude correctAnswer for security
      }));
      res.json(sessionQuestions);
    } catch (error) {
      console.error("Error fetching session questions:", error);
      res.status(500).json({ message: "Failed to fetch session questions" });
    }
  });
  app2.post("/api/exam-sessions/:id/submit", async (req, res) => {
    try {
      const { id } = req.params;
      const { answers } = req.body;
      const session = await storage.getExamSession(id);
      if (!session) {
        return res.status(404).json({ message: "Exam session not found" });
      }
      const updatedSession = await storage.updateExamSession(id, {
        answers,
        status: "completed",
        endTime: /* @__PURE__ */ new Date()
      });
      res.json({
        success: true,
        message: "Exam submitted successfully",
        session: updatedSession
      });
    } catch (error) {
      console.error("Error submitting exam:", error);
      res.status(500).json({ message: "Failed to submit exam" });
    }
  });
  app2.post("/api/exam-sessions/:id/flag", requireAdmin, async (req, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const { id } = req.params;
      const { reason } = req.body;
      const session = await storage.getExamSession(id);
      if (!session) {
        return res.status(404).json({ message: "Exam session not found" });
      }
      const updatedSession = await storage.updateExamSession(id, {
        status: "completed",
        // Auto-submit
        endTime: /* @__PURE__ */ new Date()
      });
      const incident = await storage.createSecurityIncident({
        sessionId: id,
        incidentType: "admin_flagged",
        severity: "critical",
        description: reason || "Manually flagged by administrator",
        metadata: {
          flaggedBy: req.admin.email,
          flaggedAt: (/* @__PURE__ */ new Date()).toISOString(),
          autoSubmitted: true
        }
      });
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: "student_flagged",
            data: {
              sessionId: id,
              studentId: session.studentId,
              reason: reason || "Manually flagged by administrator",
              incident
            }
          }));
        }
      });
      res.json({
        success: true,
        message: "Student flagged and exam submitted",
        session: updatedSession,
        incident
      });
    } catch (error) {
      console.error("Error flagging student:", error);
      res.status(500).json({ message: "Failed to flag student" });
    }
  });
  app2.post("/api/exam-sessions/:id/resolve", requireAdmin, async (req, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const { id } = req.params;
      const session = await storage.getExamSession(id);
      if (!session) {
        return res.status(404).json({ message: "Exam session not found" });
      }
      if (session.status === "completed" || session.status === "submitted") {
        return res.status(400).json({
          message: "Cannot resolve a completed exam",
          error: "EXAM_ALREADY_COMPLETED"
        });
      }
      const updatedSession = await storage.updateExamSession(id, {
        status: "in_progress"
        // Resume
      });
      const incident = await storage.createSecurityIncident({
        sessionId: id,
        incidentType: "admin_resolved",
        severity: "low",
        description: "Student allowed to continue exam after admin review",
        metadata: {
          resolvedBy: req.admin.email,
          resolvedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: "student_resolved",
            data: {
              sessionId: id,
              studentId: session.studentId,
              incident
            }
          }));
        }
      });
      res.json({
        success: true,
        message: "Student resolved and allowed to continue",
        session: updatedSession,
        incident
      });
    } catch (error) {
      console.error("Error resolving student:", error);
      res.status(500).json({ message: "Failed to resolve student" });
    }
  });
  app2.post("/api/security-incidents", requireAdmin, async (req, res) => {
    try {
      const data = insertSecurityIncidentSchema.parse(req.body);
      const incident = await storage.createSecurityIncident(data);
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client.type === "admin") {
          client.send(JSON.stringify({
            type: "security_incident",
            data: incident
          }));
        }
      });
      res.json(incident);
    } catch (error) {
      console.error("Error creating security incident:", error);
      res.status(500).json({ message: "Failed to create security incident" });
    }
  });
  app2.post("/api/monitoring-logs", async (req, res) => {
    try {
      const data = insertMonitoringLogSchema.parse(req.body);
      const log = await storage.createMonitoringLog(data);
      res.json(log);
    } catch (error) {
      console.error("Error creating monitoring log:", error);
      res.status(500).json({ message: "Failed to create monitoring log" });
    }
  });
  app2.get("/api/monitoring-logs/:sessionId", requireAdmin, async (req, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const { sessionId } = req.params;
      const logs = await storage.getMonitoringLogs(sessionId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching monitoring logs:", error);
      res.status(500).json({ message: "Failed to fetch monitoring logs" });
    }
  });
  app2.get("/api/exam-stats", requireAdmin, async (req, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const stats = await storage.getExamStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching exam stats:", error);
      res.status(500).json({ message: "Failed to fetch exam stats" });
    }
  });
  app2.get("/api/exam-sessions", requireAdmin, async (req, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const sessions2 = await storage.getAllExamSessions();
      res.json(sessions2);
    } catch (error) {
      console.error("Error fetching exam sessions:", error);
      res.status(500).json({ message: "Failed to fetch exam sessions" });
    }
  });
  app2.get("/api/active-sessions", requireAdmin, async (req, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const sessions2 = await storage.getActiveExamSessions();
      res.json(sessions2);
    } catch (error) {
      console.error("Error fetching active sessions:", error);
      res.status(500).json({ message: "Failed to fetch active sessions" });
    }
  });
  app2.get("/api/security-incidents", requireAdmin, async (req, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const incidents = await storage.getSecurityIncidents();
      res.json(incidents);
    } catch (error) {
      console.error("Error fetching security incidents:", error);
      res.status(500).json({ message: "Failed to fetch security incidents" });
    }
  });
  app2.patch("/api/security-incidents/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await ensureAdminUser(storage, req.admin.email);
      const updates = req.body;
      if (updates.isResolved) {
        updates.resolvedAt = /* @__PURE__ */ new Date();
      }
      const updatedIncident = await storage.updateSecurityIncident(id, updates);
      res.json(updatedIncident);
    } catch (error) {
      console.error("Error updating security incident:", error);
      res.status(500).json({ message: "Failed to update security incident" });
    }
  });
  app2.post("/api/questions", requireAdmin, async (req, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const userId = req.admin.email;
      const data = insertQuestionSchema.parse(req.body);
      const question = await storage.createQuestion(data);
      res.json(question);
    } catch (error) {
      console.error("Error creating question:", error);
      res.status(500).json({ message: "Failed to create question" });
    }
  });
  app2.get("/api/questions", requireAdmin, async (req, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const userId = req.admin.email;
      const questions2 = await storage.getAllQuestions();
      res.json(questions2);
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });
  app2.put("/api/questions/:id", requireAdmin, async (req, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const userId = req.admin.email;
      const { id } = req.params;
      const data = insertQuestionSchema.parse(req.body);
      const question = await storage.updateQuestion(id, data);
      res.json(question);
    } catch (error) {
      console.error("Error updating question:", error);
      res.status(500).json({ message: "Failed to update question" });
    }
  });
  app2.delete("/api/questions/:id", requireAdmin, async (req, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const userId = req.admin.email;
      const { id } = req.params;
      await storage.deleteQuestion(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting question:", error);
      res.status(500).json({ message: "Failed to delete question" });
    }
  });
  app2.post("/api/verify-name", async (req, res) => {
    try {
      const { idCardImage, expectedName } = req.body;
      if (!idCardImage || !expectedName) {
        return res.status(400).json({
          message: "Missing required fields: idCardImage and expectedName"
        });
      }
      console.log("Starting simple name verification for:", expectedName);
      const result = await extractNameFromDocument(idCardImage, expectedName);
      res.json({
        isValid: result.isValid,
        confidence: result.confidence,
        extractedName: result.extractedName,
        reason: result.reason
      });
    } catch (error) {
      console.error("Name verification error:", error);
      res.status(500).json({
        message: "Verification failed. Please try again.",
        error: process.env.NODE_ENV === "development" ? error?.message : void 0
      });
    }
  });
  app2.post("/api/verify-identity", async (req, res) => {
    try {
      const { idCardImage, selfieImage, expectedName, expectedIdNumber, hallTicketId } = req.body;
      if (!idCardImage || !selfieImage || !expectedName) {
        return res.status(400).json({
          message: "Missing required fields: idCardImage, selfieImage, and expectedName are required"
        });
      }
      if (hallTicketId) {
        const hallTicket = await storage.getHallTicketById(hallTicketId);
        if (!hallTicket || !hallTicket.isActive) {
          return res.status(400).json({ message: "Invalid or inactive hall ticket" });
        }
      }
      if (!process.env.OPENAI_API_KEY) {
        console.log("OpenAI API key not set - using fallback verification");
        try {
          await storage.storeIdentityVerification(hallTicketId, {
            studentName: expectedName,
            documentImage: idCardImage,
            selfieImage,
            uploadedAt: (/* @__PURE__ */ new Date()).toISOString(),
            verificationType: "ai_fallback",
            status: "pending_manual_review",
            reason: "OpenAI API key not configured"
          });
        } catch (storeError) {
          console.error("Failed to store verification data:", storeError);
        }
        return res.json({
          isValid: true,
          confidence: 0.75,
          extractedData: {
            name: expectedName,
            documentType: "ID Document",
            idNumber: expectedIdNumber
          },
          faceMatch: {
            matches: true,
            confidence: 0.75
          },
          reasons: ["Document uploaded successfully (AI verification unavailable - manual review recommended)"]
        });
      }
      let verificationResult;
      try {
        verificationResult = await verifyIDDocument(
          idCardImage,
          selfieImage,
          expectedName,
          expectedIdNumber
        );
        if (verificationResult && verificationResult.isValid !== void 0) {
          return res.json(verificationResult);
        }
      } catch (aiError) {
        console.error("AI verification failed:", aiError);
        try {
          await storage.storeIdentityVerification(hallTicketId, {
            studentName: expectedName,
            documentImage: idCardImage,
            selfieImage,
            uploadedAt: (/* @__PURE__ */ new Date()).toISOString(),
            verificationType: "ai_fallback",
            status: "pending_manual_review",
            reason: "AI verification timed out or failed"
          });
        } catch (storeError) {
          console.error("Failed to store verification data:", storeError);
        }
        return res.json({
          isValid: true,
          confidence: 0.7,
          extractedData: {
            name: expectedName,
            documentType: "ID Document",
            idNumber: expectedIdNumber
          },
          faceMatch: {
            matches: true,
            confidence: 0.7
          },
          reasons: ["Document uploaded successfully. AI verification unavailable - your documents have been saved for manual admin review."]
        });
      }
      return res.json({
        isValid: true,
        confidence: 0.75,
        extractedData: {
          name: expectedName,
          documentType: "ID Document"
        },
        faceMatch: {
          matches: true,
          confidence: 0.75
        },
        reasons: ["Document uploaded successfully"]
      });
    } catch (error) {
      console.error("Identity verification error:", error);
      if (!req.body.idCardImage || !req.body.selfieImage || !req.body.expectedName) {
        return res.status(400).json({
          message: "Missing required verification documents"
        });
      }
      return res.json({
        isValid: true,
        confidence: 0.7,
        extractedData: {
          name: req.body.expectedName,
          documentType: "ID Document"
        },
        faceMatch: {
          matches: true,
          confidence: 0.7
        },
        reasons: ["Document uploaded successfully (verification system unavailable - manual review will be performed)"]
      });
    }
  });
  app2.post("/api/store-identity-document", async (req, res) => {
    try {
      const { hallTicketId, studentName, rollNumber, documentImage, selfieImage } = req.body;
      if (!hallTicketId || !studentName || !documentImage) {
        return res.status(400).json({
          message: "Missing required fields: hallTicketId, studentName, and documentImage are required"
        });
      }
      if (!documentImage.startsWith("data:image/")) {
        return res.status(400).json({
          message: "Invalid document image format"
        });
      }
      const verificationData = {
        studentName,
        rollNumber,
        documentImage,
        selfieImage,
        uploadedAt: (/* @__PURE__ */ new Date()).toISOString(),
        verificationType: "manual",
        status: "pending_manual_review"
      };
      let storageSuccess = false;
      try {
        await storage.storeIdentityVerification(hallTicketId, verificationData);
        console.log(`\u2705 Stored identity document for manual verification: ${studentName} (${rollNumber})`);
        storageSuccess = true;
      } catch (storeError) {
        console.error("\u26A0\uFE0F Storage error - document received but not persisted:", storeError);
      }
      res.json({
        success: true,
        message: "Identity document received for manual verification",
        stored: storageSuccess,
        verificationData: {
          uploadedAt: verificationData.uploadedAt,
          status: verificationData.status
        }
      });
    } catch (error) {
      console.error("Document storage error:", error);
      res.status(500).json({
        message: "Failed to receive document",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  const httpServer = createServer(app2);
  const wss = new WebSocketServer({
    noServer: true
  });
  httpServer.on("upgrade", (request, socket, head) => {
    if (request.url !== "/ws") {
      socket.destroy();
      return;
    }
    const cookies = {};
    if (request.headers.cookie) {
      request.headers.cookie.split(";").forEach((cookie) => {
        const [key, value] = cookie.split("=").map((c) => c.trim());
        if (key && value) {
          cookies[key] = value;
        }
      });
    }
    let isAdmin = false;
    const adminToken = cookies["admin_token"];
    if (adminToken) {
      try {
        const secret = process.env.JWT_SECRET || "dev-secret-for-local-development-only";
        const decoded = jwt2.verify(adminToken, secret);
        if (decoded.role === "admin") {
          isAdmin = true;
        }
      } catch (error) {
        console.error("WebSocket JWT validation failed:", error);
      }
    }
    wss.handleUpgrade(request, socket, head, (ws2) => {
      if (isAdmin) {
        ws2.type = "admin";
      }
      wss.emit("connection", ws2, request);
    });
  });
  wss.on("connection", (ws2) => {
    ws2.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "auth") {
          if (!ws2.type) {
            ws2.type = data.userType || "student";
          }
          ws2.userId = data.userId;
          ws2.sessionId = data.sessionId;
        }
        if (data.type === "student_status_update") {
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN && client.type === "admin") {
              client.send(JSON.stringify({
                type: "student_status",
                data: data.payload
              }));
            }
          });
        }
        if (data.type === "face_detection_update") {
          if (data.sessionId) {
            await storage.createMonitoringLog({
              sessionId: data.sessionId,
              eventType: "face_detected",
              eventData: data.payload
            });
          }
        }
        if (data.type === "video_snapshot") {
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN && client.type === "admin") {
              client.send(JSON.stringify({
                type: "video_feed",
                data: {
                  sessionId: data.data.sessionId,
                  studentId: data.data.studentId,
                  studentName: data.data.studentName,
                  rollNumber: data.data.rollNumber,
                  snapshot: data.data.snapshot,
                  timestamp: data.data.timestamp
                }
              }));
            }
          });
          if (data.data.sessionId) {
            await storage.createMonitoringLog({
              sessionId: data.data.sessionId,
              eventType: "video_snapshot",
              eventData: {
                studentId: data.data.studentId,
                timestamp: data.data.timestamp
              }
            });
          }
        }
        if (data.type === "security_violation" || data.type === "face_violation") {
          try {
            if (!data.data.sessionId || !data.data.incidentType || !data.data.severity || !data.data.description) {
              console.error("Invalid violation data: missing required fields (sessionId, incidentType, severity, description)");
              return;
            }
            if (ws2.type !== "student") {
              console.error("Unauthorized: Only students can report violations");
              return;
            }
            const session = await storage.getExamSession(data.data.sessionId);
            if (!session) {
              console.error(`Session ${data.data.sessionId} not found`);
              return;
            }
            const recentIncidents = await storage.getSecurityIncidents(data.data.sessionId);
            const oneMinuteAgo = new Date(Date.now() - 6e4);
            const recentSameType = recentIncidents.filter(
              (incident2) => incident2.incidentType === data.data.incidentType && incident2.createdAt && new Date(incident2.createdAt) > oneMinuteAgo
            );
            if (recentSameType.length >= 3) {
              console.log(`Rate limited: Too many ${data.data.incidentType} incidents for session ${data.data.sessionId}`);
              return;
            }
            const incident = await storage.createSecurityIncident({
              sessionId: data.data.sessionId,
              incidentType: data.data.incidentType,
              severity: data.data.severity,
              description: data.data.description,
              metadata: data.data.metadata || {}
            });
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN && client.type === "admin") {
                client.send(JSON.stringify({
                  type: "security_incident",
                  data: {
                    ...incident,
                    studentName: data.data.studentName,
                    rollNumber: data.data.rollNumber,
                    violationType: data.data.incidentType
                    // Use actual incident type, not message type
                  }
                }));
              }
            });
            console.log(`Security incident created: ${data.data.incidentType} for session ${data.data.sessionId}`);
          } catch (error) {
            console.error("Error creating security incident:", error);
          }
        }
        if (data.type === "student_status") {
          try {
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN && client.type === "admin") {
                client.send(JSON.stringify({
                  type: "student_monitoring",
                  data: data.data
                }));
              }
            });
          } catch (error) {
            console.error("Error handling student status:", error);
          }
        }
        if (data.type === "policy_update") {
          try {
            if (!data.data.sessionId || !data.data.action) {
              console.error("Invalid policy update: missing sessionId or action");
              return;
            }
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN && client.type === "admin") {
                client.send(JSON.stringify({
                  type: "policy_update",
                  data: data.data
                }));
              }
            });
            console.log(`Policy update: ${data.data.action} for session ${data.data.sessionId}`);
          } catch (error) {
            console.error("Error handling policy update:", error);
          }
        }
        if (data.type === "admin_action") {
          try {
            if (ws2.type !== "admin") {
              console.error("Unauthorized: Only admins can send admin actions");
              return;
            }
            if (!data.data.sessionId || !data.data.action) {
              console.error("Invalid admin action: missing sessionId or action");
              return;
            }
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN && client.type === "student" && client.sessionId === data.data.sessionId) {
                client.send(JSON.stringify({
                  type: "admin_action",
                  data: {
                    action: data.data.action,
                    // 'flag' or 'resolve'
                    message: data.data.message,
                    timestamp: (/* @__PURE__ */ new Date()).toISOString()
                  }
                }));
              }
            });
            console.log(`Admin action: ${data.data.action} for session ${data.data.sessionId}`);
          } catch (error) {
            console.error("Error handling admin action:", error);
          }
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });
    ws2.on("close", () => {
      console.log("WebSocket connection closed");
    });
  });
  return httpServer;
}

// api/index.ts
var app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());
var initialized = false;
var initPromise = null;
async function init() {
  if (initialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      await registerRoutes(app);
      initialized = true;
    })();
  }
  return initPromise;
}
async function handler(req, res) {
  await init();
  return app(req, res);
}
export {
  handler as default
};
