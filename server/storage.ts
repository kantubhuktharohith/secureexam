import {
  users,
  hallTickets,
  examSessions,
  securityIncidents,
  monitoringLogs,
  questions,
  proctoringSnapshots,
  codeSubmissions,
  analyticsReports,
  type User,
  type UpsertUser,
  type HallTicket,
  type InsertHallTicket,
  type ExamSession,
  type InsertExamSession,
  type SecurityIncident,
  type InsertSecurityIncident,
  type MonitoringLog,
  type InsertMonitoringLog,
  type Question,
  type InsertQuestion,
  type ProctoringSnapshot,
  type InsertProctoringSnapshot,
  type CodeSubmission,
  type InsertCodeSubmission,
  type AnalyticsReport,
  type InsertAnalyticsReport,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sql, inArray } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Hall ticket operations
  createHallTicket(hallTicket: InsertHallTicket): Promise<HallTicket>;
  getHallTicketByQR(qrData: string): Promise<HallTicket | undefined>;
  getHallTicketById(id: string): Promise<HallTicket | undefined>;
  getHallTicketByIdAndRoll(hallTicketId: string, rollNumber: string): Promise<HallTicket | undefined>;
  getHallTicketsByCreator(creatorId: string): Promise<HallTicket[]>;
  updateHallTicket(id: string, updates: Partial<InsertHallTicket>): Promise<HallTicket>;
  deleteHallTicket(id: string): Promise<void>;
  
  // Exam session operations
  createExamSession(session: InsertExamSession): Promise<ExamSession>;
  getExamSession(id: string): Promise<ExamSession | undefined>;
  getExamSessionByStudent(studentId: string, hallTicketId: string): Promise<ExamSession | undefined>;
  updateExamSession(id: string, updates: Partial<InsertExamSession>): Promise<ExamSession>;
  getActiveExamSessions(): Promise<ExamSession[]>;
  getAllExamSessions(): Promise<any[]>;
  getExamSessionsByExam(examName: string): Promise<any[]>;
  
  // Security incident operations
  createSecurityIncident(incident: InsertSecurityIncident): Promise<SecurityIncident>;
  getSecurityIncidents(sessionId?: string): Promise<SecurityIncident[]>;
  updateSecurityIncident(id: string, updates: Partial<InsertSecurityIncident>): Promise<SecurityIncident>;
  getActiveSecurityIncidents(): Promise<SecurityIncident[]>;
  
  // Monitoring log operations
  createMonitoringLog(log: InsertMonitoringLog): Promise<MonitoringLog>;
  getMonitoringLogs(sessionId: string): Promise<MonitoringLog[]>;
  
  // Question operations
  createQuestion(question: InsertQuestion): Promise<Question>;
  getAllQuestions(): Promise<Question[]>;
  updateQuestion(id: string, data: InsertQuestion): Promise<Question>;
  deleteQuestion(id: string): Promise<void>;
  getQuestionsByExam(examName: string): Promise<Question[]>;
  getRandomQuestions(examName: string, limit: number): Promise<Question[]>;
  getQuestionsByIds(ids: string[]): Promise<Question[]>;
  
  // Proctoring snapshot operations
  createProctoringSnapshot(snapshot: InsertProctoringSnapshot): Promise<ProctoringSnapshot>;
  getProctoringSnapshots(sessionId: string): Promise<ProctoringSnapshot[]>;
  getUnanalyzedSnapshots(limit: number): Promise<ProctoringSnapshot[]>;
  updateProctoringSnapshot(id: string, updates: Partial<InsertProctoringSnapshot>): Promise<ProctoringSnapshot>;
  
  // Code submission operations
  createCodeSubmission(submission: InsertCodeSubmission): Promise<CodeSubmission>;
  getCodeSubmissions(sessionId: string): Promise<CodeSubmission[]>;
  getCodeSubmissionByQuestion(sessionId: string, questionId: string): Promise<CodeSubmission | undefined>;
  
  // Analytics operations
  createAnalyticsReport(report: InsertAnalyticsReport): Promise<AnalyticsReport>;
  getAnalyticsReport(examName: string, reportType: string): Promise<AnalyticsReport | undefined>;
  
  // Analytics
  getExamStats(): Promise<{
    activeStudents: number;
    totalSessions: number;
    securityAlerts: number;
    averageProgress: number;
  }>;

  // Identity verification storage
  storeIdentityVerification(hallTicketId: string, verificationData: any): Promise<void>;
  
  // Risk score
  calculateRiskScore(sessionId: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // separate id so it is NOT updated if conflict happens
    const { id, ...rest } = userData;

    const [user] = await db
      .insert(users)
      .values(userData) // insert can still use id
      .onConflictDoUpdate({
        target: users.email,  // conflict is on email
        set: {
          ...rest,            // update all fields EXCEPT id
          updatedAt: new Date(),
        },
      })
      .returning();

    return user;
  }


  // Hall ticket operations
  async createHallTicket(hallTicket: InsertHallTicket): Promise<HallTicket> {
    const [ticket] = await db.insert(hallTickets).values(hallTicket).returning();
    return ticket;
  }

  async getHallTicketByQR(qrData: string): Promise<HallTicket | undefined> {
    const [ticket] = await db
      .select()
      .from(hallTickets)
      .where(and(eq(hallTickets.qrCodeData, qrData), eq(hallTickets.isActive, true)));
    return ticket;
  }

  async getHallTicketById(id: string): Promise<HallTicket | undefined> {
    const [ticket] = await db.select().from(hallTickets).where(eq(hallTickets.id, id));
    return ticket;
  }

  async getHallTicketsByCreator(creatorId: string): Promise<HallTicket[]> {
    return await db
      .select()
      .from(hallTickets)
      .where(eq(hallTickets.createdBy, creatorId))
      .orderBy(desc(hallTickets.createdAt));
  }

  async updateHallTicket(id: string, updates: Partial<InsertHallTicket>): Promise<HallTicket> {
    const [ticket] = await db
      .update(hallTickets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(hallTickets.id, id))
      .returning();
    return ticket;
  }

  async getHallTicketByIdAndRoll(hallTicketId: string, rollNumber: string): Promise<HallTicket | undefined> {
    const [ticket] = await db
      .select()
      .from(hallTickets)
      .where(and(
        eq(hallTickets.hallTicketId, hallTicketId),
        eq(hallTickets.rollNumber, rollNumber),
        eq(hallTickets.isActive, true)
      ));
    return ticket;
  }

  async deleteHallTicket(id: string): Promise<void> {
    // First, get all exam sessions that reference this hall ticket
    const relatedSessions = await db
      .select()
      .from(examSessions)
      .where(eq(examSessions.hallTicketId, id));

    // Delete related records for each session (cascade)
    for (const session of relatedSessions) {
      await db.delete(securityIncidents).where(eq(securityIncidents.sessionId, session.id));
      await db.delete(monitoringLogs).where(eq(monitoringLogs.sessionId, session.id));
      await db.delete(proctoringSnapshots).where(eq(proctoringSnapshots.sessionId, session.id));
      await db.delete(codeSubmissions).where(eq(codeSubmissions.sessionId, session.id));
    }

    // Delete all exam sessions that reference this hall ticket
    await db.delete(examSessions).where(eq(examSessions.hallTicketId, id));

    // Finally, delete the hall ticket
    await db.delete(hallTickets).where(eq(hallTickets.id, id));
  }

  // Exam session operations
  async createExamSession(session: InsertExamSession): Promise<ExamSession> {
    const [examSession] = await db.insert(examSessions).values(session).returning();
    return examSession;
  }

  async getExamSession(id: string): Promise<ExamSession | undefined> {
    const [session] = await db.select().from(examSessions).where(eq(examSessions.id, id));
    return session;
  }

  async getExamSessionByStudent(studentId: string, hallTicketId: string): Promise<ExamSession | undefined> {
    const [session] = await db
      .select()
      .from(examSessions)
      .where(and(eq(examSessions.studentId, studentId), eq(examSessions.hallTicketId, hallTicketId)));
    return session;
  }

  async updateExamSession(id: string, updates: Partial<InsertExamSession>): Promise<ExamSession> {
    const [session] = await db
      .update(examSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(examSessions.id, id))
      .returning();
    return session;
  }

  async getAllExamSessions(): Promise<any[]> {
    return await db
      .select({
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
        score: examSessions.score,
        totalMarks: examSessions.totalMarks,
        cheatingRiskScore: examSessions.cheatingRiskScore,
        createdAt: examSessions.createdAt,
        updatedAt: examSessions.updatedAt,
        studentName: hallTickets.studentName,
        studentLastName: sql<string | null>`NULL`,
        studentEmail: users.email,
        hallTicketNumber: hallTickets.hallTicketId,
        examName: hallTickets.examName,
        rollNumber: hallTickets.rollNumber
      })
      .from(examSessions)
      .leftJoin(users, eq(users.id, examSessions.studentId))
      .leftJoin(hallTickets, eq(hallTickets.id, examSessions.hallTicketId))
      .orderBy(desc(examSessions.startTime));
  }

  async getActiveExamSessions(): Promise<any[]> {
    return await db
      .select({
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
        score: examSessions.score,
        totalMarks: examSessions.totalMarks,
        cheatingRiskScore: examSessions.cheatingRiskScore,
        createdAt: examSessions.createdAt,
        updatedAt: examSessions.updatedAt,
        studentName: hallTickets.studentName,
        studentLastName: sql<string | null>`NULL`,
        studentEmail: users.email,
        hallTicketNumber: hallTickets.hallTicketId,
        examName: hallTickets.examName,
        rollNumber: hallTickets.rollNumber
      })
      .from(examSessions)
      .leftJoin(users, eq(users.id, examSessions.studentId))
      .leftJoin(hallTickets, eq(hallTickets.id, examSessions.hallTicketId))
      .where(eq(examSessions.status, "in_progress"))
      .orderBy(desc(examSessions.startTime));
  }

  async getExamSessionsByExam(examName: string): Promise<any[]> {
    return await db
      .select({
        id: examSessions.id,
        hallTicketId: examSessions.hallTicketId,
        studentId: examSessions.studentId,
        status: examSessions.status,
        startTime: examSessions.startTime,
        endTime: examSessions.endTime,
        answers: examSessions.answers,
        questionIds: examSessions.questionIds,
        score: examSessions.score,
        totalMarks: examSessions.totalMarks,
        cheatingRiskScore: examSessions.cheatingRiskScore,
        createdAt: examSessions.createdAt,
        studentName: hallTickets.studentName,
        studentEmail: users.email,
        examName: hallTickets.examName,
        rollNumber: hallTickets.rollNumber,
      })
      .from(examSessions)
      .leftJoin(users, eq(users.id, examSessions.studentId))
      .leftJoin(hallTickets, eq(hallTickets.id, examSessions.hallTicketId))
      .where(eq(hallTickets.examName, examName))
      .orderBy(desc(examSessions.startTime));
  }

  // Security incident operations
  async createSecurityIncident(incident: InsertSecurityIncident): Promise<SecurityIncident> {
    const [securityIncident] = await db.insert(securityIncidents).values(incident).returning();
    return securityIncident;
  }

  async getSecurityIncidents(sessionId?: string): Promise<SecurityIncident[]> {
    const query = db.select().from(securityIncidents);
    if (sessionId) {
      return await query.where(eq(securityIncidents.sessionId, sessionId)).orderBy(desc(securityIncidents.createdAt));
    }
    return await query.orderBy(desc(securityIncidents.createdAt));
  }

  async updateSecurityIncident(id: string, updates: Partial<InsertSecurityIncident>): Promise<SecurityIncident> {
    const [incident] = await db
      .update(securityIncidents)
      .set(updates)
      .where(eq(securityIncidents.id, id))
      .returning();
    return incident;
  }

  async getActiveSecurityIncidents(): Promise<SecurityIncident[]> {
    return await db
      .select()
      .from(securityIncidents)
      .where(eq(securityIncidents.isResolved, false))
      .orderBy(desc(securityIncidents.createdAt));
  }

  // Monitoring log operations
  async createMonitoringLog(log: InsertMonitoringLog): Promise<MonitoringLog> {
    const [monitoringLog] = await db.insert(monitoringLogs).values(log).returning();
    return monitoringLog;
  }

  async getMonitoringLogs(sessionId: string): Promise<MonitoringLog[]> {
    return await db
      .select()
      .from(monitoringLogs)
      .where(eq(monitoringLogs.sessionId, sessionId))
      .orderBy(desc(monitoringLogs.timestamp));
  }

  // Question operations
  async createQuestion(question: InsertQuestion): Promise<Question> {
    const [newQuestion] = await db.insert(questions).values(question).returning();
    return newQuestion;
  }

  async getQuestionsByExam(examName: string): Promise<Question[]> {
    return await db.select().from(questions).where(eq(questions.examName, examName));
  }

  async getRandomQuestions(examName: string, limit: number): Promise<Question[]> {
    return await db
      .select()
      .from(questions)
      .where(eq(questions.examName, examName))
      .orderBy(sql`RANDOM()`)
      .limit(limit);
  }

  async getAllQuestions(): Promise<Question[]> {
    return await db
      .select()
      .from(questions)
      .orderBy(desc(questions.createdAt));
  }

  async updateQuestion(id: string, data: InsertQuestion): Promise<Question> {
    const [question] = await db
      .update(questions)
      .set(data)
      .where(eq(questions.id, id))
      .returning();
    return question;
  }

  async deleteQuestion(id: string): Promise<void> {
    await db.delete(questions).where(eq(questions.id, id));
  }

  async getQuestionsByIds(ids: string[]): Promise<Question[]> {
    if (ids.length === 0) return [];
    return await db.select().from(questions).where(inArray(questions.id, ids));
  }

  // Proctoring snapshot operations
  async createProctoringSnapshot(snapshot: InsertProctoringSnapshot): Promise<ProctoringSnapshot> {
    const [newSnapshot] = await db.insert(proctoringSnapshots).values(snapshot).returning();
    return newSnapshot;
  }

  async getProctoringSnapshots(sessionId: string): Promise<ProctoringSnapshot[]> {
    return await db
      .select()
      .from(proctoringSnapshots)
      .where(eq(proctoringSnapshots.sessionId, sessionId))
      .orderBy(desc(proctoringSnapshots.timestamp));
  }

  async getUnanalyzedSnapshots(limit: number): Promise<ProctoringSnapshot[]> {
    return await db
      .select()
      .from(proctoringSnapshots)
      .where(sql`${proctoringSnapshots.aiAnalysis} IS NULL`)
      .orderBy(proctoringSnapshots.timestamp)
      .limit(limit);
  }

  async updateProctoringSnapshot(id: string, updates: Partial<InsertProctoringSnapshot>): Promise<ProctoringSnapshot> {
    const [snapshot] = await db
      .update(proctoringSnapshots)
      .set(updates)
      .where(eq(proctoringSnapshots.id, id))
      .returning();
    return snapshot;
  }

  // Code submission operations
  async createCodeSubmission(submission: InsertCodeSubmission): Promise<CodeSubmission> {
    const [newSubmission] = await db.insert(codeSubmissions).values(submission).returning();
    return newSubmission;
  }

  async getCodeSubmissions(sessionId: string): Promise<CodeSubmission[]> {
    return await db
      .select()
      .from(codeSubmissions)
      .where(eq(codeSubmissions.sessionId, sessionId))
      .orderBy(desc(codeSubmissions.createdAt));
  }

  async getCodeSubmissionByQuestion(sessionId: string, questionId: string): Promise<CodeSubmission | undefined> {
    const [submission] = await db
      .select()
      .from(codeSubmissions)
      .where(and(eq(codeSubmissions.sessionId, sessionId), eq(codeSubmissions.questionId, questionId)));
    return submission;
  }

  // Analytics report operations
  async createAnalyticsReport(report: InsertAnalyticsReport): Promise<AnalyticsReport> {
    const [newReport] = await db.insert(analyticsReports).values(report).returning();
    return newReport;
  }

  async getAnalyticsReport(examName: string, reportType: string): Promise<AnalyticsReport | undefined> {
    const [report] = await db
      .select()
      .from(analyticsReports)
      .where(and(eq(analyticsReports.examName, examName), eq(analyticsReports.reportType, reportType)))
      .orderBy(desc(analyticsReports.generatedAt))
      .limit(1);
    return report;
  }

  // Risk score calculation
  async calculateRiskScore(sessionId: string): Promise<number> {
    const incidents = await this.getSecurityIncidents(sessionId);
    
    if (incidents.length === 0) return 0;
    
    // Weighted scoring based on incident severity
    const severityWeights: Record<string, number> = {
      'low': 5,
      'medium': 15,
      'high': 25,
      'critical': 40,
    };
    
    let totalScore = 0;
    for (const incident of incidents) {
      totalScore += severityWeights[incident.severity] || 10;
    }
    
    // Cap at 100
    return Math.min(100, totalScore);
  }

  // Analytics
  async getExamStats(): Promise<{
    activeStudents: number;
    totalSessions: number;
    securityAlerts: number;
    averageProgress: number;
  }> {
    const [activeStudentsResult] = await db
      .select({ count: count() })
      .from(examSessions)
      .where(eq(examSessions.status, "in_progress"));

    const [totalSessionsResult] = await db.select({ count: count() }).from(examSessions);

    const [securityAlertsResult] = await db
      .select({ count: count() })
      .from(securityIncidents)
      .where(eq(securityIncidents.isResolved, false));

    const activeSessions = await db
      .select()
      .from(examSessions)
      .where(eq(examSessions.status, "in_progress"));

    let averageProgress = 0;
    if (activeSessions.length > 0) {
      const totalProgress = activeSessions.reduce((sum, session) => {
        const progress = session.currentQuestion || 1;
        return sum + progress;
      }, 0);
      averageProgress = Math.round((totalProgress / activeSessions.length) * 2);
    }

    return {
      activeStudents: activeStudentsResult.count,
      totalSessions: totalSessionsResult.count,
      securityAlerts: securityAlertsResult.count,
      averageProgress,
    };
  }

  // Store identity verification data for manual review
  async storeIdentityVerification(hallTicketId: string, verificationData: any): Promise<void> {
    try {
      console.log('Starting storeIdentityVerification for hall ticket:', hallTicketId);
      
      const hallTicket = await this.getHallTicketById(hallTicketId);
      if (!hallTicket) {
        console.warn('Hall ticket not found, but continuing to allow student access');
        return;
      }

      console.log('Hall ticket found:', hallTicket.hallTicketId, 'for student:', hallTicket.studentName);

      const studentEmail = hallTicket.studentEmail;
      let studentUser;
      try {
        studentUser = await db
          .select()
          .from(users)
          .where(eq(users.email, studentEmail))
          .limit(1);
      } catch (queryError) {
        console.error('Error querying user:', queryError);
        return;
      }

      let studentId = studentUser[0]?.id;

      if (!studentId) {
        console.log('Creating new user for email:', studentEmail);
        
        try {
          const userId = `student_${hallTicket.rollNumber}`;
          
          const nameParts = hallTicket.studentName.split(' ');
          const [newUser] = await db
            .insert(users)
            .values({
              id: userId,
              email: studentEmail,
              firstName: nameParts[0] || hallTicket.studentName,
              lastName: nameParts.slice(1).join(' ') || '',
              role: 'student',
            })
            .returning();
          studentId = newUser.id;
          console.log('Created new user with ID:', studentId);
        } catch (createError) {
          console.error('Error creating user (non-fatal):', createError);
          return;
        }
      } else {
        console.log('Found existing user with ID:', studentId);
      }

      let examSession;
      try {
        examSession = await this.getExamSessionByStudent(studentId, hallTicketId);
      } catch (sessionQueryError) {
        console.error('Error querying exam session:', sessionQueryError);
        return;
      }
      
      if (!examSession) {
        console.log('Creating new exam session for student:', studentId);
        try {
          examSession = await this.createExamSession({
            hallTicketId: hallTicketId,
            studentId: studentId,
            status: 'not_started',
            verificationData: verificationData,
            isVerified: true,
          });
          console.log('Created exam session with ID:', examSession.id);
        } catch (createSessionError) {
          console.error('Error creating exam session (non-fatal):', createSessionError);
          return;
        }
      } else {
        console.log('Updating existing exam session:', examSession.id);
        try {
          await this.updateExamSession(examSession.id, {
            verificationData: verificationData,
            isVerified: true,
          });
        } catch (updateError) {
          console.error('Error updating exam session (non-fatal):', updateError);
          return;
        }
      }

      console.log(`Successfully stored identity verification for hall ticket ${hallTicketId} in exam session ${examSession.id}`);
    } catch (error) {
      console.error('Error storing identity verification (non-fatal):', error);
      return;
    }
  }
}

export const storage = new DatabaseStorage();
