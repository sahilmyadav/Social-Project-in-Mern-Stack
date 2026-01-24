"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Navigation from "@/components/navigation"
import { postService, reelService } from "@/lib/api-services"
import { ApiError } from "@/lib/api-client"

export default function CreatePage() {
  const [user, setUser] = useState<any>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [caption, setCaption] = useState("")
  const [contentType, setContentType] = useState<"post" | "reel">("post")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (!userData) {
      router.push("/")
    } else {
      setUser(JSON.parse(userData))
    }
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("user")
    router.push("/")
  }

  const handlePublish = async () => {
    if (!uploadedFile || !caption.trim()) {
      setError("Please upload a file and add a caption")
      return
    }

    setLoading(true)
    setError("")

    try {
      // Create FormData
      const formData = new FormData()
      formData.append("file", uploadedFile)
      formData.append("caption", caption.trim())

      // Call appropriate API based on content type
      let response
      if (contentType === "post") {
        response = await postService.createPost(formData)
      } else {
        response = await reelService.uploadReel(formData)
      }

      if (response.success) {
        alert(`${contentType === "post" ? "Post" : "Reel"} published successfully!`)
        setCaption("")
        setUploadedFile(null)
        // Redirect to home to see the new post/reel
        router.push("/home")
      } else {
        setError(response.message || `Failed to publish ${contentType}`)
      }
    } catch (err) {
      const apiError = err as ApiError
      console.error(`Failed to publish ${contentType}:`, apiError)

      if (apiError.statusCode === 401) {
        setError("Please login to create content")
        router.push("/login")
      } else if (apiError.statusCode === 413) {
        setError("File size too large. Please choose a smaller file.")
      } else {
        setError(apiError.message || `Failed to publish ${contentType}. Please try again.`)
      }
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <main className="min-h-screen bg-background pb-20 lg:pb-0">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar */}
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto">
          <Navigation user={user} onLogout={handleLogout} />
        </aside>

        {/* Main Content */}
        <section className="lg:col-span-2 max-w-2xl mx-auto">
          <div className="bg-card rounded-2xl border border-border p-8">
            <h1 className="text-3xl font-bold text-foreground mb-6">Create New Content</h1>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                {error}
              </div>
            )}

            {/* Content Type Selection */}
            <div className="mb-8">
              <p className="text-foreground font-semibold mb-4">What would you like to create?</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setContentType("post")}
                  className={`p-4 rounded-xl border-2 transition ${contentType === "post" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                    }`}
                >
                  <p className="text-2xl mb-2">📸</p>
                  <p className="font-semibold text-foreground">Post</p>
                  <p className="text-xs text-muted-foreground mt-1">Share photos & stories</p>
                </button>
                <button
                  onClick={() => setContentType("reel")}
                  className={`p-4 rounded-xl border-2 transition ${contentType === "reel" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                    }`}
                >
                  <p className="text-2xl mb-2">🎬</p>
                  <p className="font-semibold text-foreground">Reel</p>
                  <p className="text-xs text-muted-foreground mt-1">Share short videos</p>
                </button>
              </div>
            </div>

            {/* Upload Area */}
            <div className="mb-8">
              <label className="block mb-4">
                <div className="border-2 border-dashed border-primary/50 rounded-xl p-12 text-center cursor-pointer hover:border-primary transition">
                  {uploadedFile ? (
                    <div>
                      <p className="text-lg font-semibold text-foreground mb-2">File ready to upload</p>
                      <p className="text-sm text-muted-foreground">{uploadedFile.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          setUploadedFile(null)
                        }}
                        className="mt-4 text-accent hover:underline text-sm"
                        type="button"
                      >
                        Change file
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Upload size={40} className="mx-auto mb-2 text-primary" />
                      <p className="text-foreground font-semibold">Click to upload</p>
                      <p className="text-sm text-muted-foreground">
                        {contentType === "post" ? "PNG, JPG, GIF up to 100MB" : "MP4, WebM up to 500MB"}
                      </p>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setUploadedFile(file)
                      setError("")
                    }
                  }}
                  accept={contentType === "post" ? "image/*" : "video/*"}
                  disabled={loading}
                />
              </label>
            </div>

            {/* Caption */}
            <div className="mb-8">
              <label className="text-foreground font-semibold block mb-2">Caption (optional)</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption for your content..."
                className="w-full p-4 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                rows={4}
                disabled={loading}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground mt-2">{caption.length}/500 characters</p>
            </div>

            {/* Tags */}
            <div className="mb-8">
              <label className="text-foreground font-semibold block mb-2">Add Tags (optional)</label>
              <Input placeholder="e.g., #design #photography #creative" />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                onClick={() => router.push("/home")}
                variant="outline"
                className="flex-1 bg-transparent"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePublish}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                disabled={!uploadedFile || !caption.trim() || loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Publishing...
                  </span>
                ) : (
                  `Publish ${contentType === "post" ? "Post" : "Reel"}`
                )}
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* Mobile Navigation */}
      <Navigation user={user} onLogout={handleLogout} isMobile={true} />
    </main>
  )
}
