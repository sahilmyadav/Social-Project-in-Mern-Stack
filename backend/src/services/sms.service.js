// SMS Service for sending OTP via SMS
// You can integrate with Twilio, AWS SNS, or any other SMS provider

class SMSService {
  constructor() {
    // Initialize SMS provider (e.g., Twilio)
    // this.client = twilio(accountSid, authToken);
  }

  /**
   * Send OTP via SMS
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} otp - OTP code
   * @param {string} type - Type of OTP (registration, login, etc.)
   */
  async sendOTP(phoneNumber, otp, type = "verification") {
    try {
      // Example with Twilio (uncomment and configure when ready)
      /*
      const message = await this.client.messages.create({
        body: `Your ${type} OTP is: ${otp}. Valid for 2 minutes. Do not share this code.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });
      
      return message;
      */

      // For development/testing - just log the OTP

      // Simulate successful SMS send
      return {
        success: true,
        message: "OTP sent successfully (development mode)",
      };
    } catch (error) {
      console.error("SMS Service Error:", error);
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  /**
   * Check if SMS service is configured
   */
  static isConfigured() {
    // Check if required environment variables are set
    return (
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
    );
  }
}

export default new SMSService();
