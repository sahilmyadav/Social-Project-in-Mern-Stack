import { z } from 'zod';

// ─── Shared helpers ──────────────────────────────────────────────
const trimmedString = (label) => z.string({ required_error: `${label} is required` }).trim();
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
export const objectId = z.string().regex(objectIdRegex, 'Invalid ObjectId');

// ─── Register ────────────────────────────────────────────────────
export const registerSchema = z
  .object({
    firstName: trimmedString('First name').min(1, 'First name is required'),
    lastName: trimmedString('Last name').min(1, 'Last name is required'),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    phone: z.string().optional().or(z.literal('')),
    password: trimmedString('Password').min(8, 'Password must be at least 8 characters'),
    gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
    dob: z.string().optional(),
  })
  .refine((data) => data.email || data.phone, {
    message: 'Email or phone number is required',
  });

// ─── Verify OTP ──────────────────────────────────────────────────
export const verifyOtpSchema = z.object({
  identifier: trimmedString('Identifier').min(1, 'Identifier is required'),
  otp: trimmedString('OTP').min(1, 'OTP is required'),
});

// ─── Resend OTP ──────────────────────────────────────────────────
export const resendOtpSchema = z
  .object({
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    phone: z.string().optional().or(z.literal('')),
  })
  .refine((data) => data.email || data.phone, {
    message: 'Email or phone number is required',
  });

// ─── Login ───────────────────────────────────────────────────────
export const loginSchema = z
  .object({
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    phone: z.string().optional().or(z.literal('')),
    password: trimmedString('Password').min(1, 'Password is required'),
  })
  .refine((data) => data.email || data.phone, {
    message: 'Email or phone number is required',
  });

// ─── Forgot Password ────────────────────────────────────────────
export const forgotPasswordSchema = z
  .object({
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    phone: z.string().optional().or(z.literal('')),
  })
  .refine((data) => data.email || data.phone, {
    message: 'Email or phone number is required',
  });

// ─── Reset Password ─────────────────────────────────────────────
export const resetPasswordSchema = z.object({
  newPassword: trimmedString('New password').min(8, 'Password must be at least 8 characters'),
});

// ─── Change Password ─────────────────────────────────────────────
export const changePasswordSchema = z.object({
  currentPassword: trimmedString('Current password').min(1, 'Current password is required'),
  newPassword: trimmedString('New password').min(8, 'New password must be at least 8 characters'),
});

// ─── Update Profile ──────────────────────────────────────────────
export const updateProfileSchema = z.object({
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  username: z
    .string()
    .trim()
    .regex(
      /^[a-zA-Z0-9_]{3,30}$/,
      'Username must be 3-30 characters (letters, numbers, underscores)'
    )
    .optional(),
  bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),
  profile_type: z.enum(['personal', 'business']).optional(),
  isPrivate: z.boolean().optional(),
  dateOfBirth: z.string().optional(),
  allowDownloads: z.boolean().optional(),
  coverPhoto: z.string().optional(),
});

// ─── Privacy Settings ────────────────────────────────────────────
export const privacySettingsSchema = z
  .object({
    profile_type: z.enum(['personal', 'business']).optional(),
    isPrivate: z.boolean().optional(),
    allowDownloads: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one privacy setting is required',
  });

// ─── Complete Profile ────────────────────────────────────────────
export const completeProfileSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(
      /^[a-zA-Z0-9_]{3,30}$/,
      'Username must be 3-30 characters (letters, numbers, underscores)'
    ),
  bio: z.string().max(500).optional(),
  interests: z.union([z.string(), z.array(z.string())]).optional(),
});

// ─── Email Change ────────────────────────────────────────────────
export const requestEmailChangeSchema = z.object({
  newEmail: z.string().email('Invalid email address'),
});

export const verifyEmailChangeSchema = z.object({
  newEmail: z.string().email('Invalid email address'),
  otp: trimmedString('OTP').min(1, 'OTP is required'),
});

// ─── Phone Change ────────────────────────────────────────────────
export const requestPhoneChangeSchema = z.object({
  newPhone: trimmedString('Phone number').min(1, 'Phone number is required'),
});

export const verifyPhoneChangeSchema = z.object({
  newPhone: trimmedString('Phone number').min(1, 'Phone number is required'),
  otp: trimmedString('OTP').min(1, 'OTP is required'),
});
