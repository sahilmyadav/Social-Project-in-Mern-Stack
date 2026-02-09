'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export type ActiveCallType = 'voice' | 'video' | 'group-voice' | 'group-video' | null;

export type CallStatus = 'idle' | 'ringing' | 'connecting' | 'active' | 'ending';

interface CallState {
  activeCallType: ActiveCallType;
  callStatus: CallStatus;
  callId: string | null;
  remoteUserId: string | null;
  groupId: string | null;
  isIncoming: boolean;
  startedAt: number | null;
}

interface CallContextValue {
  /** Whether ANY call is currently active/ringing/connecting (not idle/ending) */
  isInCall: boolean;
  /** The type of the current active call */
  activeCallType: ActiveCallType;
  /** Current call status in the state machine */
  callStatus: CallStatus;
  /** Full call metadata */
  callState: CallState;
  /** Attempt to acquire the call lock. Returns false if already in a call. */
  acquireCall: (
    type: ActiveCallType,
    meta?: {
      callId?: string;
      remoteUserId?: string;
      groupId?: string;
      isIncoming?: boolean;
    }
  ) => boolean;
  /** Update call status without releasing the lock */
  setCallStatus: (status: CallStatus) => void;
  /** Release the call lock when a call ends */
  releaseCall: () => void;
}

const defaultState: CallState = {
  activeCallType: null,
  callStatus: 'idle',
  callId: null,
  remoteUserId: null,
  groupId: null,
  isIncoming: false,
  startedAt: null,
};

const CallContext = createContext<CallContextValue>({
  isInCall: false,
  activeCallType: null,
  callStatus: 'idle',
  callState: defaultState,
  acquireCall: () => false,
  setCallStatus: () => {},
  releaseCall: () => {},
});

export function CallProvider({ children }: { children: ReactNode }) {
  const [callState, setCallState] = useState<CallState>(defaultState);
  const lockRef = useRef(false);

  const acquireCall = useCallback(
    (
      type: ActiveCallType,
      meta?: {
        callId?: string;
        remoteUserId?: string;
        groupId?: string;
        isIncoming?: boolean;
      }
    ): boolean => {
      if (lockRef.current) return false;
      lockRef.current = true;
      setCallState({
        activeCallType: type,
        callStatus: 'ringing',
        callId: meta?.callId ?? null,
        remoteUserId: meta?.remoteUserId ?? null,
        groupId: meta?.groupId ?? null,
        isIncoming: meta?.isIncoming ?? false,
        startedAt: Date.now(),
      });
      return true;
    },
    []
  );

  const updateCallStatus = useCallback((status: CallStatus) => {
    setCallState((prev) => ({ ...prev, callStatus: status }));
  }, []);

  const releaseCall = useCallback(() => {
    lockRef.current = false;
    setCallState(defaultState);
  }, []);

  return (
    <CallContext.Provider
      value={{
        isInCall: callState.activeCallType !== null,
        activeCallType: callState.activeCallType,
        callStatus: callState.callStatus,
        callState,
        acquireCall,
        setCallStatus: updateCallStatus,
        releaseCall,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCallState() {
  return useContext(CallContext);
}
