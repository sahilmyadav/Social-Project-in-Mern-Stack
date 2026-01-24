import nodemailer from "nodemailer";

// Create transporter
const createTransporter = () => {
  // If SMTP credentials are not provided, return null
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    console.warn(
      "SMTP credentials not found. Email service will not be available."
    );
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_PORT === "465", // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const transporter = createTransporter();

class EmailService {
  async sendPasswordResetEmail(email, resetUrl) {
    if (!transporter) {
      throw new Error("Email service not configured");
    }
    const subject = "Reset your password - Social Media ";
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .reset-box { background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px; }
            .reset-link { display: inline-block; padding: 12px 24px; background: #007bff; color: #fff; border-radius: 4px; text-decoration: none; font-size: 18px; margin-top: 10px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your password. Click the button below to set a new password:</p>
            <div class="reset-box">
              <a class="reset-link" href="${resetUrl}">Reset Password</a>
            </div>
            <p>This link will expire in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
            <div class="footer">
              <p>© ${new Date().getFullYear()} { Platform Name } CRM. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject,
        html,
      });

      return { success: true, messageId: info.messageId };
    } catch (error) {
      throw new Error(`Failed to send password reset email: ${error.message}`);
    }
  }
  async sendOTPEmail(email, otp, purpose = "verification") {
    if (!transporter) {
      throw new Error("Email service not configured");
    }

    const subjectMap = {
      verification: "Verify your email - Social Media ",
      login: "Your login OTP - Social Media ",
      password_reset: "Reset your password - Social Media ",
      registration: "Welcome! Verify your email - Social Media Platform",
    };

    const subject = subjectMap[purpose] || "Your OTP - Social Media ";

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .otp-box { background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px; }
          .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #007bff; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Your OTP Code</h2>
          <p>Your OTP code is:</p>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Abizob CRM. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject,
        html,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async sendWelcomeEmail(email, firstName) {
    if (!transporter) {
      throw new Error("Email service not configured");
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Welcome to Abizob CRM, ${firstName}!</h2>
          <p>Your account has been successfully created.</p>
          <p>You can now log in and start using our services.</p>
          <p>If you have any questions, feel free to contact our support team.</p>
        </div>
      </body>
      </html>
    `;

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: "Welcome to Abizob CRM",
        html,
      });

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to send welcome email: ${error.message}`);
    }
  }

  isConfigured() {
    return transporter !== null;
  }
}

export default new EmailService();
