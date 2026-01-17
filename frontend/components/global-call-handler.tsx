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

  console.log('🔄 [GlobalCallHandler] Component rendered. isSocketReady:', isSocketReady, 'incomingCall:', incomingCall)

  // Initialize socket connection on mount
  useEffect(() => {
    console.log('🚀 [GlobalCallHandler] useEffect for socket init running...')
    
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken')
      console.log('🔑 [GlobalCallHandler] Token from localStorage:', token ? 'EXISTS' : 'NOT FOUND')
      
      if (token) {
        console.log('🔌 [GlobalCallHandler] Calling initSocket...')
        const socket = initSocket(token)
        console.log('🔌 [GlobalCallHandler] initSocket returned:', socket ? 'SOCKET OBJECT' : 'NULL')
        
        if (socket) {
          console.log('🔍 [GlobalCallHandler] Socket state - connected:', socket.connected, 'id:', socket.id)
          
          // Wait for socket to connect
          if (socket.connected) {
            console.log('✅ [GlobalCallHandler] Socket already connected, setting ready state')
            setIsSocketReady(true)
          } else {
            console.log('⏳ [GlobalCallHandler] Socket not connected yet, waiting for connect event...')
            const onConnect = () => {
              console.log('✅ [GlobalCallHandler] Socket connect event fired! Setting ready state')
              setIsSocketReady(true)
            }
            socket.on('connect', onConnect)
            
            return () => {
              console.log('🧹 [GlobalCallHandler] Cleaning up connect listener')
              socket.off('connect', onConnect)
            }
          }
        } else {
          console.log('❌ [GlobalCallHandler] Socket is null after initSocket')
        }
      } else {
        console.log('⚠️ [GlobalCallHandler] No accessToken found in localStorage')
        console.log('📋 [GlobalCallHandler] localStorage keys:', Object.keys(localStorage))
      }
    } else {
      console.log('⚠️ [GlobalCallHandler] window is undefined')
    }
  }, [])

  // Listen for incoming calls only after socket is ready
  useEffect(() => {
    console.log('🎯 [GlobalCallHandler] Incoming call listener useEffect running. isSocketReady:', isSocketReady)
    
    if (!isSocketReady) {
      console.log('⏳ [GlobalCallHandler] Socket not ready yet, skipping listener setup')
      return
    }
    
    console.log('👂 [GlobalCallHandler] Socket is ready! Setting up incoming call listener...')
    
    const handleIncomingCall = (data: any) => {
      console.log('🔔🔔🔔 [GlobalCallHandler] INCOMING CALL RECEIVED! Data:', JSON.stringify(data, null, 2))
      
      const callType = data.callType || 'voice'
      
      const callData = {
        callerId: data.callerId,
        callerName: data.callerInfo?.name || 'Unknown',
        callerAvatar: data.callerInfo?.avatar || '👤',
        threadId: data.threadId,
        callType: callType,
      }
      
      console.log('📞 [GlobalCallHandler] Setting incoming call state:', callData)
      setIncomingCall(callData)
    }

    // Handle when remote user rejects our call
    const handleCallRejected = (data: any) => {
      console.log('❌ [GlobalCallHandler] Call was rejected:', data)
      setIncomingCall(null)
      setIsVoiceCallOpen(false)
      setIsVideoCallOpen(false)
    }
    
    // Handle when remote user ends the call
    const handleCallEndedByRemote = (data: any) => {
      console.log('📞 [GlobalCallHandler] Call ended by remote:', data)
      setIncomingCall(null)
      setIsVoiceCallOpen(false)
      setIsVideoCallOpen(false)
    }

    console.log('📡 [GlobalCallHandler] Registering call event handlers...')
    onIncomingCall(handleIncomingCall)
    onCallRejected(handleCallRejected)
    onCallEnded(handleCallEndedByRemote)
    console.log('✅ [GlobalCallHandler] Call listeners successfully registered!')

    return () => {
      console.log('🧹 [GlobalCallHandler] Cleaning up call listeners')
      offIncomingCall(handleIncomingCall)
      offCallRejected(handleCallRejected)
      offCallEnded(handleCallEndedByRemote)
    }
  }, [isSocketReady])

  const handleAcceptVoiceCall = () => {
    console.log('✅ [GlobalCallHandler] Accepting voice call globally')
    setIsVoiceCallOpen(true)
  }

  const handleAcceptVideoCall = () => {
    console.log('✅ [GlobalCallHandler] Accepting video call globally')
    setIsVideoCallOpen(true)
  }

  const handleReject = () => {
    console.log('❌ [GlobalCallHandler] Rejecting call globally')
    if (incomingCall?.callerId && incomingCall?.threadId) {
      emitRejectCall(incomingCall.callerId, incomingCall.threadId)
    }
    setIncomingCall(null)
    setIsVoiceCallOpen(false)
    setIsVideoCallOpen(false)
  }

  const handleCallEnd = () => {
    console.log('📞 [GlobalCallHandler] Call ended globally')
    setIncomingCall(null)
  }

  console.log('🎨 [GlobalCallHandler] Rendering UI. incomingCall:', incomingCall, 'isVoiceCallOpen:', isVoiceCallOpen, 'isVideoCallOpen:', isVideoCallOpen)

  return (
    <>
      {/* Incoming Call Notifications */}
      {incomingCall && !isVoiceCallOpen && !isVideoCallOpen && (
        <>
          {console.log('🎨 [GlobalCallHandler] Rendering incoming call notification for:', incomingCall.callType)}
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
