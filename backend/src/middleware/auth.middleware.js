import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

const verifyJwt = asyncHandler(async (req, _, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", ""); // install cookie-parser middleware to use req.cookies

    if (!token) {
      throw new ApiError(401, "Unauthorized request ");
    }

    // Verify token - this will throw error if expired or invalid
    const decodeToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decodeToken?._id).select(
      "-password -refreshToken "
    );

    if (!user) {
      throw new ApiError(401, "Invalid AccessToken");
    }

    req.user = user;
    next();
  } catch (error) {

    if (error.name === "TokenExpiredError") {
      throw new ApiError(401, "Token has expired. Please login again.");
    }
    if (error.name === "JsonWebTokenError") {
      throw new ApiError(401, "Invalid token. Please login again.");
    }

    throw new ApiError(401, error?.message || "Invalid access token");
  }
});

const verifyJwtOptional = asyncHandler(async (req, _, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return next(); // Proceed without user if no token
    }

    // Verify token
    try {
      const decodeToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const user = await User.findById(decodeToken?._id).select(
        "-password -refreshToken "
      );

      if (user) {
        req.user = user;
      }
    } catch (ignore) {
      // Ignore token errors for optional auth
    }

    next();
  } catch (error) {
    next();
  }
});

export { verifyJwt, verifyJwtOptional };
