// SMS Service for sending OTP via SMS
// Integrate with Twilio, AWS SNS, or any other SMS provider

import logger from '../utils/logger.js';

class SMSService {
  constructor() {
    // Initialize SMS provider (e.g., Twilio)
    // this.client = twilio(accountSid, authToken);
  }

  /**
   * Send OTP via SMS.
   * In production, throws if no SMS provider is configured.
   */
  async sendOTP(phoneNumber, otp, type = 'verification') {
    const isProd = process.env.NODE_ENV === 'production';

    if (isProd && !SMSService.isConfigured()) {
      throw new Error(
        'SMS service is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.'
      );
    }

    if (SMSService.isConfigured()) {
      // Uncomment when Twilio is integrated:
      /*
      const message = await this.client.messages.create({
        body: `Your ${type} OTP is: ${otp}. Valid for 10 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });
      return { success: true, messageId: message.sid };
      */
    }

    // Development mode only
    logger.warn('SMS not configured — OTP logged for dev only', {
      phoneLast4: phoneNumber.slice(-4),
      type,
    });

    return {
      success: true,
      message: 'OTP sent successfully (development mode)',
      development: true,
    };
  }

  static isConfigured() {
    return !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
    );
  }
}

export default new SMSService();
