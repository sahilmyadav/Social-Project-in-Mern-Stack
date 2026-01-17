"use client";

import { useState, useEffect } from "react";
import { X, Search, Users, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chatService, followService } from "@/lib/api-services";

interface User {
    _id: string;
    firstName: string;
    lastName?: string;
    username: string;
    profilePicture?: string;
    isFollowing?: boolean;
}

interface CreateGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGroupCreated: (group: any) => void;
}

export default function CreateGroupModal({
    isOpen,
    onClose,
    onGroupCreated,
}: CreateGroupModalProps) {
    const [step, setStep] = useState<"members" | "details">("members");
    const [searchQuery, setSearchQuery] = useState("");
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
    const [groupName, setGroupName] = useState("");
    const [groupDescription, setGroupDescription] = useState("");
    const [groupAvatar, setGroupAvatar] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadFollowing();
        }
    }, [isOpen]);

    useEffect(() => {
        if (searchQuery.trim()) {
            searchUsers();
        } else {
            loadFollowing();
        }
    }, [searchQuery]);

    const loadFollowing = async () => {
        setIsLoading(true);
        try {
            const userData = localStorage.getItem("user");
            if (!userData) return;

            const user = JSON.parse(userData);
            const response = await followService.getFollowing(user._id);

            if (response.success && response.data) {
                setUsers(response.data.following || []);
            }
        } catch (error) {
            console.error("Error loading following:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const searchUsers = async () => {
        setIsLoading(true);
        try {
            const response = await followService.getSuggestions({ limit: 20 });
            if (response.success && response.data) {
                setUsers(response.data.suggestions || []);
            }
        } catch (error) {
            console.error("Error searching users:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleUserSelection = (user: User) => {
        setSelectedUsers((prev) => {
            const isSelected = prev.some((u) => u._id === user._id);
            if (isSelected) {
                return prev.filter((u) => u._id !== user._id);
            } else {
                return [...prev, user];
            }
        });
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setGroupAvatar(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim() || selectedUsers.length === 0) {
            alert("Please enter a group name and select at least one member");
            return;
        }

        setIsCreating(true);
        try {
            const memberIds = selectedUsers.map((u) => u._id);
            console.log("Creating group with data:", {
                name: groupName.trim(),
                description: groupDescription.trim(),
                memberIds,
                hasAvatar: !!groupAvatar,
            });

            const response = await chatService.createGroup({
                name: groupName.trim(),
                description: groupDescription.trim(),
                memberIds,
                avatar: groupAvatar || undefined,
            });

            console.log("Create group response:", response);

            if (response.success && response.data) {
                onGroupCreated(response.data);
                handleClose();
            } else {
                const errorMessage = response.message || "Failed to create group";
                console.error("Group creation failed:", errorMessage);
                alert(errorMessage);
            }
        } catch (error: any) {
            console.error("Error creating group:", error);
            console.error("Error type:", typeof error);
            console.error("Error keys:", Object.keys(error));

            // Extract error message from different possible error structures
            let errorMessage = "Failed to create group";

            if (typeof error === 'string') {
                errorMessage = error;
            } else if (error?.message) {
                errorMessage = error.message;
            } else if (error?.error) {
                errorMessage = error.error;
            } else if (error?.statusCode) {
                errorMessage = `Error ${error.statusCode}: ${error.message || error.error || 'Unknown error'}`;
            }

            console.error("Final error message:", errorMessage);
            alert(errorMessage);
        } finally {
            setIsCreating(false);
        }
    };

    const handleClose = () => {
        setStep("members");
        setSearchQuery("");
        setSelectedUsers([]);
        setGroupName("");
        setGroupDescription("");
        setGroupAvatar(null);
        setAvatarPreview("");
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            <Users className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {step === "members" ? "New Group" : "Group Details"}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {step === "members"
                                    ? `${selectedUsers.length} member${selectedUsers.length !== 1 ? "s" : ""} selected`
                                    : "Add group information"}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {step === "members" ? (
                        <div className="p-6 space-y-4">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <Input
                                    type="text"
                                    placeholder="Search people..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                                />
                            </div>

                            {/* Selected Users */}
                            {selectedUsers.length > 0 && (
                                <div className="flex flex-wrap gap-2 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                                    {selectedUsers.map((user) => (
                                        <div
                                            key={user._id}
                                            className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-full border border-purple-200 dark:border-purple-800"
                                        >
                                            <img
                                                src={user.profilePicture || "/default-avatar.png"}
                                                alt={user.firstName}
                                                className="w-6 h-6 rounded-full object-cover"
                                            />
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                {user.firstName}
                                            </span>
                                            <button
                                                onClick={() => toggleUserSelection(user)}
                                                className="ml-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full p-0.5"
                                            >
                                                <X className="w-3 h-3 text-gray-500" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* User List */}
                            <div className="space-y-2">
                                {isLoading ? (
                                    <div className="text-center py-8 text-gray-500">
                                        Loading...
                                    </div>
                                ) : users.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        No users found
                                    </div>
                                ) : (
                                    users.map((user) => {
                                        const isSelected = selectedUsers.some(
                                            (u) => u._id === user._id
                                        );
                                        return (
                                            <div
                                                key={user._id}
                                                onClick={() => toggleUserSelection(user)}
                                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${isSelected
                                                    ? "bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-500"
                                                    : "hover:bg-gray-50 dark:hover:bg-gray-800 border-2 border-transparent"
                                                    }`}
                                            >
                                                <img
                                                    src={user.profilePicture || "/default-avatar.png"}
                                                    alt={user.firstName}
                                                    className="w-12 h-12 rounded-full object-cover"
                                                />
                                                <div className="flex-1">
                                                    <p className="font-semibold text-gray-900 dark:text-white">
                                                        {user.firstName} {user.lastName || ""}
                                                    </p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        @{user.username}
                                                    </p>
                                                </div>
                                                <div
                                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected
                                                        ? "bg-purple-500 border-purple-500"
                                                        : "border-gray-300 dark:border-gray-600"
                                                        }`}
                                                >
                                                    {isSelected && (
                                                        <svg
                                                            className="w-4 h-4 text-white"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={3}
                                                                d="M5 13l4 4L19 7"
                                                            />
                                                        </svg>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 space-y-6">
                            {/* Group Avatar */}
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative">
                                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden">
                                        {avatarPreview ? (
                                            <img
                                                src={avatarPreview}
                                                alt="Group avatar"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <Users className="w-12 h-12 text-white" />
                                        )}
                                    </div>
                                    <label
                                        htmlFor="avatar-upload"
                                        className="absolute bottom-0 right-0 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-purple-600 transition-colors shadow-lg"
                                    >
                                        <Camera className="w-4 h-4 text-white" />
                                        <input
                                            id="avatar-upload"
                                            type="file"
                                            accept="image/*"
                                            onChange={handleAvatarChange}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Add group photo
                                </p>
                            </div>

                            {/* Group Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Group Name *
                                </label>
                                <Input
                                    type="text"
                                    placeholder="Enter group name"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    maxLength={50}
                                    className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {groupName.length}/50 characters
                                </p>
                            </div>

                            {/* Group Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Description (Optional)
                                </label>
                                <textarea
                                    placeholder="What's this group about?"
                                    value={groupDescription}
                                    onChange={(e) => setGroupDescription(e.target.value)}
                                    maxLength={200}
                                    rows={3}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 dark:text-white"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {groupDescription.length}/200 characters
                                </p>
                            </div>

                            {/* Members Preview */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Members ({selectedUsers.length})
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {selectedUsers.slice(0, 5).map((user) => (
                                        <img
                                            key={user._id}
                                            src={user.profilePicture || "/default-avatar.png"}
                                            alt={user.firstName}
                                            className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-gray-800"
                                            title={user.firstName}
                                        />
                                    ))}
                                    {selectedUsers.length > 5 && (
                                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-300">
                                            +{selectedUsers.length - 5}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex gap-3">
                    {step === "details" && (
                        <Button
                            onClick={() => setStep("members")}
                            variant="outline"
                            className="flex-1"
                        >
                            Back
                        </Button>
                    )}
                    <Button
                        onClick={() => {
                            if (step === "members") {
                                if (selectedUsers.length === 0) {
                                    alert("Please select at least one member");
                                    return;
                                }
                                setStep("details");
                            } else {
                                handleCreateGroup();
                            }
                        }}
                        disabled={
                            step === "members"
                                ? selectedUsers.length === 0
                                : !groupName.trim() || isCreating
                        }
                        className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                    >
                        {step === "members"
                            ? "Next"
                            : isCreating
                                ? "Creating..."
                                : "Create Group"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
