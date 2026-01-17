"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { UserPlus, UserMinus } from "lucide-react"
import { useRouter } from "next/navigation"

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

  const handleFollowToggle = (userId: string, currentFollowing: boolean) => {
    setLocalUsers(localUsers.map((user) => (user.id === userId ? { ...user, isFollowing: !currentFollowing } : user)))
    onFollowChange?.(userId, !currentFollowing)
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
                        handleFollowToggle(userId, user.isFollowing || false)
                      }}
                      className={
                        user.isFollowing
                          ? "bg-muted hover:bg-muted/80 text-foreground border border-border"
                          : "bg-primary hover:bg-primary/90 text-primary-foreground"
                      }
                    >
                      {user.isFollowing ? (
                        <>
                          <UserMinus size={14} className="mr-1" />
                          Unfollow
                        </>
                      ) : (
                        <>
                          <UserPlus size={14} className="mr-1" />
                          Follow
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
