/**
 * Shared search utilities.
 *
 * Provides safe regex construction and reusable blocked-user filtering
 * to prevent ReDoS and eliminate code duplication across search endpoints.
 */

/**
 * Escape special regex characters in user-supplied input.
 * Prevents ReDoS attacks from crafted search queries.
 *
 * @param {string} str - Raw user input
 * @returns {string} - Escaped string safe for new RegExp()
 */
export const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Build a case-insensitive RegExp from user input.
 * Escapes special characters and enforces a max length.
 *
 * @param {string} query - Raw search query from user
 * @param {number} maxLength - Maximum allowed query length (default 200)
 * @returns {RegExp}
 */
export const buildSafeRegex = (query, maxLength = 200) => {
  const trimmed = query.trim().slice(0, maxLength);
  return new RegExp(escapeRegex(trimmed), 'i');
};

/**
 * Fetch bidirectional blocked user IDs for a given user.
 * Returns the union of: users the current user blocked + users who blocked current user.
 *
 * @param {import('mongoose').Types.ObjectId|string|null} userId
 * @param {import('mongoose').Model} UserModel
 * @returns {Promise<import('mongoose').Types.ObjectId[]>}
 */
export const getBlockedUserIds = async (userId, UserModel) => {
  if (!userId) return [];

  const [currentUser, usersWhoBlockedMe] = await Promise.all([
    UserModel.findById(userId).select('blockedUsers').lean(),
    UserModel.find({ blockedUsers: userId }).select('_id').lean(),
  ]);

  const blockedByMe = currentUser?.blockedUsers || [];
  const blockedMe = usersWhoBlockedMe.map((u) => u._id);

  return [...blockedByMe, ...blockedMe];
};
