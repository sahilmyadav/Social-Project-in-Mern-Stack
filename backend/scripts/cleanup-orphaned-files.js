/**
 * Cleanup Orphaned File References
 *
 * This script removes database references to files that no longer exist on disk.
 * Run with: docker exec social-backend node scripts/cleanup-orphaned-files.js
 */

import fs from 'fs';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, '../uploads');

// Connect to MongoDB
const MONGO_URL = process.env.MONGO_URL || 'mongodb://mongo:27017/social_media_app';

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Check if a file exists
function fileExists(filePath) {
  if (!filePath) return true; // null/undefined is valid (no file)

  // Extract relative path from URL
  let relativePath = filePath;
  if (filePath.startsWith('/uploads/')) {
    relativePath = filePath.replace('/uploads/', '');
  } else if (filePath.startsWith('uploads/')) {
    relativePath = filePath.replace('uploads/', '');
  }

  const fullPath = path.join(UPLOADS_DIR, relativePath);
  return fs.existsSync(fullPath);
}

async function cleanupUsers() {
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

  console.log('\n📷 Checking user avatars and cover photos...');

  const users = await User.find({
    $or: [
      { avatar: { $ne: null, $exists: true } },
      { profileImage: { $ne: null, $exists: true } },
      { coverPhoto: { $ne: null, $exists: true } }
    ]
  }).select('_id username avatar profileImage coverPhoto');

  let avatarsCleaned = 0;
  let coversCleaned = 0;

  for (const user of users) {
    const updates = {};

    // Check avatar
    if (user.avatar && !fileExists(user.avatar)) {
      updates.avatar = null;
      updates.profileImage = null;
      avatarsCleaned++;
      console.log(`  🗑️ Cleaning avatar for user: ${user.username || user._id}`);
    }

    // Check profileImage (if different from avatar)
    if (user.profileImage && user.profileImage !== user.avatar && !fileExists(user.profileImage)) {
      updates.profileImage = null;
      if (!updates.avatar) avatarsCleaned++;
      console.log(`  🗑️ Cleaning profileImage for user: ${user.username || user._id}`);
    }

    // Check coverPhoto
    if (user.coverPhoto && !fileExists(user.coverPhoto)) {
      updates.coverPhoto = null;
      coversCleaned++;
      console.log(`  🗑️ Cleaning coverPhoto for user: ${user.username || user._id}`);
    }

    if (Object.keys(updates).length > 0) {
      await User.updateOne({ _id: user._id }, { $set: updates });
    }
  }

  console.log(`✅ Cleaned ${avatarsCleaned} avatars, ${coversCleaned} cover photos`);
  return { avatarsCleaned, coversCleaned };
}

async function cleanupPosts() {
  const Post = mongoose.model('Post', new mongoose.Schema({}, { strict: false }));

  console.log('\n📝 Checking posts...');

  const posts = await Post.find({
    is_deleted: false,
    'media.0': { $exists: true }
  }).select('_id media caption');

  let postsDeleted = 0;
  let mediaItemsCleaned = 0;

  for (const post of posts) {
    if (!post.media || post.media.length === 0) continue;

    // Check if ALL media files are missing
    const validMedia = post.media.filter(m => {
      if (!m.url) return false;
      const exists = fileExists(m.url);
      if (!exists) mediaItemsCleaned++;
      return exists;
    });

    if (validMedia.length === 0) {
      // All media missing - mark post as deleted
      await Post.updateOne({ _id: post._id }, { $set: { is_deleted: true } });
      postsDeleted++;
      console.log(`  🗑️ Marked post as deleted: ${post._id} (all media missing)`);
    } else if (validMedia.length < post.media.length) {
      // Some media missing - update to only valid media
      await Post.updateOne({ _id: post._id }, { $set: { media: validMedia } });
      console.log(`  ⚠️ Removed ${post.media.length - validMedia.length} missing media from post: ${post._id}`);
    }
  }

  console.log(`✅ Deleted ${postsDeleted} posts, cleaned ${mediaItemsCleaned} media items`);
  return { postsDeleted, mediaItemsCleaned };
}

async function cleanupReels() {
  const Reel = mongoose.model('Reel', new mongoose.Schema({}, { strict: false }));

  console.log('\n🎬 Checking reels...');

  const reels = await Reel.find({
    is_deleted: false,
    'media.url': { $exists: true, $ne: null }
  }).select('_id media caption');

  let reelsDeleted = 0;

  for (const reel of reels) {
    if (!reel.media?.url) continue;

    if (!fileExists(reel.media.url)) {
      await Reel.updateOne({ _id: reel._id }, { $set: { is_deleted: true } });
      reelsDeleted++;
      console.log(`  🗑️ Marked reel as deleted: ${reel._id}`);
    }
  }

  console.log(`✅ Deleted ${reelsDeleted} reels`);
  return { reelsDeleted };
}

async function cleanupStories() {
  const Story = mongoose.model('Story', new mongoose.Schema({}, { strict: false }));

  console.log('\n📖 Checking stories...');

  const stories = await Story.find({
    'media.url': { $exists: true, $ne: null }
  }).select('_id media');

  let storiesDeleted = 0;

  for (const story of stories) {
    if (!story.media?.url) continue;

    if (!fileExists(story.media.url)) {
      await Story.deleteOne({ _id: story._id });
      storiesDeleted++;
      console.log(`  🗑️ Deleted story: ${story._id}`);
    }
  }

  console.log(`✅ Deleted ${storiesDeleted} stories`);
  return { storiesDeleted };
}

async function main() {
  console.log('🧹 Starting orphaned file cleanup...');
  console.log(`📁 Uploads directory: ${UPLOADS_DIR}`);

  await connectDB();

  const results = {
    users: await cleanupUsers(),
    posts: await cleanupPosts(),
    reels: await cleanupReels(),
    stories: await cleanupStories(),
  };

  console.log('\n========================================');
  console.log('📊 CLEANUP SUMMARY');
  console.log('========================================');
  console.log(`👤 User avatars cleaned: ${results.users.avatarsCleaned}`);
  console.log(`🖼️ Cover photos cleaned: ${results.users.coversCleaned}`);
  console.log(`📝 Posts deleted: ${results.posts.postsDeleted}`);
  console.log(`🎬 Reels deleted: ${results.reels.reelsDeleted}`);
  console.log(`📖 Stories deleted: ${results.stories.storiesDeleted}`);
  console.log('========================================\n');

  await mongoose.disconnect();
  console.log('✅ Cleanup complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Cleanup failed:', err);
  process.exit(1);
});
