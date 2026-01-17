import { toast } from "sonner"

export const showToast = {
    // Success toasts
    success: (message: string, description?: string) => {
        toast.success(message, { description })
    },

    // Error toasts
    error: (message: string, description?: string) => {
        toast.error(message, { description })
    },

    // Info toasts
    info: (message: string, description?: string) => {
        toast.info(message, { description })
    },

    // Warning toasts
    warning: (message: string, description?: string) => {
        toast.warning(message, { description })
    },

    // Loading toast
    loading: (message: string) => {
        return toast.loading(message)
    },

    // Promise toast (for async operations)
    promise: <T,>(
        promise: Promise<T>,
        {
            loading,
            success,
            error,
        }: {
            loading: string
            success: string | ((data: T) => string)
            error: string | ((error: any) => string)
        }
    ) => {
        return toast.promise(promise, {
            loading,
            success,
            error,
        })
    },

    // Dismiss a specific toast
    dismiss: (toastId?: string | number) => {
        toast.dismiss(toastId)
    },
}

// Predefined toasts for common actions
export const toasts = {
    // Post actions
    postCreated: () => showToast.success("Post created successfully", "Your post is now live!"),
    postDeleted: () => showToast.success("Post deleted", "Your post has been removed"),
    postSaved: () => showToast.success("Post saved", "Added to your saved posts"),
    postUnsaved: () => showToast.success("Post unsaved", "Removed from saved posts"),
    postReported: () => showToast.success("Report submitted", "Thank you for helping keep our community safe"),

    // Reel actions
    reelUploaded: () => showToast.success("Reel uploaded successfully", "Your reel is now live!"),
    reelDeleted: () => showToast.success("Reel deleted", "Your reel has been removed"),
    reelSaved: () => showToast.success("Reel saved", "Added to your saved reels"),
    reelUnsaved: () => showToast.success("Reel unsaved", "Removed from saved reels"),
    reelReported: () => showToast.success("Report submitted", "Thank you for helping keep our community safe"),

    // Story actions
    storyUploaded: () => showToast.success("Story uploaded", "Your story is now visible to your followers"),
    storyDeleted: () => showToast.success("Story deleted", "Your story has been removed"),

    // Comment actions
    commentAdded: () => showToast.success("Comment added", "Your comment has been posted"),
    commentDeleted: () => showToast.success("Comment deleted", "Your comment has been removed"),

    // Like actions
    postLiked: () => showToast.success("Post liked", ""),
    postUnliked: () => showToast.info("Post unliked", ""),

    // Follow actions
    userFollowed: (username: string) => showToast.success("Following", `You are now following ${username}`),
    userUnfollowed: (username: string) => showToast.info("Unfollowed", `You unfollowed ${username}`),

    // Message actions
    messageSent: () => showToast.success("Message sent", ""),
    messageDeleted: () => showToast.success("Message deleted", ""),

    // Group actions
    groupCreated: () => showToast.success("Group created", "Your group is ready!"),
    groupUpdated: () => showToast.success("Group updated", "Changes saved successfully"),
    memberAdded: () => showToast.success("Member added", ""),
    memberRemoved: () => showToast.success("Member removed", ""),

    // Error toasts
    error: (message?: string) => showToast.error("Something went wrong", message || "Please try again later"),
    networkError: () => showToast.error("Network error", "Please check your internet connection"),
    uploadError: () => showToast.error("Upload failed", "Please try again"),
    deleteError: () => showToast.error("Delete failed", "Please try again"),
    saveError: () => showToast.error("Save failed", "Please try again"),
}
