/**
 * Global Call State Manager
 *
 * A singleton store that tracks the active call state across the entire app.
 * Both the chat page and the global-call-handler use this store, ensuring that
 * when one side ends a call, the other side immediately reflects the change.
 *
 * This replaces the fragmented local state that caused the bug where ending a
 * call on one device/tab left the other side's modal still open.
 */

type CallType = 'voice' | 'video';

interface ActiveCall {
  callerId: string;
  recipientId: string;
  threadId: string;
  callType: CallType;
  isIncoming: boolean;
  isGroupCall: boolean;
  groupInfo?: {
    groupId: string;
    groupName: string;
    groupAvatar: string | null;
  };
  callerName: string;
  callerAvatar: string | null;
}

type CallStoreListener = () => void;

interface CallStore {
  activeCall: ActiveCall | null;
  isCallModalOpen: boolean;
}

let state: CallStore = {
  activeCall: null,
  isCallModalOpen: false,
};

const listeners = new Set<CallStoreListener>();

function notify() {
  listeners.forEach((listener) => listener());
}

/**
 * Start a new call (outgoing or incoming accepted).
 */
export function setActiveCall(call: ActiveCall) {
  state = { activeCall: call, isCallModalOpen: true };
  console.log('📞 CallStore: setActiveCall', call.callType, call.isGroupCall ? 'group' : '1-to-1');
  notify();
}

/**
 * End the currently active call and close all modals.
 * This is the SINGLE source of truth — call it from anywhere and every
 * subscriber (chat page, global handler, modals) will react.
 */
export function endActiveCall() {
  if (!state.activeCall && !state.isCallModalOpen) return; // already ended
  console.log('📞 CallStore: endActiveCall');
  state = { activeCall: null, isCallModalOpen: false };
  notify();
}

/**
 * Get the current call state (for non-React reads).
 */
export function getCallState(): CallStore {
  return state;
}

/**
 * Subscribe to call state changes. Returns an unsubscribe function.
 * Designed for use inside React's `useSyncExternalStore` or a useEffect.
 */
export function subscribeCallStore(listener: CallStoreListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------
import { useSyncExternalStore } from 'react';

export function useCallStore(): CallStore {
  return useSyncExternalStore(subscribeCallStore, getCallState, getCallState);
}
