import nodemailer from "nodemailer";
import type { HallTicket } from "@shared/schema";

// Create reusable transporter
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn("⚠️ SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env to enable email sending.");
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

/**
 * Send a hall ticket email to the student.
 * Non-blocking — logs errors but never throws.
 */
export async function sendHallTicketEmail(
  hallTicket: HallTicket,
  qrCodeDataUrl?: string
): Promise<boolean> {
  try {
    const t = getTransporter();
    if (!t) {
      console.log(`📧 Email skipped for ${hallTicket.studentEmail} — SMTP not configured`);
      return false;
    }

    const examDate = new Date(hallTicket.examDate).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Build inline attachments (QR code)
    const attachments: nodemailer.SendMailOptions["attachments"] = [];
    let qrCidTag = "";
    if (qrCodeDataUrl) {
      const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, "");
      attachments.push({
        filename: "qrcode.png",
        content: Buffer.from(base64Data, "base64"),
        cid: "hallticket-qr",
      });
      qrCidTag = `<img src="cid:hallticket-qr" alt="QR Code" width="180" height="180" style="display:block;margin:0 auto;" />`;
    }

    const html = buildEmailHTML(hallTicket, examDate, qrCidTag);

    await t.sendMail({
      from: `"ExamGuardPro" <${process.env.SMTP_USER}>`,
      to: hallTicket.studentEmail,
      subject: `🎓 Your Hall Ticket for ${hallTicket.examName} — ${hallTicket.hallTicketId}`,
      html,
      attachments,
    });

    console.log(`✅ Hall ticket email sent to ${hallTicket.studentEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send hall ticket email to ${hallTicket.studentEmail}:`, error);
    return false;
  }
}

function buildEmailHTML(
  ticket: HallTicket,
  examDate: string,
  qrCidTag: string
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0f2f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a8a,#3b82f6);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:0.5px;">🎓 HALL TICKET</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">University Examination — ExamGuardPro</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:28px 40px 8px;">
              <p style="margin:0;font-size:16px;color:#1e293b;">Dear <strong>${ticket.studentName}</strong>,</p>
              <p style="margin:12px 0 0;font-size:14px;color:#475569;line-height:1.6;">
                Your hall ticket for <strong>${ticket.examName}</strong> has been generated successfully. Please find your exam details below. Keep this email safe — you will need it for authentication.
              </p>
            </td>
          </tr>

          <!-- Details Card -->
          <tr>
            <td style="padding:20px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      ${detailRow("Hall Ticket ID", ticket.hallTicketId, "#1e40af")}
                      ${detailRow("Roll Number", ticket.rollNumber)}
                      ${detailRow("Exam Name", ticket.examName)}
                      ${detailRow("Exam Date", examDate)}
                      ${detailRow("Duration", `${ticket.duration} minutes`)}
                      ${detailRow("Total Questions", String(ticket.totalQuestions))}
                      ${detailRow("Student Email", ticket.studentEmail)}
                      ${ticket.studentIdBarcode ? detailRow("Barcode ID", ticket.studentIdBarcode, "#7c3aed") : ""}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- QR Code -->
          ${qrCidTag ? `
          <tr>
            <td style="padding:8px 40px 20px;text-align:center;">
              <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#1e293b;">Scan this QR Code for Authentication</p>
              ${qrCidTag}
              <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;">Use this QR code at exam check-in</p>
            </td>
          </tr>
          ` : ""}

          <!-- Instructions -->
          <tr>
            <td style="padding:12px 40px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:8px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#1e40af;">📋 Important Instructions</p>
                    <ul style="margin:0;padding-left:18px;font-size:13px;color:#334155;line-height:1.8;">
                      <li>Arrive <strong>30 minutes</strong> before the exam time.</li>
                      <li>Carry a valid <strong>photo ID</strong> for identity verification.</li>
                      <li>Ensure a stable <strong>internet connection</strong> and working <strong>webcam</strong>.</li>
                      <li>No electronic devices (phones, smartwatches) are allowed.</li>
                      <li>The exam is <strong>AI-proctored</strong> — any suspicious activity will be flagged.</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f1f5f9;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                This is a system-generated email from <strong>ExamGuardPro</strong>. Do not reply to this email.
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#cbd5e1;">
                © ${new Date().getFullYear()} ExamGuardPro — Secure Exam Browser
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function detailRow(label: string, value: string, valueColor = "#1e293b"): string {
  return `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#64748b;width:40%;">${label}</td>
      <td style="padding:6px 0;font-size:13px;font-weight:600;color:${valueColor};">${value}</td>
    </tr>`;
}
