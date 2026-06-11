"""
email_service.py — sends real emails via Brevo (formerly Sendinblue) SMTP relay.

Configure in .env:
    SMTP_HOST=smtp-relay.brevo.com
    SMTP_PORT=587
    SMTP_USER=your_brevo_login_email          ← the email you use to log into Brevo
    SMTP_PASSWORD=your_brevo_smtp_key         ← Brevo → SMTP & API → SMTP → Generate SMTP Key

Brevo SMTP key setup:
    1. Log in at https://app.brevo.com
    2. Go to  Account → SMTP & API → SMTP tab
    3. Click "Generate a new SMTP key" and copy it
    4. Paste it as SMTP_PASSWORD in your .env
    5. SMTP_USER is the email address you use to log into Brevo
    6. Add / verify your sender address in Brevo → Senders & IPs → Senders
       (the address you put in EMAILS_FROM)
"""

import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _send(to_email: str, subject: str, html_body: str, text_body: str) -> bool:
    """
    Internal: build and send a MIME email via Brevo SMTP relay.
    Returns True on success, False on failure (logs the error — never raises,
    so a failed email never breaks the registration flow).
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.error(
            "EMAIL NOT SENT — SMTP_USER or SMTP_PASSWORD is missing in .env. "
            "Set SMTP_USER=<your Brevo login email> and SMTP_PASSWORD=<your Brevo SMTP key>. "
            "See email_service.py docstring for Brevo setup steps."
        )
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"VisaFlow IWMS <{settings.EMAILS_FROM or settings.SMTP_USER}>"
        msg["To"]      = to_email

        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body,  "html"))

        # Brevo SMTP relay: smtp-relay.brevo.com:587 with STARTTLS
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, to_email, msg.as_string())

        logger.info(f"Email sent → {to_email} | {subject}")
        return True

    except smtplib.SMTPAuthenticationError:
        logger.error(
            "Brevo SMTP authentication failed. "
            "Make sure SMTP_USER is your Brevo account email and "
            "SMTP_PASSWORD is your Brevo SMTP key (not your account password). "
            "Generate one at: Brevo → Account → SMTP & API → SMTP tab."
        )
        return False
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Public helpers
# ─────────────────────────────────────────────────────────────────────────────

def send_welcome_email(
    to_email: str,
    student_name: str,
    student_code: str,
    password: str,
    registered_by: str,
) -> bool:
    """
    Send a welcome email to a newly registered student with their login credentials.
    Called automatically by register_student() after DB commit.
    """
    subject = f"Welcome to VisaFlow IWMS — Your Account is Ready, {student_name.split()[0]}!"

    html_body = f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:16px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);
                     padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;
                       letter-spacing:-0.5px;">
              ✈️ VisaFlow
            </h1>
            <p style="margin:6px 0 0;color:#c7d2fe;font-size:13px;
                      text-transform:uppercase;letter-spacing:1px;">
              Immigration Workflow Management System
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 8px;font-size:22px;color:#111827;font-weight:800;">
              Welcome, {student_name}! 🎉
            </h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              Your immigration application account has been created by
              <strong>{registered_by}</strong>. You can now log in and track
              your application at every stage.
            </p>

            <!-- Credentials box -->
            <div style="background:#f5f3ff;border:1.5px solid #e0d7ff;
                        border-radius:12px;padding:24px;margin-bottom:24px;">
              <p style="margin:0 0 14px;font-size:13px;font-weight:700;
                        color:#6d28d9;text-transform:uppercase;letter-spacing:0.6px;">
                Your Login Credentials
              </p>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #ede9fe;">
                    <span style="font-size:13px;color:#9ca3af;width:120px;
                                 display:inline-block;">Student Code</span>
                    <strong style="font-size:15px;color:#4f46e5;
                                   font-family:monospace;">{student_code}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #ede9fe;">
                    <span style="font-size:13px;color:#9ca3af;width:120px;
                                 display:inline-block;">Email</span>
                    <strong style="font-size:14px;color:#111827;">{to_email}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;">
                    <span style="font-size:13px;color:#9ca3af;width:120px;
                                 display:inline-block;">Password</span>
                    <strong style="font-size:15px;color:#111827;
                                   font-family:monospace;">{password}</strong>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Login button -->
            <div style="text-align:center;margin-bottom:28px;">
              <a href="http://localhost:3000"
                 style="display:inline-block;padding:14px 32px;
                        background:linear-gradient(135deg,#4f46e5,#7c3aed);
                        color:#ffffff;text-decoration:none;border-radius:10px;
                        font-size:15px;font-weight:700;letter-spacing:0.3px;">
                Login to Your Account →
              </a>
            </div>

            <!-- What happens next -->
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;
                        border-radius:10px;padding:18px;margin-bottom:24px;">
              <p style="margin:0 0 10px;font-size:13px;font-weight:700;
                        color:#166534;text-transform:uppercase;">What Happens Next</p>
              <ul style="margin:0;padding-left:18px;color:#374151;
                         font-size:13px;line-height:1.8;">
                <li>Our <strong>Enquiry Officer</strong> will contact you to collect your documents</li>
                <li>A <strong>Counsellor</strong> will guide you on country, course &amp; university</li>
                <li>Your application will move through <strong>Admission → Enrollment → Visa</strong></li>
                <li>You can track every stage by logging into the portal</li>
              </ul>
            </div>

            <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
              Please change your password after your first login. If you have any
              questions, contact your assigned officer or reply to this email.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #f0f0f0;
                     padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              VisaFlow Immigration Workflow Management System<br>
              This is an automated message — please do not reply directly.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""

    text_body = f"""Welcome to VisaFlow IWMS, {student_name}!

Your immigration application account has been created by {registered_by}.

YOUR LOGIN CREDENTIALS
----------------------
Student Code : {student_code}
Email        : {to_email}
Password     : {password}

Login at: http://localhost:3000

WHAT HAPPENS NEXT
-----------------
1. Enquiry Officer will contact you to collect documents
2. Counsellor will guide you on country, course & university
3. Application moves through Admission → Enrollment → Visa
4. Track every stage by logging into the portal

Please change your password after first login.

— VisaFlow IWMS Team
"""

    return _send(to_email, subject, html_body, text_body)


def send_stage_advance_email(
    to_email: str,
    student_name: str,
    student_code: str,
    from_stage: str,
    to_stage: str,
    officer_name: str,
) -> bool:
    """Notify the student when their application moves to a new stage."""
    subject = f"Application Update — Moved to {to_stage.title()} Stage"

    stage_icons = {
        "reception": "🏢", "enquiry": "🔍", "counsellor": "🎓",
        "admission": "📋", "enrollment": "📝", "visa": "✈️", "completed": "🎉",
    }
    icon = stage_icons.get(to_stage.lower(), "📌")

    html_body = f"""
<!DOCTYPE html>
<html>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f3f4f6;
             margin:0;padding:40px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:14px;
                    box-shadow:0 4px 20px rgba(0,0,0,0.07);overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);
                     padding:28px 36px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">
              ✈️ VisaFlow
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px;">
            <div style="text-align:center;font-size:48px;margin-bottom:12px;">{icon}</div>
            <h2 style="margin:0 0 8px;text-align:center;color:#111827;font-size:20px;">
              Application Advanced!
            </h2>
            <p style="text-align:center;color:#6b7280;margin:0 0 24px;">
              Hi {student_name}, your application has moved to a new stage.
            </p>
            <div style="background:#eff6ff;border-radius:10px;padding:18px;
                        text-align:center;margin-bottom:24px;">
              <p style="margin:0 0 6px;color:#6b7280;font-size:13px;">
                <span style="text-decoration:line-through;">{from_stage.title()}</span>
                &nbsp;→&nbsp;
                <strong style="color:#1d4ed8;font-size:16px;">{to_stage.title()}</strong>
              </p>
              <p style="margin:6px 0 0;color:#9ca3af;font-size:12px;">
                Assigned officer: {officer_name}
              </p>
            </div>
            <p style="color:#6b7280;font-size:13px;text-align:center;">
              Log in to your portal to see the latest updates on your application.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #f0f0f0;
                     padding:16px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              VisaFlow IWMS — Student Code: {student_code}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""

    text_body = f"""Hi {student_name},

Your immigration application has advanced!

{from_stage.upper()} → {to_stage.upper()}

Assigned officer: {officer_name}
Student Code: {student_code}

Log in to track your application: http://localhost:3000

— VisaFlow IWMS Team
"""

    return _send(to_email, subject, html_body, text_body)
if __name__ == "__main__":
    result = send_welcome_email(
        to_email="arindam@antiersolutions.com",
        student_name="Test Student",
        student_code="STU-99999",
        password="test123",
        registered_by="Test Officer",
    )
    print("Sent:", result)