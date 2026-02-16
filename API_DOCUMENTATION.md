# Social App — API Documentation

**Base URL:** `http://localhost:3000/api/v1`

**Version:** 1.0.0

---

## Table of Contents

1. [Authentication & Users](#1-authentication--users)
2. [Follow System](#2-follow-system)
3. [Posts](#3-posts)
4. [Comments](#4-comments)
5. [Reels](#5-reels)
6. [Stories](#6-stories)
7. [Feed](#7-feed)
8. [Chat (Direct Messages)](#8-chat-direct-messages)
9. [Groups](#9-groups)
10. [Group Calls](#10-group-calls)
11. [Notifications](#11-notifications)
12. [Search](#12-search)
13. [Live Streaming](#13-live-streaming)
14. [Admin Panel](#14-admin-panel)
15. [System](#15-system)
16. [WebRTC](#16-webrtc)
17. [Health Check](#17-health-check)
18. [Root-Level Endpoints](#18-root-level-endpoints)

---

## How Auth Works

Most APIs need a **JWT token**. After login, you get an `accessToken`. Send it in every request like this:

```
Authorization: Bearer <your_access_token>
```

Some APIs (like post details, search) work without login too — they use optional auth for personalization.

---

## Common Response Format

**Success:**

```json
{
  "success": true,
  "message": "Done successfully",
  "data": {}
}
```

**Error:**

```json
{
  "success": false,
  "message": "Something went wrong"
}
```

---

## 1. Authentication & Users

Base path: `/api/v1/users`

### Register a New User

```
POST /register
```

| Field    | Type   | Required | Description      |
| -------- | ------ | -------- | ---------------- |
| fullName | string | Yes      | User's full name |
| email    | string | Yes      | Email address    |
| phone    | string | Yes      | Phone number     |
| password | string | Yes      | Min 8 chars      |
| username | string | Yes      | Unique username  |

**Response:**

```json
{
  "success": true,
  "message": "OTP sent to your email/phone for verification"
}
```

---

### Verify Registration OTP

```
POST /verify-register
```

| Field | Type   | Required |
| ----- | ------ | -------- |
| email | string | Yes      |
| otp   | string | Yes      |

**Response:**

```json
{
  "success": true,
  "message": "Account verified successfully",
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
}
```

---

### Resend OTP

```
POST /resend-otp
```

| Field | Type   | Required |
| ----- | ------ | -------- |
| email | string | Yes      |

---

### Login

```
POST /login
```

| Field    | Type   | Required |
| -------- | ------ | -------- |
| email    | string | Yes      |
| password | string | Yes      |

**Response:** Sends OTP to registered email/phone for 2-factor verification.

---

### Verify Login OTP

```
POST /verify-login
```

| Field | Type   | Required |
| ----- | ------ | -------- |
| email | string | Yes      |
| otp   | string | Yes      |

**Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "user": { "id": "...", "username": "...", "fullName": "..." }
  }
}
```

---

### Refresh Token

```
POST /refresh-token
```

Send the refresh token (from cookie or body) to get a new access token when the old one expires.

---

### Forgot Password

```
POST /forgot-password
```

| Field | Type   | Required |
| ----- | ------ | -------- |
| email | string | Yes      |

Sends a reset OTP/link to the email.

---

### Reset Password

```
POST /reset-password
```

| Field       | Type   | Required |
| ----------- | ------ | -------- |
| email       | string | Yes      |
| otp         | string | Yes      |
| newPassword | string | Yes      |

---

### Check Username Availability

```
GET /check-username?username=johndoe
```

**Response:**

```json
{
  "success": true,
  "available": true
}
```

---

### Get Current User (Logged-in User)

```
GET /current-user
Auth: Required
```

Returns the full profile of the logged-in user.

---

### Get User Profile

```
GET /profile/:userId
Auth: Required
```

Returns public profile of any user by their ID.

---

### Logout

```
POST /logout
Auth: Required
```

---

### Change Password

```
POST /change-password
Auth: Required
```

| Field           | Type   | Required |
| --------------- | ------ | -------- |
| currentPassword | string | Yes      |
| newPassword     | string | Yes      |

---

### Update Profile

```
PUT /update-profile
Auth: Required
```

| Field    | Type   | Required |
| -------- | ------ | -------- |
| fullName | string | No       |
| bio      | string | No       |
| username | string | No       |
| website  | string | No       |
| gender   | string | No       |

---

### Update Profile Picture

```
PUT /update-profile-picture
Auth: Required
Content-Type: multipart/form-data
```

| Field          | Type | Required |
| -------------- | ---- | -------- |
| profilePicture | file | Yes      |

---

### Update Cover Photo

```
PUT /update-cover-photo
Auth: Required
Content-Type: multipart/form-data
```

| Field      | Type | Required |
| ---------- | ---- | -------- |
| coverPhoto | file | Yes      |

---

### Delete Profile Picture

```
DELETE /delete-profile-picture
Auth: Required
```

---

### Delete Cover Photo

```
DELETE /delete-cover-photo
Auth: Required
```

---

### Complete Profile (After Signup)

```
POST /complete-profile
Auth: Required
Content-Type: multipart/form-data
```

| Field          | Type   | Required |
| -------------- | ------ | -------- |
| profilePicture | file   | No       |
| coverPhoto     | file   | No       |
| bio            | string | No       |
| interests      | array  | No       |

---

### Update Privacy Settings

```
PUT /privacy-settings
Auth: Required
```

| Field            | Type    | Required |
| ---------------- | ------- | -------- |
| isPrivate        | boolean | No       |
| showOnlineStatus | boolean | No       |
| showLastSeen     | boolean | No       |

---

### Delete Account

```
DELETE /delete/:id
Auth: Required
```

Permanently deletes the user account with that ID.

---

### Block a User

```
POST /block/:userId
Auth: Required
```

---

### Unblock a User

```
POST /unblock/:userId
Auth: Required
```

---

### Get Blocked Users List

```
GET /blocked-list
Auth: Required
```

**Response:**

```json
{
  "success": true,
  "data": [{ "userId": "...", "username": "...", "fullName": "..." }]
}
```

---

### Request Email Change

```
POST /request-email-change
Auth: Required
```

| Field    | Type   | Required |
| -------- | ------ | -------- |
| newEmail | string | Yes      |

---

### Verify Email Change

```
POST /verify-email-change
Auth: Required
```

| Field | Type   | Required |
| ----- | ------ | -------- |
| otp   | string | Yes      |

---

### Request Phone Change

```
POST /request-phone-change
Auth: Required
```

| Field    | Type   | Required |
| -------- | ------ | -------- |
| newPhone | string | Yes      |

---

### Verify Phone Change

```
POST /verify-phone-change
Auth: Required
```

| Field | Type   | Required |
| ----- | ------ | -------- |
| otp   | string | Yes      |

---

## 2. Follow System

Base path: `/api/v1/follow`

All routes need Auth.

### Send Follow Request

```
POST /request/:targetUserId
```

If the target user has a public account → auto-approved.
If private account → sends a pending request.

**Response:**

```json
{
  "success": true,
  "message": "Follow request sent"
}
```

---

### Accept Follow Request

```
POST /accept/:requestId
```

---

### Reject Follow Request

```
POST /reject/:requestId
```

---

### Get Pending Follow Requests

```
GET /pending-requests
```

Returns list of people who sent you a follow request.

---

### Remove a Follow Request (by request ID)

```
DELETE /remove-request/:requestId
```

---

### Cancel Follow Request (by user ID)

```
DELETE /cancel/:userId
```

Use this from frontend — cancel a request you sent to someone.

---

### Remove a Follower

```
DELETE /remove/:targetUserId
```

Removes someone from your followers list.

---

### Unfollow a User

```
DELETE /unfollow/:targetUserId
```

---

### Check Follow Status

```
GET /status/:targetUserId
```

**Response:**

```json
{
  "success": true,
  "data": {
    "isFollowing": true,
    "isFollowedBy": false,
    "isPending": false
  }
}
```

---

### Follow Back

```
POST /follow-back/:targetUserId
```

---

### Get Follow Suggestions

```
GET /suggestions
```

Returns suggested users you might want to follow.

---

### Get Total Followers Count

```
GET /total-followers
```

---

### Get Total Following Count

```
GET /total-following
```

---

### Get Followers List

```
GET /followers/:userId
```

---

### Get Following List

```
GET /following/:userId
```

---

## 3. Posts

Base path: `/api/v1/post`

### Upload a Post

```
POST /upload
Auth: Required
Content-Type: multipart/form-data
```

| Field       | Type     | Required | Description                         |
| ----------- | -------- | -------- | ----------------------------------- |
| files       | file[]   | Yes      | Images or videos (multiple allowed) |
| caption     | string   | No       | Post caption                        |
| location    | string   | No       | Location tag                        |
| hashtags    | string[] | No       | Hashtags                            |
| taggedUsers | string[] | No       | Tagged user IDs                     |

**Response:**

```json
{
  "success": true,
  "message": "Post uploaded successfully",
  "data": { "postId": "..." }
}
```

---

### Delete a Post

```
DELETE /delete/:postId
Auth: Required
```

---

### Get Post Details

```
GET /details/:postId
Auth: Optional
```

Returns full post info — media, caption, likes count, comments count, etc.

---

### Like a Post

```
POST /like/:postId
Auth: Required
```

---

### Unlike a Post

```
DELETE /unlike/:postId
Auth: Required
```

---

### Comment on a Post

```
POST /comment/:postId
Auth: Required
```

| Field | Type   | Required |
| ----- | ------ | -------- |
| text  | string | Yes      |

---

### Delete a Comment

```
DELETE /comment/:commentId
Auth: Required
```

---

### Get All Comments on a Post

```
GET /comments/:postId
Auth: Required
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "commentId": "...",
      "user": { "username": "...", "profilePicture": "..." },
      "text": "Nice post!",
      "createdAt": "2026-02-10T..."
    }
  ]
}
```

---

### Share a Post

```
POST /share/:postId
Auth: Required
```

---

### Save a Post

```
POST /save/:postId
Auth: Required
```

---

### Unsave a Post

```
DELETE /unsave/:postId
Auth: Required
```

---

### Get User's Saved Posts

```
GET /user-saved-posts
Auth: Required
```

---

### Get User's Saved Posts (Alternate Path)

```
GET /save/user-saved-posts
Auth: Required
```

This is an alias — same as `/user-saved-posts` above. Both work.

---

### Report a Post

```
POST /report/:postId
Auth: Required
```

| Field  | Type   | Required |
| ------ | ------ | -------- |
| reason | string | Yes      |

---

### Get Total Post Count

```
GET /totalPostCount
Auth: Required
```

---

### Explore Posts

```
GET /explore
Auth: Required
```

Returns posts from users you're NOT following — for discovery.

---

### Track Post View

```
POST /view/:postId
Auth: Required
```

---

### Get Post Views

```
GET /views/:postId
Auth: Required
```

---

## 4. Comments

Base path: `/api/v1/comment`

All routes need Auth.

### Like a Comment

```
POST /like/:commentId
```

---

### Unlike a Comment

```
DELETE /unlike/:commentId
```

---

### Reply to a Comment

```
POST /reply/:commentId
```

| Field | Type   | Required |
| ----- | ------ | -------- |
| text  | string | Yes      |

---

### Get Replies to a Comment

```
GET /replies/:commentId
```

Supports pagination with `?page=1&limit=10`.

---

### Edit a Comment

```
PUT /edit/:commentId
```

| Field | Type   | Required |
| ----- | ------ | -------- |
| text  | string | Yes      |

---

### Delete a Comment

```
DELETE /delete/:commentId
```

---

### Get Comment Details

```
GET /:commentId
```

---

## 5. Reels

Base path: `/api/v1/reel`

### Upload a Reel

```
POST /upload
Auth: Required
Content-Type: multipart/form-data
```

| Field    | Type     | Required | Description            |
| -------- | -------- | -------- | ---------------------- |
| file     | file     | Yes      | Video file             |
| caption  | string   | No       | Reel caption           |
| hashtags | string[] | No       | Hashtags               |
| music    | string   | No       | Music/audio track info |

---

### Delete a Reel

```
DELETE /delete/:reelId
Auth: Required
```

---

### Get Reel Details

```
GET /details/:reelId
Auth: Optional
```

---

### Get a User's Reels

```
GET /user/:userId
Auth: Required
```

---

### Like / Unlike a Reel (Toggle)

```
POST /toggle-like/:reelId
Auth: Required
```

If already liked → unlikes it. If not liked → likes it.

---

### Comment on a Reel

```
POST /comment/:reelId
Auth: Required
```

| Field | Type   | Required |
| ----- | ------ | -------- |
| text  | string | Yes      |

---

### Get Reel Comments

```
GET /comments/:reelId
Auth: Required
```

---

### Save a Reel

```
POST /save/:reelId
Auth: Required
```

---

### Unsave a Reel

```
DELETE /unsave/:reelId
Auth: Required
```

---

### Get Saved Reels

```
GET /saved
Auth: Required
```

---

### Report a Reel

```
POST /report/:reelId
Auth: Required
```

| Field  | Type   | Required |
| ------ | ------ | -------- |
| reason | string | Yes      |

---

### Track Reel View

```
POST /view/:reelId
Auth: Required
```

---

## 6. Stories

Base path: `/api/v1/story`

### Upload a Story

```
POST /upload
Auth: Required
Content-Type: multipart/form-data
```

| Field | Type | Required | Description          |
| ----- | ---- | -------- | -------------------- |
| file  | file | Yes      | Image or short video |

Stories auto-expire after 24 hours.

---

### Delete a Story

```
DELETE /delete/:storyId
Auth: Required
```

---

### Get All Stories (Feed)

```
GET /feed
Auth: Required
```

Returns stories from users you follow, grouped by user.

---

### Get a User's Stories

```
GET /user/:userId
Auth: Required
```

---

### View a Story (Mark as Seen)

```
POST /view/:storyId
Auth: Required
```

---

### Get Story Viewers

```
GET /viewers/:storyId
Auth: Required
```

Shows who has viewed your story.

---

### Get All Stories (Alternate Path)

```
GET /get-all-stories
Auth: Required
```

This is an alias — same as `/feed` above. Both return the same stories feed.

---

### Cleanup Expired Stories

```
POST /cleanup
Auth: Not Required
```

Called by cron job or manually. Deletes stories older than 24 hours.

---

## 7. Feed

Base path: `/api/v1/feed`

All routes need Auth.

### Home Feed

```
GET /home
```

Returns posts from people you follow, sorted by time.

**Query Params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 10 | Posts per page |

---

### Reels Feed

```
GET /reels
```

Returns reels for the reels tab.

---

### Stories Feed

```
GET /stories
```

Returns active stories from users you follow.

---

### Get a User's Posts

```
GET /posts/:userId
```

Returns all posts of a specific user.

---

## 8. Chat (Direct Messages)

Base path: `/api/v1/chat`

All routes need Auth.

### Get All Chat Threads

```
GET /threads
```

Returns all conversations of the logged-in user.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "threadId": "...",
      "participant": { "username": "...", "profilePicture": "..." },
      "lastMessage": { "text": "Hey!", "createdAt": "..." },
      "unreadCount": 2
    }
  ]
}
```

---

### Get Unread Messages Count

```
GET /unread-count
```

---

### Create or Get a Thread

```
POST /thread/:receiverId
```

If a thread already exists with this user → returns it. Otherwise creates a new one.

---

### Delete a Thread

```
DELETE /thread/delete/:threadId
```

---

### Send a Message

```
POST /message/send/:threadId
Content-Type: multipart/form-data
```

| Field | Type   | Required | Description                 |
| ----- | ------ | -------- | --------------------------- |
| text  | string | No       | Message text                |
| media | file   | No       | Image, video, or audio file |

At least one of `text` or `media` is required.

---

### Delete a Message

```
DELETE /message/delete/:messageId
```

---

### Edit a Message

```
PUT /message/edit/:messageId
```

| Field | Type   | Required |
| ----- | ------ | -------- |
| text  | string | Yes      |

---

### Get Messages in a Thread

```
GET /messages/:threadId
```

Supports pagination with `?page=1&limit=20`.

---

### Mark Messages as Seen

```
PUT /messages/seen/:threadId
```

---

### Upload Chat Media

```
POST /media/upload
Content-Type: multipart/form-data
```

---

### Request a Call

```
POST /call/request/:receiverId
```

---

### End a Call

```
POST /call/end/:callId
```

---

## 9. Groups

Base path: `/api/v1/group`

All routes need Auth.

### Create a Group

```
POST /
Content-Type: multipart/form-data
```

| Field       | Type     | Required | Description              |
| ----------- | -------- | -------- | ------------------------ |
| name        | string   | Yes      | Group name               |
| description | string   | No       | Group description        |
| avatar      | file     | No       | Group avatar image       |
| members     | string[] | Yes      | Array of user IDs to add |

---

### Get My Groups

```
GET /
```

Returns all groups the logged-in user is a member of.

---

### Get Group Details

```
GET /:groupId
```

---

### Update Group

```
PUT /:groupId
Content-Type: multipart/form-data
```

| Field       | Type   | Required |
| ----------- | ------ | -------- |
| name        | string | No       |
| description | string | No       |
| avatar      | file   | No       |

---

### Delete Group

```
DELETE /:groupId
```

---

### Add Members

```
POST /:groupId/members
```

| Field   | Type     | Required |
| ------- | -------- | -------- |
| members | string[] | Yes      |

---

### Remove a Member

```
DELETE /:groupId/members/:memberId
```

---

### Update Member Role

```
PUT /:groupId/members/:memberId/role
```

| Field | Type   | Required | Description         |
| ----- | ------ | -------- | ------------------- |
| role  | string | Yes      | "admin" or "member" |

---

### Generate Invite Link

```
POST /:groupId/invite
```

---

### Join via Invite Link

```
POST /join/:code
```

---

### Send Message to Group

```
POST /:groupId/messages
Content-Type: multipart/form-data
```

| Field | Type   | Required |
| ----- | ------ | -------- |
| text  | string | No       |
| files | file[] | No       |

---

### Get Group Messages

```
GET /:groupId/messages
```

Supports pagination: `?page=1&limit=20`.

---

### React to a Message

```
POST /:groupId/messages/:messageId/react
```

| Field | Type   | Required |
| ----- | ------ | -------- |
| emoji | string | Yes      |

---

### Delete Group Message

```
DELETE /:groupId/messages/:messageId
```

---

### Forward a Message

```
POST /messages/:messageId/forward
```

| Field         | Type   | Required |
| ------------- | ------ | -------- |
| targetGroupId | string | Yes      |

---

### Pin / Unpin a Message

```
PUT /:groupId/messages/:messageId/pin
```

---

### Star a Message

```
PUT /:groupId/messages/:messageId/star
```

---

### Vote on a Poll

```
POST /:groupId/messages/:messageId/vote
```

| Field       | Type   | Required |
| ----------- | ------ | -------- |
| optionIndex | number | Yes      |

---

### Search Group Messages

```
GET /:groupId/search?q=hello
```

---

### Get Starred Messages

```
GET /:groupId/starred
```

---

### Get Group Media Gallery

```
GET /:groupId/media
```

---

## 10. Group Calls

Base path: `/api/v1/group`

All routes need Auth.

### Start a Group Call

```
POST /:groupId/call
```

| Field | Type   | Required | Description        |
| ----- | ------ | -------- | ------------------ |
| type  | string | Yes      | "audio" or "video" |

---

### Get Active Call in Group

```
GET /:groupId/call/active
```

---

### Get Call History

```
GET /:groupId/call/history
```

---

### Join a Call

```
POST /call/:callId/join
```

---

### Leave a Call

```
POST /call/:callId/leave
```

---

### End a Call (Host Only)

```
POST /call/:callId/end
```

---

### Get Call Info

```
GET /call/:callId
```

---

### Toggle Audio/Video/Screen Share

```
PUT /call/:callId/media
```

| Field       | Type    | Required |
| ----------- | ------- | -------- |
| audio       | boolean | No       |
| video       | boolean | No       |
| screenShare | boolean | No       |

---

### Admit from Waiting Room (Host Only)

```
POST /call/:callId/admit
```

---

### Raise / Lower Hand

```
PUT /call/:callId/hand
```

---

### Mute a Participant (Host Only)

```
POST /call/:callId/mute
```

| Field         | Type   | Required |
| ------------- | ------ | -------- |
| participantId | string | Yes      |

---

### Toggle Recording (Host Only)

```
PUT /call/:callId/recording
```

---

## 11. Notifications

Base path: `/api/v1/notifications`

All routes need Auth.

### Get Notifications

```
GET /list
```

**Query Params:**
| Param | Type | Default |
|-------|------|---------|
| page | number | 1 |
| limit | number | 20 |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "type": "like",
      "message": "john liked your post",
      "read": false,
      "createdAt": "2026-02-10T..."
    }
  ]
}
```

---

### Mark One Notification as Read

```
PUT /read/:notificationId
```

---

### Mark All as Read

```
PUT /read-all
```

---

### Get Unread Count

```
GET /unread-count
```

---

### Get Notification Settings

```
GET /settings
```

---

### Update Notification Settings

```
PUT /settings/update
```

| Field    | Type    | Required |
| -------- | ------- | -------- |
| likes    | boolean | No       |
| comments | boolean | No       |
| follows  | boolean | No       |
| messages | boolean | No       |

---

### Register Device Token (Push Notifications)

```
POST /register-token
```

| Field    | Type   | Required |
| -------- | ------ | -------- |
| token    | string | Yes      |
| platform | string | Yes      |

---

### Unregister Device Token

```
DELETE /unregister-token
```

---

### Internal: Create Like Notification

```
POST /like/:postId
Auth: Required
```

Called internally by other services when a user likes a post. Creates a notification for the post owner.

---

### Internal: Create Comment Notification

```
POST /comment/:postId
Auth: Required
```

Called internally when someone comments on a post.

---

### Internal: Create Share Notification

```
POST /share/:postId
Auth: Required
```

Called internally when a post is shared.

---

### Internal: Create Reel Notification

```
POST /reel/:reelId
Auth: Required
```

Called internally for reel-related notifications (like, comment, etc.).

---

### Internal: Create Follow Notification

```
POST /follow/:userId
Auth: Required
```

Called internally when a user follows someone.

---

## 12. Search

Base path: `/api/v1/search`

### Global Search

```
GET /global?q=photography
Auth: Optional
```

Searches across users, posts, hashtags — everything.

---

### Search Users

```
GET /users?q=john
Auth: Optional
```

---

### Search Pages

```
GET /pages?q=tech
Auth: Optional
```

---

### Search Hashtags

```
GET /hashtags?q=travel
Auth: Optional
```

---

### Get Trending

```
GET /trending
Auth: Optional
```

Returns trending hashtags and topics.

---

### Get Search History

```
GET /history
Auth: Required
```

---

### Clear Search History

```
DELETE /history
Auth: Required
```

---

## 13. Live Streaming

Base path: `/api/v1/live`

All routes need Auth.

### Create a Live Stream

```
POST /create
Content-Type: multipart/form-data
```

| Field     | Type   | Required | Description  |
| --------- | ------ | -------- | ------------ |
| title     | string | Yes      | Stream title |
| thumbnail | file   | No       | Cover image  |

---

### Start Live Stream

```
POST /start/:streamId
```

---

### End Live Stream

```
POST /end/:streamId
```

---

### Get Live Stream Details

```
GET /details/:streamId
```

---

### Get Active Live Streams (From Followed Users)

```
GET /active
```

---

### Get All Public Live Streams

```
GET /all
```

---

### Get User's Live Stream History

```
GET /user/:userId
```

---

### Join a Live Stream

```
POST /join/:streamId
```

---

### Leave a Live Stream

```
POST /leave/:streamId
```

---

### Get Live Stream Viewers

```
GET /viewers/:streamId
```

---

### Send a Live Comment

```
POST /comment/:streamId
```

| Field | Type   | Required |
| ----- | ------ | -------- |
| text  | string | Yes      |

---

### Get Live Comments

```
GET /comments/:streamId
```

---

### Delete a Live Stream

```
DELETE /delete/:streamId
```

---

## 14. Admin Panel

Base path: `/api/v1/admin`

### Admin Login

```
POST /login
Auth: Not Required
```

| Field    | Type   | Required |
| -------- | ------ | -------- |
| email    | string | Yes      |
| password | string | Yes      |

---

### Get Dashboard Stats

```
GET /dashboard
Auth: Admin Only
```

Returns total users, total posts, active users, reports count, etc.

---

### Get Analytics

```
GET /analytics
Auth: Admin Only
```

Returns charts data — user growth, post trends, etc.

---

### Get All Users

```
GET /users
Auth: Admin Only
```

**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| page | number | Page number |
| limit | number | Users per page |
| search | string | Search by name/email |

---

### Verify a User

```
PUT /user/verify/:userId
Auth: Admin Only
```

Gives blue tick / verified badge to the user.

---

### Ban a User

```
PUT /user/ban/:userId
Auth: Admin Only
```

---

### Delete a User (Admin)

```
DELETE /user/delete/:userId
Auth: Admin Only
```

---

### Get All Content

```
GET /content
Auth: Admin Only
```

Returns posts, reels for moderation.

---

### Remove Content

```
DELETE /content/remove/:contentId
Auth: Admin Only
```

---

### Get Reports

```
GET /reports
Auth: Admin Only
```

Returns all reported posts/reels/users.

---

### Resolve a Report

```
PUT /reports/resolve/:reportId
Auth: Admin Only
```

---

### Send Global Notification

```
POST /notification/send-global
Auth: Admin Only
```

| Field   | Type   | Required |
| ------- | ------ | -------- |
| title   | string | Yes      |
| message | string | Yes      |

---

## 15. System

Base path: `/api/v1/system`

### Check App Update

```
GET /app-update
Auth: Not Required
```

Returns latest app version info so the frontend can show update prompts.

---

### Check Maintenance Status

```
GET /maintenance-status
Auth: Not Required
```

**Response:**

```json
{
  "success": true,
  "data": {
    "isUnderMaintenance": false,
    "message": ""
  }
}
```

---

### Get Server Health

```
GET /server-health
Auth: Required
```

---

### Set Maintenance Mode (Admin Only)

```
PUT /maintenance-mode
Auth: Admin Only
```

| Field   | Type    | Required |
| ------- | ------- | -------- |
| enabled | boolean | Yes      |
| message | string  | No       |

---

### Update App Version (Admin Only)

```
PUT /app-version/update
Auth: Admin Only
```

---

## 16. WebRTC

Base path: `/api/v1/webrtc`

### Get TURN Server Credentials

```
GET /turn-credentials
Auth: Required
```

Returns temporary TURN server credentials for video/voice calls. These are short-lived for security.

**Response:**

```json
{
  "success": true,
  "data": {
    "urls": ["turn:server.com:3478"],
    "username": "temp_user",
    "credential": "temp_pass"
  }
}
```

---

## 17. Health Check

### Quick Health Check

```
GET /api/v1/health
Auth: Not Required
```

**Response:**

```json
{
  "status": "ok",
  "message": "Server is healthy",
  "timestamp": "2026-02-12T10:00:00.000Z"
}
```

---

### Detailed Health Check

```
GET /api/v1/health/detailed
Auth: Not Required
```

Returns uptime, memory usage, database connection status.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-02-12T10:00:00.000Z",
  "uptime": 86400,
  "memory": { "heapUsed": 50000000 },
  "services": {
    "database": "connected"
  }
}
```

---

### Legacy Health Check

```
GET /health-check
Auth: Not Required
```

Older endpoint. Returns `{ msg: 'Server is Healthy' }`. Use `/api/v1/health` instead.

---

## 18. Root-Level Endpoints

These are defined directly in `app.js` — no base path prefix.

### API Running Check

```
GET /
Auth: Not Required
```

**Response:**

```json
{
  "msg": "API Is Running",
  "version": "1.0.0"
}
```

---

### Quick Health

```
GET /health
Auth: Not Required
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-02-12T10:00:00.000Z"
}
```

---

## Status Codes Quick Reference

| Code | Meaning                                           |
| ---- | ------------------------------------------------- |
| 200  | OK — Request successful                           |
| 201  | Created — New resource created                    |
| 204  | No Content — Success, nothing to return           |
| 400  | Bad Request — Invalid input or missing fields     |
| 401  | Unauthorized — Not logged in or token expired     |
| 403  | Forbidden — You don't have permission             |
| 404  | Not Found — Resource doesn't exist                |
| 409  | Conflict — Already exists (duplicate)             |
| 429  | Too Many Requests — Rate limit hit                |
| 500  | Internal Server Error — Something broke on server |

---

## Notes

- All IDs are MongoDB ObjectIDs (24-character hex strings).
- File uploads use `multipart/form-data` — don't send JSON for those endpoints.
- Pagination uses `?page=1&limit=10` query params where supported.
- Stories expire automatically after 24 hours.
- Real-time features (chat, calls, notifications) work through Socket.IO — not covered in this REST API doc.
- The server runs behind Nginx in production with HTTPS.

---

_Last updated: 12 February 2026_
