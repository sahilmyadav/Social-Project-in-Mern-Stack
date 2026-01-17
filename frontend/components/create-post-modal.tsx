"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Upload, Image as ImageIcon } from "lucide-react"
import { postService } from "@/lib/api-services"
import { ApiError } from "@/lib/api-client"

interface CreatePostModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit?: (post: any) => void
}

export default function CreatePostModal({ isOpen, onClose, onSubmit }: CreatePostModalProps) {
  const [caption, setCaption] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [user, setUser] = useState<any>(null)

  // Get user from localStorage on mount
  useEffect(() => {
    console.log("Modal isOpen:", isOpen)
    if (isOpen) {
      console.log("Modal opened, loading user data...")
      const userData = localStorage.getItem("user")
      if (userData) {
        setUser(JSON.parse(userData))
        console.log("User loaded:", JSON.parse(userData))
      } else {
        console.log("No user data found in localStorage")
      }
    }
  }, [isOpen])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.type.startsWith('image/')) {
        setError("Please select an image file")
        return
      }

      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB")
        return
      }

      setFile(selectedFile)
      setError("")
      
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(selectedFile)
    }
  }

  const handleRemoveFile = () => {
    setFile(null)
    setPreviewUrl("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    console.log("=== FORM SUBMIT TRIGGERED ===")
   
    e.preventDefault()
    setError("")

    console.log("=== CREATE POST DEBUG ===")
    console.log("Caption:", caption)
    console.log("File:", file)
    console.log("User:", user)
    console.log("Access Token:", localStorage.getItem("accessToken"))

    // Validation
    if (!file) {
      console.log("Validation failed: No file selected")
      setError("Please select an image to upload")
      return
    }

    console.log("Validation passed, proceeding with upload...")

    setLoading(true)

    try {
      console.log("Creating FormData...")
      // Create FormData
      const formData = new FormData()
      formData.append("files", file) // Backend expects "files" (plural)
      formData.append("caption", caption.trim())

      console.log("FormData entries:")
      for (let pair of formData.entries()) {
        console.log(pair[0], pair[1])
      }

      console.log("Calling API...")
      // Call API
      const response = await postService.createPost(formData)
      console.log("API Response:", response)

      if (response.success) {
        // Success - clear form and close modal
        setCaption("")
        setFile(null)
        setPreviewUrl("")
        
        // Call parent onSubmit if provided
        if (onSubmit) {
          onSubmit(response.data)
        }
        
        onClose()
        
        // Optionally reload the page to show new post
        window.location.reload()
      } else {
        setError(response.message || "Failed to create post")
      }
    } catch (err) {
      const apiError = err as ApiError
      console.error("Failed to create post:", apiError)
      
      if (apiError.statusCode === 401) {
        setError("Please login to create a post")
      } else if (apiError.statusCode === 413) {
        setError("File size too large. Please choose a smaller image.")
      } else {
        setError(apiError.message || "Failed to create post. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-xl font-bold">Create Post</h2>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-muted rounded-full transition"
            disabled={loading}
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Author */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xl">
              😊
            </div>
            <div>
              <p className="font-semibold">{user?.firstName || user?.name || "User"} {user?.lastName || ""}</p>
              <p className="text-sm text-muted-foreground">Public</p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* Caption */}
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full p-4 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
            rows={4}
            disabled={loading}
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground text-right">{caption.length}/500 characters</p>

          {/* File Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block">
              Add Photo <span className="text-red-500">*</span>
            </label>
            
            {!previewUrl ? (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  disabled={loading}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    <ImageIcon size={48} className="text-muted-foreground" />
                    <p className="text-muted-foreground">Click to upload an image</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
                  </div>
                </label>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-64 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                  disabled={loading}
                >
                  <X size={20} />
                </button>
                <p className="text-xs text-muted-foreground mt-2">
                  {file?.name} ({(file!.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              </div>
            )}
          </div>

          {/* Test API Button */}
          <Button
            type="button"
            onClick={async () => {
              console.log("=== DIRECT API TEST ===")
              const testUrl = "http://localhost:3333/api/v1/post/upload"
              console.log("Testing URL:", testUrl)
              try {
                const response = await fetch(testUrl, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${localStorage.getItem("accessToken")}`
                  }
                })
                console.log("Test Response:", response.status, response.statusText)
                const data = await response.json()
                console.log("Test Data:", data)
                
                alert(`API Test: ${response.status} - ${JSON.stringify(data)}`)
              } catch (err: any) {
                console.error("Test Error:", err)
                alert(`API Test Error: ${err.message}`)
              }
            }}
            className="w-full bg-yellow-500 text-black mb-2"
          >
            🧪 Test API Connection
          </Button>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Button 
              type="button" 
              onClick={onClose} 
              variant="outline" 
              className="flex-1 bg-transparent"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              disabled={loading || !file}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Posting...
                </span>
              ) : (
                "Post"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
