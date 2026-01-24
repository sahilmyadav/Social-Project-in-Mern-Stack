"use client";

import { useState, useEffect } from "react";
import {
    X,
    Users,
    Camera,
    Edit2,
    UserPlus,
    LogOut,
    Shield,
    Trash2,
    MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chatService } from "@/lib/api-services";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface GroupMember {
    _id: string;
    firstName: string;
    lastName?: string;
    username: string;
    profilePicture?: string;
    isAdmin?: boolean;
}

interface GroupInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupId: string;
    currentUserId: string;
    onGroupUpdated?: () => void;
    onLeaveGroup?: () => void;
}

export default function GroupInfoModal({
    isOpen,
    onClose,
    groupId,
    currentUserId,
    onGroupUpdated,
    onLeaveGroup,
}: GroupInfoModalProps) {
    const [groupDetails, setGroupDetails] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [groupName, setGroupName] = useState("");
    const [groupDescription, setGroupDescription] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        if (isOpen && groupId) {
            loadGroupDetails();
        }
    }, [isOpen, groupId]);

    const loadGroupDetails = async () => {
        setIsLoading(true);
        try {
            const response = await chatService.getGroupDetails(groupId);
            if (response.success && response.data) {
                setGroupDetails(response.data);
                setGroupName(response.data.name || "");
                setGroupDescription(response.data.description || "");
            }
        } catch (error) {
            console.error("Error loading group details:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateGroup = async () => {
        if (!groupName.trim()) {
            alert("Group name cannot be empty");
            return;
        }

        setIsUpdating(true);
        try {
            const response = await chatService.updateGroup(groupId, {
                name: groupName.trim(),
                description: groupDescription.trim(),
            });

            if (response.success) {
                setIsEditing(false);
                loadGroupDetails();
                onGroupUpdated?.();
            } else {
                alert(response.message || "Failed to update group");
            }
        } catch (error: any) {
            console.error("Error updating group:", error);
            alert(error.message || "Failed to update group");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const response = await chatService.updateGroupAvatar(groupId, file);
            if (response.success) {
                loadGroupDetails();
                onGroupUpdated?.();
            } else {
                alert(response.message || "Failed to update group avatar");
            }
        } catch (error: any) {
            console.error("Error updating avatar:", error);
            alert(error.message || "Failed to update group avatar");
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!confirm("Are you sure you want to remove this member?")) return;

        try {
            const response = await chatService.removeMember(groupId, memberId);
            if (response.success) {
                loadGroupDetails();
                onGroupUpdated?.();
            } else {
                alert(response.message || "Failed to remove member");
            }
        } catch (error: any) {
            console.error("Error removing member:", error);
            alert(error.message || "Failed to remove member");
        }
    };

    const handleMakeAdmin = async (memberId: string) => {
        try {
            const response = await chatService.makeAdmin(groupId, memberId);
            if (response.success) {
                loadGroupDetails();
                onGroupUpdated?.();
            } else {
                alert(response.message || "Failed to make admin");
            }
        } catch (error: any) {
            console.error("Error making admin:", error);
            alert(error.message || "Failed to make admin");
        }
    };

    const handleLeaveGroup = async () => {
        if (!confirm("Are you sure you want to leave this group?")) return;

        try {
            const response = await chatService.leaveGroup(groupId);
            if (response.success) {
                onLeaveGroup?.();
                onClose();
            } else {
                alert(response.message || "Failed to leave group");
            }
        } catch (error: any) {
            console.error("Error leaving group:", error);
            alert(error.message || "Failed to leave group");
        }
    };

    if (!isOpen) return null;

    const isAdmin = groupDetails?.admins?.some(
        (admin: any) => admin._id === currentUserId || admin === currentUserId
    );
    const members: GroupMember[] = groupDetails?.members || [];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Group Info
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
                        </div>
                    ) : (
                        <div className="p-6 space-y-6">
                            {/* Group Avatar & Name */}
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative">
                                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden">
                                        {groupDetails?.avatar ? (
                                            <img
                                                src={groupDetails.avatar}
                                                alt="Group avatar"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <Users className="w-12 h-12 text-white" />
                                        )}
                                    </div>
                                    {isAdmin && (
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
                                    )}
                                </div>

                                {isEditing ? (
                                    <div className="w-full space-y-3">
                                        <Input
                                            type="text"
                                            value={groupName}
                                            onChange={(e) => setGroupName(e.target.value)}
                                            placeholder="Group name"
                                            maxLength={50}
                                            className="text-center font-semibold"
                                        />
                                        <textarea
                                            value={groupDescription}
                                            onChange={(e) => setGroupDescription(e.target.value)}
                                            placeholder="Group description"
                                            maxLength={200}
                                            rows={2}
                                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 dark:text-white text-center text-sm"
                                        />
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => {
                                                    setIsEditing(false);
                                                    setGroupName(groupDetails?.name || "");
                                                    setGroupDescription(groupDetails?.description || "");
                                                }}
                                                variant="outline"
                                                className="flex-1"
                                                size="sm"
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                onClick={handleUpdateGroup}
                                                disabled={isUpdating}
                                                className="flex-1 bg-purple-500 hover:bg-purple-600"
                                                size="sm"
                                            >
                                                {isUpdating ? "Saving..." : "Save"}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <div className="flex items-center gap-2 justify-center">
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                                {groupDetails?.name}
                                            </h3>
                                            {isAdmin && (
                                                <button
                                                    onClick={() => setIsEditing(true)}
                                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                                                >
                                                    <Edit2 className="w-4 h-4 text-gray-500" />
                                                </button>
                                            )}
                                        </div>
                                        {groupDetails?.description && (
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                {groupDetails.description}
                                            </p>
                                        )}
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                            {members.length} member{members.length !== 1 ? "s" : ""}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Members List */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-semibold text-gray-900 dark:text-white">
                                        Members
                                    </h4>
                                    {isAdmin && (
                                        <button className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-sm font-medium">
                                            <UserPlus className="w-4 h-4" />
                                            Add
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    {members.map((member) => {
                                        const memberIsAdmin = groupDetails?.admins?.some(
                                            (admin: any) =>
                                                admin._id === member._id || admin === member._id
                                        );
                                        const isCurrentUser = member._id === currentUserId;

                                        return (
                                            <div
                                                key={member._id}
                                                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                            >
                                                <img
                                                    src={member.profilePicture || "/default-avatar.png"}
                                                    alt={member.firstName}
                                                    className="w-12 h-12 rounded-full object-cover"
                                                />
                                                <div className="flex-1">
                                                    <p className="font-semibold text-gray-900 dark:text-white">
                                                        {member.firstName} {member.lastName || ""}
                                                        {isCurrentUser && (
                                                            <span className="text-gray-500 text-sm ml-1">
                                                                (You)
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        @{member.username}
                                                        {memberIsAdmin && (
                                                            <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full">
                                                                Admin
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>

                                                {isAdmin && !isCurrentUser && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                                                                <MoreVertical className="w-4 h-4 text-gray-500" />
                                                            </button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            {!memberIsAdmin && (
                                                                <DropdownMenuItem
                                                                    onClick={() => handleMakeAdmin(member._id)}
                                                                >
                                                                    <Shield className="w-4 h-4 mr-2" />
                                                                    Make Admin
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem
                                                                onClick={() => handleRemoveMember(member._id)}
                                                                className="text-red-600 dark:text-red-400"
                                                            >
                                                                <Trash2 className="w-4 h-4 mr-2" />
                                                                Remove
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Leave Group */}
                            <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                                <button
                                    onClick={handleLeaveGroup}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-medium"
                                >
                                    <LogOut className="w-5 h-5" />
                                    Leave Group
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
