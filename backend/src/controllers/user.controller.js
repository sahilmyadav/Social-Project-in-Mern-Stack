import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Followers } from '../models/followers.model.js';
import { Post } from '../models/post.model.js';
import { Reel } from '../models/reel.model.js';
import { Save } from '../models/save.model.js';
import { User } from '../models/user.model.js';
import { default as emailService, default as EmailService } from '../services/email.service.js';
import smsService from '../services/sms.service.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { saveFileLocally, uploadOnCloudinary } from '../utils/localStorage.js';
import redis from '../utils/redis.config.js';
// import crypto from "crypto";

// Utility function to generate a 6-digit OTP as string
export function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;

    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    console.error('Token generation error:', error);
    throw new ApiError(
      500,
      error?.message || 'Something went wrong while generating refresh and access tokens'
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, password, gender, dob } = req.body;

  // Validate required fields
  if (!firstName?.trim() || !lastName?.trim() || !password?.trim()) {
    throw new ApiError(400, 'First name, last name, and password are required');
  }

  // Password validation (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(password)) {
    throw new ApiError(
      400,
      'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number'
    );
  }

  // At least one of email or phone must be provided
  if (!email && !phone) {
    throw new ApiError(400, 'Either email or phone number is required');
  }

  // Validate gender if provided
  if (gender && !['male', 'female', 'other', 'prefer_not_to_say'].includes(gender)) {
    throw new ApiError(400, 'Invalid gender value');
  }

  // Validate date of birth (must be 16+)
  if (dob) {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 16) {
      throw new ApiError(400, 'You must be at least 16 years old to create an account');
    }
  }

  // Check if user already exists in database
  const query = [];
  if (email) query.push({ email });
  if (phone) query.push({ phone });

  const existedUser = await User.findOne({ $or: query });

  if (existedUser) {
    throw new ApiError(409, 'User with this email or phone already exists');
  }

  // Check rate limiting - prevent spam (max 3 attempts per 2 minutes)
  const identifier = email || phone;
  const rateLimitKey = `ratelimit:registration:${identifier}`;
  const attemptCount = await redis.incr(rateLimitKey);

  if (attemptCount === 1) {
    await redis.expire(rateLimitKey, 2 * 60); // 2 minutes
  }

  if (attemptCount > 3) {
    throw new ApiError(429, 'Too many registration attempts. Please try again later.');
  }

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Store registration data in Redis (expires in 10 minutes)
  const registrationData = {
    firstName,
    lastName,
    email: email || null,
    phone: phone || null,
    hashedPassword,
    hashedOtp,
    otpCreatedAt: Date.now(),
    gender: gender || null,
    dob: dob || null,
  };

  const redisKey = `registration:${identifier}`;
  await redis.setex(
    redisKey,
    10 * 60, // 10 minutes TTL
    JSON.stringify(registrationData)
  );

  // Send OTP
  try {
    if (email) {
      await emailService.sendOTPEmail(email, otp, 'registration');

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            otpSent: true,
            identifier: email,
            method: 'email',
            expiresIn: 600, // 10 minutes in seconds
          },
          'OTP sent to your email. Please verify within 10 minutes.'
        )
      );
    } else if (phone) {
      await smsService.sendOTP(phone, otp, 'registration');

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            otpSent: true,
            identifier: phone,
            method: 'sms',
            expiresIn: 600,
          },
          'OTP sent to your phone. Please verify within 10 minutes.'
        )
      );
    }
  } catch (error) {
    // Clean up Redis data if OTP sending fails
    await redis.del(redisKey);
    throw new ApiError(500, error?.message || 'Failed to send OTP. Please try again.');
  }
});

// Step 2: Verify OTP and create user
const verifyRegisterOtp = asyncHandler(async (req, res) => {
  const { identifier, otp } = req.body; // identifier = email or phone

  if (!identifier?.trim()) {
    throw new ApiError(400, 'identifier is required');
  }

  if (!otp?.trim()) {
    throw new ApiError(400, 'OTP is required');
  }

  // Get registration data from Redis
  const redisKey = `registration:${identifier}`;
  const registrationDataJson = await redis.get(redisKey);

  if (!registrationDataJson) {
    throw new ApiError(
      400,
      'OTP has expired or registration session not found. Please register again.'
    );
  }

  const registrationData = JSON.parse(registrationDataJson);

  // Check OTP expiry (3 minutes from creation)
  const otpAge = Date.now() - registrationData.otpCreatedAt;
  if (otpAge > 3 * 60 * 1000) {
    await redis.del(redisKey);
    throw new ApiError(400, 'OTP has expired. Please request a new one.');
  }

  // Verify OTP
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

  if (hashedOtp !== registrationData.hashedOtp) {
    throw new ApiError(400, 'Invalid OTP');
  }

  // Check again if user was created in the meantime (race condition)
  const query = [];
  if (registrationData.email) query.push({ email: registrationData.email });
  if (registrationData.phone) query.push({ phone: registrationData.phone });

  const existingUser = await User.findOne({ $or: query });
  if (existingUser) {
    await redis.del(redisKey);
    throw new ApiError(409, 'User already exists');
  }

  // Create user account immediately with profileCompleted = false
  // This way user can complete profile anytime without token expiration
  const user = await User.create({
    firstName: registrationData.firstName,
    lastName: registrationData.lastName,
    email: registrationData.email || undefined,
    phone: registrationData.phone || undefined,
    password: registrationData.hashedPassword,
    gender: registrationData.gender || undefined,
    dob: registrationData.dob ? new Date(registrationData.dob) : undefined,
    status: 'active',
    profileCompleted: false, // User needs to complete profile
    username: `user_${Date.now()}`, // Temporary username, will be updated in profile setup
  });

  // Clean up Redis
  await redis.del(redisKey);
  await redis.del(`ratelimit:registration:${identifier}`);

  // Generate tokens
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

  const createdUser = await User.findById(user._id).select('-password -refreshToken');

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  };

  return res
    .status(201)
    .cookie('accessToken', accessToken, cookieOptions)
    .cookie('refreshToken', refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        201,
        {
          user: createdUser,
          accessToken,
          refreshToken,
          profileCompleted: false, // Frontend should redirect to profile setup
        },
        'Account created successfully. Please complete your profile.'
      )
    );
});

// Step 3: Resend OTP
// const resendRegistrationOtp = asyncHandler(async (req, res) => {
//   const { identifier } = req.body; // email or phone

//   if (!identifier?.trim()) {
//     throw new ApiError(400, "Email or phone is required");
//   }

//   // Check rate limiting for resend
//   const resendRateLimitKey = `ratelimit:resend:${identifier}`;
//   const resendCount = await redis.incr(resendRateLimitKey);

//   if (resendCount === 1) {
//     await redis.expire(resendRateLimitKey, 15 * 60);
//   }

//   if (resendCount > 3) {
//     throw new ApiError(429, "Too many resend attempts. Please try again later.");
//   }

//   // Get existing registration data
//   const redisKey = `registration:${identifier}`;
//   const registrationDataJson = await redis.get(redisKey);

//   if (!registrationDataJson) {
//     throw new ApiError(
//       404,
//       "Registration session not found. Please start registration again."
//     );
//   }

//   const registrationData = JSON.parse(registrationDataJson);

//   // Generate new OTP
//   const otp = Math.floor(100000 + Math.random() * 900000).toString();
//   const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

//   // Update registration data with new OTP
//   registrationData.hashedOtp = hashedOtp;
//   registrationData.otpCreatedAt = Date.now();

//   // Store updated data (refresh TTL to 10 minutes)
//   await redis.setex(
//     redisKey,
//     10 * 60,
//     JSON.stringify(registrationData)
//   );

//   // Send new OTP
//   try {
//     if (registrationData.email) {
//       await emailService.sendOTPEmail(registrationData.email, otp, "registration");

//       return res.status(200).json(
//         new ApiResponse(
//           200,
//           {
//             otpSent: true,
//             method: "email",
//           },
//           "New OTP sent to your email"
//         )
//       );
//     } else if (registrationData.phone) {
//       await smsService.sendOTP(registrationData.phone, otp, "registration");

//       return res.status(200).json(
//         new ApiResponse(
//           200,
//           {
//             otpSent: true,
//             method: "sms",
//           },
//           "New OTP sent to your phone"
//         )
//       );
//     }
//   } catch (error) {
//     throw new ApiError(
//       500,
//       error?.message || "Failed to resend OTP. Please try again."
//     );
//   }
// });

// Resend Registration OTP - Active Implementation
const resendRegistrationOtp = asyncHandler(async (req, res) => {
  const { email, phone } = req.body;
  const identifier = email || phone;

  if (!identifier?.trim()) {
    throw new ApiError(400, 'Email or phone is required');
  }

  // Check rate limiting for resend
  const resendRateLimitKey = `ratelimit:resend:${identifier}`;
  const resendCount = await redis.incr(resendRateLimitKey);

  if (resendCount === 1) {
    await redis.expire(resendRateLimitKey, 15 * 60); // 15 minutes
  }

  if (resendCount > 5) {
    throw new ApiError(429, 'Too many resend attempts. Please try again later.');
  }

  // Get existing registration data
  const redisKey = `registration:${identifier}`;
  const registrationDataJson = await redis.get(redisKey);

  if (!registrationDataJson) {
    throw new ApiError(
      404,
      'Registration session not found or expired. Please start registration again.'
    );
  }

  const registrationData = JSON.parse(registrationDataJson);

  // Generate new OTP
  const otp = generateOTP();
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

  // Update registration data with new OTP
  registrationData.hashedOtp = hashedOtp;
  registrationData.otpCreatedAt = Date.now();

  // Store updated data (refresh TTL to 10 minutes)
  await redis.setex(redisKey, 10 * 60, JSON.stringify(registrationData));

  // Send new OTP
  try {
    if (email || registrationData.email) {
      const emailAddress = email || registrationData.email;
      await emailService.sendOTPEmail(emailAddress, otp, 'registration');
      console.log(`OTP resent to email: ${emailAddress}`);

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            otpSent: true,
            method: 'email',
          },
          'New OTP sent to your email'
        )
      );
    } else if (phone || registrationData.phone) {
      const phoneNumber = phone || registrationData.phone;
      await smsService.sendOTP(phoneNumber, otp, 'registration');
      console.log(`OTP resent to phone: ${phoneNumber}`);

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            otpSent: true,
            method: 'sms',
          },
          'New OTP sent to your phone'
        )
      );
    }
  } catch (error) {
    console.error('Failed to resend OTP:', error);
    throw new ApiError(500, error?.message || 'Failed to resend OTP. Please try again.');
  }
});

// login user Api (step 1: credentials + send OTP)
const loginUser = asyncHandler(async (req, res) => {
  const { email, phone, password } = req.body;

  if (!email && !phone) {
    throw new ApiError(400, 'Email or phone is required');
  }

  if (!password) {
    throw new ApiError(400, 'Password is required');
  }

  // Build query more explicitly
  const query = [];
  if (email) {
    query.push({ email: email.toLowerCase().trim() });
  }
  if (phone) {
    query.push({ phone: phone.trim() });
  }

  const user = await User.findOne({
    $or: query,
  }).select('+password');

  if (!user) {
    throw new ApiError(404, 'User does not exist');
  }

  // Verify the user matches what we're looking for
  const emailMatch = email && user.email?.toLowerCase() === email.toLowerCase();
  const phoneMatch = phone && user.phone === phone;

  if (!emailMatch && !phoneMatch) {
    console.error('QUERY MISMATCH! Found wrong user!');
    console.error('Requested email:', email, 'Found email:', user.email);
    console.error('Requested phone:', phone, 'Found phone:', user.phone);
    throw new ApiError(404, 'User does not exist');
  }

  // Check if account is locked
  if (user.isLocked()) {
    const lockTimeRemaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
    throw new ApiError(
      423,
      `Account is temporarily locked. Please try again in ${lockTimeRemaining} minutes.`
    );
  }

  // Auto-clear expired lock
  if (user.lockUntil && user.lockUntil <= Date.now()) {
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save({ validateBeforeSave: false });
  }

  // Check if user is active
  if (user.status !== 'active') {
    throw new ApiError(403, 'Account is not active. Please contact administrator.');
  }

  const isMatch = await user.isPasswordCorrect(password);

  if (!isMatch) {
    // Increment login attempts
    user.loginAttempts += 1;
    if (user.loginAttempts >= 5) {
      user.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
    }
    await user.save({ validateBeforeSave: false });
    throw new ApiError(401, 'Invalid user credentials');
  }

  // DIRECT LOGIN - OTP COMMENTED OUT
  // Reset login attempts on successful login
  user.loginAttempts = 0;
  user.lockUntil = undefined;
  await user.save({ validateBeforeSave: false });

  // Generate tokens and login directly
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

  const loggedInUser = await User.findById(user._id).select('-password -refreshToken');

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  };

  return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        'User logged in successfully'
      )
    );

  /* OTP LOGIN - COMMENTED OUT FOR DIRECT LOGIN
  // Generate OTP and send email
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

  user.otp = {
    code: hashedOtp,
    expiresAt: new Date(Date.now() + 2 * 60 * 1000), // 2 minutes
  };
  user.loginAttempts = 0;
  user.lockUntil = undefined;

  await user.save({ validateBeforeSave: false });
  try {
    // Send OTP via email or SMS based on what user has
    if (user.email && email) {
      await emailService.sendOTPEmail(user.email, otp, "login");
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            otpSent: true,
            email: user.email,
            userId: user._id,
            method: "email",
          },
          "OTP sent to your registered email"
        )
      );
    } else if (user.phone && phone) {
      await smsService.sendOTP(user.phone, otp, "login");
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            otpSent: true,
            phone: user.phone,
            userId: user._id,
            method: "sms",
          },
          "OTP sent to your registered phone"
        )
      );
    }
  } catch (error) {
    user.otp = undefined;
    await user.save({ validateBeforeSave: false });
    throw new ApiError(
      500,
      error?.message || "Failed to send OTP. Please try again."
    );
  }
  */
});

// login user Api (step 2: verify OTP + issue tokens) - COMMENTED OUT FOR DIRECT LOGIN
/*
const verifyLoginOtp = asyncHandler(async (req, res) => {
  const { email, phone, userId, otp } = req.body;


  if (!otp) {
    throw new ApiError(400, "OTP is required");
  }

  if (!email && !phone && !userId) {
    throw new ApiError(400, "Email, phone, or userId is required");
  }

  const user = userId
    ? await User.findById(userId)
    : await User.findOne({
        $or: [{ email }, { phone }],
      });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

    id: user._id,
    email: user.email,
    phone: user.phone,
    hasOtp: !!user.otp,
    otpCode: user.otp?.code,
    otpExpires: user.otp?.expiresAt
  });

  if (!user.otp?.code || !user.otp?.expiresAt) {
    console.error("OTP not found in user record!");
    throw new ApiError(400, "No OTP request found for this user");
  }

  if (user.otp.expiresAt.getTime() < Date.now()) {
    user.otp = undefined;
    await user.save({ validateBeforeSave: false });
    throw new ApiError(400, "OTP has expired. Please request a new one.");
  }

  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

  if (hashedOtp !== user.otp.code) {
    throw new ApiError(400, "Invalid OTP");
  }

  user.otp = undefined;
  user.lastLogin = new Date();

  await user.save({ validateBeforeSave: false });

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken -otp"
  );

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});
*/

// Temporary verifyLoginOtp stub for compatibility
const verifyLoginOtp = asyncHandler(async (req, res) => {
  throw new ApiError(501, 'OTP login is currently disabled. Please use direct login.');
});

// logout user Api
const logOutUser = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, 'Unauthorized request');
  }

  // Decode without verify (ignore expiration)
  let decodedToken;
  try {
    decodedToken = jwt.decode(incomingRefreshToken);
  } catch (error) {
    decodedToken = null;
  }

  if (decodedToken?._id) {
    await User.findByIdAndUpdate(decodedToken._id, {
      $unset: { refreshToken: 1 },
    });
  }

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  };

  return res
    .status(200)
    .clearCookie('accessToken', cookieOptions)
    .clearCookie('refreshToken', cookieOptions)
    .json(new ApiResponse(200, {}, 'user logged Out'));
});

// Get current user
const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password -refreshToken');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  const followersCount = await Followers.countDocuments({
      following_id: user._id,
      status: 'accepted',
    }),
    followingCount = await Followers.countDocuments({
      follower_id: user._id,
      status: 'accepted',
    }),
    totalPosts = await Post.countDocuments({
      user_id: user._id,
      is_deleted: false,
    }),
    totalReels = await Reel.countDocuments({
      user_id: user._id,
      is_deleted: false,
    }),
    totalSavedPosts = await Save.countDocuments({
      user_id: user._id,
    });
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...user.toObject(),
        followersCount,
        followingCount,
        totalPosts,
        totalReels,
        totalSavedPosts,
      },
      'User fetched successfully'
    )
  );
});

// Refresh access token
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, 'Unauthorized request');
  }

  try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id).select('+refreshToken');

    if (!user) {
      throw new ApiError(401, 'Invalid refresh token');
    }

    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, 'Refresh token is expired or used');
    }

    const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshTokens(
      user._id
    );

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    };

    return res
      .status(200)
      .cookie('accessToken', accessToken, cookieOptions)
      .cookie('refreshToken', newRefreshToken, cookieOptions)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          'Access token refreshed'
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || 'Invalid refresh token');
  }
});

// Forgot Password - Send Reset Token (JWT)
const forgotPassword = asyncHandler(async (req, res) => {
  const { email, phone } = req.body;

  if (!email && !phone) {
    throw new ApiError(400, 'Email or phone is required');
  }

  // Build query properly - only include fields that are provided
  const query = [];
  if (email) {
    query.push({ email: email.toLowerCase().trim() });
  }
  if (phone) {
    query.push({ phone: phone.trim() });
  }

  const user = await User.findOne({
    $or: query,
  });

  if (!user) {
    throw new ApiError(404, 'User not found with this email or phone');
  }

  // Verify the user matches what we're looking for
  const emailMatch = email && user.email?.toLowerCase() === email.toLowerCase().trim();
  const phoneMatch = phone && user.phone === phone.trim();

  if (!emailMatch && !phoneMatch) {
    console.error('QUERY MISMATCH! Found wrong user!');
    console.error('Requested email:', email, 'Found email:', user.email);
    console.error('Requested phone:', phone, 'Found phone:', user.phone);
    throw new ApiError(404, 'User not found with this email or phone');
  }

  // Generate JWT reset token (valid for 15 minutes)
  const resetToken = jwt.sign({ userId: user._id }, process.env.RESET_SECRET, {
    expiresIn: '15m',
  });

  // Send reset link via email with clickable button
  if (typeof EmailService.isConfigured === 'function' && !EmailService.isConfigured()) {
    throw new ApiError(500, 'Email service not configured');
  }

  const resetUrl = `${
    process.env.FRONTEND_URL || 'http://localhost:3000'
  }/reset-password?token=${resetToken}`;

  await EmailService.sendPasswordResetEmail(user.email, resetUrl);
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        message: 'Password reset link sent to your email',
        email: user.email, // Return the actual email for confirmation
        expiresIn: 900,
      },
      'Password reset link sent'
    )
  );
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.query;
  const { newPassword } = req.body;

  if (!token) {
    throw new ApiError(400, 'Reset token is required');
  }

  if (!newPassword) {
    throw new ApiError(400, 'New password is required');
  }

  // Password validation (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    throw new ApiError(
      400,
      'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number'
    );
  }

  // Verify the JWT token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.RESET_SECRET);
  } catch (error) {
    throw new ApiError(400, 'Invalid or expired reset token');
  }

  const user = await User.findById(decoded.userId).select('+password');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Save new password
  user.password = newPassword;
  await user.save();

  return res.status(200).json(new ApiResponse(200, {}, 'Password reset successfully'));
});

const changePassword = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Current and new passwords are required');
  }

  const user = await User.findById(userId).select('+password');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const isMatch = await user.isPasswordCorrect(currentPassword);
  if (!isMatch) {
    throw new ApiError(401, 'Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();

  return res.status(200).json(new ApiResponse(200, {}, 'Password changed successfully'));
});

const deleteUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;

  const user = await User.findByIdAndDelete(userId);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return res.status(200).json(new ApiResponse(200, {}, 'User deleted successfully'));
});

const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  let {
    firstName,
    lastName,
    username,
    bio,
    profile_type,
    coverPhoto,
    isPrivate,
    dateOfBirth,
    allowDownloads,
  } = req.body;

  // BACKWARD COMPATIBILITY: Handle frontend sending profile_type: "private"/"public"
  // Convert to isPrivate boolean
  if (profile_type === 'private' || profile_type === 'public') {
    isPrivate = profile_type === 'private';
    profile_type = undefined; // Don't update the actual profile_type field
  }

  // Validate isPrivate if provided
  if (isPrivate !== undefined && typeof isPrivate !== 'boolean') {
    throw new ApiError(400, 'isPrivate must be a boolean value');
  }

  // Validate profile_type if provided (should be "personal" or "business")
  if (profile_type && !['personal', 'business'].includes(profile_type)) {
    throw new ApiError(400, 'profile_type must be either "personal" or "business"');
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Validate and update username if provided
  if (username) {
    const normalizedUsername = username.toLowerCase().trim();

    // Check if username is different from current
    if (normalizedUsername !== user.username) {
      // Check if username is already taken
      const existingUser = await User.findOne({
        username: normalizedUsername,
        _id: { $ne: userId },
      });
      if (existingUser) {
        throw new ApiError(400, 'This username is already taken');
      }
      user.username = normalizedUsername;
    }
  }

  // Update fields if provided
  if (firstName) user.firstName = firstName;
  if (lastName !== undefined) user.lastName = lastName;
  if (bio !== undefined) user.bio = bio;
  if (profile_type) user.profile_type = profile_type;
  if (coverPhoto) user.coverPhoto = coverPhoto;
  if (dateOfBirth) user.dob = dateOfBirth;
  if (allowDownloads !== undefined) user.allowDownloads = allowDownloads;

  // Handle privacy toggle
  if (isPrivate !== undefined) {
    const oldPrivacy = user.isPrivate;
    user.isPrivate = isPrivate;

    // If switching from private to public, auto-accept all pending follow requests
    if (oldPrivacy === true && isPrivate === false) {
      await Followers.updateMany(
        { following_id: userId, status: 'requested' },
        { $set: { status: 'accepted' } }
      );
    }
  }

  await user.save();

  const updatedUser = await User.findById(userId).select('-password -refreshToken -otp');

  return res
    .status(200)
    .json(new ApiResponse(200, { user: updatedUser }, 'Profile updated successfully'));
});

// Unlock account (for development/admin use)
const unlockAccount = asyncHandler(async (req, res) => {
  const { email, phone, userId } = req.body;

  if (!email && !phone && !userId) {
    throw new ApiError(400, 'Email, phone, or userId is required');
  }

  const query = [];
  if (userId) {
    query.push({ _id: userId });
  } else {
    if (email) query.push({ email });
    if (phone) query.push({ phone });
  }

  const user = await User.findOne({ $or: query });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Reset lock fields only - don't trigger password rehash
  await User.updateOne(
    { _id: user._id },
    {
      $set: { loginAttempts: 0 },
      $unset: { lockUntil: '' },
    }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { email: user.email, phone: user.phone },
        'Account unlocked successfully'
      )
    );
});

// Reset password for testing (development only)
const resetPasswordForTesting = asyncHandler(async (req, res) => {
  const { email, phone, userId, newPassword } = req.body;

  if (!email && !phone && !userId) {
    throw new ApiError(400, 'Email, phone, or userId is required');
  }

  if (!newPassword) {
    throw new ApiError(400, 'New password is required');
  }

  const query = [];
  if (userId) {
    query.push({ _id: userId });
  } else {
    if (email) query.push({ email });
    if (phone) query.push({ phone });
  }

  const user = await User.findOne({ $or: query }).select('+password');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Set new password (will be hashed by pre-save hook)
  user.password = newPassword;
  await user.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { email: user.email, phone: user.phone },
        'Password reset successfully for testing'
      )
    );
});

// Get user profile by userId
const getUserProfile = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    throw new ApiError(400, 'User ID is required');
  }

  // Check if userId is a valid MongoDB ObjectId or a username
  const mongoose = await import('mongoose');
  const isValidObjectId = mongoose.default.Types.ObjectId.isValid(userId);

  // Find user by userId (ObjectId) or username
  let user;
  if (isValidObjectId) {
    user = await User.findById(userId).select(
      'firstName lastName username bio avatar profileImage coverPhoto isVerified profile_type isPrivate allowDownloads status blockedUsers'
    );
  }

  // If not found by ObjectId, try to find by username
  if (!user) {
    user = await User.findOne({ username: userId }).select(
      'firstName lastName username bio avatar profileImage coverPhoto isVerified profile_type isPrivate allowDownloads status blockedUsers'
    );
  }

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Use the actual user's _id for subsequent operations
  const profileUserId = user._id;

  if (user.status !== 'active') {
    throw new ApiError(403, 'This account is not available');
  }

  // Check if current user is viewing the profile
  const currentUserId = req.user?._id;

  // ✅ INSTAGRAM-LIKE BLOCKING: Check bidirectional blocking BEFORE showing profile
  if (currentUserId && currentUserId.toString() !== profileUserId.toString()) {
    // Check if current user has blocked this profile user
    const currentUser = await User.findById(currentUserId).select('blockedUsers').lean();
    const hasBlockedThem = currentUser?.blockedUsers?.some(
      (blockedId) => blockedId.toString() === profileUserId.toString()
    );

    // Check if this profile user has blocked the current user
    const theyBlockedYou = user.blockedUsers?.some(
      (blockedId) => blockedId.toString() === currentUserId.toString()
    );

    // If either has blocked the other, deny access
    if (hasBlockedThem || theyBlockedYou) {
      throw new ApiError(404, 'User not found'); // Return 404 like Instagram (don't reveal blocking)
    }
  }

  // ✅ OPTIMIZED: Run all count queries in parallel
  const [followersCount, followingCount, postsCount, reelsCount, followRecord, reverseFollowRecord] = await Promise.all([
    Followers.countDocuments({ following_id: profileUserId, status: 'accepted' }),
    Followers.countDocuments({ follower_id: profileUserId, status: 'accepted' }),
    Post.countDocuments({ user_id: profileUserId, is_deleted: false }),
    Reel.countDocuments({ user_id: profileUserId, is_deleted: false }),
    currentUserId && currentUserId.toString() !== profileUserId.toString()
      ? Followers.findOne({ follower_id: currentUserId, following_id: profileUserId }).select('status').lean()
      : null,
    // Check if profile user follows the current user (for "Follow Back" feature)
    currentUserId && currentUserId.toString() !== profileUserId.toString()
      ? Followers.findOne({ follower_id: profileUserId, following_id: currentUserId, status: 'accepted' }).select('status').lean()
      : null,
  ]);

  // Check follow status from the parallel query result
  let isFollowing = false;
  let isPending = false;
  let followsYou = false;
  if (followRecord) {
    isFollowing = followRecord.status === 'accepted';
    isPending = followRecord.status === 'requested';
  }
  // Check if profile user follows the current user
  if (reverseFollowRecord) {
    followsYou = true;
  }

  // Build response
  const profileData = {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    username: user.username,
    bio: user.bio || '',
    profilePicture: user.profileImage || user.avatar,
    avatar: user.avatar,
    coverPhoto: user.coverPhoto,
    followersCount,
    followingCount,
    postsCount,
    reelsCount,
    isVerified: user.isVerified,
    profile_type: user.profile_type,
    isPrivate: user.isPrivate,
    allowDownloads: user.allowDownloads,
    isFollowing: isFollowing,
    isPending: isPending,
    followsYou: followsYou,
  };

  return res
    .status(200)
    .json(new ApiResponse(200, profileData, 'User profile retrieved successfully'));
});

const updateProfileImage = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(400, 'Please provide user ID first');
  }
  // The file will be available as req.file after uploadSingle middleware
  // Try different ways to access the file
  const file = req.file || req.files?.file || req.files?.[0];

  if (!file) {
    throw new ApiError(400, 'At least one media file (image/video) is required');
  }

  // Save to local storage instead of Cloudinary
  const result = await saveFileLocally(file, userId.toString(), 'avatar');

  if (!result) {
    throw new ApiError(500, `Failed to upload profile image`);
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { profileImage: result.url, avatar: result.url },
    { new: true }
  ).select('-password -refreshToken -otp');

  return res.status(200).json(new ApiResponse(200, user, 'Profile image updated successfully'));
});

// Update Cover Photo
const updateCoverPhoto = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(400, 'Please provide user ID first');
  }

  // The file will be available as req.file after upload middleware
  const file = req.file || req.files?.coverPhoto?.[0] || req.files?.[0];

  if (!file) {
    throw new ApiError(400, 'Cover photo is required');
  }

  // Save to local storage
  const result = await saveFileLocally(file, userId.toString(), 'cover');

  if (!result) {
    throw new ApiError(500, 'Failed to upload cover photo');
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { coverPhoto: result.url },
    { new: true }
  ).select('-password -refreshToken -otp');

  return res.status(200).json(new ApiResponse(200, user, 'Cover photo updated successfully'));
});

// Block a user
const blockUser = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id; // From JWT middleware
  const { userId } = req.params; // Extract from URL parameter

  // Validation: Check if userId is provided
  if (!userId) {
    throw new ApiError(400, 'User ID is required');
  }

  // Validation: Check if user is trying to block themselves
  if (currentUserId.toString() === userId.toString()) {
    throw new ApiError(400, 'You cannot block yourself');
  }

  // Validation: Check if the user to be blocked exists
  const userToBlock = await User.findById(userId);
  if (!userToBlock) {
    throw new ApiError(404, 'User not found');
  }

  // Get current user
  const currentUser = await User.findById(currentUserId);

  // Check if user is already blocked
  if (currentUser.blockedUsers.includes(userId)) {
    throw new ApiError(400, 'User is already blocked');
  }

  // Add user to blocked list
  currentUser.blockedUsers.push(userId);
  await currentUser.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        blockedUserId: userId,
        blockedUser: {
          _id: userToBlock._id,
          firstName: userToBlock.firstName,
          lastName: userToBlock.lastName,
          username: userToBlock.username,
          profileImage: userToBlock.profileImage || userToBlock.avatar,
        },
      },
      'User blocked successfully'
    )
  );
});

// Unblock a user
const unblockUser = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id; // From JWT middleware
  const { userId } = req.params; // Extract from URL parameter

  // Validation: Check if userId is provided
  if (!userId) {
    throw new ApiError(400, 'User ID is required');
  }

  // Validation: Check if the user exists
  const userToUnblock = await User.findById(userId);
  if (!userToUnblock) {
    throw new ApiError(404, 'User not found');
  }

  // Get current user
  const currentUser = await User.findById(currentUserId);

  // Check if user is actually blocked
  if (!currentUser.blockedUsers.includes(userId)) {
    throw new ApiError(400, 'User is not blocked');
  }

  // Remove user from blocked list
  currentUser.blockedUsers = currentUser.blockedUsers.filter(
    (id) => id.toString() !== userId.toString()
  );
  await currentUser.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        unblockedUserId: userId,
      },
      'User unblocked successfully'
    )
  );
});

// Get list of blocked users with pagination
const getBlockedUsers = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id; // From JWT middleware
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  // Get current user with populated blocked users
  const currentUser = await User.findById(currentUserId)
    .select('blockedUsers')
    .populate({
      path: 'blockedUsers',
      select: 'firstName lastName username profileImage avatar bio isVerified',
      options: {
        skip: skip,
        limit: limit,
      },
    });

  if (!currentUser) {
    throw new ApiError(404, 'User not found');
  }

  // Get total count of blocked users
  const totalBlocked = currentUser.blockedUsers.length;
  const totalPages = Math.ceil(totalBlocked / limit);

  // Format the response
  const blockedUsers = currentUser.blockedUsers.map((user) => ({
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    username: user.username,
    profileImage: user.profileImage || user.avatar,
    bio: user.bio,
    isVerified: user.isVerified,
  }));

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        blockedUsers,
        pagination: {
          currentPage: page,
          totalPages,
          totalBlocked,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      'Blocked users retrieved successfully'
    )
  );
});

// Update privacy settings (profile type, private account, download permissions)
const updatePrivacySettings = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { profile_type, isPrivate, allowDownloads } = req.body;

  // Validate inputs
  if (profile_type && !['personal', 'business'].includes(profile_type)) {
    throw new ApiError(400, 'profile_type must be either "personal" or "business"');
  }

  if (isPrivate !== undefined && typeof isPrivate !== 'boolean') {
    throw new ApiError(400, 'isPrivate must be a boolean value');
  }

  if (allowDownloads !== undefined && typeof allowDownloads !== 'boolean') {
    throw new ApiError(400, 'allowDownloads must be a boolean value');
  }

  // Build update object
  const updateData = {};
  if (profile_type !== undefined) {
    updateData.profile_type = profile_type;
  }
  if (isPrivate !== undefined) {
    updateData.isPrivate = isPrivate;
  }
  if (allowDownloads !== undefined) {
    updateData.allowDownloads = allowDownloads;
  }

  // Check if there's anything to update
  if (Object.keys(updateData).length === 0) {
    throw new ApiError(400, 'No privacy settings provided to update');
  }

  // Update user
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Store old privacy state for follow request handling
  const oldIsPrivate = user.isPrivate;

  // Apply updates
  Object.assign(user, updateData);
  await user.save();

  // If switching from private to public, auto-accept all pending follow requests
  if (oldIsPrivate === true && isPrivate === false) {
    const pendingRequests = await Followers.updateMany(
      { following_id: userId, status: 'requested' },
      { $set: { status: 'accepted' } }
    );
  }

  // Return updated user without sensitive fields
  const updatedUser = await User.findById(userId).select('-password -refreshToken -otp');

  return res
    .status(200)
    .json(new ApiResponse(200, { user: updatedUser }, 'Privacy settings updated successfully'));
});

// Check username availability
const checkUsernameAvailability = asyncHandler(async (req, res) => {
  const { username } = req.query;

  // Validate that username is provided
  if (!username) {
    throw new ApiError(400, 'Username is required');
  }

  // Validate username format
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json(
      new ApiResponse(
        400,
        {
          available: false,
          message:
            'Username must be 3-30 characters and contain only letters, numbers, and underscores',
        },
        'Invalid username format'
      )
    );
  }

  // Reserved usernames that cannot be used
  const reservedUsernames = [
    'admin',
    'administrator',
    'root',
    'system',
    'support',
    'help',
    'api',
    'www',
    'mail',
    'ftp',
    'blog',
    'dev',
    'stage',
    'test',
    'official',
    'verified',
    'staff',
    'team',
    'info',
    'contact',
    'about',
    'terms',
    'privacy',
    'settings',
    'profile',
    'user',
    'login',
    'signup',
    'register',
    'logout',
    'auth',
    'account',
  ];

  if (reservedUsernames.includes(username.toLowerCase())) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          available: false,
          message: 'This username is reserved and cannot be used',
        },
        'Username is reserved'
      )
    );
  }

  // Check if username exists in database (case-insensitive)
  const existingUser = await User.findOne({
    username: username.toLowerCase(),
  });

  const isAvailable = !existingUser;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        available: isAvailable,
        message: isAvailable ? 'Username is available' : 'Username is already taken',
        suggestions: !isAvailable
          ? [
              `${username}_${Math.floor(Math.random() * 999)}`,
              `${username}${new Date().getFullYear()}`,
              `${username}_official`,
            ]
          : undefined,
      },
      isAvailable ? 'Username available' : 'Username taken'
    )
  );
});

// Complete profile setup (can be done anytime after registration)
const completeProfile = asyncHandler(async (req, res) => {
  const userId = req.user._id; // From JWT authentication
  const { username, bio, interests } = req.body;

  // Get current user
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // If profile already completed, this is an update
  if (user.profileCompleted) {
    throw new ApiError(
      400,
      'Profile already completed. Use update-profile endpoint to make changes.'
    );
  }

  // Validate username is provided
  if (!username) {
    throw new ApiError(400, 'Username is required');
  }

  // Validate username format
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  if (!usernameRegex.test(username)) {
    throw new ApiError(
      400,
      'Username must be 3-30 characters and contain only letters, numbers, and underscores'
    );
  }

  // Check if username is already taken (case-insensitive)
  const existingUsername = await User.findOne({
    username: username.toLowerCase(),
    _id: { $ne: userId }, // Exclude current user
  });

  if (existingUsername) {
    throw new ApiError(400, 'Username is already taken');
  }

  // Update user profile
  user.username = username.toLowerCase();
  if (bio !== undefined) {
    user.bio = bio;
  }

  // Handle interests
  if (interests !== undefined) {
    let parsedInterests = interests;
    // Parse if it's a JSON string (from FormData)
    if (typeof interests === 'string') {
      try {
        parsedInterests = JSON.parse(interests);
      } catch {
        parsedInterests = [];
      }
    }
    if (Array.isArray(parsedInterests)) {
      user.interests = parsedInterests.filter((i) => typeof i === 'string' && i.trim().length > 0);
    }
  }

  // Handle profile picture upload
  console.log('📷 Profile setup - req.files:', req.files ? Object.keys(req.files) : 'none');
  if (req.files?.profilePicture && req.files.profilePicture[0]) {
    console.log('📷 Uploading profile picture:', req.files.profilePicture[0].path);
    const profilePictureUpload = await uploadOnCloudinary(req.files.profilePicture[0].path);
    if (profilePictureUpload) {
      user.profileImage = profilePictureUpload.secure_url;
      user.avatar = profilePictureUpload.secure_url;
      console.log('✅ Profile image URL set:', user.profileImage);
    } else {
      console.log('⚠️ Profile picture upload returned null');
    }
  } else {
    console.log('📷 No profile picture file received');
  }

  // Handle cover photo upload
  if (req.files?.coverPhoto && req.files.coverPhoto[0]) {
    console.log('🖼️ Uploading cover photo:', req.files.coverPhoto[0].path);
    const coverPhotoUpload = await uploadOnCloudinary(req.files.coverPhoto[0].path);
    if (coverPhotoUpload) {
      user.coverPhoto = coverPhotoUpload.secure_url;
      console.log('✅ Cover photo URL set:', user.coverPhoto);
    } else {
      console.log('⚠️ Cover photo upload returned null');
    }
  } else {
    console.log('🖼️ No cover photo file received');
  }

  // Mark profile as completed
  user.profileCompleted = true;

  await user.save();
  console.log('✅ User saved. profileImage:', user.profileImage, 'coverPhoto:', user.coverPhoto);

  // Return updated user without sensitive fields
  const updatedUser = await User.findById(userId).select('-password -refreshToken -otp');
  console.log(
    '📤 Returning user with profileImage:',
    updatedUser.profileImage,
    'coverPhoto:',
    updatedUser.coverPhoto
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { user: updatedUser }, 'Profile completed successfully'));
});

// Request Email Change - Send OTP to both current email and phone
const requestEmailChange = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { newEmail } = req.body;

  if (!newEmail) {
    throw new ApiError(400, 'New email is required');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newEmail)) {
    throw new ApiError(400, 'Please enter a valid email address');
  }

  // Check if email already exists
  const existingUser = await User.findOne({ email: newEmail.toLowerCase() });
  if (existingUser) {
    throw new ApiError(400, 'This email is already registered');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Generate OTP
  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store OTP and new email in Redis or user document
  await redis.set(
    `email_change:${userId}`,
    JSON.stringify({ newEmail: newEmail.toLowerCase(), otp, expiry: otpExpiry }),
    'EX',
    600 // 10 minutes
  );

  // Send OTP to current email
  if (user.email) {
    try {
      await emailService.sendOTPEmail(user.email, otp, 'email_change');
    } catch (error) {
      console.error('Error sending email OTP:', error);
    }
  }

  // Send OTP to phone if available
  if (user.phone) {
    try {
      await smsService.sendOTP(user.phone, otp, 'email_change');
    } catch (error) {
      console.error('Error sending SMS OTP:', error);
    }
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Verification code sent to your email and phone'));
});

// Verify Email Change OTP
const verifyEmailChange = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { newEmail, otp } = req.body;

  if (!newEmail || !otp) {
    throw new ApiError(400, 'New email and OTP are required');
  }

  // Get stored OTP data from Redis
  const storedData = await redis.get(`email_change:${userId}`);
  if (!storedData) {
    throw new ApiError(400, 'Verification code expired. Please request a new one.');
  }

  const { newEmail: storedEmail, otp: storedOtp, expiry } = JSON.parse(storedData);

  // Verify OTP
  if (otp !== storedOtp) {
    throw new ApiError(400, 'Invalid verification code');
  }

  // Verify email matches
  if (newEmail.toLowerCase() !== storedEmail) {
    throw new ApiError(400, 'Email mismatch. Please try again.');
  }

  // Check expiry
  if (new Date() > new Date(expiry)) {
    await redis.del(`email_change:${userId}`);
    throw new ApiError(400, 'Verification code expired. Please request a new one.');
  }

  // Update user email
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  user.email = newEmail.toLowerCase();
  await user.save();

  // Clear Redis data
  await redis.del(`email_change:${userId}`);

  const updatedUser = await User.findById(userId).select('-password -refreshToken -otp');

  return res
    .status(200)
    .json(new ApiResponse(200, { user: updatedUser }, 'Email updated successfully'));
});

// Request Phone Change - Send OTP to both email and current phone
const requestPhoneChange = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { newPhone } = req.body;

  if (!newPhone) {
    throw new ApiError(400, 'New phone number is required');
  }

  // Clean phone number (remove spaces, dashes, etc.)
  const cleanPhone = newPhone.replace(/\s+/g, '').replace(/-/g, '');

  // Check if phone already exists
  const existingUser = await User.findOne({ phone: cleanPhone });
  if (existingUser) {
    throw new ApiError(400, 'This phone number is already registered');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Generate OTP
  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store OTP and new phone in Redis
  await redis.set(
    `phone_change:${userId}`,
    JSON.stringify({ newPhone: cleanPhone, otp, expiry: otpExpiry }),
    'EX',
    600 // 10 minutes
  );

  // Send OTP to email
  if (user.email) {
    try {
      await emailService.sendOTPEmail(user.email, otp, 'phone_change');
    } catch (error) {
      console.error('Error sending email OTP:', error);
    }
  }

  // Send OTP to current phone if available
  if (user.phone) {
    try {
      await smsService.sendOTP(user.phone, otp, 'phone_change');
    } catch (error) {
      console.error('Error sending SMS OTP:', error);
    }
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Verification code sent to your email and phone'));
});

// Verify Phone Change OTP
const verifyPhoneChange = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { newPhone, otp } = req.body;

  if (!newPhone || !otp) {
    throw new ApiError(400, 'New phone number and OTP are required');
  }

  // Clean phone number
  const cleanPhone = newPhone.replace(/\s+/g, '').replace(/-/g, '');

  // Get stored OTP data from Redis
  const storedData = await redis.get(`phone_change:${userId}`);
  if (!storedData) {
    throw new ApiError(400, 'Verification code expired. Please request a new one.');
  }

  const { newPhone: storedPhone, otp: storedOtp, expiry } = JSON.parse(storedData);

  // Verify OTP
  if (otp !== storedOtp) {
    throw new ApiError(400, 'Invalid verification code');
  }

  // Verify phone matches
  if (cleanPhone !== storedPhone) {
    throw new ApiError(400, 'Phone number mismatch. Please try again.');
  }

  // Check expiry
  if (new Date() > new Date(expiry)) {
    await redis.del(`phone_change:${userId}`);
    throw new ApiError(400, 'Verification code expired. Please request a new one.');
  }

  // Update user phone
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  user.phone = cleanPhone;
  await user.save();

  // Clear Redis data
  await redis.del(`phone_change:${userId}`);

  const updatedUser = await User.findById(userId).select('-password -refreshToken -otp');

  return res
    .status(200)
    .json(new ApiResponse(200, { user: updatedUser }, 'Phone number updated successfully'));
});

export {
    blockUser,
    changePassword,
    checkUsernameAvailability,
    completeProfile,
    deleteUser,
    forgotPassword,
    getBlockedUsers,
    getCurrentUser,
    getUserProfile,
    loginUser,
    logOutUser,
    refreshAccessToken,
    registerUser,
    requestEmailChange,
    requestPhoneChange,
    resendRegistrationOtp,
    resetPassword,
    resetPasswordForTesting,
    unblockUser,
    unlockAccount,
    updateCoverPhoto,
    updatePrivacySettings,
    updateProfile,
    updateProfileImage,
    verifyEmailChange,
    verifyLoginOtp,
    verifyPhoneChange,
    verifyRegisterOtp
};
