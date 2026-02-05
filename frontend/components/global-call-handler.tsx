'use client'

import { emitRejectCall, getSocket, initSocket } from '@/lib/socket'
import { showToast } from '@/lib/toast'
import { useCallback, useEffect, useRef, useState } from 'react'
import IncomingCallNotification from './incoming-call-notification'
import IncomingVideoCallNotification from './incoming-video-call-notification'
import VideoCallModal from './video-call-modal'
import VoiceCallModal from './voice-call-modal'

interface IncomingCall {
  callerId: string
  callerName: string
  callerAvatar: string
  threadId: string
  callType?: 'voice' | 'video'
}

export default function GlobalCallHandler() {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null)
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false)
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const listenersAttached = useRef(false)

  // Memoized handlers
  const handleIncomingCall = useCallback((data: any) => {
    console.log('📞 Global: Incoming call received:', data)

    const callType = data.callType || 'voice'

    const callData = {
      callerId: data.callerId,
      callerName: data.callerInfo?.name || data.name || 'Unknown',
      callerAvatar: data.callerInfo?.avatar || '👤',
      threadId: data.threadId,
      callType: callType,
    }

    console.log('📞 Global: Setting incoming call:', callData)
    setIncomingCall(callData)
  }, [])

  const handleCallRejected = useCallback((data: any) => {
    console.log('📞 Global: Call rejected:', data)
    setIncomingCall(null)
    setIsVoiceCallOpen(false)
    setIsVideoCallOpen(false)
  }, [])

  const handleCallEnded = useCallback((data: any) => {
    console.log('📞 Global: Call ended by remote:', data)
    setIncomingCall(null)
    setIsVoiceCallOpen(false)
    setIsVideoCallOpen(false)
  }, [])

  const handleCallFailed = useCallback((data: any) => {
    console.log('📞 Global: Call failed:', data)
    showToast.error('Call Failed', data.reason || 'Unable to connect the call')
    setIncomingCall(null)
    setIsVoiceCallOpen(false)
    setIsVideoCallOpen(false)
  }, [])

  // Function to attach listeners
  const attachListeners = useCallback((socket: any) => {
    if (!socket || listenersAttached.current) return

    // Remove any existing listeners first
    socket.off('incomingCall', handleIncomingCall)
    socket.off('callRejected', handleCallRejected)
    socket.off('callEnded', handleCallEnded)
    socket.off('callFailed', handleCallFailed)

    // Attach fresh listeners
    socket.on('incomingCall', handleIncomingCall)
    socket.on('callRejected', handleCallRejected)
    socket.on('callEnded', handleCallEnded)
    socket.on('callFailed', handleCallFailed)

    listenersAttached.current = true
  }, [handleIncomingCall, handleCallRejected, handleCallEnded, handleCallFailed])

  // Initialize socket and set up listeners
  useEffect(() => {
    if (typeof window === 'undefined') return

    const token = localStorage.getItem('accessToken')
    const userDataStr = localStorage.getItem('user')

    if (userDataStr) {
      try {
        const userData = JSON.parse(userDataStr)
        setCurrentUserId(userData._id || '')
      } catch (e) {
        console.error('Error parsing user data:', e)
      }
    }

    if (!token) return

    const socket = initSocket(token)
    if (!socket) return

    // Attach listeners immediately if connected
    if (socket.connected) {
      attachListeners(socket)
    }

    // Re-attach listeners on connect/reconnect
    const onConnect = () => {
      listenersAttached.current = false
      attachListeners(socket)
    }

    socket.on('connect', onConnect)

    // Also try to get existing socket and attach
    const existingSocket = getSocket()
    if (existingSocket?.connected) {
      attachListeners(existingSocket)
    }

    return () => {
      socket.off('connect', onConnect)
      socket.off('incomingCall', handleIncomingCall)
      socket.off('callRejected', handleCallRejected)
      socket.off('callEnded', handleCallEnded)
      socket.off('callFailed', handleCallFailed)
      listenersAttached.current = false
    }
  }, [attachListeners, handleIncomingCall, handleCallRejected, handleCallEnded, handleCallFailed])

  // Re-check socket periodically to ensure listeners are attached
  useEffect(() => {
    const interval = setInterval(() => {
      const socket = getSocket()
      if (socket?.connected && !listenersAttached.current) {
        attachListeners(socket)
      }
    }, 5000) // Increased from 2000ms to reduce console noise

    return () => clearInterval(interval)
  }, [attachListeners])

  const handleAcceptVoiceCall = () => {
    setIsVoiceCallOpen(true)
  }

  const handleAcceptVideoCall = () => {
    setIsVideoCallOpen(true)
  }

  const handleReject = () => {
    if (incomingCall?.callerId && incomingCall?.threadId) {
      emitRejectCall(incomingCall.callerId, incomingCall.threadId)
    }
    setIncomingCall(null)
    setIsVoiceCallOpen(false)
    setIsVideoCallOpen(false)
  }

  const handleCallEnd = () => {
    setIncomingCall(null)
  }

  return (
    <>
      {/* Incoming Call Notifications */}
      {incomingCall && !isVoiceCallOpen && !isVideoCallOpen && (
        <>
          {incomingCall.callType === 'video' ? (
            <IncomingVideoCallNotification
              callerName={incomingCall.callerName}
              callerAvatar={incomingCall.callerAvatar}
              onAccept={handleAcceptVideoCall}
              onReject={handleReject}
            />
          ) : (
            <IncomingCallNotification
              isVisible={true}
              callerName={incomingCall.callerName}
              callerAvatar={incomingCall.callerAvatar}
              onAccept={handleAcceptVoiceCall}
              onReject={handleReject}
            />
          )}
        </>
      )}

      {/* Voice Call Modal */}
      {incomingCall && incomingCall.callType === 'voice' && (
        <VoiceCallModal
          isOpen={isVoiceCallOpen}
          onClose={() => {
            setIsVoiceCallOpen(false)
            setIncomingCall(null)
          }}
          recipientName={incomingCall.callerName}
          recipientAvatar={incomingCall.callerAvatar}
          recipientId={incomingCall.callerId}
          currentUserId={currentUserId}
          isIncomingCall={true}
          callerId={incomingCall.callerId}
          threadId={incomingCall.threadId}
          onCallEnd={handleCallEnd}
        />
      )}

      {/* Video Call Modal */}
      {incomingCall && incomingCall.callType === 'video' && (
        <VideoCallModal
          isOpen={isVideoCallOpen}
          onClose={() => {
            setIsVideoCallOpen(false)
            setIncomingCall(null)
          }}
          recipientName={incomingCall.callerName}
          recipientAvatar={incomingCall.callerAvatar}
          recipientId={incomingCall.callerId}
          isIncoming={true}
          callId={incomingCall.threadId}
          callerId={incomingCall.callerId}
          threadId={incomingCall.threadId}
        />
      )}
    </>
  )
}
