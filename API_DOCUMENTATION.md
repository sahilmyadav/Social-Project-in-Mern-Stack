# Social Media API Documentation

**Base URL:** `https://clikkme.in/api/v1`

**Version:** 1.0.0

---

## Table of Contents

1. [Authentication](#authentication)
2. [User Management](#user-management)
3. [Follow System](#follow-system)
4. [Posts](#posts)
5. [Reels](#reels)
6. [Stories](#stories)
7. [Feed](#feed)
8. [Chat & Messaging](#chat--messaging)
9. [Group Chat & Calls](#group-chat--calls)
10. [Comments](#comments)
11. [Notifications](#notifications)
12. [Search](#search)
13. [Live Streaming](#live-streaming)
14. [Admin](#admin)
15. [System](#system)

---

## Authentication

All protected routes require a valid JWT token in the Authorization header:

```
Authorization: Bearer <access_token>
```

Or via cookies:

- `accessToken`
- `refreshToken`

---

## User Management

### Register User

**POST** `/users/register`

Initiates user registration. Sends OTP to email or phone for verification.

**Request Body:**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "password": "Password123",
  "gender": "male",
  "dob": "1995-05-15"
}
```

| Field     | Type   | Required | Description                                            |
| --------- | ------ | -------- | ------------------------------------------------------ |
| firstName | string | Yes      | User's first name                                      |
| lastName  | string | Yes      | User's last name                                       |
| email     | string | No\*     | Email address (\*either email or phone required)       |
| phone     | string | No\*     | Phone number (\*either email or phone required)        |
| password  | string | Yes      | Min 8 chars, 1 uppercase, 1 lowercase, 1 number        |
| gender    | string | No       | Values: `male`, `female`, `other`, `prefer_not_to_say` |
| dob       | string | No       | Date of birth (must be 16+ years old)                  |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "otpSent": true,
    "identifier": "john@example.com",
    "method": "email",
    "expiresIn": 600
  },
  "message": "OTP sent to your email. Please verify within 10 minutes."
}
```

---

### Verify Registration OTP

**POST** `/users/verify-register`

Verifies OTP and creates user account.

**Request Body:**

```json
{
  "identifier": "john@example.com",
  "otp": "123456"
}
```

**Response (201):**

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "user": {
      "_id": "64f...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "username": "user_1234567890",
      "profileCompleted": false
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "profileCompleted": false
  },
  "message": "Account created successfully. Please complete your profile."
}
```

---

### Resend OTP

**POST** `/users/resend-otp`

Resends OTP for registration verification.

**Request Body:**

```json
{
  "email": "john@example.com"
}
```

_or_

```json
{
  "phone": "+1234567890"
}
```

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "otpSent": true,
    "method": "email"
  },
  "message": "New OTP sent to your email"
}
```

---

### Login

**POST** `/users/login`

Initiates login. Sends OTP for 2FA verification.

**Request Body:**

```json
{
  "email": "john@example.com",
  "password": "Password123"
}
```

_or_

```json
{
  "phone": "+1234567890",
  "password": "Password123"
}
```

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "otpSent": true,
    "identifier": "john@example.com",
    "method": "email"
  },
  "message": "OTP sent. Please verify to complete login."
}
```

---

### Verify Login OTP

**POST** `/users/verify-login`

Completes login with OTP verification.

**Request Body:**

```json
{
  "identifier": "john@example.com",
  "otp": "123456"
}
```

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "user": {
      "_id": "64f...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "username": "johndoe",
      "profilePicture": "/uploads/avatars/...",
      "isVerified": false
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  },
  "message": "Logged in successfully"
}
```

---

### Refresh Token

**POST** `/users/refresh-token`

Refreshes access token using refresh token.

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  },
  "message": "Token refreshed successfully"
}
```

---

### Logout

**POST** `/users/logout`

🔒 **Auth Required**

Logs out user and invalidates tokens.

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Logged out successfully"
}
```

---

### Forgot Password

**POST** `/users/forgot-password`

Sends password reset OTP.

**Request Body:**

```json
{
  "email": "john@example.com"
}
```

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "otpSent": true,
    "method": "email"
  },
  "message": "Password reset OTP sent"
}
```

---

### Reset Password

**POST** `/users/reset-password`

Resets password using OTP.

**Request Body:**

```json
{
  "identifier": "john@example.com",
  "otp": "123456",
  "newPassword": "NewPassword123"
}
```

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Password reset successfully"
}
```

---

### Get Current User

**GET** `/users/current-user`

🔒 **Auth Required**

Returns currently authenticated user details.

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "_id": "64f...",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "username": "johndoe",
    "profilePicture": "/uploads/avatars/...",
    "coverPhoto": "/uploads/covers/...",
    "bio": "Software Developer",
    "gender": "male",
    "dob": "1995-05-15",
    "isVerified": false,
    "profileCompleted": true,
    "isPrivate": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "User fetched successfully"
}
```

---

### Get User Profile

**GET** `/users/profile/:userId`

🔒 **Auth Required**

Returns public profile of a user.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| userId | string | User's ID |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "_id": "64f...",
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe",
    "profilePicture": "/uploads/avatars/...",
    "coverPhoto": "/uploads/covers/...",
    "bio": "Software Developer",
    "isVerified": true,
    "isPrivate": false,
    "postsCount": 25,
    "followersCount": 150,
    "followingCount": 75,
    "isFollowing": false,
    "isFollowedBy": true
  },
  "message": "User profile fetched successfully"
}
```

---

### Check Username Availability

**GET** `/users/check-username?username=johndoe`

Checks if username is available.

**Query Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| username | string | Yes | Username to check |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "available": true
  },
  "message": "Username is available"
}
```

---

### Complete Profile

**POST** `/users/complete-profile`

🔒 **Auth Required**

Completes user profile setup after registration.

**Content-Type:** `multipart/form-data`

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| username | string | Yes | Unique username |
| bio | string | No | User bio (max 150 chars) |
| website | string | No | Personal website URL |
| profilePicture | file | No | Profile image |
| coverPhoto | file | No | Cover image |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "_id": "64f...",
    "username": "johndoe",
    "profileCompleted": true
  },
  "message": "Profile completed successfully"
}
```

---

### Update Profile

**PUT** `/users/update-profile`

🔒 **Auth Required**

Updates user profile information.

**Request Body:**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "username": "johndoe",
  "bio": "Updated bio",
  "website": "https://example.com",
  "gender": "male",
  "dob": "1995-05-15"
}
```

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "_id": "64f...",
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe",
    "bio": "Updated bio"
  },
  "message": "Profile updated successfully"
}
```

---

### Update Profile Picture

**PUT** `/users/update-profile-picture`

🔒 **Auth Required**

**Content-Type:** `multipart/form-data`

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | file | Yes | Profile image (jpg, png, webp) |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "profilePicture": "/uploads/avatars/user_123_avatar.jpg"
  },
  "message": "Profile picture updated successfully"
}
```

---

### Update Cover Photo

**PUT** `/users/update-cover-photo`

🔒 **Auth Required**

**Content-Type:** `multipart/form-data`

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | file | Yes | Cover image (jpg, png, webp) |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "coverPhoto": "/uploads/covers/user_123_cover.jpg"
  },
  "message": "Cover photo updated successfully"
}
```

---

### Update Privacy Settings

**PUT** `/users/privacy-settings`

🔒 **Auth Required**

**Request Body:**

```json
{
  "isPrivate": true,
  "allowDownloads": false,
  "showActivityStatus": true
}
```

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "isPrivate": true,
    "allowDownloads": false,
    "showActivityStatus": true
  },
  "message": "Privacy settings updated"
}
```

---

### Change Password

**POST** `/users/change-password`

🔒 **Auth Required**

**Request Body:**

```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword123"
}
```

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Password changed successfully"
}
```

---

### Block User

**POST** `/users/block/:userId`

🔒 **Auth Required**

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| userId | string | ID of user to block |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "User blocked successfully"
}
```

---

### Unblock User

**POST** `/users/unblock/:userId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "User unblocked successfully"
}
```

---

### Get Blocked Users

**GET** `/users/blocked-list`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "_id": "64f...",
      "firstName": "Jane",
      "lastName": "Doe",
      "username": "janedoe",
      "profilePicture": "/uploads/avatars/..."
    }
  ],
  "message": "Blocked users fetched successfully"
}
```

---

### Delete Account

**DELETE** `/users/delete/:id`

🔒 **Auth Required**

Permanently deletes user account.

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Account deleted successfully"
}
```

---

## Follow System

### Send Follow Request

**POST** `/follow/request/:targetUserId`

🔒 **Auth Required**

Sends follow request. Auto-approves if target user has public account.

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "status": "following"
  },
  "message": "Now following user"
}
```

_or for private accounts:_

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "status": "pending",
    "requestId": "64f..."
  },
  "message": "Follow request sent"
}
```

---

### Accept Follow Request

**POST** `/follow/accept/:requestId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Follow request accepted"
}
```

---

### Reject Follow Request

**POST** `/follow/reject/:requestId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Follow request rejected"
}
```

---

### Get Pending Requests

**GET** `/follow/pending-requests`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "_id": "64f...",
      "follower": {
        "_id": "64f...",
        "firstName": "Jane",
        "lastName": "Doe",
        "username": "janedoe",
        "profilePicture": "/uploads/avatars/..."
      },
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "message": "Pending requests fetched"
}
```

---

### Unfollow User

**DELETE** `/follow/unfollow/:targetUserId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Unfollowed successfully"
}
```

---

### Cancel Follow Request

**DELETE** `/follow/cancel/:userId`

🔒 **Auth Required**

Cancels pending follow request.

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Follow request cancelled"
}
```

---

### Remove Follower

**DELETE** `/follow/remove/:targetUserId`

🔒 **Auth Required**

Removes a user from your followers.

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Follower removed"
}
```

---

### Get Follow Status

**GET** `/follow/status/:targetUserId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "isFollowing": true,
    "isFollowedBy": false,
    "isPending": false
  },
  "message": "Follow status fetched"
}
```

---

### Follow Back

**POST** `/follow/follow-back/:targetUserId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "status": "following"
  },
  "message": "Followed back successfully"
}
```

---

### Get Follow Suggestions

**GET** `/follow/suggestions`

🔒 **Auth Required**

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| limit | number | 10 | Number of suggestions |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "_id": "64f...",
      "firstName": "Jane",
      "lastName": "Doe",
      "username": "janedoe",
      "profilePicture": "/uploads/avatars/...",
      "mutualFollowers": 5
    }
  ],
  "message": "Suggestions fetched"
}
```

---

### Get Followers

**GET** `/follow/followers/:userId`

🔒 **Auth Required**

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "followers": [
      {
        "_id": "64f...",
        "firstName": "Jane",
        "lastName": "Doe",
        "username": "janedoe",
        "profilePicture": "/uploads/avatars/...",
        "isFollowing": true
      }
    ],
    "total": 150,
    "page": 1,
    "totalPages": 8
  },
  "message": "Followers fetched"
}
```

---

### Get Following

**GET** `/follow/following/:userId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "following": [
      {
        "_id": "64f...",
        "firstName": "John",
        "lastName": "Smith",
        "username": "johnsmith",
        "profilePicture": "/uploads/avatars/..."
      }
    ],
    "total": 75,
    "page": 1,
    "totalPages": 4
  },
  "message": "Following fetched"
}
```

---

### Get Total Followers Count

**GET** `/follow/total-followers`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "count": 150
  },
  "message": "Total followers count"
}
```

---

### Get Total Following Count

**GET** `/follow/total-following`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "count": 75
  },
  "message": "Total following count"
}
```

---

## Posts

### Upload Post

**POST** `/post/upload`

🔒 **Auth Required**

**Content-Type:** `multipart/form-data`

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| files | file[] | Yes | Media files (max 10, images/videos) |
| caption | string | No | Post caption (max 2000 chars) |
| tags | string/array | No | Tagged user IDs (JSON array or comma-separated) |
| location | string/object | No | Location name or JSON object |
| visibility | string | No | `public`, `private`, `followers` (default: `public`) |

**Response (201):**

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "_id": "64f...",
    "user_id": {
      "_id": "64f...",
      "firstName": "John",
      "lastName": "Doe",
      "username": "johndoe",
      "profilePicture": "/uploads/avatars/...",
      "isVerified": false
    },
    "caption": "Beautiful sunset!",
    "media": [
      {
        "type": "image",
        "url": "/uploads/posts/post_123.jpg",
        "thumbnail": "/uploads/posts/post_123.jpg"
      }
    ],
    "tags": [],
    "location": {
      "name": "Los Angeles, CA"
    },
    "visibility": "public",
    "likes_count": 0,
    "comments_count": 0,
    "createdAt": "2024-01-15T10:00:00.000Z"
  },
  "message": "Post created successfully"
}
```

---

### Get Post Details

**GET** `/post/details/:postId`

Returns post details. Public endpoint.

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "_id": "64f...",
    "user_id": {
      "_id": "64f...",
      "firstName": "John",
      "lastName": "Doe",
      "username": "johndoe",
      "profilePicture": "/uploads/avatars/...",
      "isVerified": true,
      "allowDownloads": true
    },
    "caption": "Beautiful sunset!",
    "media": [
      {
        "type": "image",
        "url": "/uploads/posts/post_123.jpg",
        "thumbnail": "/uploads/posts/post_123.jpg"
      }
    ],
    "likes_count": 256,
    "comments_count": 42,
    "shares_count": 15,
    "isLiked": false,
    "isSaved": false,
    "createdAt": "2024-01-15T10:00:00.000Z"
  },
  "message": "Post details fetched"
}
```

---

### Delete Post

**DELETE** `/post/delete/:postId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Post deleted successfully"
}
```

---

### Like Post

**POST** `/post/like/:postId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "likes_count": 257
  },
  "message": "Post liked"
}
```

---

### Unlike Post

**DELETE** `/post/unlike/:postId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "likes_count": 256
  },
  "message": "Post unliked"
}
```

---

### Comment on Post

**POST** `/post/comment/:postId`

🔒 **Auth Required**

**Request Body:**

```json
{
  "content": "Great photo!"
}
```

**Response (201):**

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "_id": "64f...",
    "user_id": {
      "_id": "64f...",
      "firstName": "Jane",
      "lastName": "Doe",
      "username": "janedoe",
      "profilePicture": "/uploads/avatars/..."
    },
    "post_id": "64f...",
    "content": "Great photo!",
    "likes_count": 0,
    "replies_count": 0,
    "createdAt": "2024-01-15T10:00:00.000Z"
  },
  "message": "Comment added"
}
```

---

### Get All Comments

**GET** `/post/comments/:postId`

🔒 **Auth Required**

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Comments per page |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "comments": [
      {
        "_id": "64f...",
        "user_id": {
          "_id": "64f...",
          "firstName": "Jane",
          "lastName": "Doe",
          "username": "janedoe",
          "profilePicture": "/uploads/avatars/..."
        },
        "content": "Great photo!",
        "likes_count": 5,
        "replies_count": 2,
        "isLiked": false,
        "createdAt": "2024-01-15T10:00:00.000Z"
      }
    ],
    "total": 42,
    "page": 1,
    "totalPages": 3
  },
  "message": "Comments fetched"
}
```

---

### Share Post

**POST** `/post/share/:postId`

🔒 **Auth Required**

**Request Body:**

```json
{
  "shareType": "repost",
  "caption": "Check this out!"
}
```

| Field     | Type   | Required | Description                 |
| --------- | ------ | -------- | --------------------------- |
| shareType | string | No       | `repost`, `story`, `direct` |
| caption   | string | No       | Caption for repost          |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "shares_count": 16
  },
  "message": "Post shared"
}
```

---

### Save Post

**POST** `/post/save/:postId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Post saved"
}
```

---

### Unsave Post

**DELETE** `/post/unsave/:postId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Post unsaved"
}
```

---

### Get User Saved Posts

**GET** `/post/user-saved-posts`

🔒 **Auth Required**

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Posts per page |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "posts": [...],
    "total": 15,
    "page": 1,
    "totalPages": 1
  },
  "message": "Saved posts fetched"
}
```

---

### Report Post

**POST** `/post/report/:postId`

🔒 **Auth Required**

**Request Body:**

```json
{
  "reason": "spam",
  "description": "This is spam content"
}
```

| Field       | Type   | Required | Description                                                        |
| ----------- | ------ | -------- | ------------------------------------------------------------------ |
| reason      | string | Yes      | `spam`, `harassment`, `violence`, `nudity`, `hate_speech`, `other` |
| description | string | No       | Additional details                                                 |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Post reported"
}
```

---

### Get Explore Posts

**GET** `/post/explore`

🔒 **Auth Required**

Returns posts from users you're not following.

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Posts per page |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "posts": [...],
    "total": 500,
    "page": 1,
    "totalPages": 25
  },
  "message": "Explore posts fetched"
}
```

---

## Reels

### Upload Reel

**POST** `/reel/upload`

🔒 **Auth Required**

**Content-Type:** `multipart/form-data`

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | file | Yes | Video file (mp4, webm, mov) |
| caption | string | No | Reel caption |
| audio | string | No | Audio/music ID |
| tags | string | No | Tagged user IDs (JSON array) |

**Response (201):**

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "_id": "64f...",
    "user_id": {
      "_id": "64f...",
      "firstName": "John",
      "lastName": "Doe",
      "username": "johndoe",
      "profilePicture": "/uploads/avatars/..."
    },
    "video_url": "/uploads/reels/reel_123.mp4",
    "thumbnail": "/uploads/reels/reel_123_thumb.jpg",
    "caption": "Check this out!",
    "likes_count": 0,
    "comments_count": 0,
    "views_count": 0,
    "createdAt": "2024-01-15T10:00:00.000Z"
  },
  "message": "Reel uploaded successfully"
}
```

---

### Get Reel Details

**GET** `/reel/details/:reelId`

Returns reel details.

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "_id": "64f...",
    "user_id": {
      "_id": "64f...",
      "firstName": "John",
      "lastName": "Doe",
      "username": "johndoe",
      "profilePicture": "/uploads/avatars/...",
      "isVerified": true
    },
    "video_url": "/uploads/reels/reel_123.mp4",
    "thumbnail": "/uploads/reels/reel_123_thumb.jpg",
    "caption": "Check this out!",
    "likes_count": 1250,
    "comments_count": 89,
    "views_count": 15000,
    "isLiked": false,
    "isSaved": false,
    "createdAt": "2024-01-15T10:00:00.000Z"
  },
  "message": "Reel details fetched"
}
```

---

### Delete Reel

**DELETE** `/reel/delete/:reelId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Reel deleted successfully"
}
```

---

### Toggle Like Reel

**POST** `/reel/toggle-like/:reelId`

🔒 **Auth Required**

Toggles like status.

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "isLiked": true,
    "likes_count": 1251
  },
  "message": "Reel liked"
}
```

---

### Comment on Reel

**POST** `/reel/comment/:reelId`

🔒 **Auth Required**

**Request Body:**

```json
{
  "content": "Amazing reel!"
}
```

**Response (201):**

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "_id": "64f...",
    "user_id": {...},
    "content": "Amazing reel!",
    "createdAt": "2024-01-15T10:00:00.000Z"
  },
  "message": "Comment added"
}
```

---

### Get Reel Comments

**GET** `/reel/comments/:reelId`

🔒 **Auth Required**

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Comments per page |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "comments": [...],
    "total": 89,
    "page": 1,
    "totalPages": 5
  },
  "message": "Comments fetched"
}
```

---

### Get User Reels

**GET** `/reel/user/:userId`

🔒 **Auth Required**

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Reels per page |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "reels": [...],
    "total": 25,
    "page": 1,
    "totalPages": 2
  },
  "message": "User reels fetched"
}
```

---

### Save Reel

**POST** `/reel/save/:reelId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Reel saved"
}
```

---

### Unsave Reel

**DELETE** `/reel/unsave/:reelId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Reel unsaved"
}
```

---

### Get User Saved Reels

**GET** `/reel/saved`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "reels": [...],
    "total": 10,
    "page": 1,
    "totalPages": 1
  },
  "message": "Saved reels fetched"
}
```

---

### Report Reel

**POST** `/reel/report/:reelId`

🔒 **Auth Required**

**Request Body:**

```json
{
  "reason": "inappropriate",
  "description": "Contains inappropriate content"
}
```

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Reel reported"
}
```

---

## Stories

### Upload Story

**POST** `/story/upload`

🔒 **Auth Required**

**Content-Type:** `multipart/form-data`

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | file | Yes | Image or video file |
| caption | string | No | Story text overlay |
| duration | number | No | Display duration in seconds (images only) |

**Response (201):**

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "_id": "64f...",
    "user_id": "64f...",
    "media_url": "/uploads/stories/story_123.jpg",
    "media_type": "image",
    "caption": "My story!",
    "views_count": 0,
    "expiresAt": "2024-01-16T10:00:00.000Z",
    "createdAt": "2024-01-15T10:00:00.000Z"
  },
  "message": "Story uploaded"
}
```

---

### Delete Story

**DELETE** `/story/delete/:storyId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Story deleted"
}
```

---

### Get Story Feed

**GET** `/story/feed`

🔒 **Auth Required**

Returns stories from followed users, grouped by user.

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "user": {
        "_id": "64f...",
        "firstName": "John",
        "lastName": "Doe",
        "username": "johndoe",
        "profilePicture": "/uploads/avatars/..."
      },
      "stories": [
        {
          "_id": "64f...",
          "media_url": "/uploads/stories/story_123.jpg",
          "media_type": "image",
          "caption": "My story!",
          "views_count": 45,
          "hasViewed": false,
          "createdAt": "2024-01-15T10:00:00.000Z"
        }
      ],
      "hasUnseenStories": true
    }
  ],
  "message": "Stories fetched"
}
```

---

### Get User Stories

**GET** `/story/user/:userId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "_id": "64f...",
      "media_url": "/uploads/stories/story_123.jpg",
      "media_type": "image",
      "caption": "My story!",
      "views_count": 45,
      "hasViewed": true,
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "message": "User stories fetched"
}
```

---

### View Story

**POST** `/story/view/:storyId`

🔒 **Auth Required**

Marks story as viewed.

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Story viewed"
}
```

---

### Get Story Viewers

**GET** `/story/viewers/:storyId`

🔒 **Auth Required**

Returns list of users who viewed your story.

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "_id": "64f...",
      "firstName": "Jane",
      "lastName": "Doe",
      "username": "janedoe",
      "profilePicture": "/uploads/avatars/...",
      "viewedAt": "2024-01-15T11:00:00.000Z"
    }
  ],
  "message": "Story viewers fetched"
}
```

---

## Feed

### Get Home Feed

**GET** `/feed/home`

🔒 **Auth Required**

Returns posts from followed users.

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Posts per page |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "posts": [
      {
        "_id": "64f...",
        "user_id": {
          "_id": "64f...",
          "firstName": "John",
          "lastName": "Doe",
          "username": "johndoe",
          "profilePicture": "/uploads/avatars/...",
          "isVerified": true
        },
        "caption": "Beautiful day!",
        "media": [...],
        "likes_count": 150,
        "comments_count": 25,
        "isLiked": true,
        "isSaved": false,
        "createdAt": "2024-01-15T10:00:00.000Z"
      }
    ],
    "total": 250,
    "page": 1,
    "hasMore": true
  },
  "message": "Feed fetched"
}
```

---

### Get Reels Feed

**GET** `/feed/reels`

🔒 **Auth Required**

Returns reels feed.

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 10 | Reels per page |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "reels": [...],
    "total": 100,
    "page": 1,
    "hasMore": true
  },
  "message": "Reels feed fetched"
}
```

---

### Get Stories Feed

**GET** `/feed/stories`

🔒 **Auth Required**

Alias for `/story/feed`.

---

### Get User Posts

**GET** `/feed/posts/:userId`

🔒 **Auth Required**

Returns posts by specific user.

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Posts per page |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "posts": [...],
    "total": 45,
    "page": 1,
    "totalPages": 3
  },
  "message": "User posts fetched"
}
```

---

## Chat & Messaging

### Get All Threads

**GET** `/chat/threads`

🔒 **Auth Required**

Returns all chat threads for current user.

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "_id": "64f...",
      "participants": [
        {
          "_id": "64f...",
          "firstName": "Jane",
          "lastName": "Doe",
          "username": "janedoe",
          "profilePicture": "/uploads/avatars/...",
          "isOnline": true
        }
      ],
      "lastMessage": {
        "content": "Hey, how are you?",
        "sender_id": "64f...",
        "createdAt": "2024-01-15T10:00:00.000Z"
      },
      "unreadCount": 2,
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "message": "Threads fetched"
}
```

---

### Create or Get Thread

**POST** `/chat/thread/:receiverId`

🔒 **Auth Required**

Creates new thread or returns existing one.

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "_id": "64f...",
    "participants": [...],
    "createdAt": "2024-01-15T10:00:00.000Z"
  },
  "message": "Thread created"
}
```

---

### Delete Thread

**DELETE** `/chat/thread/delete/:threadId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Thread deleted"
}
```

---

### Send Message

**POST** `/chat/message/send/:threadId`

🔒 **Auth Required**

**Content-Type:** `multipart/form-data` or `application/json`

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| content | string | No* | Text message (*required if no media) |
| media | file | No\* | Image/video attachment |
| replyTo | string | No | Message ID to reply to |

**Response (201):**

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "_id": "64f...",
    "thread_id": "64f...",
    "sender_id": {
      "_id": "64f...",
      "firstName": "John",
      "lastName": "Doe",
      "username": "johndoe",
      "profilePicture": "/uploads/avatars/..."
    },
    "content": "Hello there!",
    "media": null,
    "status": "sent",
    "createdAt": "2024-01-15T10:00:00.000Z"
  },
  "message": "Message sent"
}
```

---

### Get Messages

**GET** `/chat/messages/:threadId`

🔒 **Auth Required**

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 50 | Messages per page |
| before | string | - | Get messages before this message ID |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "messages": [
      {
        "_id": "64f...",
        "sender_id": {...},
        "content": "Hello!",
        "media": null,
        "status": "read",
        "createdAt": "2024-01-15T10:00:00.000Z"
      }
    ],
    "total": 150,
    "page": 1,
    "hasMore": true
  },
  "message": "Messages fetched"
}
```

---

### Delete Message

**DELETE** `/chat/message/delete/:messageId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Message deleted"
}
```

---

### Edit Message

**PUT** `/chat/message/edit/:messageId`

🔒 **Auth Required**

**Request Body:**

```json
{
  "content": "Updated message content"
}
```

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "_id": "64f...",
    "content": "Updated message content",
    "isEdited": true,
    "editedAt": "2024-01-15T11:00:00.000Z"
  },
  "message": "Message edited"
}
```

---

### Mark Messages as Seen

**PUT** `/chat/messages/seen/:threadId`

🔒 **Auth Required**

Marks all messages in thread as seen.

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Messages marked as seen"
}
```

---

### Request Call

**POST** `/chat/call/request/:receiverId`

🔒 **Auth Required**

**Request Body:**

```json
{
  "callType": "video"
}
```

| Field    | Type   | Required | Description        |
| -------- | ------ | -------- | ------------------ |
| callType | string | Yes      | `voice` or `video` |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "callId": "64f...",
    "callType": "video",
    "status": "ringing"
  },
  "message": "Call initiated"
}
```

---

### End Call

**POST** `/chat/call/end/:callId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Call ended"
}
```

---

## Group Chat & Calls

Full WhatsApp/Instagram-style group messaging and calling API.

### Create Group

**POST** `/group`

🔒 **Auth Required**

**Content-Type:** `multipart/form-data`

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Group name |
| description | string | No | Group description |
| memberIds | string[] | Yes | Array of user IDs to add (JSON stringified) |
| type | string | No | `private` or `public` (default: private) |
| avatar | file | No | Group avatar image |

**Response (201):**

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "_id": "64f...",
    "name": "My Group",
    "description": "A cool group",
    "avatar": "/uploads/groups/...",
    "type": "private",
    "members": [...],
    "createdBy": {...},
    "createdAt": "2024-01-15T10:00:00.000Z"
  },
  "message": "Group created successfully"
}
```

---

### Get My Groups

**GET** `/group`

🔒 **Auth Required**

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| limit | number | 50 | Max groups to return |
| skip | number | 0 | Offset for pagination |
| search | string | - | Search by group name |

---

### Get Group Details

**GET** `/group/:groupId`

🔒 **Auth Required**

---

### Update Group

**PUT** `/group/:groupId`

🔒 **Auth Required** (Admin/Moderator only)

**Request Body:**
| Field | Type | Description |
|-------|------|-------------|
| name | string | New group name |
| description | string | New description |
| settings | object | Group settings |
| avatar | file | New avatar image |

---

### Delete Group

**DELETE** `/group/:groupId`

🔒 **Auth Required** (Admin only)

---

### Add Members

**POST** `/group/:groupId/members`

🔒 **Auth Required**

**Request Body:**

```json
{
  "memberIds": ["userId1", "userId2"]
}
```

---

### Remove Member / Leave Group

**DELETE** `/group/:groupId/members/:memberId`

🔒 **Auth Required**

---

### Update Member Role

**PUT** `/group/:groupId/members/:memberId/role`

🔒 **Auth Required** (Admin only)

**Request Body:**

```json
{
  "role": "admin" | "moderator" | "member"
}
```

---

### Generate Invite Link

**POST** `/group/:groupId/invite`

🔒 **Auth Required** (Admin only)

**Request Body:**

```json
{
  "expiresIn": 604800,
  "usageLimit": 100
}
```

**Response:**

```json
{
  "code": "abc123...",
  "inviteUrl": "https://app.com/join-group/abc123...",
  "expiresAt": "2024-01-22T10:00:00.000Z"
}
```

---

### Join via Invite

**POST** `/group/join/:code`

🔒 **Auth Required**

---

### Send Group Message

**POST** `/group/:groupId/messages`

🔒 **Auth Required**

**Content-Type:** `multipart/form-data`

**Request Body:**
| Field | Type | Description |
|-------|------|-------------|
| text | string | Message text |
| messageType | string | `text`, `image`, `video`, `audio`, etc. |
| replyTo | string | Message ID to reply to |
| mentions | string[] | User IDs to mention (JSON) |
| sharedContent | object | Shared post/reel/story (JSON) |
| location | object | Location data (JSON) |
| poll | object | Poll data (JSON) |
| files | file[] | Media files to upload |

---

### Get Group Messages

**GET** `/group/:groupId/messages`

🔒 **Auth Required**

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| limit | number | Max messages (default: 50) |
| before | string | ISO date for pagination |
| after | string | ISO date for pagination |

---

### React to Message

**POST** `/group/:groupId/messages/:messageId/react`

**Request Body:**

```json
{
  "emoji": "❤️"
}
```

---

### Delete Message

**DELETE** `/group/:groupId/messages/:messageId`

**Request Body:**

```json
{
  "deleteForEveryone": true
}
```

---

### Forward Message

**POST** `/group/messages/:messageId/forward`

**Request Body:**

```json
{
  "targetGroupIds": ["groupId1", "groupId2"]
}
```

---

### Pin/Unpin Message

**PUT** `/group/:groupId/messages/:messageId/pin`

🔒 **Auth Required** (Admin/Moderator only)

---

### Star Message

**PUT** `/group/:groupId/messages/:messageId/star`

---

### Vote on Poll

**POST** `/group/:groupId/messages/:messageId/vote`

**Request Body:**

```json
{
  "optionIds": ["opt_0", "opt_1"]
}
```

---

### Search Messages

**GET** `/group/:groupId/search`

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| query | string | Search text |
| type | string | Message type filter |
| from | string | Filter by sender ID |
| limit | number | Max results |

---

### Get Starred Messages

**GET** `/group/:groupId/starred`

---

### Get Media Gallery

**GET** `/group/:groupId/media`

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| type | string | `image`, `video`, `file`, `all` |
| limit | number | Max items |
| skip | number | Offset |

---

### Initiate Group Call

**POST** `/group/:groupId/call`

🔒 **Auth Required**

**Request Body:**

```json
{
  "callType": "video",
  "settings": {
    "maxParticipants": 8,
    "waitingRoomEnabled": false,
    "muteOnJoin": true,
    "recordingEnabled": false,
    "screenSharingAllowed": true
  }
}
```

---

### Get Active Call

**GET** `/group/:groupId/call/active`

---

### Get Call History

**GET** `/group/:groupId/call/history`

---

### Join Group Call

**POST** `/group/call/:callId/join`

**Request Body:**

```json
{
  "peerId": "peer-connection-id"
}
```

---

### Leave Group Call

**POST** `/group/call/:callId/leave`

---

### End Group Call

**POST** `/group/call/:callId/end`

🔒 **Auth Required** (Host only)

---

### Get Call Info

**GET** `/group/call/:callId`

---

### Toggle Media State

**PUT** `/group/call/:callId/media`

**Request Body:**

```json
{
  "mediaType": "audio" | "video" | "screenShare",
  "enabled": true
}
```

---

### Admit from Waiting Room

**POST** `/group/call/:callId/admit`

🔒 **Auth Required** (Host only)

**Request Body:**

```json
{
  "waitingUserId": "userId",
  "admit": true
}
```

---

### Toggle Hand Raise

**PUT** `/group/call/:callId/hand`

**Request Body:**

```json
{
  "raised": true
}
```

---

### Mute Participant

**POST** `/group/call/:callId/mute`

🔒 **Auth Required** (Host only)

**Request Body:**

```json
{
  "targetUserId": "userId",
  "muted": true
}
```

---

### Toggle Recording

**PUT** `/group/call/:callId/recording`

🔒 **Auth Required** (Host only)

**Request Body:**

```json
{
  "record": true
}
```

---

## Comments

### Like Comment

**POST** `/comment/like/:commentId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "likes_count": 6
  },
  "message": "Comment liked"
}
```

---

### Unlike Comment

**DELETE** `/comment/unlike/:commentId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "likes_count": 5
  },
  "message": "Comment unliked"
}
```

---

### Reply to Comment

**POST** `/comment/reply/:commentId`

🔒 **Auth Required**

**Request Body:**

```json
{
  "content": "Thanks for the feedback!"
}
```

**Response (201):**

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "_id": "64f...",
    "user_id": {...},
    "parent_id": "64f...",
    "content": "Thanks for the feedback!",
    "likes_count": 0,
    "createdAt": "2024-01-15T10:00:00.000Z"
  },
  "message": "Reply added"
}
```

---

### Get Comment Replies

**GET** `/comment/replies/:commentId`

🔒 **Auth Required**

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 10 | Replies per page |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "replies": [...],
    "total": 5,
    "page": 1,
    "totalPages": 1
  },
  "message": "Replies fetched"
}
```

---

### Edit Comment

**PUT** `/comment/edit/:commentId`

🔒 **Auth Required**

**Request Body:**

```json
{
  "content": "Updated comment"
}
```

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "_id": "64f...",
    "content": "Updated comment",
    "isEdited": true
  },
  "message": "Comment updated"
}
```

---

### Delete Comment

**DELETE** `/comment/delete/:commentId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Comment deleted"
}
```

---

### Get Comment Details

**GET** `/comment/:commentId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "_id": "64f...",
    "user_id": {...},
    "content": "Great post!",
    "likes_count": 5,
    "replies_count": 2,
    "isLiked": true,
    "createdAt": "2024-01-15T10:00:00.000Z"
  },
  "message": "Comment details fetched"
}
```

---

## Notifications

### Get Notifications

**GET** `/notifications/list`

🔒 **Auth Required**

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Notifications per page |
| type | string | - | Filter by type (like, comment, follow, etc.) |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "notifications": [
      {
        "_id": "64f...",
        "type": "like",
        "sender_id": {
          "_id": "64f...",
          "firstName": "Jane",
          "lastName": "Doe",
          "username": "janedoe",
          "profilePicture": "/uploads/avatars/..."
        },
        "title": "New Like",
        "message": "Jane Doe liked your post",
        "reference_id": "64f...",
        "reference_type": "Post",
        "thumbnail": "/uploads/posts/...",
        "action_url": "/post/64f...",
        "is_read": false,
        "createdAt": "2024-01-15T10:00:00.000Z"
      }
    ],
    "total": 50,
    "page": 1,
    "totalPages": 3
  },
  "message": "Notifications fetched"
}
```

---

### Mark Notification as Read

**PUT** `/notifications/read/:notificationId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Notification marked as read"
}
```

---

### Mark All Notifications as Read

**PUT** `/notifications/read-all`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "All notifications marked as read"
}
```

---

### Get Unread Count

**GET** `/notifications/unread-count`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "count": 12
  },
  "message": "Unread count fetched"
}
```

---

### Get Notification Settings

**GET** `/notifications/settings`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "likes": true,
    "comments": true,
    "follows": true,
    "directMessages": true,
    "mentions": true,
    "liveStreams": true,
    "pushEnabled": true,
    "emailEnabled": false
  },
  "message": "Settings fetched"
}
```

---

### Update Notification Settings

**PUT** `/notifications/settings/update`

🔒 **Auth Required**

**Request Body:**

```json
{
  "likes": true,
  "comments": true,
  "follows": true,
  "directMessages": true,
  "mentions": true,
  "liveStreams": false,
  "pushEnabled": true,
  "emailEnabled": false
}
```

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {...},
  "message": "Settings updated"
}
```

---

### Register Device Token

**POST** `/notifications/register-token`

🔒 **Auth Required**

Registers device for push notifications.

**Request Body:**

```json
{
  "token": "fcm_device_token_here",
  "platform": "android"
}
```

| Field    | Type   | Required | Description             |
| -------- | ------ | -------- | ----------------------- |
| token    | string | Yes      | FCM/APNS device token   |
| platform | string | Yes      | `android`, `ios`, `web` |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Device token registered"
}
```

---

### Unregister Device Token

**DELETE** `/notifications/unregister-token`

🔒 **Auth Required**

**Request Body:**

```json
{
  "token": "fcm_device_token_here"
}
```

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Device token unregistered"
}
```

---

## Search

### Global Search

**GET** `/search/global?q=keyword`

🔓 **Auth Optional** (auth improves personalization)

**Query Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| q | string | Yes | Search query |
| type | string | No | Filter: `users`, `posts`, `hashtags`, `all` |
| limit | number | No | Results limit (default: 20) |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "users": [
      {
        "_id": "64f...",
        "firstName": "John",
        "lastName": "Doe",
        "username": "johndoe",
        "profilePicture": "/uploads/avatars/...",
        "isVerified": true
      }
    ],
    "posts": [...],
    "hashtags": [
      {
        "tag": "#travel",
        "count": 1500
      }
    ]
  },
  "message": "Search results"
}
```

---

### Search Users

**GET** `/search/users?q=john`

🔓 **Auth Optional**

**Query Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| q | string | Yes | Username or name to search |
| limit | number | No | Results limit (default: 20) |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "_id": "64f...",
      "firstName": "John",
      "lastName": "Doe",
      "username": "johndoe",
      "profilePicture": "/uploads/avatars/...",
      "isVerified": true,
      "followersCount": 1500
    }
  ],
  "message": "Users found"
}
```

---

### Search Hashtags

**GET** `/search/hashtags?q=travel`

🔓 **Auth Optional**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "tag": "#travel",
      "count": 15000
    },
    {
      "tag": "#travelphotography",
      "count": 8500
    }
  ],
  "message": "Hashtags found"
}
```

---

### Get Trending

**GET** `/search/trending`

🔓 **Auth Optional**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "hashtags": [
      { "tag": "#viral", "count": 50000 },
      { "tag": "#trending", "count": 45000 }
    ],
    "topics": [{ "name": "Technology", "posts_count": 12000 }]
  },
  "message": "Trending fetched"
}
```

---

### Get Search History

**GET** `/search/history`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "_id": "64f...",
      "query": "sunset photos",
      "type": "text",
      "createdAt": "2024-01-15T10:00:00.000Z"
    },
    {
      "_id": "64f...",
      "query": "johndoe",
      "type": "user",
      "user": {
        "_id": "64f...",
        "username": "johndoe",
        "profilePicture": "/uploads/avatars/..."
      },
      "createdAt": "2024-01-14T10:00:00.000Z"
    }
  ],
  "message": "Search history fetched"
}
```

---

### Clear Search History

**DELETE** `/search/history`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Search history cleared"
}
```

---

## Live Streaming

### Create Live Stream

**POST** `/live/create`

🔒 **Auth Required**

**Content-Type:** `multipart/form-data`

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | Stream title |
| description | string | No | Stream description |
| thumbnail | file | No | Stream thumbnail image |
| visibility | string | No | `public`, `followers` (default: `public`) |

**Response (201):**

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "_id": "64f...",
    "user_id": {...},
    "title": "My Live Stream",
    "description": "Streaming now!",
    "thumbnail": "/uploads/live/thumb_123.jpg",
    "status": "created",
    "streamKey": "live_key_abc123",
    "rtmpUrl": "rtmp://your-server.com/live",
    "playbackUrl": null,
    "viewers_count": 0,
    "createdAt": "2024-01-15T10:00:00.000Z"
  },
  "message": "Live stream created"
}
```

---

### Start Live Stream

**POST** `/live/start/:streamId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "_id": "64f...",
    "status": "live",
    "startedAt": "2024-01-15T10:05:00.000Z"
  },
  "message": "Live stream started"
}
```

---

### End Live Stream

**POST** `/live/end/:streamId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "_id": "64f...",
    "status": "ended",
    "duration": 3600,
    "totalViewers": 150,
    "endedAt": "2024-01-15T11:05:00.000Z"
  },
  "message": "Live stream ended"
}
```

---

### Get Live Stream Details

**GET** `/live/details/:streamId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "_id": "64f...",
    "user_id": {
      "_id": "64f...",
      "firstName": "John",
      "lastName": "Doe",
      "username": "johndoe",
      "profilePicture": "/uploads/avatars/...",
      "isVerified": true
    },
    "title": "My Live Stream",
    "description": "Streaming now!",
    "thumbnail": "/uploads/live/thumb_123.jpg",
    "status": "live",
    "playbackUrl": "https://your-server.com/live/abc123.m3u8",
    "viewers_count": 45,
    "startedAt": "2024-01-15T10:05:00.000Z"
  },
  "message": "Stream details fetched"
}
```

---

### Get Active Live Streams

**GET** `/live/active`

🔒 **Auth Required**

Returns live streams from followed users.

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "_id": "64f...",
      "user_id": {...},
      "title": "Live Stream",
      "thumbnail": "/uploads/live/...",
      "viewers_count": 45,
      "startedAt": "2024-01-15T10:05:00.000Z"
    }
  ],
  "message": "Active streams fetched"
}
```

---

### Get All Live Streams

**GET** `/live/all`

🔒 **Auth Required**

Returns all public live streams.

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Streams per page |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "streams": [...],
    "total": 25,
    "page": 1,
    "totalPages": 2
  },
  "message": "Live streams fetched"
}
```

---

### Join Live Stream

**POST** `/live/join/:streamId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "viewers_count": 46,
    "playbackUrl": "https://your-server.com/live/abc123.m3u8"
  },
  "message": "Joined stream"
}
```

---

### Leave Live Stream

**POST** `/live/leave/:streamId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "viewers_count": 45
  },
  "message": "Left stream"
}
```

---

### Get Live Stream Viewers

**GET** `/live/viewers/:streamId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "_id": "64f...",
      "firstName": "Jane",
      "lastName": "Doe",
      "username": "janedoe",
      "profilePicture": "/uploads/avatars/..."
    }
  ],
  "message": "Viewers fetched"
}
```

---

### Send Live Comment

**POST** `/live/comment/:streamId`

🔒 **Auth Required**

**Request Body:**

```json
{
  "content": "Great stream!"
}
```

**Response (201):**

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "_id": "64f...",
    "user_id": {...},
    "content": "Great stream!",
    "createdAt": "2024-01-15T10:10:00.000Z"
  },
  "message": "Comment sent"
}
```

---

### Get Live Comments

**GET** `/live/comments/:streamId`

🔒 **Auth Required**

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| limit | number | 50 | Comments to fetch |
| after | string | - | Get comments after this timestamp |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "_id": "64f...",
      "user_id": {...},
      "content": "Great stream!",
      "createdAt": "2024-01-15T10:10:00.000Z"
    }
  ],
  "message": "Comments fetched"
}
```

---

### Get User Live Streams

**GET** `/live/user/:userId`

🔒 **Auth Required**

Returns live stream history for user.

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "_id": "64f...",
      "title": "Past Stream",
      "thumbnail": "/uploads/live/...",
      "status": "ended",
      "duration": 3600,
      "totalViewers": 150,
      "createdAt": "2024-01-10T10:00:00.000Z"
    }
  ],
  "message": "User streams fetched"
}
```

---

### Delete Live Stream

**DELETE** `/live/delete/:streamId`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Live stream deleted"
}
```

---

## Admin

### Admin Login

**POST** `/admin/login`

**Request Body:**

```json
{
  "email": "admin@example.com",
  "password": "AdminPassword123"
}
```

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "user": {
      "_id": "64f...",
      "email": "admin@example.com",
      "userType": "admin"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  },
  "message": "Admin logged in"
}
```

---

### Get Dashboard

**GET** `/admin/dashboard`

🔒 **Admin Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "totalUsers": 15000,
    "activeUsers": 12000,
    "newUsersToday": 150,
    "totalPosts": 50000,
    "totalReels": 20000,
    "totalReports": 25,
    "pendingReports": 10
  },
  "message": "Dashboard data fetched"
}
```

---

### Get Analytics

**GET** `/admin/analytics`

🔒 **Admin Auth Required**

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| period | string | 7d | Time period: `7d`, `30d`, `90d`, `1y` |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "userGrowth": [
      { "date": "2024-01-08", "count": 100 },
      { "date": "2024-01-09", "count": 120 }
    ],
    "postActivity": [...],
    "engagement": {
      "avgLikes": 45,
      "avgComments": 8,
      "avgShares": 3
    }
  },
  "message": "Analytics fetched"
}
```

---

### Get Users

**GET** `/admin/users`

🔒 **Admin Auth Required**

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Users per page |
| search | string | - | Search by name/email |
| status | string | - | Filter: `active`, `banned`, `pending` |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "users": [
      {
        "_id": "64f...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "username": "johndoe",
        "status": "active",
        "isVerified": false,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 15000,
    "page": 1,
    "totalPages": 750
  },
  "message": "Users fetched"
}
```

---

### Verify User

**PUT** `/admin/user/verify/:userId`

🔒 **Admin Auth Required**

Grants verified badge to user.

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "_id": "64f...",
    "isVerified": true
  },
  "message": "User verified"
}
```

---

### Ban User

**PUT** `/admin/user/ban/:userId`

🔒 **Admin Auth Required**

**Request Body:**

```json
{
  "reason": "Violation of community guidelines",
  "duration": "permanent"
}
```

| Field    | Type   | Required | Description                                     |
| -------- | ------ | -------- | ----------------------------------------------- |
| reason   | string | Yes      | Ban reason                                      |
| duration | string | No       | `7d`, `30d`, `permanent` (default: `permanent`) |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "_id": "64f...",
    "status": "banned"
  },
  "message": "User banned"
}
```

---

### Delete User (Admin)

**DELETE** `/admin/user/delete/:userId`

🔒 **Admin Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "User deleted"
}
```

---

### Get Content

**GET** `/admin/content`

🔒 **Admin Auth Required**

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| type | string | - | `post`, `reel`, `story` |
| status | string | - | `active`, `flagged`, `removed` |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "content": [...],
    "total": 500,
    "page": 1,
    "totalPages": 25
  },
  "message": "Content fetched"
}
```

---

### Remove Content

**DELETE** `/admin/content/remove/:contentId`

🔒 **Admin Auth Required**

**Request Body:**

```json
{
  "type": "post",
  "reason": "Violates community guidelines"
}
```

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Content removed"
}
```

---

### Get Reports

**GET** `/admin/reports`

🔒 **Admin Auth Required**

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Reports per page |
| status | string | - | `pending`, `resolved`, `dismissed` |
| type | string | - | `post`, `reel`, `user`, `comment` |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "reports": [
      {
        "_id": "64f...",
        "reporter": {...},
        "reported_content": {...},
        "reason": "spam",
        "description": "This is spam content",
        "status": "pending",
        "createdAt": "2024-01-15T10:00:00.000Z"
      }
    ],
    "total": 25,
    "page": 1,
    "totalPages": 2
  },
  "message": "Reports fetched"
}
```

---

### Resolve Report

**PUT** `/admin/reports/resolve/:reportId`

🔒 **Admin Auth Required**

**Request Body:**

```json
{
  "action": "remove_content",
  "notes": "Content violated community guidelines"
}
```

| Field  | Type   | Required | Description                                          |
| ------ | ------ | -------- | ---------------------------------------------------- |
| action | string | Yes      | `remove_content`, `ban_user`, `dismiss`, `warn_user` |
| notes  | string | No       | Admin notes                                          |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "_id": "64f...",
    "status": "resolved",
    "action": "remove_content"
  },
  "message": "Report resolved"
}
```

---

### Send Global Notification

**POST** `/admin/notification/send-global`

🔒 **Admin Auth Required**

**Request Body:**

```json
{
  "title": "System Update",
  "message": "We've added new features!",
  "targetAudience": "all"
}
```

| Field          | Type   | Required | Description                                  |
| -------------- | ------ | -------- | -------------------------------------------- |
| title          | string | Yes      | Notification title                           |
| message        | string | Yes      | Notification body                            |
| targetAudience | string | No       | `all`, `verified`, `active` (default: `all`) |

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "sentTo": 15000
  },
  "message": "Global notification sent"
}
```

---

## System

### Get App Update Info

**GET** `/system/app-update`

Public endpoint for checking app updates.

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "currentVersion": "1.2.0",
    "minVersion": "1.0.0",
    "updateRequired": false,
    "updateUrl": "https://app-store-link",
    "releaseNotes": "Bug fixes and improvements"
  },
  "message": "App update info"
}
```

---

### Get Maintenance Status

**GET** `/system/maintenance-status`

Public endpoint for checking maintenance mode.

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "isUnderMaintenance": false,
    "message": null,
    "estimatedEndTime": null
  },
  "message": "Maintenance status"
}
```

---

### Get Server Health

**GET** `/system/server-health`

🔒 **Auth Required**

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "status": "ok",
    "uptime": 864000,
    "memory": {
      "used": "512MB",
      "total": "2GB"
    },
    "database": "connected"
  },
  "message": "Server health"
}
```

---

### Set Maintenance Mode

**PUT** `/system/maintenance-mode`

🔒 **Admin Auth Required**

**Request Body:**

```json
{
  "enabled": true,
  "message": "Scheduled maintenance",
  "estimatedEndTime": "2024-01-15T12:00:00.000Z"
}
```

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "isUnderMaintenance": true
  },
  "message": "Maintenance mode updated"
}
```

---

### Update App Version

**PUT** `/system/app-version/update`

🔒 **Admin Auth Required**

**Request Body:**

```json
{
  "currentVersion": "1.3.0",
  "minVersion": "1.1.0",
  "releaseNotes": "New features added"
}
```

**Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "currentVersion": "1.3.0",
    "minVersion": "1.1.0"
  },
  "message": "App version updated"
}
```

---

## Health Check

### Basic Health Check

**GET** `/api/v1/health`

**Response (200):**

```json
{
  "status": "ok",
  "message": "Server is healthy",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

---

### Detailed Health Check

**GET** `/api/v1/health/detailed`

**Response (200):**

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "uptime": 864000,
  "memory": {
    "rss": 52428800,
    "heapTotal": 20971520,
    "heapUsed": 15728640,
    "external": 1048576
  },
  "services": {
    "database": "connected"
  }
}
```

---

## Error Responses

All endpoints return errors in the following format:

**4xx/5xx Response:**

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Error description here",
  "errors": []
}
```

### Common Error Codes

| Status Code | Description                              |
| ----------- | ---------------------------------------- |
| 400         | Bad Request - Invalid input              |
| 401         | Unauthorized - Missing or invalid token  |
| 403         | Forbidden - Insufficient permissions     |
| 404         | Not Found - Resource doesn't exist       |
| 409         | Conflict - Resource already exists       |
| 429         | Too Many Requests - Rate limit exceeded  |
| 500         | Internal Server Error                    |
| 503         | Service Unavailable - Server maintenance |

---

## Rate Limits

| Endpoint Category | Requests | Window |
| ----------------- | -------- | ------ |
| Authentication    | 10       | 15 min |
| General API       | 500      | 15 min |
| File Uploads      | 50       | 1 hour |

---

## File Upload Limits

| Content Type    | Max Files | Max Size  |
| --------------- | --------- | --------- |
| Posts           | 10        | 50MB each |
| Reels           | 1         | 100MB     |
| Stories         | 1         | 50MB      |
| Profile Picture | 1         | 5MB       |
| Cover Photo     | 1         | 10MB      |
| Chat Media      | 5         | 25MB each |

---

## WebSocket Events

The application uses Socket.IO for real-time features:

**Connection:** `wss://your-domain.com`

### Events

| Event                | Direction     | Description           |
| -------------------- | ------------- | --------------------- |
| `connect`            | Client→Server | Establish connection  |
| `authenticate`       | Client→Server | Send JWT token        |
| `authenticated`      | Server→Client | Auth success          |
| `new_message`        | Server→Client | New chat message      |
| `message_seen`       | Both          | Message read status   |
| `typing`             | Both          | User typing indicator |
| `online_status`      | Server→Client | User online/offline   |
| `new_notification`   | Server→Client | New notification      |
| `call_incoming`      | Server→Client | Incoming call         |
| `call_accepted`      | Both          | Call accepted         |
| `call_rejected`      | Both          | Call rejected         |
| `call_ended`         | Both          | Call ended            |
| `live_comment`       | Both          | Live stream comment   |
| `live_viewer_update` | Server→Client | Viewer count update   |

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- All IDs are MongoDB ObjectIds (24-character hex strings)
- File URLs are relative to the server domain
- Stories auto-expire after 24 hours
- Pagination starts at page 1 (not 0)

---

_Last Updated: February 2026_
