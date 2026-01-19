"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { storyService, feedService } from "@/lib/api-services";
import AddStoryModal from "./add-story-modal";
import StoryViewer from "./story-viewer";

interface Story {
  _id: string;
  user: {
    _id: string;
    firstName: string;
    username: string;
    profilePicture?: string;
    avatar?: string;
  };
  media: {
    url: string;
    type: "image" | "video";
  };
  createdAt: string;
}

interface StoriesBarProps {
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string;
}

export default function StoriesBar({
  currentUserId,
  currentUserName,
  currentUserAvatar,
}: StoriesBarProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [myStories, setMyStories] = useState<Story[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);
  const [selectedUserStories, setSelectedUserStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  // Group stories by user
  const groupedStories = stories.reduce((acc, story) => {
    const userId = story.user._id;
    if (!acc[userId]) {
      acc[userId] = [];
    }
    acc[userId].push(story);
    return acc;
  }, {} as Record<string, Story[]>);

  const uniqueUsers = Object.values(groupedStories);

  const loadStories = async () => {
    try {
      setLoading(true);

      // Load current user's stories with cache busting
      const myStoriesResponse = await storyService.getUserStories(currentUserId);
      console.log('📸 My stories response:', myStoriesResponse);
      console.log('📸 Current user ID:', currentUserId);
      if (myStoriesResponse.success && myStoriesResponse.data) {
        let userStories: any[] = [];

        // Handle nested structure: [{ user: ..., stories: [...] }] or direct array
        if (myStoriesResponse.data.stories && Array.isArray(myStoriesResponse.data.stories)) {
          // Check if it's the nested structure
          if (myStoriesResponse.data.stories[0]?.stories) {
            myStoriesResponse.data.stories.forEach((userStoryGroup: any) => {
              if (userStoryGroup.stories && Array.isArray(userStoryGroup.stories)) {
                const flattenedStories = userStoryGroup.stories.map((story: any) => ({
                  ...story,
                  user: story.user || userStoryGroup.user
                }));
                userStories.push(...flattenedStories);
              }
            });
          } else {
            // Direct array structure
            userStories = myStoriesResponse.data.stories;
          }
        } else {
          // Fallback to direct array
          userStories = myStoriesResponse.data || [];
        }

        // Transform backend user_id to user field if needed
        userStories = userStories.map((story: any) => {
          if (story.user_id && !story.user) {
            return {
              ...story,
              user: {
                _id: story.user_id._id || story.user_id,
                firstName: story.user_id.firstName || story.user_id.username || 'Unknown',
                username: story.user_id.username,
                profilePicture: story.user_id.profileImage || story.user_id.profilePicture,
                avatar: story.user_id.avatar,
              },
            };
          }
          return story;
        });

        console.log('📸 Setting my stories:', userStories);
        setMyStories(userStories);
      }

      // Load all stories using the getAllStories endpoint
      const storiesFeedResponse = await storyService.getAllStories({ page: 1, limit: 50 });
      console.log('📸 All stories response:', storiesFeedResponse);
      if (storiesFeedResponse.success && storiesFeedResponse.data) {
        let feedStories: any[] = [];

        // Handle nested structure: [{ user: ..., stories: [...] }]
        if (storiesFeedResponse.data.stories && Array.isArray(storiesFeedResponse.data.stories)) {
          storiesFeedResponse.data.stories.forEach((userStoryGroup: any) => {
            if (userStoryGroup.stories && Array.isArray(userStoryGroup.stories)) {
              // Add user info to each story and flatten the array
              const flattenedStories = userStoryGroup.stories.map((story: any) => ({
                ...story,
                user: story.user || userStoryGroup.user // Use story's user if available, otherwise group's user
              }));
              feedStories.push(...flattenedStories);
            }
          });
        } else {
          // Fallback to direct array if structure is different
          feedStories = storiesFeedResponse.data || [];
        }

        // Transform backend user_id to user field if needed
        feedStories = feedStories.map((story: any) => {
          if (story.user_id && !story.user) {
            return {
              ...story,
              user: {
                _id: story.user_id._id || story.user_id,
                firstName: story.user_id.firstName || story.user_id.username || 'Unknown',
                username: story.user_id.username,
                profilePicture: story.user_id.profileImage || story.user_id.profilePicture,
                avatar: story.user_id.avatar,
              },
            };
          }
          return story;
        });

        console.log('📸 Setting feed stories:', feedStories);
        setStories(feedStories);
      }
    } catch (error) {
      console.error("Error loading stories:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStories();
  }, [currentUserId]);

  const handleAddStory = () => {
    setIsAddModalOpen(true);
  };

  const handleStoryClick = (userStories: Story[], index: number = 0) => {
    setSelectedUserStories(userStories);
    setSelectedStoryIndex(index);
    setIsViewerOpen(true);
  };

  const handleDeleteStory = async (storyId: string) => {
    try {
      const response = await storyService.deleteStory(storyId);
      if (response.success) {
        // Reload stories
        await loadStories();
      }
    } catch (error) {
      console.error("Error deleting story:", error);
    }
  };

  const hasMyStory = myStories.length > 0;

  console.log('📸 Rendering stories-bar. hasMyStory:', hasMyStory, 'myStories count:', myStories.length);

  return (
    <>
      <div className="bg-card sm:border sm:border-border sm:rounded-lg py-4 mb-0 sm:mb-3">
        <div className="flex items-center gap-4 overflow-x-auto px-4 pb-1 no-scrollbar">
          {/* Add Story Button */}
          <div className="flex-shrink-0">
            <button
              onClick={handleAddStory}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="relative">
                <div className="w-[66px] h-[66px] rounded-full overflow-hidden border border-border/50">
                  {currentUserAvatar ? (
                    <img
                      src={currentUserAvatar}
                      alt={currentUserName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 flex items-center justify-center text-foreground font-semibold text-xl">
                      {currentUserName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-[#0095F6] rounded-full flex items-center justify-center border-[3px] border-background shadow-sm">
                  <Plus className="w-4 h-4 text-white" strokeWidth={3} />
                </div>
              </div>
              <span className="text-[11px] text-muted-foreground mt-1">
                Your story
              </span>
            </button>
          </div>

          {/* My Stories */}
          {hasMyStory && (
            <div className="flex-shrink-0">
              <button
                onClick={() => handleStoryClick(myStories)}
                className="flex flex-col items-center gap-1 group"
              >
                <div className="story-ring w-[70px] h-[70px] rounded-full p-[3px]">
                  <div className="w-full h-full rounded-full border-[3px] border-background overflow-hidden">
                    {myStories[0]?.media?.type === "image" ? (
                      <img
                        src={myStories[0]?.media?.url}
                        alt="My story"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={myStories[0]?.media?.url}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-foreground mt-1 max-w-[70px] truncate">
                  Your story
                </span>
              </button>
            </div>
          )}

          {/* Other Users' Stories */}
          {uniqueUsers
            .filter((userStories) => userStories[0].user._id !== currentUserId)
            .map((userStories) => {
              const user = userStories[0].user;
              return (
                <div key={user._id} className="flex-shrink-0">
                  <button
                    onClick={() => handleStoryClick(userStories)}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div className="story-ring w-[70px] h-[70px] rounded-full p-[3px] transition-transform group-active:scale-95">
                      <div className="w-full h-full rounded-full border-[3px] border-background overflow-hidden">
                        {user.profilePicture || user.avatar ? (
                          <img
                            src={user.profilePicture || user.avatar}
                            alt={user.firstName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 flex items-center justify-center text-foreground font-semibold">
                            {user.firstName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] text-foreground mt-1 max-w-[70px] truncate">
                      {user.firstName}
                    </span>
                  </button>
                </div>
              );
            })}

          {/* Loading skeletons */}
          {loading && (
            <>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex-shrink-0">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-[70px] h-[70px] rounded-full bg-muted skeleton-wave" />
                    <div className="w-10 h-2.5 bg-muted rounded-sm skeleton-wave mt-1" />
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Add Story Modal */}
      <AddStoryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={loadStories}
      />

      {/* Story Viewer */}
      <StoryViewer
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        stories={selectedUserStories}
        initialIndex={selectedStoryIndex}
        currentUserId={currentUserId}
        onDelete={handleDeleteStory}
      />
    </>
  );
}
