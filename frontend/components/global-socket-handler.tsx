"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { initSocket, emitUserOnline, emitUserOffline, disconnectSocket } from "@/lib/socket"

export default function GlobalSocketHandler() {
    const router = useRouter()
    const [isLoggedIn, setIsLoggedIn] = useState(false)

    useEffect(() => {
        // Check login status periodically
        const checkLoginStatus = () => {
            const token = localStorage.getItem("accessToken")
            const userData = localStorage.getItem("user")

            if (token && userData) {
                if (!isLoggedIn) {
                    // User just logged in!
                    setIsLoggedIn(true)
                }
            } else {
                if (isLoggedIn) {
                    // User just logged out!
                    setIsLoggedIn(false)
                }
            }
        }

        // Check immediately
        checkLoginStatus()

        // Check every 500ms for login/logout
        const interval = setInterval(checkLoginStatus, 500)

        return () => clearInterval(interval)
    }, [isLoggedIn])

    useEffect(() => {
        if (!isLoggedIn) {
            return
        }

        const token = localStorage.getItem("accessToken")
        const userData = localStorage.getItem("user")

        if (!token || !userData) {
            return
        }

        const user = JSON.parse(userData)

        // Initialize socket connection
        const socket = initSocket(token)

        // Emit online status when socket connects
        if (socket?.connected) {
            emitUserOnline(user._id)
        } else {
            socket?.once("connect", () => {
                emitUserOnline(user._id)
            })
        }

        // Handle reconnection
        socket?.on("connect", () => {
            emitUserOnline(user._id)
        })

        // Listen for Live Stream Start
        socket?.on("liveStreamStarted", (data) => {
            const { streamId, title, streamerId } = data
            toast.message("Live Stream Started", {
                description: `${title || "A user"} is live now!`,
                action: {
                    label: "Watch",
                    onClick: () => router.push(`/live/watch/${streamId}`)
                },
                duration: 10000, // Show for 10 seconds
            })
        })

        // Emit offline status before page unload (tab close, refresh, etc.)
        const handleBeforeUnload = () => {
            emitUserOffline(user._id)
        }

        window.addEventListener("beforeunload", handleBeforeUnload)

        // Cleanup on unmount or logout
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload)
            socket?.off("liveStreamStarted")
            socket?.off("connect")

            // If user logged out, emit offline and disconnect
            const currentToken = localStorage.getItem("accessToken")
            if (!currentToken) {
                emitUserOffline(user._id)
                disconnectSocket()
            }
        }
    }, [isLoggedIn]) // Re-run when login status changes!

    return null
}
