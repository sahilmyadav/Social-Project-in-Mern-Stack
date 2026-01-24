"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { UserPlus, UserMinus, Clock } from "lucide-react"
import { useRouter } from "next/navigation"
import { followService } from "@/lib/api-services"

interface User {
  _id: string
  id?: string
  firstName?: string
  lastName?: string
  fullName?: string
  name?: string
  username?: string
  profilePicture?: string
  avatar?: string
  bio?: string
  isVerified?: boolean
  isFollowing?: boolean
  isPrivate?: boolean
  isPending?: boolean
  profile_type?: string
}

interface FollowersModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  users: User[]
  loading?: boolean
  onFollowChange?: (userId: string, isFollowing: boolean) => void
}

export default function FollowersModal({ open, onOpenChange, title, users, loading = false, onFollowChange }: FollowersModalProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [localUsers, setLocalUsers] = useState(users)
  const router = useRouter()

  useEffect(() => {
    setLocalUsers(users)
  }, [users])

  const getUserName = (user: User) => {
    return user.fullName || user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User'
  }

  const filteredUsers = localUsers.filter((user) => {
    const name = getUserName(user).toLowerCase()
    const username = (user.username || '').toLowerCase()
    const query = searchQuery.toLowerCase()
    return name.includes(query) || username.includes(query)
  })

  const handleFollowToggle = async (userId: string, user: User) => {
    const currentFollowing = user.isFollowing || false
    const isPending = user.isPending || false
    const isPrivate = user.isPrivate || user.profile_type === 'private'

    try {
      if (currentFollowing) {
        // Unfollow the user
        // Optimistically update UI
        setLocalUsers(localUsers.map((u) =>
          (u._id || u.id) === userId ? { ...u, isFollowing: false, isPending: false } : u
        ))

        const response = await followService.unfollowUser(userId)

        if (!response.success) {
          // Revert on failure
          setLocalUsers(localUsers.map((u) =>
            (u._id || u.id) === userId ? { ...u, isFollowing: true, isPending: false } : u
          ))
        } else {
          // Update localStorage on success
          localStorage.setItem(`follow_status_${userId}`, 'none')
        }

        // Notify parent
        onFollowChange?.(userId, false)

      } else if (isPending) {
        // Cancel pending request
        // Optimistically update UI
        setLocalUsers(localUsers.map((u) =>
          (u._id || u.id) === userId ? { ...u, isPending: false, isFollowing: false } : u
        ))

        const response = await followService.cancelFollowRequest(userId)

        if (!response.success) {
          // Revert on failure
          setLocalUsers(localUsers.map((u) =>
            (u._id || u.id) === userId ? { ...u, isPending: true, isFollowing: false } : u
          ))
        } else {
          // Update localStorage on success
          localStorage.setItem(`follow_status_${userId}`, 'none')
        }

        // Notify parent
        onFollowChange?.(userId, false)

      } else {
        // Send follow request (works for both public and private accounts)

        // Optimistically update UI
        setLocalUsers(localUsers.map((u) =>
          (u._id || u.id) === userId ? { ...u, isFollowing: !isPrivate, isPending: isPrivate } : u
        ))

        const response = await followService.sendFollowRequest(userId)

        if (response.success) {
          // Check if auto-approved (public account) or pending (private account)
          const autoApproved = response.data?.autoApproved || response.data?.followRequest?.status === 'accepted'

          // Update based on actual response
          setLocalUsers(localUsers.map((u) =>
            (u._id || u.id) === userId
              ? { ...u, isFollowing: autoApproved, isPending: !autoApproved }
              : u
          ))

          // Update localStorage based on result
          if (autoApproved) {
            localStorage.setItem(`follow_status_${userId}`, 'following')
          } else {
            localStorage.setItem(`follow_status_${userId}`, 'pending')
          }
        } else {
          // Revert on failure
          setLocalUsers(localUsers.map((u) =>
            (u._id || u.id) === userId ? { ...u, isFollowing: false, isPending: false } : u
          ))
        }

        // Notify parent
        onFollowChange?.(userId, true)
      }
    } catch (error) {
      console.error('Error toggling follow status:', error)
      // Revert to original state on error
      setLocalUsers(localUsers.map((u) =>
        (u._id || u.id) === userId
          ? { ...u, isFollowing: currentFollowing, isPending: isPending }
          : u
      ))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-muted border-border"
          />

          <div className="max-h-96 overflow-y-auto space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {searchQuery ? 'No users found' : `No ${title.toLowerCase()} yet`}
              </p>
            ) : (
              filteredUsers.map((user) => {
                const userId = user._id || user.id || ''
                const userName = getUserName(user)
                const userAvatar = user.profilePicture || user.avatar || userName.charAt(0)
                const username = user.username || userName.toLowerCase().replace(/\s+/g, "")

                return (
                  <div
                    key={userId}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted hover:bg-muted/80 transition"
                  >
                    <div
                      className="flex items-center gap-3 flex-1 cursor-pointer"
                      onClick={() => {
                        router.push(`/profile/${userId}`)
                        onOpenChange(false)
                      }}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold flex-shrink-0">
                        {userAvatar.startsWith('http') ? (
                          <img src={userAvatar} alt={userName} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span>{userAvatar}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className="font-medium text-foreground truncate">{userName}</p>
                          {user.isVerified && <span className="text-blue-500">✓</span>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">@{username}</p>
                        {user.bio && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{user.bio}</p>
                        )}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleFollowToggle(userId, user)
                      }}
                      className={
                        user.isFollowing
                          ? "bg-muted hover:bg-muted/80 text-foreground border border-border"
                          : user.isPending
                            ? "bg-muted hover:bg-muted/80 text-foreground border border-border"
                            : "bg-primary hover:bg-primary/90 text-primary-foreground"
                      }
                    >
                      {user.isFollowing ? (
                        <>
                          <UserMinus size={14} className="mr-1" />
                          Unfollow
                        </>
                      ) : user.isPending ? (
                        <>
                          <Clock size={14} className="mr-1" />
                          Requested
                        </>
                      ) : (
                        <>
                          <UserPlus size={14} className="mr-1" />
                          {user.isPrivate || user.profile_type === 'private' ? 'Request' : 'Follow'}
                        </>
                      )}
                    </Button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
