import { showToast } from '@/lib/toast';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseVoiceRecorderOptions {
  onRecordingComplete: (audioFile: File) => Promise<void>;
}

// Maximum recording duration in seconds (5 minutes)
const MAX_RECORDING_DURATION = 300;

export function useVoiceRecorder({ onRecordingComplete }: UseVoiceRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const onRecordingCompleteRef = useRef(onRecordingComplete);
  const cancelledRef = useRef(false);
  onRecordingCompleteRef.current = onRecordingComplete;

  // Cleanup on unmount — stop any active recording and clear interval
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      if (mediaRecorderRef.current) {
        try {
          const stream = mediaRecorderRef.current.stream;
          stream.getTracks().forEach((track) => track.stop());
        } catch { /* ignore */ }
        mediaRecorderRef.current = null;
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      // Determine correct file extension based on actual mime type
      const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';

      audioChunksRef.current = [];
      cancelledRef.current = false;
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // If recording was cancelled, do NOT send the audio
        if (cancelledRef.current) {
          audioChunksRef.current = [];
          return;
        }

        const chunks = audioChunksRef.current;
        if (chunks.length === 0) return;

        const audioBlob = new Blob(chunks, { type: mimeType });
        const audioFile = new File(
          [audioBlob],
          `voice_message_${Date.now()}.${extension}`,
          { type: mimeType }
        );

        stream.getTracks().forEach((track) => track.stop());

        await onRecordingCompleteRef.current(audioFile);
      };

      mediaRecorder.start(1000); // 1s timeslice to reduce GC pressure
      setIsRecording(true);
      setRecordingDuration(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          const next = prev + 1;
          // Auto-stop at max duration
          if (next >= MAX_RECORDING_DURATION) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop();
            }
            setIsRecording(false);
            if (recordingIntervalRef.current) {
              clearInterval(recordingIntervalRef.current);
              recordingIntervalRef.current = null;
            }
          }
          return next;
        });
      }, 1000);
    } catch {
      showToast.error(
        'Microphone access denied',
        'Please allow microphone access to record voice messages'
      );
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, []);

  const cancelRecording = useCallback(() => {
    // Set cancelled flag BEFORE stopping so onstop handler knows to discard
    cancelledRef.current = true;

    if (mediaRecorderRef.current) {
      // Stop the recorder first (triggers onstop which checks cancelledRef)
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      const stream = mediaRecorderRef.current.stream;
      stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingDuration(0);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, []);

  const formatRecordingDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording,
    formatRecordingDuration,
  };
}
