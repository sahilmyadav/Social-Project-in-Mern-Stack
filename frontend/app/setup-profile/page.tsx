"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Camera, Check, X, Loader2, User, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authService } from "@/lib/api-services"
import { ApiError } from "@/lib/api-client"

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value)
        }, delay)

        return () => {
            clearTimeout(handler)
        }
    }, [value, delay])

    return debouncedValue
}

export default function SetupProfilePage() {
    const router = useRouter()
    const [username, setUsername] = useState("")
    const [bio, setBio] = useState("")
    const [profilePicture, setProfilePicture] = useState<File | null>(null)
    const [profilePreview, setProfilePreview] = useState<string>("")
    const [coverPhoto, setCoverPhoto] = useState<File | null>(null)
    const [coverPreview, setCoverPreview] = useState<string>("")

    const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle")
    const [usernameMessage, setUsernameMessage] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState("")

    const debouncedUsername = useDebounce(username, 500)

    // Check username availability
    useEffect(() => {
        const checkUsername = async () => {
            if (!debouncedUsername) {
                setUsernameStatus("idle")
                setUsernameMessage("")
                return
            }

            // Validate format
            const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/
            if (!usernameRegex.test(debouncedUsername)) {
                setUsernameStatus("invalid")
                setUsernameMessage("Username must be 3-30 characters (letters, numbers, underscores only)")
                return
            }

            setUsernameStatus("checking")
            try {
                const response = await authService.checkUsername(debouncedUsername)
                if (response.success && response.data) {
                    if (response.data.available) {
                        setUsernameStatus("available")
                        setUsernameMessage("Username is available!")
                    } else {
                        setUsernameStatus("taken")
                        setUsernameMessage("Username is already taken")
                    }
                }
            } catch (err) {
                setUsernameStatus("invalid")
                setUsernameMessage("Error checking username")
            }
        }

        checkUsername()
    }, [debouncedUsername])

    const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                setError("Profile picture must be less than 5MB")
                return
            }
            setProfilePicture(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setProfilePreview(reader.result as string)
            }
            reader.readAsDataURL(file)
            setError("")
        }
    }

    const handleCoverPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                setError("Cover photo must be less than 10MB")
                return
            }
            setCoverPhoto(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setCoverPreview(reader.result as string)
            }
            reader.readAsDataURL(file)
            setError("")
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        if (!username.trim()) {
            setError("Username is required")
            return
        }

        if (usernameStatus !== "available") {
            setError("Please choose an available username")
            return
        }

        // NEW: Check if user is logged in (has accessToken)
        const accessToken = localStorage.getItem("accessToken")
        if (!accessToken) {
            setError("Session expired. Please login again.")
            router.push("/login")
            return
        }

        setIsSubmitting(true)

        try {
            const response = await authService.completeProfile({
                username: username.trim(),
                bio: bio.trim(),
                profilePicture: profilePicture || undefined,
                coverPhoto: coverPhoto || undefined
            })

            if (response.success && response.data) {
                // Store tokens and user data (User is now created!)
                localStorage.setItem("accessToken", response.data.accessToken)
                localStorage.setItem("refreshToken", response.data.refreshToken)
                localStorage.setItem("user", JSON.stringify(response.data.user))

                // Redirect to home
                router.push("/home")
            } else {
                setError(response.message || "Failed to complete profile")
            }
        } catch (err) {
            const apiError = err as ApiError

            // Handle "User already exists" error
            if (apiError.statusCode === 409) {
                setError("Error: " + (apiError.message || "This email may already be in use. Please try a different email."))
                // Token already cleared above
            } else {
                setError(apiError.message || "An error occurred. Please try again.")
            }
        } finally {
            setIsSubmitting(false)
        }
    }



    return (
        <main className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-2xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mb-4">
                            <User className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Complete Your Profile
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Let's set up your profile to get started
                        </p>
                    </div>

                    {/* Main Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
                        {/* Cover Photo Section */}
                        <div className="relative h-48 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-500">
                            {coverPreview ? (
                                <img
                                    src={coverPreview}
                                    alt="Cover"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <ImageIcon className="w-16 h-16 text-white/50" />
                                </div>
                            )}
                            <label
                                htmlFor="cover-upload"
                                className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 rounded-full p-3 shadow-lg cursor-pointer hover:scale-110 transition-transform"
                            >
                                <Camera className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                                <input
                                    id="cover-upload"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleCoverPhotoChange}
                                    className="hidden"
                                />
                            </label>
                        </div>

                        {/* Profile Picture */}
                        <div className="relative px-8 -mt-16 mb-6">
                            <div className="relative inline-block">
                                <div className="w-32 h-32 rounded-full border-4 border-white dark:border-gray-800 bg-gradient-to-br from-purple-400 to-pink-400 overflow-hidden shadow-xl">
                                    {profilePreview ? (
                                        <img
                                            src={profilePreview}
                                            alt="Profile"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <User className="w-16 h-16 text-white" />
                                        </div>
                                    )}
                                </div>
                                <label
                                    htmlFor="profile-upload"
                                    className="absolute bottom-0 right-0 bg-purple-500 rounded-full p-2.5 shadow-lg cursor-pointer hover:bg-purple-600 transition-colors"
                                >
                                    <Camera className="w-4 h-4 text-white" />
                                    <input
                                        id="profile-upload"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleProfilePictureChange}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-6">
                            {/* Error Message */}
                            {error && (
                                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            {/* Username */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    Username *
                                </label>
                                <div className="relative">
                                    <Input
                                        type="text"
                                        placeholder="Choose a unique username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                                        maxLength={30}
                                        className="pr-10"
                                        required
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        {usernameStatus === "checking" && (
                                            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                                        )}
                                        {usernameStatus === "available" && (
                                            <Check className="w-5 h-5 text-green-500" />
                                        )}
                                        {usernameStatus === "taken" && (
                                            <X className="w-5 h-5 text-red-500" />
                                        )}
                                        {usernameStatus === "invalid" && (
                                            <X className="w-5 h-5 text-orange-500" />
                                        )}
                                    </div>
                                </div>
                                {usernameMessage && (
                                    <p
                                        className={`text-xs mt-1 ${usernameStatus === "available"
                                            ? "text-green-600 dark:text-green-400"
                                            : usernameStatus === "taken"
                                                ? "text-red-600 dark:text-red-400"
                                                : "text-orange-600 dark:text-orange-400"
                                            }`}
                                    >
                                        {usernameMessage}
                                    </p>
                                )}
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Your unique identifier on ClickME
                                </p>
                            </div>

                            {/* Bio */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    Bio (Optional)
                                </label>
                                <textarea
                                    placeholder="Tell us about yourself..."
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    maxLength={150}
                                    rows={3}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 dark:text-white"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {bio.length}/150 characters
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-4">
                                <Button
                                    type="submit"
                                    disabled={isSubmitting || usernameStatus !== "available"}
                                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Creating Account...
                                        </>
                                    ) : (
                                        "Complete Profile"
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>

                    {/* Tips */}
                    <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                        <p>💡 Tip: You can always update your profile later in settings</p>
                    </div>
                </div>
            </div>
        </main>
    )
}
