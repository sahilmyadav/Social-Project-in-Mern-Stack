import bcrypt from "bcrypt";
import { User } from "../models/user.model.js";

class OTPService {
  // Generate 6-digit OTP
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Hash OTP before storing
  async hashOTP(otp) {
    return await bcrypt.hash(otp, 10);
  }

  // Verify OTP
  async verifyOTP(hashedOTP, plainOTP) {
    return await bcrypt.compare(plainOTP, hashedOTP);
  }

  // Save OTP to user
  async saveOTP(userId, otp, expiresInMinutes = 10) {
    const hashedOTP = await this.hashOTP(otp);
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await User.findByIdAndUpdate(userId, {
      "otp.code": hashedOTP,
      "otp.expiresAt": expiresAt,
    });

    return { otp, expiresAt };
  }

  // Verify and clear OTP
  async verifyAndClearOTP(userId, plainOTP) {
    const user = await User.findById(userId).select("+otp");

    if (!user || !user.otp || !user.otp.code) {
      throw new Error("OTP not found or expired");
    }

    // Check expiration
    if (new Date() > user.otp.expiresAt) {
      await this.clearOTP(userId);
      throw new Error("OTP expired");
    }

    // Verify OTP
    const isValid = await this.verifyOTP(user.otp.code, plainOTP);

    if (!isValid) {
      throw new Error("Invalid OTP");
    }

    // Clear OTP after successful verification
    await this.clearOTP(userId);

    return true;
  }

  // Clear OTP
  async clearOTP(userId) {
    await User.findByIdAndUpdate(userId, {
      $unset: {
        "otp.code": "",
        "otp.expiresAt": "",
      },
    });
  }

  // Check if OTP exists and is valid
  async checkOTPExists(userId) {
    const user = await User.findById(userId).select("+otp");
    if (!user || !user.otp || !user.otp.code) {
      return false;
    }
    if (new Date() > user.otp.expiresAt) {
      await this.clearOTP(userId);
      return false;
    }
    return true;
  }
}

export default new OTPService();

