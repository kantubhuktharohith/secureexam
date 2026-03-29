import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";


// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("student"), // 'admin' | 'student'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Hall tickets table
export const hallTickets = pgTable("hall_tickets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  hallTicketId: varchar("hall_ticket_id").notNull().unique(),
  examName: varchar("exam_name").notNull(),
  examDate: timestamp("exam_date").notNull(),
  duration: integer("duration").notNull(), // in minutes
  totalQuestions: integer("total_questions").notNull(),
  rollNumber: varchar("roll_number").notNull(),
  studentName: varchar("student_name").notNull(),
  studentEmail: varchar("student_email").notNull(),
  studentIdBarcode: varchar("student_id_barcode"), // Student ID card barcode for verification
  idCardImageUrl: text("id_card_image_url"), // URL/path to uploaded student ID card image
  qrCodeData: text("qr_code_data").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("hall_ticket_id_idx").on(table.hallTicketId),
  index("roll_number_idx").on(table.rollNumber),
  index("qr_code_data_idx").on(table.qrCodeData),
  index("is_active_idx").on(table.isActive),
]);

// Exam sessions table
export const examSessions = pgTable("exam_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  hallTicketId: uuid("hall_ticket_id").notNull().references(() => hallTickets.id),
  studentId: varchar("student_id").notNull().references(() => users.id),
  status: varchar("status").notNull().default("not_started"), // 'not_started' | 'in_progress' | 'paused' | 'completed' | 'submitted'
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  currentQuestion: integer("current_question").default(1),
  answers: jsonb("answers").default({}),
  questionIds: jsonb("question_ids").default([]), // array of question UUIDs for this session
  timeRemaining: integer("time_remaining"), // in seconds
  isVerified: boolean("is_verified").default(false),
  verificationData: jsonb("verification_data"), // photos, ID verification results
  score: integer("score"), // auto-calculated score
  totalMarks: integer("total_marks"), // max possible marks
  cheatingRiskScore: integer("cheating_risk_score"), // 0-100 risk score
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Security incidents table
export const securityIncidents = pgTable("security_incidents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id").notNull().references(() => examSessions.id),
  incidentType: varchar("incident_type").notNull(), // 'multiple_faces' | 'looking_away' | 'network_disconnect' | 'device_detected' | 'voice_detected' | 'phone_detected'
  severity: varchar("severity").notNull(), // 'low' | 'medium' | 'high' | 'critical'
  description: text("description").notNull(),
  metadata: jsonb("metadata"), // detection confidence, duration, etc.
  snapshotUrl: varchar("snapshot_url"),
  isResolved: boolean("is_resolved").default(false),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Monitoring logs table
export const monitoringLogs = pgTable("monitoring_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id").notNull().references(() => examSessions.id),
  eventType: varchar("event_type").notNull(), // 'face_detected' | 'attention_warning' | 'network_status' | 'question_answered'
  eventData: jsonb("event_data"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Questions table — supports MCQ, Coding, and Subjective
export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  examName: varchar("exam_name").notNull(),
  questionText: text("question_text").notNull(),
  options: jsonb("options"), // array of options (MCQ only, nullable for coding/subjective)
  correctAnswer: varchar("correct_answer"), // MCQ correct option or short answer (nullable for coding/subjective)
  questionType: varchar("question_type").notNull().default("multiple_choice"), // 'multiple_choice' | 'coding' | 'subjective'
  difficulty: varchar("difficulty").default("medium"),
  subject: varchar("subject").notNull(),
  topic: varchar("topic").notNull(),
  marks: integer("marks").notNull().default(1),
  // Coding question fields
  starterCode: text("starter_code"), // initial code template
  testCases: jsonb("test_cases"), // [{input: string, expectedOutput: string, isHidden: boolean}]
  allowedLanguages: jsonb("allowed_languages"), // ["python", "javascript", "java", "cpp"]
  // Subjective question fields
  rubric: jsonb("rubric"), // {keywords: string[], gradingCriteria: string, maxMarks: number, sampleAnswer: string}
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Proctoring snapshots table — webcam captures for AI analysis
export const proctoringSnapshots = pgTable("proctoring_snapshots", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id").notNull().references(() => examSessions.id),
  imageData: text("image_data").notNull(), // base64 encoded image
  faceCount: integer("face_count").default(0),
  gazeDirection: varchar("gaze_direction"), // 'center' | 'left' | 'right' | 'up' | 'down'
  aiAnalysis: jsonb("ai_analysis"), // {suspicious: bool, objects: [], riskLevel, reason}
  timestamp: timestamp("timestamp").defaultNow(),
});

// Code submissions table — for coding questions
export const codeSubmissions = pgTable("code_submissions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id").notNull().references(() => examSessions.id),
  questionId: uuid("question_id").notNull().references(() => questions.id),
  code: text("code").notNull(),
  language: varchar("language").notNull(), // 'python' | 'javascript' | 'java' | 'cpp'
  output: text("output"),
  testResults: jsonb("test_results"), // [{input, expectedOutput, actualOutput, passed}]
  executionTime: integer("execution_time"), // in milliseconds
  score: integer("score"), // auto-calculated score for this submission
  createdAt: timestamp("created_at").defaultNow(),
});

// Analytics reports table — cached analytics data
export const analyticsReports = pgTable("analytics_reports", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  examName: varchar("exam_name").notNull(),
  reportType: varchar("report_type").notNull(), // 'score_distribution' | 'subject_performance' | 'cheating_report' | 'time_analysis'
  data: jsonb("data").notNull(), // cached report data
  generatedAt: timestamp("generated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  createdHallTickets: many(hallTickets),
  examSessions: many(examSessions),
  resolvedIncidents: many(securityIncidents),
}));

export const hallTicketsRelations = relations(hallTickets, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [hallTickets.createdBy],
    references: [users.id],
  }),
  examSessions: many(examSessions),
}));

export const examSessionsRelations = relations(examSessions, ({ one, many }) => ({
  hallTicket: one(hallTickets, {
    fields: [examSessions.hallTicketId],
    references: [hallTickets.id],
  }),
  student: one(users, {
    fields: [examSessions.studentId],
    references: [users.id],
  }),
  securityIncidents: many(securityIncidents),
  monitoringLogs: many(monitoringLogs),
  proctoringSnapshots: many(proctoringSnapshots),
  codeSubmissions: many(codeSubmissions),
}));

export const securityIncidentsRelations = relations(securityIncidents, ({ one }) => ({
  session: one(examSessions, {
    fields: [securityIncidents.sessionId],
    references: [examSessions.id],
  }),
  resolvedBy: one(users, {
    fields: [securityIncidents.resolvedBy],
    references: [users.id],
  }),
}));

export const monitoringLogsRelations = relations(monitoringLogs, ({ one }) => ({
  session: one(examSessions, {
    fields: [monitoringLogs.sessionId],
    references: [examSessions.id],
  }),
}));

export const proctoringSnapshotsRelations = relations(proctoringSnapshots, ({ one }) => ({
  session: one(examSessions, {
    fields: [proctoringSnapshots.sessionId],
    references: [examSessions.id],
  }),
}));

export const codeSubmissionsRelations = relations(codeSubmissions, ({ one }) => ({
  session: one(examSessions, {
    fields: [codeSubmissions.sessionId],
    references: [examSessions.id],
  }),
  question: one(questions, {
    fields: [codeSubmissions.questionId],
    references: [questions.id],
  }),
}));

// Insert schemas
export const insertHallTicketSchema = createInsertSchema(hallTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Client input schema for hall ticket creation (only fields the client sends)
export const clientHallTicketSchema = z.object({
  examName: z.string().min(1, "Exam name is required"),
  examDate: z.string().min(1, "Exam date is required"), // Will be converted to Date on server
  duration: z.number().min(1, "Duration must be at least 1 minute"),
  totalQuestions: z.number().min(1, "Total questions must be at least 1"),
  rollNumber: z.string().min(1, "Roll number is required"),
  studentName: z.string().min(1, "Student name is required"),
  studentEmail: z.string().email("Valid email is required"),
  studentIdBarcode: z.string().optional(), // Optional: Student ID card barcode for verification
  idCardImageUrl: z.string().optional(), // Optional: URL to uploaded student ID card image
});

export const insertExamSessionSchema = createInsertSchema(examSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSecurityIncidentSchema = createInsertSchema(securityIncidents).omit({
  id: true,
  createdAt: true,
});

export const insertMonitoringLogSchema = createInsertSchema(monitoringLogs).omit({
  id: true,
  timestamp: true,
});

export const insertQuestionSchema = createInsertSchema(questions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProctoringSnapshotSchema = createInsertSchema(proctoringSnapshots).omit({
  id: true,
  timestamp: true,
});

export const insertCodeSubmissionSchema = createInsertSchema(codeSubmissions).omit({
  id: true,
  createdAt: true,
});

export const insertAnalyticsReportSchema = createInsertSchema(analyticsReports).omit({
  id: true,
  generatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertHallTicket = z.infer<typeof insertHallTicketSchema>;
export type ClientHallTicket = z.infer<typeof clientHallTicketSchema>;
export type HallTicket = typeof hallTickets.$inferSelect;
export type InsertExamSession = z.infer<typeof insertExamSessionSchema>;
export type ExamSession = typeof examSessions.$inferSelect;
export type InsertSecurityIncident = z.infer<typeof insertSecurityIncidentSchema>;
export type SecurityIncident = typeof securityIncidents.$inferSelect;
export type InsertMonitoringLog = z.infer<typeof insertMonitoringLogSchema>;
export type MonitoringLog = typeof monitoringLogs.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questions.$inferSelect;
export type InsertProctoringSnapshot = z.infer<typeof insertProctoringSnapshotSchema>;
export type ProctoringSnapshot = typeof proctoringSnapshots.$inferSelect;
export type InsertCodeSubmission = z.infer<typeof insertCodeSubmissionSchema>;
export type CodeSubmission = typeof codeSubmissions.$inferSelect;
export type InsertAnalyticsReport = z.infer<typeof insertAnalyticsReportSchema>;
export type AnalyticsReport = typeof analyticsReports.$inferSelect;
