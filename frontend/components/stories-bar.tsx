"use client";

import { useState, useEffect } from "react";
import { Plus, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { storyService, feedService, liveStreamService } from "@/lib/api-services";
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
  filter?: string;
  music?: {
    trackId: string;
    trackName: string;
    artistName: string;
    previewUrl: string;
    startTime: number;
  };
  createdAt: string;
}

interface LiveStream {
  _id: string;
  title: string;
  streamer: {
    _id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
    avatar?: string;
  };
  thumbnail?: string;
  viewerCount: number;
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
  const router = useRouter();
  const [stories, setStories] = useState<Story[]>([]);
  const [myStories, setMyStories] = useState<Story[]>([]);
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
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

  const loadData = async () => {
    try {
      setLoading(true);

      // Parallel fetch: Stories + Live Streams
      const [myStoriesResponse, feedStoriesResponse, liveResponse] = await Promise.all([
        storyService.getUserStories(currentUserId),
        storyService.getAllStories({ page: 1, limit: 50 }),
        liveStreamService.getActiveLiveStreams({ limit: 10 })
      ]);

      // 1. Handle My Stories
      if (myStoriesResponse.success && myStoriesResponse.data) {
        let userStories: any[] = [];
        // Handle nested structure
        if (myStoriesResponse.data.stories && Array.isArray(myStoriesResponse.data.stories)) {
          if (myStoriesResponse.data.stories[0]?.stories) {
            myStoriesResponse.data.stories.forEach((userStoryGroup: any) => {
              if (userStoryGroup.stories && Array.isArray(userStoryGroup.stories)) {
                userStories.push(...userStoryGroup.stories.map((story: any) => ({
                  ...story,
                  user: story.user || userStoryGroup.user
                })));
              }
            });
          } else {
            userStories = myStoriesResponse.data.stories;
          }
        } else {
          userStories = myStoriesResponse.data || [];
        }

        // Transform
        setMyStories(transformStories(userStories));
      }

      // 2. Handle Feed Stories
      if (feedStoriesResponse.success && feedStoriesResponse.data) {
        let feedStories: any[] = [];
        if (feedStoriesResponse.data.stories && Array.isArray(feedStoriesResponse.data.stories)) {
          feedStoriesResponse.data.stories.forEach((userStoryGroup: any) => {
            if (userStoryGroup.stories && Array.isArray(userStoryGroup.stories)) {
              feedStories.push(...userStoryGroup.stories.map((story: any) => ({
                ...story,
                user: story.user || userStoryGroup.user
              })));
            }
          });
        } else {
          feedStories = feedStoriesResponse.data || [];
        }
        setStories(transformStories(feedStories));
      }

      // 3. Handle Live Streams
      if (liveResponse.success && liveResponse.data) {
        // Filter out streams where streamer might be null (e.g. deleted user)
        setLiveStreams(liveResponse.data.filter((s: any) => s.streamer));
      }

    } catch (error) {
      console.error("Error loading stories/live:", error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to normalize story user structure
  const transformStories = (list: any[]) => {
    return list.map((story: any) => {
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
  }

  useEffect(() => {
    loadData();
  }, [currentUserId]);

  const handleAddStory = () => setIsAddModalOpen(true);

  const handleStoryClick = (userStories: Story[], index: number = 0) => {
    setSelectedUserStories(userStories);
    setSelectedStoryIndex(index);
    setIsViewerOpen(true);
  };

  const handleLiveClick = (streamId: string) => {
    router.push(`/live/watch/${streamId}`);
  };

  const handleDeleteStory = async (storyId: string) => {
    try {
      const response = await storyService.deleteStory(storyId);
      if (response.success) {
        await loadData();
      }
    } catch (error) {
      console.error("Error deleting story:", error);
    }
  };

  const hasMyStory = myStories.length > 0;

  return (
    <>
      <div className="bg-card border border-border rounded-2xl p-4 mb-6">
        <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {/* Add Story Button */}
          <div className="flex-shrink-0">
            <button
              onClick={handleAddStory}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="relative">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-border">
                  {currentUserAvatar ? (
                    <img
                      src={currentUserAvatar}
                      alt={currentUserName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                      {currentUserName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-background">
                  <Plus className="w-3 h-3 text-white" />
                </div>
              </div>
              <span className="text-xs font-medium text-foreground">
                {hasMyStory ? "Add" : "Your Story"}
              </span>
            </button>
          </div>

          {/* Live Streams (Priority) */}
          {liveStreams.map((stream) => (
            <div key={stream._id} className="flex-shrink-0">
              <button
                onClick={() => handleLiveClick(stream._id)}
                className="flex flex-col items-center gap-2 group cursor-pointer"
              >
                <div className="relative">
                  {/* Red Pulse Ring for Live */}
                  <div className="absolute -inset-0.5 rounded-full bg-red-600 blur opacity-75 group-hover:opacity-100 animate-pulse transition"></div>
                  <div className="relative w-16 h-16 rounded-full p-0.5 bg-red-600">
                    <div className="w-full h-full rounded-full border-2 border-background overflow-hidden relative">
                      {stream.streamer?.profilePicture || stream.streamer?.avatar ? (
                        <img
                          src={stream.streamer?.profilePicture || stream.streamer?.avatar}
                          alt={stream.streamer?.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                          <Video className="w-6 h-6 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-red-600 text-[10px] text-white font-bold px-1.5 rounded-sm border-2 border-background">
                    LIVE
                  </div>
                </div>
                <span className="text-xs font-medium text-foreground max-w-[64px] truncate">
                  {stream.streamer?.firstName}
                </span>
              </button>
            </div>
          ))}

          {/* My Stories */}
          {hasMyStory && (
            <div className="flex-shrink-0">
              <button
                onClick={() => handleStoryClick(myStories)}
                className="flex flex-col items-center gap-2 group cursor-pointer"
              >
                <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500">
                  <div className="w-full h-full rounded-full border-2 border-background overflow-hidden">
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
                <span className="text-xs font-medium text-foreground">You</span>
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
                    className="flex flex-col items-center gap-2 group cursor-pointer"
                  >
                    <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500">
                      <div className="w-full h-full rounded-full border-2 border-background overflow-hidden">
                        {user.profilePicture || user.avatar ? (
                          <img
                            src={user.profilePicture || user.avatar}
                            alt={user.firstName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                            {user.firstName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-medium text-foreground max-w-[64px] truncate">
                      {user.firstName}
                    </span>
                  </button>
                </div>
              );
            })}

          {loading && (
            <div className="flex-shrink-0">
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
                <div className="w-12 h-3 bg-muted rounded animate-pulse" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Story Modal */}
      <AddStoryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={loadData}
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
