"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Eye, EyeOff, Bell, Lock, Shield, Trash2, Moon, Sun } from "lucide-react"
import Navigation from "@/components/navigation"
import { authService } from "@/lib/api-services"
import { useConfirmDialog, ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useTheme } from "next-themes"

export default function AccountSettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("general")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    phone: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [notifications, setNotifications] = useState({
    likes: true,
    comments: true,
    follows: true,
    messages: true,
    promotions: false,
  })
  const [isPrivateAccount, setIsPrivateAccount] = useState(false)
  const [allowDownloads, setAllowDownloads] = useState(true)
  const [privacyLoading, setPrivacyLoading] = useState(false)
  const [downloadLoading, setDownloadLoading] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const { confirm, dialogProps } = useConfirmDialog()

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (!userData) {
      router.push("/")
    } else {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
      setFormData({
        ...formData,
        email: parsedUser.email || "",
        username: parsedUser.name || "",
        phone: "+91 9876543210",
      })
      // Set private account status from user data
      setIsPrivateAccount(parsedUser.profile_type === 'private' || parsedUser.isPrivate || false)
      // Set download permission from user data (default to true if not set)
      setAllowDownloads(parsedUser.allowDownloads !== false)
    }
  }, [router])

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleInputChange = (e: any) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleNotificationChange = (key: keyof typeof notifications) => {
    setNotifications({ ...notifications, [key]: !notifications[key] })
  }

  const handleSaveChanges = () => {
    confirm({
      title: "Success",
      message: "Changes saved successfully!",
      variant: "success",
      confirmText: "OK",
      cancelText: null
    })
  }

  const handleChangePassword = async () => {
    setPasswordError("")

    // Validation
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      setPasswordError("All fields are required")
      return
    }

    if (formData.newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters")
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setPasswordError("New passwords do not match")
      return
    }

    setPasswordLoading(true)

    try {
      const response = await authService.changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      })

      if (response.success) {
        confirm({
          title: "Success",
          message: "Password changed successfully!",
          variant: "success",
          confirmText: "OK",
          cancelText: null
        })
        setFormData({
          ...formData,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        })
      } else {
        setPasswordError(response.message || "Failed to change password")
      }
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password. Please try again.")
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleTogglePrivateAccount = async () => {
    setPrivacyLoading(true)
    try {
      const newPrivacyStatus = !isPrivateAccount

      const response = await authService.updatePrivacySettings({
        profile_type: newPrivacyStatus ? 'private' : 'public'
      })

      if (response.success) {
        setIsPrivateAccount(newPrivacyStatus)

        // Update user data in localStorage
        const userData = localStorage.getItem("user")
        if (userData) {
          const parsedUser = JSON.parse(userData)
          parsedUser.profile_type = newPrivacyStatus ? 'private' : 'public'
          parsedUser.isPrivate = newPrivacyStatus
          localStorage.setItem("user", JSON.stringify(parsedUser))
          setUser(parsedUser)
        }

        confirm({
          title: "Privacy Settings Updated",
          message: newPrivacyStatus ? "Your account is now private" : "Your account is now public",
          variant: "success",
          confirmText: "OK",
          cancelText: null
        })
      } else {
        confirm({
          title: "Error",
          message: response.message || "Failed to update privacy settings",
          variant: "danger",
          confirmText: "OK",
          cancelText: null
        })
      }
    } catch (error: any) {
      console.error("Error updating privacy:", error)
      confirm({
        title: "Error",
        message: error.message || "Failed to update privacy settings",
        variant: "danger",
        confirmText: "OK",
        cancelText: null
      })
    } finally {
      setPrivacyLoading(false)
    }
  }

  const handleToggleDownloads = async () => {
    setDownloadLoading(true)
    try {
      const newDownloadStatus = !allowDownloads

      const response = await authService.updatePrivacySettings({
        allowDownloads: newDownloadStatus
      })

      if (response.success) {
        setAllowDownloads(newDownloadStatus)

        // Update user data in localStorage
        const userData = localStorage.getItem("user")
        if (userData) {
          const parsedUser = JSON.parse(userData)
          parsedUser.allowDownloads = newDownloadStatus
          localStorage.setItem("user", JSON.stringify(parsedUser))
          setUser(parsedUser)
        }

        confirm({
          title: "Download Settings Updated",
          message: newDownloadStatus
            ? "Others can now download your posts and reels"
            : "Others cannot download your posts and reels",
          variant: "success",
          confirmText: "OK",
          cancelText: null
        })
      } else {
        confirm({
          title: "Error",
          message: response.message || "Failed to update download settings",
          variant: "danger",
          confirmText: "OK",
          cancelText: null
        })
      }
    } catch (error: any) {
      console.error("Error updating download settings:", error)
      confirm({
        title: "Error",
        message: error.message || "Failed to update download settings",
        variant: "danger",
        confirmText: "OK",
        cancelText: null
      })
    } finally {
      setDownloadLoading(false)
    }
  }

  const handleDeleteAccount = () => {
    confirm({
      title: "Delete Account",
      message: "Are you sure you want to delete your account? This action cannot be undone.",
      variant: "danger",
      confirmText: "Delete Account",
      onConfirm: () => {
        localStorage.removeItem("user")
        router.push("/")
      }
    })
  }

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <main className="min-h-screen bg-background pb-20 lg:pb-0">
      <ConfirmDialog {...dialogProps} />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto cursor-pointer">
          <Navigation user={user} onLogout={() => { }} />
        </aside>

        <section className="lg:col-span-3">
          <div className="max-w-3xl mx-auto p-4 lg:p-8">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
              <button onClick={() => router.back()} className="p-2 hover:bg-muted rounded-lg transition cursor-pointer">
                <ArrowLeft size={24} className="text-foreground" />
              </button>
              <h1 className="text-3xl font-bold text-foreground">Account Settings</h1>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-8 border-b border-border overflow-x-auto pb-px scrollbar-hide">
              {[
                { id: "general", label: "General", icon: "⚙️" },
                { id: "security", label: "Security", icon: "🔒" },
                { id: "notifications", label: "Notifications", icon: "🔔" },
                { id: "privacy", label: "Privacy", icon: "🛡️" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`cursor-pointer px-4 py-3 font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap flex-shrink-0 ${activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* General Settings */}
            {activeTab === "general" && (
              <div className="space-y-6">
                <div className="bg-card rounded-lg border border-border p-6">
                  <h2 className="text-xl font-bold mb-4 text-foreground">Personal Information</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">Email Address</label>
                      <Input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="bg-muted border-0 text-foreground"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">Username</label>
                      <Input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleInputChange}
                        className="bg-muted border-0 text-foreground"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">Phone Number</label>
                      <Input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="bg-muted border-0 text-foreground"
                      />
                    </div>

                    <Button
                      onClick={handleSaveChanges}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground w-full mt-6 cursor-pointer"
                    >
                      Save Changes
                    </Button>
                  </div>
                </div>

                {/* Theme Settings */}
                <div className="bg-card rounded-lg border border-border p-6">
                  <h2 className="text-xl font-bold mb-4 text-foreground">Appearance</h2>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg gap-4">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 flex-shrink-0">
                          {mounted && theme === "dark" ? <Moon size={16} className="text-primary" /> : <Sun size={16} className="text-primary" />}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">Dark Theme</p>
                          <p className="text-sm text-muted-foreground">
                            {mounted && theme === "dark" ? "Dark mode is enabled" : "Light mode is enabled"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                        disabled={!mounted}
                        className={`cursor-pointer w-12 h-7 rounded-full transition flex-shrink-0 ${mounted && theme === "dark" ? "bg-primary" : "bg-muted-foreground"
                          } disabled:opacity-50`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white transition transform ${mounted && theme === "dark" ? "translate-x-6" : "translate-x-1"
                            }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Security Settings */}
            {activeTab === "security" && (
              <div className="space-y-6">
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Lock size={24} className="text-primary" />
                    <h2 className="text-xl font-bold text-foreground">Change Password</h2>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">Current Password</label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          name="currentPassword"
                          value={formData.currentPassword}
                          onChange={handleInputChange}
                          className="bg-muted border-0 text-foreground pr-10"
                        />
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">New Password</label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          name="newPassword"
                          value={formData.newPassword}
                          onChange={handleInputChange}
                          className="bg-muted border-0 text-foreground pr-10"
                        />
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">Confirm Password</label>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          className="bg-muted border-0 text-foreground pr-10"
                        />
                        <button
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    {passwordError && (
                      <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3 mt-4">
                        {passwordError}
                      </div>
                    )}

                    <Button
                      onClick={handleChangePassword}
                      disabled={passwordLoading}
                      className="cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground w-full mt-6"
                    >
                      {passwordLoading ? "Updating..." : "Update Password"}
                    </Button>
                  </div>
                </div>

                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Shield size={24} className="text-primary" />
                    <h2 className="text-xl font-bold text-foreground">Two-Factor Authentication</h2>
                  </div>
                  <p className="text-muted-foreground mb-4">Add an extra layer of security to your account</p>
                  <Button className="cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground">Enable 2FA</Button>
                </div>
              </div>
            )}

            {/* Notifications Settings */}
            {activeTab === "notifications" && (
              <div className="space-y-6">
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Bell size={24} className="text-primary" />
                    <h2 className="text-xl font-bold text-foreground">Notification Preferences</h2>
                  </div>

                  <div className="space-y-4">
                    {([
                      { key: "likes", label: "Likes on your posts", icon: "❤️" },
                      { key: "comments", label: "Comments on your posts", icon: "💬" },
                    ] as const).map((notif) => (
                      <div key={notif.key} className="flex items-center justify-between p-4 bg-muted rounded-lg gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-2xl">{notif.icon}</span>
                          <span className="text-foreground font-semibold">{notif.label}</span>
                        </div>
                        <button
                          onClick={() => handleNotificationChange(notif.key)}
                          className={`cursor-pointer w-12 h-7 rounded-full transition flex-shrink-0 ${notifications[notif.key as keyof typeof notifications]
                            ? "bg-primary"
                            : "bg-muted-foreground"
                            }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-white transition transform ${notifications[notif.key as keyof typeof notifications] ? "translate-x-6" : "translate-x-1"
                              }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Privacy Settings */}
            {activeTab === "privacy" && (
              <div className="space-y-6">
                <div className="bg-card rounded-lg border border-border p-6">
                  <h2 className="text-xl font-bold mb-4 text-foreground">Privacy & Safety</h2>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg gap-4">
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">Private Account</p>
                        <p className="text-sm text-muted-foreground">
                          {isPrivateAccount
                            ? "Your account is private - only approved followers can see your posts"
                            : "Your account is public - anyone can see your posts"}
                        </p>
                      </div>
                      <button
                        onClick={handleTogglePrivateAccount}
                        disabled={privacyLoading}
                        className={`cursor-pointer w-12 h-7 rounded-full transition flex-shrink-0 ${isPrivateAccount ? "bg-primary" : "bg-muted-foreground"
                          } disabled:opacity-50`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white transition transform ${isPrivateAccount ? "translate-x-6" : "translate-x-1"
                            }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg gap-4">
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">Allow Downloads</p>
                        <p className="text-sm text-muted-foreground">
                          {allowDownloads
                            ? "Others can download your posts and reels"
                            : "Others cannot download your posts and reels"}
                        </p>
                      </div>
                      <button
                        onClick={handleToggleDownloads}
                        disabled={downloadLoading}
                        className={`cursor-pointer w-12 h-7 rounded-full transition flex-shrink-0 ${allowDownloads ? "bg-primary" : "bg-muted-foreground"
                          } disabled:opacity-50`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white transition transform ${allowDownloads ? "translate-x-6" : "translate-x-1"
                            }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg gap-4">
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">Block Messages from Strangers</p>
                        <p className="text-sm text-muted-foreground">Only people you follow can message you</p>
                      </div>
                      <button className="cursor-pointer w-12 h-7 rounded-full bg-primary flex-shrink-0">
                        <div className="w-5 h-5 rounded-full bg-white translate-x-6" />
                      </button>
                    </div>

                    {/* Blocked Users */}
                    <button
                      onClick={() => router.push('/blocked-users')}
                      className="w-full flex items-center justify-between p-4 bg-muted rounded-lg hover:bg-muted/80 transition cursor-pointer"
                    >
                      <div className="text-left">
                        <p className="font-semibold text-foreground">Blocked Users</p>
                        <p className="text-sm text-muted-foreground">Manage users you've blocked</p>
                      </div>
                      <span className="text-muted-foreground">→</span>
                    </button>
                  </div>
                </div>

                <div className="bg-card rounded-lg border border-red-200 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Trash2 size={24} className="text-red-500" />
                    <h2 className="text-xl font-bold text-red-500">Delete Account</h2>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    Once you delete your account, there is no going back. Please be certain.
                  </p>
                  <Button onClick={handleDeleteAccount} className="bg-red-500 hover:bg-red-600 text-white cursor-pointer">
                    Delete Account Permanently
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <Navigation user={user} onLogout={() => { }} isMobile={true} />
    </main>
  )
}
