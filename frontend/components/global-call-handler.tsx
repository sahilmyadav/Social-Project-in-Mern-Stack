'use client'

import { useEffect, useState } from 'react'
import { initSocket, onIncomingCall, offIncomingCall, emitRejectCall, onCallRejected, offCallRejected, onCallEnded, offCallEnded } from '@/lib/socket'
import IncomingVideoCallNotification from './incoming-video-call-notification'
import IncomingCallNotification from './incoming-call-notification'
import VoiceCallModal from './voice-call-modal'
import VideoCallModal from './video-call-modal'

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
  const [isSocketReady, setIsSocketReady] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string>('')



  // Initialize socket connection on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken')
      const userId = localStorage.getItem('userId') || ''
      setCurrentUserId(userId)

      if (token) {
        const socket = initSocket(token)

        if (socket) {
          // Wait for socket to connect
          if (socket.connected) {
            setIsSocketReady(true)
          } else {
            const onConnect = () => {
              setIsSocketReady(true)
            }
            socket.on('connect', onConnect)

            return () => {
              socket.off('connect', onConnect)
            }
          }
        }
      }
    }
  }, [])

  // Listen for incoming calls only after socket is ready
  useEffect(() => {
    if (!isSocketReady) {
      return
    }

    const handleIncomingCall = (data: any) => {
      const callType = data.callType || 'voice'

      const callData = {
        callerId: data.callerId,
        callerName: data.callerInfo?.name || 'Unknown',
        callerAvatar: data.callerInfo?.avatar || '👤',
        threadId: data.threadId,
        callType: callType,
      }

      setIncomingCall(callData)
    }

    // Handle when remote user rejects our call
    const handleCallRejected = (data: any) => {
      setIncomingCall(null)
      setIsVoiceCallOpen(false)
      setIsVideoCallOpen(false)
    }

    // Handle when remote user ends the call
    const handleCallEndedByRemote = (data: any) => {
      setIncomingCall(null)
      setIsVoiceCallOpen(false)
      setIsVideoCallOpen(false)
    }

    onIncomingCall(handleIncomingCall)
    onCallRejected(handleCallRejected)
    onCallEnded(handleCallEndedByRemote)

    return () => {
      offIncomingCall(handleIncomingCall)
      offCallRejected(handleCallRejected)
      offCallEnded(handleCallEndedByRemote)
    }
  }, [isSocketReady])

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
