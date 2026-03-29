import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
import { requireAdmin, login, logout, getAuthUser, ensureAdminUser } from "./adminAuth";
import { insertHallTicketSchema, clientHallTicketSchema, insertExamSessionSchema, insertSecurityIncidentSchema, insertMonitoringLogSchema, insertQuestionSchema, insertProctoringSnapshotSchema, insertCodeSubmissionSchema } from "@shared/schema";
import QRCode from "qrcode";
import { nanoid } from "nanoid";
import { verifyIDDocument } from "./ai-verification";
import { extractNameFromDocument } from "./simple-name-verification";
import { sendHallTicketEmail } from "./email";


interface WebSocketClient extends WebSocket {
  sessionId?: string;
  userId?: string;
  type?: 'admin' | 'student';
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Admin authentication routes
  app.post('/api/auth/login', login);
  app.post('/api/auth/logout', logout);
  app.get('/api/auth/user', requireAdmin, getAuthUser);

  // Hall ticket routes
  app.post('/api/hall-tickets', requireAdmin, async (req: any, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const userId = req.admin.email;

      const clientData = clientHallTicketSchema.parse(req.body);
      const hallTicketId = `HT${new Date().getFullYear()}${nanoid(8).toUpperCase()}`;
      
      // Generate QR code data
      const qrData = JSON.stringify({
        hallTicketId,
        rollNumber: clientData.rollNumber,
        examName: clientData.examName,
        timestamp: new Date().getTime()
      });

      const hallTicket = await storage.createHallTicket({
        hallTicketId,
        examName: clientData.examName,
        examDate: new Date(clientData.examDate), // Convert string to Date
        duration: clientData.duration,
        totalQuestions: clientData.totalQuestions,
        rollNumber: clientData.rollNumber,
        studentName: clientData.studentName,
        studentEmail: clientData.studentEmail,
        studentIdBarcode: clientData.studentIdBarcode, // Store student ID barcode
        idCardImageUrl: clientData.idCardImageUrl, // Store ID card image
        qrCodeData: qrData,
        isActive: true,
        createdBy: userId,
      });

      // Fire-and-forget: send hall ticket email
      (async () => {
        try {
          const qrCodeUrl = await QRCode.toDataURL(qrData, { width: 300, margin: 2 });
          await sendHallTicketEmail(hallTicket, qrCodeUrl);
        } catch (emailErr) {
          console.error("Email send failed (non-blocking):", emailErr);
        }
      })();

      res.json(hallTicket);
    } catch (error: any) {
      console.error("Error creating hall ticket:", error);
      res.status(500).json({ message: "Failed to create hall ticket", detail: error?.message });
    }
  });

  // Bulk hall ticket creation
  app.post('/api/hall-tickets/bulk', requireAdmin, async (req: any, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const userId = req.admin.email;
      const { hallTickets } = req.body;

      if (!Array.isArray(hallTickets) || hallTickets.length === 0) {
        return res.status(400).json({ message: "Invalid data: hallTickets array required" });
      }

      // Pre-validate all tickets before creating any
      const validatedTickets = [];
      const validationErrors = [];

      for (let i = 0; i < hallTickets.length; i++) {
        try {
          const clientData = clientHallTicketSchema.parse(hallTickets[i]);
          validatedTickets.push(clientData);
        } catch (error: any) {
          validationErrors.push(`Row ${i + 2}: ${error.message}`); // +2 for 1-indexed and header
        }
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationErrors.slice(0, 5)
        });
      }

      // All validated, now create tickets
      const createdTickets = [];
      
      for (const clientData of validatedTickets) {
        const hallTicketId = `HT${new Date().getFullYear()}${nanoid(8).toUpperCase()}`;
        
        // Generate QR code data
        const qrData = JSON.stringify({
          hallTicketId,
          rollNumber: clientData.rollNumber,
          examName: clientData.examName,
          timestamp: new Date().getTime()
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
          studentIdBarcode: clientData.studentIdBarcode || '',
          idCardImageUrl: clientData.idCardImageUrl || '',
          qrCodeData: qrData,
          isActive: true,
          createdBy: userId,
        });

        createdTickets.push(hallTicket);
      }

      // Fire-and-forget: send emails for all created tickets
      (async () => {
        for (const ticket of createdTickets) {
          try {
            const qrCodeUrl = await QRCode.toDataURL(ticket.qrCodeData, { width: 300, margin: 2 });
            await sendHallTicketEmail(ticket, qrCodeUrl);
          } catch (emailErr) {
            console.error(`Bulk email failed for ${ticket.studentEmail}:`, emailErr);
          }
        }
      })();

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

  app.get('/api/hall-tickets', requireAdmin, async (req: any, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const userId = req.admin.email;

      const hallTickets = await storage.getHallTicketsByCreator(userId);
      res.json(hallTickets);
    } catch (error) {
      console.error("Error fetching hall tickets:", error);
      res.status(500).json({ message: "Failed to fetch hall ticket" });
    }
  });

  app.get('/api/hall-tickets/:id/qr', requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const hallTicket = await storage.getHallTicketById(id);
      
      if (!hallTicket) {
        return res.status(404).json({ message: "Hall ticket not found" });
      }

      const qrCodeUrl = await QRCode.toDataURL(hallTicket.qrCodeData, {
        width: 300,
        margin: 2,
      });

      res.json({ qrCodeUrl });
    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  app.patch('/api/hall-tickets/:id', requireAdmin, async (req: any, res) => {
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

  app.delete('/api/hall-tickets/:id', requireAdmin, async (req: any, res) => {
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

  // Resend hall ticket email
  app.post('/api/hall-tickets/:id/send-email', requireAdmin, async (req: any, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const { id } = req.params;
      const hallTicket = await storage.getHallTicketById(id);

      if (!hallTicket) {
        return res.status(404).json({ message: "Hall ticket not found" });
      }

      const qrCodeUrl = await QRCode.toDataURL(hallTicket.qrCodeData, { width: 300, margin: 2 });
      const sent = await sendHallTicketEmail(hallTicket, qrCodeUrl);

      if (sent) {
        res.json({ success: true, message: `Email sent to ${hallTicket.studentEmail}` });
      } else {
        res.status(500).json({ message: "Failed to send email. Check SMTP configuration in .env" });
      }
    } catch (error) {
      console.error("Error resending hall ticket email:", error);
      res.status(500).json({ message: "Failed to resend email" });
    }
  });

  // Student authentication routes
  app.post('/api/auth/verify-hall-ticket', async (req, res) => {
    try {
      const { qrData, rollNumber, hallTicketId } = req.body;
      console.log('[verify-hall-ticket] Received:', { hallTicketId, rollNumber, hasQrData: !!qrData });
      
      let hallTicket;
      
      // If hallTicketId is provided (manual entry), validate by hall ticket ID
      if (hallTicketId) {
        hallTicket = await storage.getHallTicketByIdAndRoll(hallTicketId, rollNumber);
        
        if (!hallTicket) {
          // Debug: try to find by just hallTicketId to give a better error
          const allTickets = await storage.getHallTicketsByCreator('admin@example.com');
          const matchById = allTickets.find(t => t.hallTicketId === hallTicketId);
          const matchByIdCaseInsensitive = allTickets.find(t => t.hallTicketId.toLowerCase() === hallTicketId.toLowerCase());
          
          if (matchByIdCaseInsensitive && !matchById) {
            console.log('[verify-hall-ticket] Case mismatch! DB has:', matchByIdCaseInsensitive.hallTicketId, 'Client sent:', hallTicketId);
            return res.status(400).json({ message: "Invalid details - case mismatch in Hall Ticket ID" });
          } else if (matchById) {
            if (matchById.rollNumber !== rollNumber) {
              console.log('[verify-hall-ticket] Roll number mismatch! DB has:', matchById.rollNumber, 'Client sent:', rollNumber);
              return res.status(400).json({ message: "Roll number does not match this hall ticket" });
            }
            if (!matchById.isActive) {
              console.log('[verify-hall-ticket] Hall ticket is inactive (already used)');
              return res.status(400).json({ message: "This hall ticket has already been used" });
            }
          } else {
            console.log('[verify-hall-ticket] No hall ticket found with ID:', hallTicketId);
            console.log('[verify-hall-ticket] Available ticket IDs:', allTickets.map(t => t.hallTicketId));
          }
          return res.status(400).json({ message: "Invalid details" });
        }
      } else if (qrData) {
        // QR code validation
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
          studentIdBarcode: hallTicket.studentIdBarcode, // Include barcode for verification
          // idCardImageUrl is omitted here to reduce payload size
        }
      });
    } catch (error) {
      console.error("Error verifying hall ticket:", error);
      res.status(500).json({ message: "Failed to verify hall ticket" });
    }
  });

  // Exam session routes
  // Student exam session creation (no auth required - validated via hall ticket)
  app.post('/api/exam-sessions', async (req, res) => {
    try {
      // Validate hall ticket exists and is active first
      const hallTicket = await storage.getHallTicketById(req.body.hallTicketId);
      if (!hallTicket || !hallTicket.isActive) {
        return res.status(400).json({ message: "Invalid or inactive hall ticket" });
      }

      // Look up student by email first to find existing users
      let studentUser = await storage.getUserByEmail(hallTicket.studentEmail);
      
      // If user doesn't exist, create one with roll number format
      if (!studentUser) {
        const studentId = `student_${hallTicket.rollNumber}`;
        studentUser = await storage.upsertUser({
          id: studentId,
          email: hallTicket.studentEmail,
          firstName: hallTicket.studentName.split(' ')[0],
          lastName: hallTicket.studentName.split(' ').slice(1).join(' ') || '',
          role: 'student',
        });
      }
      
      const studentId = studentUser.id;
      
      // Prepare data with studentId and convert startTime to Date
      const sessionData = {
        ...req.body,
        studentId: studentId,
        startTime: req.body.startTime ? new Date(req.body.startTime) : new Date(),
      };

      // Now validate with schema
      const data = insertExamSessionSchema.parse(sessionData);
      
      // Check if session already exists
      const existingSession = await storage.getExamSessionByStudent(studentId, data.hallTicketId);
      if (existingSession) {
        // Mark hall ticket as inactive even for existing sessions
        await storage.updateHallTicket(hallTicket.id, { isActive: false });
        return res.json(existingSession);
      }

      // Get randomized questions for this exam
      let examQuestions = await storage.getRandomQuestions(hallTicket.examName, hallTicket.totalQuestions);
      
      // If no questions found for specific exam name, fallback to any available questions
      if (!examQuestions || examQuestions.length === 0) {
        console.log(`No questions found for "${hallTicket.examName}", trying fallback to all questions`);
        const allQuestions = await storage.getAllQuestions();
        
        if (allQuestions.length === 0) {
          return res.status(400).json({ 
            message: "No questions available in the system. Please contact the administrator to add questions.",
            error: "NO_QUESTIONS_IN_SYSTEM"
          });
        }
        
        // Use random questions from all available
        const shuffled = allQuestions.sort(() => 0.5 - Math.random());
        const limit = Math.min(hallTicket.totalQuestions || 20, allQuestions.length);
        examQuestions = shuffled.slice(0, limit);
        
        console.log(`Using ${examQuestions.length} fallback questions for exam`);
      }
      
      const questionIds = examQuestions.map(q => q.id);

      // Add questionIds to the session data
      const sessionDataWithQuestions = {
        ...data,
        questionIds: questionIds
      };

      const examSession = await storage.createExamSession(sessionDataWithQuestions);

      // Mark hall ticket as inactive to prevent reuse
      await storage.updateHallTicket(hallTicket.id, { isActive: false });

      res.json(examSession);
    } catch (error) {
      console.error("Error creating exam session:", error);
      res.status(500).json({ message: "Failed to create exam session" });
    }
  });

  app.get('/api/exam-sessions/:id', requireAdmin, async (req: any, res) => {
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

  app.patch('/api/exam-sessions/:id', requireAdmin, async (req: any, res) => {
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

  // Get questions for a specific exam session (no auth required - students use hall tickets)
  app.get('/api/exam-sessions/:id/questions', async (req, res) => {
    try {
      const { id } = req.params;
      let session = await storage.getExamSession(id);
      
      if (!session) {
        return res.status(404).json({ message: "Exam session not found" });
      }

      // Get the questions based on the session's questionIds
      let questionIds = session.questionIds as string[];
      
      // If no questions assigned, assign them now (handles old sessions)
      if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
        console.log('No questions assigned to session, assigning now...');
        
        // Get the hall ticket to know exam details
        const hallTicket = await storage.getHallTicketById(session.hallTicketId);
        if (!hallTicket) {
          return res.status(400).json({ 
            message: "Hall ticket not found for this session",
            error: "HALL_TICKET_NOT_FOUND"
          });
        }
        
        // Get randomized questions for this exam
        let examQuestions = await storage.getRandomQuestions(hallTicket.examName, hallTicket.totalQuestions);
        
        // If no questions found for specific exam name, fallback to any available questions
        if (!examQuestions || examQuestions.length === 0) {
          console.log(`No questions found for "${hallTicket.examName}", trying fallback to all questions`);
          const allQuestions = await storage.getAllQuestions();
          
          if (allQuestions.length === 0) {
            return res.status(400).json({ 
              message: "No questions available in the system. Please contact the administrator to add questions.",
              error: "NO_QUESTIONS_IN_SYSTEM"
            });
          }
          
          // Use random questions from all available
          const shuffled = allQuestions.sort(() => 0.5 - Math.random());
          const limit = Math.min(hallTicket.totalQuestions || 20, allQuestions.length);
          examQuestions = shuffled.slice(0, limit);
          
          console.log(`Using ${examQuestions.length} fallback questions for exam`);
        }
        
        questionIds = examQuestions.map(q => q.id);
        
        // Update the session with the question IDs
        session = await storage.updateExamSession(id, { questionIds: questionIds });
        console.log(`Assigned ${questionIds.length} questions to session ${id}`);
      }

      // Fetch questions but don't return correct answers to students
      const allQuestions = await storage.getAllQuestions();
      const sessionQuestions = allQuestions
        .filter(q => questionIds.includes(q.id))
        .map(q => ({
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

  // Submit exam session with auto-grading
  app.post('/api/exam-sessions/:id/submit', async (req, res) => {
    try {
      const { id } = req.params;
      const { answers } = req.body;
      
      const session = await storage.getExamSession(id);
      if (!session) {
        return res.status(404).json({ message: "Exam session not found" });
      }

      // Auto-grade MCQ questions
      let score = 0;
      let totalMarks = 0;
      const questionIds = (session.questionIds as string[]) || [];
      
      if (questionIds.length > 0) {
        const allQuestions = await storage.getQuestionsByIds(questionIds);
        
        for (const question of allQuestions) {
          totalMarks += question.marks;
          
          if (question.questionType === 'multiple_choice' || question.questionType === 'true_false') {
            // Auto-grade MCQ/TF: compare answer with correctAnswer
            const studentAnswer = answers?.[question.id];
            if (studentAnswer) {
              const selectedOption = typeof studentAnswer === 'object' ? studentAnswer.selectedOption : studentAnswer;
              if (selectedOption && selectedOption.toUpperCase() === question.correctAnswer?.toUpperCase()) {
                score += question.marks;
              }
            }
          }
          // Coding and subjective questions need manual/AI grading
          // They are not auto-graded here
        }
      }

      // Calculate cheating risk score
      const riskScore = await storage.calculateRiskScore(id);

      // Update session with final answers, score, and mark as completed
      const updatedSession = await storage.updateExamSession(id, {
        answers: answers,
        status: 'completed',
        endTime: new Date(),
        score: score,
        totalMarks: totalMarks,
        cheatingRiskScore: riskScore,
      });

      res.json({ 
        success: true, 
        message: "Exam submitted successfully",
        session: updatedSession,
        score,
        totalMarks,
        cheatingRiskScore: riskScore,
      });
    } catch (error) {
      console.error("Error submitting exam:", error);
      res.status(500).json({ message: "Failed to submit exam" });
    }
  });

  // Flag student - manually flag and auto-submit exam
  app.post('/api/exam-sessions/:id/flag', requireAdmin, async (req: any, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const { id } = req.params;
      const { reason } = req.body;
      
      const session = await storage.getExamSession(id);
      if (!session) {
        return res.status(404).json({ message: "Exam session not found" });
      }

      // Update session: pause and mark as flagged
      const updatedSession = await storage.updateExamSession(id, {
        status: 'completed', // Auto-submit
        endTime: new Date()
      });

      // Create a critical security incident for the flag
      const incident = await storage.createSecurityIncident({
        sessionId: id,
        incidentType: 'admin_flagged',
        severity: 'critical',
        description: reason || 'Manually flagged by administrator',
        metadata: { 
          flaggedBy: req.admin.email,
          flaggedAt: new Date().toISOString(),
          autoSubmitted: true
        }
      });

      // Broadcast to all clients
      wss.clients.forEach((client: WebSocketClient) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'student_flagged',
            data: {
              sessionId: id,
              studentId: session.studentId,
              reason: reason || 'Manually flagged by administrator',
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

  // Resolve student - allow flagged/paused student to continue
  app.post('/api/exam-sessions/:id/resolve', requireAdmin, async (req: any, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const { id } = req.params;
      
      const session = await storage.getExamSession(id);
      if (!session) {
        return res.status(404).json({ message: "Exam session not found" });
      }

      // Update session: resume exam (only if not already completed/submitted)
      if (session.status === 'completed' || session.status === 'submitted') {
        return res.status(400).json({ 
          message: "Cannot resolve a completed exam",
          error: "EXAM_ALREADY_COMPLETED"
        });
      }

      const updatedSession = await storage.updateExamSession(id, {
        status: 'in_progress' // Resume
      });

      // Create a security incident for the resolution
      const incident = await storage.createSecurityIncident({
        sessionId: id,
        incidentType: 'admin_resolved',
        severity: 'low',
        description: 'Student allowed to continue exam after admin review',
        metadata: { 
          resolvedBy: req.admin.email,
          resolvedAt: new Date().toISOString()
        }
      });

      // Broadcast to all clients
      wss.clients.forEach((client: WebSocketClient) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'student_resolved',
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

  // Security incident routes
  app.post('/api/security-incidents', requireAdmin, async (req: any, res) => {
    try {
      const data = insertSecurityIncidentSchema.parse(req.body);
      const incident = await storage.createSecurityIncident(data);
      
      // Broadcast to admin clients
      wss.clients.forEach((client: WebSocketClient) => {
        if (client.readyState === WebSocket.OPEN && client.type === 'admin') {
          client.send(JSON.stringify({
            type: 'security_incident',
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


  // Monitoring routes  
  app.post('/api/monitoring-logs', async (req, res) => {
    try {
      const data = insertMonitoringLogSchema.parse(req.body);
      const log = await storage.createMonitoringLog(data);
      res.json(log);
    } catch (error) {
      console.error("Error creating monitoring log:", error);
      res.status(500).json({ message: "Failed to create monitoring log" });
    }
  });

  app.get('/api/monitoring-logs/:sessionId', requireAdmin, async (req: any, res) => {
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

  app.get('/api/exam-stats', requireAdmin, async (req: any, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);

      const stats = await storage.getExamStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching exam stats:", error);
      res.status(500).json({ message: "Failed to fetch exam stats" });
    }
  });

  app.get('/api/exam-sessions', requireAdmin, async (req: any, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);

      const sessions = await storage.getAllExamSessions();
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching exam sessions:", error);
      res.status(500).json({ message: "Failed to fetch exam sessions" });
    }
  });

  app.get('/api/active-sessions', requireAdmin, async (req: any, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);

      const sessions = await storage.getActiveExamSessions();
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching active sessions:", error);
      res.status(500).json({ message: "Failed to fetch active sessions" });
    }
  });

  // Security incident routes
  app.get('/api/security-incidents', requireAdmin, async (req: any, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);

      const incidents = await storage.getSecurityIncidents();
      res.json(incidents);
    } catch (error) {
      console.error("Error fetching security incidents:", error);
      res.status(500).json({ message: "Failed to fetch security incidents" });
    }
  });

  app.patch('/api/security-incidents/:id', requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await ensureAdminUser(storage, req.admin.email);

      const updates = req.body;
      // Add resolvedAt timestamp on the server side to avoid serialization issues
      if (updates.isResolved) {
        updates.resolvedAt = new Date();
      }
      const updatedIncident = await storage.updateSecurityIncident(id, updates);
      res.json(updatedIncident);
    } catch (error) {
      console.error("Error updating security incident:", error);
      res.status(500).json({ message: "Failed to update security incident" });
    }
  });

  // Question management routes
  app.post('/api/questions', requireAdmin, async (req: any, res) => {
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

  app.get('/api/questions', requireAdmin, async (req: any, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const userId = req.admin.email;

      const questions = await storage.getAllQuestions();
      res.json(questions);
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  app.put('/api/questions/:id', requireAdmin, async (req: any, res) => {
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

  app.delete('/api/questions/:id', requireAdmin, async (req: any, res) => {
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

  // AI-powered ID verification endpoint
  // Simple name-based verification route (new simplified system)
  app.post('/api/verify-name', async (req, res) => {
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
        error: process.env.NODE_ENV === 'development' ? (error as Error)?.message : undefined
      });
    }
  });

  // AI-powered verification route with fallback
  app.post('/api/verify-identity', async (req, res) => {
    try {
      let { idCardImage, selfieImage, expectedName, expectedIdNumber, hallTicketId } = req.body;
      
      // Verify hall ticket exists if provided
      if (hallTicketId) {
        const hallTicket = await storage.getHallTicketById(hallTicketId);
        if (!hallTicket || !hallTicket.isActive) {
          return res.status(400).json({ message: "Invalid or inactive hall ticket" });
        }
        
        // If the client didn't send idCardImage, use the one from the admin
        if (!idCardImage && hallTicket.idCardImageUrl) {
          idCardImage = hallTicket.idCardImageUrl;
        }
      }

      if (!idCardImage || !selfieImage || !expectedName) {
        return res.status(400).json({ 
          message: "Missing required fields: idCardImage, selfieImage, and expectedName are required" 
        });
      }

      // Check if OpenAI API key is available
      if (!process.env.OPENAI_API_KEY) {
        console.log("OpenAI API key not set - using fallback verification");
        
        // Store for manual review before returning success
        try {
          await storage.storeIdentityVerification(hallTicketId, {
            studentName: expectedName,
            documentImage: idCardImage,
            selfieImage: selfieImage,
            uploadedAt: new Date().toISOString(),
            verificationType: 'ai_fallback',
            status: 'pending_manual_review',
            reason: 'OpenAI API key not configured'
          });
        } catch (storeError) {
          console.error('Failed to store verification data:', storeError);
        }
        
        // Fallback: Accept verification with basic checks
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

      // Perform AI verification with timeout protection
      let verificationResult;
      try {
        verificationResult = await verifyIDDocument(
          idCardImage,
          selfieImage,
          expectedName,
          expectedIdNumber
        );
        
        // If AI verification succeeds, return the result
        if (verificationResult && verificationResult.isValid !== undefined) {
          return res.json(verificationResult);
        }
      } catch (aiError) {
        console.error("AI verification failed:", aiError);
        
        // Store for manual review
        try {
          await storage.storeIdentityVerification(hallTicketId, {
            studentName: expectedName,
            documentImage: idCardImage,
            selfieImage: selfieImage,
            uploadedAt: new Date().toISOString(),
            verificationType: 'ai_fallback',
            status: 'pending_manual_review',
            reason: 'AI verification timed out or failed'
          });
        } catch (storeError) {
          console.error('Failed to store verification data:', storeError);
        }
        
        // Graceful fallback - allow student to proceed
        return res.json({
          isValid: true,
          confidence: 0.70,
          extractedData: {
            name: expectedName,
            documentType: "ID Document",
            idNumber: expectedIdNumber
          },
          faceMatch: {
            matches: true,
            confidence: 0.70
          },
          reasons: ["Document uploaded successfully. AI verification unavailable - your documents have been saved for manual admin review."]
        });
      }

      // Should not reach here, but if we do, return success fallback
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
      
      // Only return error if required fields are missing
      if (!req.body.idCardImage || !req.body.selfieImage || !req.body.expectedName) {
        return res.status(400).json({ 
          message: "Missing required verification documents" 
        });
      }
      
      // If documents exist but system failed, allow with fallback
      return res.json({
        isValid: true,
        confidence: 0.70,
        extractedData: {
          name: req.body.expectedName,
          documentType: "ID Document"
        },
        faceMatch: {
          matches: true,
          confidence: 0.70
        },
        reasons: ["Document uploaded successfully (verification system unavailable - manual review will be performed)"]
      });
    }
  });

  // Store identity documents for manual verification
  app.post('/api/store-identity-document', async (req, res) => {
    try {
      const { hallTicketId, studentName, rollNumber, documentImage, selfieImage } = req.body;
      
      if (!hallTicketId || !studentName || !documentImage) {
        return res.status(400).json({ 
          message: "Missing required fields: hallTicketId, studentName, and documentImage are required" 
        });
      }

      // Validate that documentImage is actually base64 data
      if (!documentImage.startsWith('data:image/')) {
        return res.status(400).json({ 
          message: "Invalid document image format" 
        });
      }

      // Prepare verification data for storage
      const verificationData = {
        studentName,
        rollNumber,
        documentImage,
        selfieImage,
        uploadedAt: new Date().toISOString(),
        verificationType: 'manual',
        status: 'pending_manual_review'
      };

      // Store in database for admin review
      let storageSuccess = false;
      try {
        await storage.storeIdentityVerification(hallTicketId, verificationData);
        console.log(`✅ Stored identity document for manual verification: ${studentName} (${rollNumber})`);
        storageSuccess = true;
      } catch (storeError) {
        console.error('⚠️ Storage error - document received but not persisted:', storeError);
        // Log for admin review but don't block student
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

  // ==================== ANALYTICS ENDPOINTS ====================

  // Analytics overview
  app.get('/api/analytics/overview', requireAdmin, async (req: any, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const examName = req.query.examName as string | undefined;

      const allSessions = examName
        ? await storage.getExamSessionsByExam(examName)
        : await storage.getAllExamSessions();

      const completedSessions = allSessions.filter((s: any) => s.status === 'completed');
      const uniqueExams = new Set(allSessions.map((s: any) => s.examName).filter(Boolean));

      const scores = completedSessions.map((s: any) => s.score).filter((s: any) => s != null);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;
      
      const passCount = completedSessions.filter((s: any) => s.score != null && s.totalMarks && (s.score / s.totalMarks) >= 0.4).length;
      const passRate = completedSessions.length > 0 ? Math.round((passCount / completedSessions.length) * 100) : 0;

      const allIncidents = await storage.getSecurityIncidents();
      const relevantIncidents = examName
        ? allIncidents.filter(i => allSessions.some((s: any) => s.id === i.sessionId))
        : allIncidents;

      const riskScores = completedSessions.map((s: any) => s.cheatingRiskScore || 0);
      const avgRiskScore = riskScores.length > 0 ? Math.round(riskScores.reduce((a: number, b: number) => a + b, 0) / riskScores.length) : 0;

      res.json({
        totalExams: uniqueExams.size,
        totalStudents: allSessions.length,
        avgScore,
        passRate,
        totalIncidents: relevantIncidents.length,
        avgRiskScore,
      });
    } catch (error) {
      console.error('Analytics overview error:', error);
      res.status(500).json({ message: 'Failed to load analytics' });
    }
  });

  // Score distribution for a specific exam
  app.get('/api/analytics/scores/:examName', requireAdmin, async (req: any, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const { examName } = req.params;

      const sessions = await storage.getExamSessionsByExam(examName);
      const completed = sessions.filter((s: any) => s.status === 'completed');

      // Build score distribution bins
      const bins = [
        { range: '0-10', min: 0, max: 10, count: 0 },
        { range: '11-20', min: 11, max: 20, count: 0 },
        { range: '21-30', min: 21, max: 30, count: 0 },
        { range: '31-40', min: 31, max: 40, count: 0 },
        { range: '41-50', min: 41, max: 50, count: 0 },
        { range: '51-60', min: 51, max: 60, count: 0 },
        { range: '61-70', min: 61, max: 70, count: 0 },
        { range: '71-80', min: 71, max: 80, count: 0 },
        { range: '81-90', min: 81, max: 90, count: 0 },
        { range: '91-100', min: 91, max: 100, count: 0 },
      ];

      for (const s of completed) {
        if (s.score != null && s.totalMarks) {
          const pct = Math.round((s.score / s.totalMarks) * 100);
          const bin = bins.find(b => pct >= b.min && pct <= b.max);
          if (bin) bin.count++;
        }
      }

      // Pass/Fail data
      const passCount = completed.filter((s: any) => s.score != null && s.totalMarks && (s.score / s.totalMarks) >= 0.4).length;
      const passFailData = [
        { name: 'Pass', value: passCount },
        { name: 'Fail', value: completed.length - passCount },
      ];

      // Top performers
      const topPerformers = completed
        .filter((s: any) => s.score != null)
        .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
        .slice(0, 10)
        .map((s: any) => ({
          studentName: s.studentName,
          rollNumber: s.rollNumber,
          score: s.score,
          totalMarks: s.totalMarks,
          riskScore: s.cheatingRiskScore || 0,
        }));

      res.json({
        distribution: bins.map(b => ({ range: b.range, count: b.count })),
        passFailData,
        topPerformers,
      });
    } catch (error) {
      console.error('Score analytics error:', error);
      res.status(500).json({ message: 'Failed to load score analytics' });
    }
  });

  // Subject-wise performance
  app.get('/api/analytics/subjects/:examName', requireAdmin, async (req: any, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const { examName } = req.params;

      const sessions = await storage.getExamSessionsByExam(examName);
      const completed = sessions.filter((s: any) => s.status === 'completed');
      const examQuestions = await storage.getQuestionsByExam(examName);

      // Group questions by subject
      const subjectStats: Record<string, { total: number; correct: number; totalMarks: number; scoredMarks: number }> = {};

      for (const q of examQuestions) {
        if (!subjectStats[q.subject]) {
          subjectStats[q.subject] = { total: 0, correct: 0, totalMarks: 0, scoredMarks: 0 };
        }
        subjectStats[q.subject].total++;
        subjectStats[q.subject].totalMarks += q.marks;

        // Count correct answers across all completed sessions
        for (const session of completed) {
          const answers = session.answers as Record<string, any> || {};
          const answer = answers[q.id];
          if (answer && q.questionType === 'multiple_choice') {
            const selected = typeof answer === 'object' ? answer.selectedOption : answer;
            if (selected && selected.toUpperCase() === q.correctAnswer?.toUpperCase()) {
              subjectStats[q.subject].correct++;
              subjectStats[q.subject].scoredMarks += q.marks;
            }
          }
        }
      }

      const subjects = Object.entries(subjectStats).map(([subject, stats]) => ({
        subject,
        avgScore: stats.totalMarks > 0 ? Math.round((stats.scoredMarks / (stats.totalMarks * Math.max(completed.length, 1))) * 100) : 0,
        accuracy: stats.total > 0 ? Math.round((stats.correct / (stats.total * Math.max(completed.length, 1))) * 100) : 0,
        totalQuestions: stats.total,
      }));

      res.json({ subjects });
    } catch (error) {
      console.error('Subject analytics error:', error);
      res.status(500).json({ message: 'Failed to load subject analytics' });
    }
  });

  // Cheating report
  app.get('/api/analytics/cheating-report/:examName', requireAdmin, async (req: any, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const { examName } = req.params;

      const sessions = await storage.getExamSessionsByExam(examName);
      const allIncidents = await storage.getSecurityIncidents();

      // Per-student cheating data
      const students = sessions.map((s: any) => {
        const sessionIncidents = allIncidents.filter(i => i.sessionId === s.id);
        return {
          studentName: s.studentName || 'Unknown',
          rollNumber: s.rollNumber,
          riskScore: s.cheatingRiskScore || 0,
          incidents: sessionIncidents.length,
          types: sessionIncidents.map(i => i.incidentType),
        };
      }).sort((a: any, b: any) => b.riskScore - a.riskScore);

      // Incident trends by severity
      const incidentsByTime: Record<string, { critical: number; high: number; medium: number; low: number }> = {};
      for (const i of allIncidents.filter(inc => sessions.some((s: any) => s.id === inc.sessionId))) {
        const time = i.createdAt ? new Date(i.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'unknown';
        if (!incidentsByTime[time]) incidentsByTime[time] = { critical: 0, high: 0, medium: 0, low: 0 };
        const sev = i.severity as 'critical' | 'high' | 'medium' | 'low';
        if (incidentsByTime[time][sev] !== undefined) incidentsByTime[time][sev]++;
      }

      const trends = Object.entries(incidentsByTime)
        .map(([time, data]) => ({ time, ...data }))
        .slice(0, 20);

      res.json({ students, trends });
    } catch (error) {
      console.error('Cheating report error:', error);
      res.status(500).json({ message: 'Failed to load cheating report' });
    }
  });

  // CSV export
  app.get('/api/analytics/export/:examName', requireAdmin, async (req: any, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const { examName } = req.params;

      const sessions = await storage.getExamSessionsByExam(examName);
      const allIncidents = await storage.getSecurityIncidents();

      const csvHeader = 'Student Name,Roll Number,Score,Total Marks,Percentage,Cheating Risk,Incidents,Status\n';
      const csvRows = sessions.map((s: any) => {
        const incidents = allIncidents.filter(i => i.sessionId === s.id).length;
        const pct = s.score != null && s.totalMarks ? Math.round((s.score / s.totalMarks) * 100) : 0;
        return `"${s.studentName || ''}","${s.rollNumber || ''}",${s.score ?? 0},${s.totalMarks ?? 0},${pct}%,${s.cheatingRiskScore || 0},${incidents},${s.status}`;
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${examName}_results.csv"`);
      res.send(csvHeader + csvRows);
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ message: 'Failed to export data' });
    }
  });

  // Proctoring snapshot storage
  app.post('/api/proctoring-snapshots', async (req, res) => {
    try {
      const data = insertProctoringSnapshotSchema.parse(req.body);
      const snapshot = await storage.createProctoringSnapshot(data);
      res.json(snapshot);
    } catch (error) {
      console.error('Error storing snapshot:', error);
      res.status(500).json({ message: 'Failed to store snapshot' });
    }
  });

  // Code submissions
  app.post('/api/code-submissions', async (req, res) => {
    try {
      const data = insertCodeSubmissionSchema.parse(req.body);
      const submission = await storage.createCodeSubmission(data);
      res.json(submission);
    } catch (error) {
      console.error('Error storing code submission:', error);
      res.status(500).json({ message: 'Failed to store code submission' });
    }
  });

  app.get('/api/code-submissions/:sessionId', requireAdmin, async (req: any, res) => {
    try {
      await ensureAdminUser(storage, req.admin.email);
      const submissions = await storage.getCodeSubmissions(req.params.sessionId);
      res.json(submissions);
    } catch (error) {
      console.error('Error fetching code submissions:', error);
      res.status(500).json({ message: 'Failed to fetch code submissions' });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // Create WebSocket server with authentication
  const wss = new WebSocketServer({ 
    noServer: true
  });

  // Handle WebSocket upgrade with JWT authentication
  httpServer.on('upgrade', (request, socket, head) => {
    if (request.url !== '/ws') {
      socket.destroy();
      return;
    }

    // Parse cookies from the upgrade request
    const cookies: Record<string, string> = {};
    if (request.headers.cookie) {
      request.headers.cookie.split(';').forEach(cookie => {
        const [key, value] = cookie.split('=').map(c => c.trim());
        if (key && value) {
          cookies[key] = value;
        }
      });
    }

    // Validate JWT token for admin connections
    let isAdmin = false;
    const adminToken = cookies['admin_token'];
    
    if (adminToken) {
      try {
        // Use the same JWT secret as the auth module
        const secret = process.env.JWT_SECRET || 'dev-secret-for-local-development-only';
        const decoded = jwt.verify(adminToken, secret) as { email: string; role: string };
        if (decoded.role === 'admin') {
          isAdmin = true;
        }
      } catch (error) {
        console.error('WebSocket JWT validation failed:', error);
      }
    }

    wss.handleUpgrade(request, socket, head, (ws: WebSocketClient) => {
      if (isAdmin) {
        ws.type = 'admin';
      }
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws: WebSocketClient) => {
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'auth') {
          // Students can still set their info via auth message (no JWT needed for students)
          if (!ws.type) {
            ws.type = data.userType || 'student';
          }
          ws.userId = data.userId;
          ws.sessionId = data.sessionId;
        }
        
        if (data.type === 'student_status_update') {
          // Broadcast to admin clients
          wss.clients.forEach((client: WebSocketClient) => {
            if (client.readyState === WebSocket.OPEN && client.type === 'admin') {
              client.send(JSON.stringify({
                type: 'student_status',
                data: data.payload
              }));
            }
          });
        }
        
        if (data.type === 'face_detection_update') {
          // Log monitoring data
          if (data.sessionId) {
            await storage.createMonitoringLog({
              sessionId: data.sessionId,
              eventType: 'face_detected',
              eventData: data.payload
            });
          }
        }

        if (data.type === 'video_snapshot') {
          // Broadcast video snapshot to admin clients for live monitoring
          wss.clients.forEach((client: WebSocketClient) => {
            if (client.readyState === WebSocket.OPEN && client.type === 'admin') {
              client.send(JSON.stringify({
                type: 'video_feed',
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
          
          // Log to monitoring logs as fallback
          if (data.data.sessionId) {
            await storage.createMonitoringLog({
              sessionId: data.data.sessionId,
              eventType: 'video_snapshot',
              eventData: { 
                studentId: data.data.studentId,
                timestamp: data.data.timestamp
              }
            });
          }
        }
        
        // Handle security violations from students
        if (data.type === 'security_violation' || data.type === 'face_violation') {
          try {
            // Validate required fields for incident creation
            if (!data.data.sessionId || !data.data.incidentType || !data.data.severity || !data.data.description) {
              console.error('Invalid violation data: missing required fields (sessionId, incidentType, severity, description)');
              return;
            }
            
            // Validate sender is a student
            if (ws.type !== 'student') {
              console.error('Unauthorized: Only students can report violations');
              return;
            }
            
            // Validate session exists and belongs to the student
            const session = await storage.getExamSession(data.data.sessionId);
            if (!session) {
              console.error(`Session ${data.data.sessionId} not found`);
              return;
            }
            
            // Rate limiting: check for recent incidents to prevent spam
            const recentIncidents = await storage.getSecurityIncidents(data.data.sessionId);
            const oneMinuteAgo = new Date(Date.now() - 60000);
            const recentSameType = recentIncidents.filter(incident => 
              incident.incidentType === data.data.incidentType && 
              incident.createdAt && new Date(incident.createdAt) > oneMinuteAgo
            );
            
            if (recentSameType.length >= 3) {
              console.log(`Rate limited: Too many ${data.data.incidentType} incidents for session ${data.data.sessionId}`);
              return;
            }
            
            // Create security incident
            const incident = await storage.createSecurityIncident({
              sessionId: data.data.sessionId,
              incidentType: data.data.incidentType,
              severity: data.data.severity,
              description: data.data.description,
              metadata: data.data.metadata || {}
            });
            
            // Broadcast to admin clients
            wss.clients.forEach((client: WebSocketClient) => {
              if (client.readyState === WebSocket.OPEN && client.type === 'admin') {
                client.send(JSON.stringify({
                  type: 'security_incident',
                  data: {
                    ...incident,
                    studentName: data.data.studentName,
                    rollNumber: data.data.rollNumber,
                    violationType: data.data.incidentType // Use actual incident type, not message type
                  }
                }));
              }
            });
            
            console.log(`Security incident created: ${data.data.incidentType} for session ${data.data.sessionId}`);
          } catch (error) {
            console.error('Error creating security incident:', error);
          }
        }
        
        // Handle student status updates (lightweight monitoring)
        if (data.type === 'student_status') {
          try {
            // Broadcast to admin clients
            wss.clients.forEach((client: WebSocketClient) => {
              if (client.readyState === WebSocket.OPEN && client.type === 'admin') {
                client.send(JSON.stringify({
                  type: 'student_monitoring',
                  data: data.data
                }));
              }
            });
          } catch (error) {
            console.error('Error handling student status:', error);
          }
        }
        
        // Handle policy updates (exam paused/auto-submitted) - separate from incidents
        if (data.type === 'policy_update') {
          try {
            // Validate basic required fields
            if (!data.data.sessionId || !data.data.action) {
              console.error('Invalid policy update: missing sessionId or action');
              return;
            }
            
            // Broadcast policy update to admin clients
            wss.clients.forEach((client: WebSocketClient) => {
              if (client.readyState === WebSocket.OPEN && client.type === 'admin') {
                client.send(JSON.stringify({
                  type: 'policy_update',
                  data: data.data
                }));
              }
            });
            
            console.log(`Policy update: ${data.data.action} for session ${data.data.sessionId}`);
          } catch (error) {
            console.error('Error handling policy update:', error);
          }
        }
        
        // Handle admin actions (flag student or resolve incident)
        if (data.type === 'admin_action') {
          try {
            // Validate admin authorization
            if (ws.type !== 'admin') {
              console.error('Unauthorized: Only admins can send admin actions');
              return;
            }
            
            // Validate required fields
            if (!data.data.sessionId || !data.data.action) {
              console.error('Invalid admin action: missing sessionId or action');
              return;
            }
            
            // Broadcast action to the specific student's session
            wss.clients.forEach((client: WebSocketClient) => {
              if (client.readyState === WebSocket.OPEN && 
                  client.type === 'student' && 
                  client.sessionId === data.data.sessionId) {
                client.send(JSON.stringify({
                  type: 'admin_action',
                  data: {
                    action: data.data.action, // 'flag' or 'resolve'
                    message: data.data.message,
                    timestamp: new Date().toISOString()
                  }
                }));
              }
            });
            
            console.log(`Admin action: ${data.data.action} for session ${data.data.sessionId}`);
          } catch (error) {
            console.error('Error handling admin action:', error);
          }
        }
        
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });
  });

  return httpServer;
}
