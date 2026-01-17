import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { model, Schema } from 'mongoose';

const userSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, unique: true, sparse: true },
    password: { type: String, required: true, select: false },
    avatar: { type: String, default: null },
    profileImage: { type: String, default: null }, // Alias for avatar
    coverPhoto: { type: String, default: null },

    // Additional personal details
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    },
    dob: { type: Date }, // Date of birth

    // Role & Access
    role: { type: Schema.Types.ObjectId, ref: 'Role' },
    userType: {
      type: String,
      default: 'user',
      enum: ['user', 'admin'],
      // required: true,
    },

    bio: { type: String, default: null },

    profile_type: {
      type: String,
      enum: ['personal', 'business'],
      default: 'personal',
    },

    // Privacy settings
    isPrivate: {
      type: Boolean,
      default: false, // false = public account, true = private account
    },

    // Download control - whether others can download this user's posts/reels
    allowDownloads: {
      type: Boolean,
      default: true, // Allow downloads by default for backward compatibility
    },

    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'blocked', 'banned'],
      default: 'active',
    },

    // Verification status
    isVerified: {
      type: Boolean,
      default: false,
    },

    // Ban details
    banReason: { type: String },
    banUntil: { type: Date },

    lastLogin: { type: Date },
    lastActive: { type: Date },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },

    // Username
    username: { type: String, unique: true, sparse: true },

    // OTP for verification (registration/login)
    otp: {
      code: { type: String },
      expiresAt: { type: Date },
    },
    isOneline: { type: Boolean, default: false },

    // Refresh token
    refreshToken: { type: String, select: false },

    // Blocked users - array of user IDs that this user has blocked
    blockedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },

  { timestamps: true }
);

// Note: email and phone indexes are created automatically by unique: true

// Virtual for full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Check if account is locked
userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  // Only hash if password doesn't look like it's already hashed
  // Bcrypt hashes always start with $2a$, $2b$, or $2y$
  if (this.password && !this.password.startsWith('$2')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Compare password
userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Generate access token
userSchema.methods.generateAccessToken = async function () {
  return await jwt.sign(
    {
      _id: this._id,
      email: this.email,
      userType: this.userType,
      role: this.role,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '1d',
    }
  );
};

// Generate refresh token
userSchema.methods.generateRefreshToken = async function () {
  return await jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d',
    }
  );
};

export const User = model('User', userSchema);
