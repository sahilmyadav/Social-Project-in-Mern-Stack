import { chatService, groupService } from '@/lib/api-services';
import { showToast } from '@/lib/toast';
import { useCallback, useState } from 'react';

interface LocationMessage {
  id: number | string;
  sender: string;
  content: string;
  timestamp: string;
  isSent: boolean;
  messageType?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    isLiveLocation?: boolean;
    expiresAt?: string;
  };
  [key: string]: any;
}

interface UseLocationSharingOptions {
  selectedThreadId: string | null;
  isGroup: boolean;
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  setShowAttachmentMenu: (show: boolean) => void;
}

export function useLocationSharing({
  selectedThreadId,
  isGroup,
  setMessages,
  setShowAttachmentMenu,
}: UseLocationSharingOptions) {
  const [isSendingLocation, setIsSendingLocation] = useState(false);
  const [showLocationMenu, setShowLocationMenu] = useState(false);

  const getPosition = useCallback(() => {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });
  }, []);

  const handleLocationError = useCallback((error: any) => {
    if (error.code === 1) {
      showToast.error('Location permission denied');
    } else if (error.code === 2) {
      showToast.error('Unable to get your location');
    } else if (error.code === 3) {
      showToast.error('Location request timed out');
    } else {
      showToast.error(error.message || 'Failed to send location');
    }
  }, []);

  const sendCurrentLocation = useCallback(async () => {
    if (!selectedThreadId || isSendingLocation) return;

    setIsSendingLocation(true);
    setShowAttachmentMenu(false);
    setShowLocationMenu(false);

    try {
      const position = await getPosition();
      const { latitude, longitude } = position.coords;

      let address = '';
      try {
        const geoResponse = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
        );
        const geoData = await geoResponse.json();
        address = geoData.display_name || '';
      } catch {}

      const tempMessage: LocationMessage = {
        id: Date.now(),
        sender: 'You',
        content: '📍 Location',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSent: true,
        messageType: 'location',
        location: {
          latitude,
          longitude,
          address,
          isLiveLocation: false,
        },
      };

      setMessages((prev: any[]) => [...prev, tempMessage]);

      let response: any;

      if (isGroup) {
        response = await groupService.sendGroupMessage(selectedThreadId, {
          messageType: 'location',
          location: {
            latitude,
            longitude,
            address,
            isLive: false,
          },
        });
      } else {
        response = await chatService.sendMessage(selectedThreadId, {
          messageType: 'location',
          location: {
            latitude,
            longitude,
            address,
            isLiveLocation: false,
          },
        });
      }

      if (response.success && response.data) {
        setMessages((prev: any[]) =>
          prev.map((msg: any) =>
            msg.id === tempMessage.id ? { ...msg, id: response.data._id } : msg
          )
        );
        showToast.success('Location sent');
      }
    } catch (error: any) {
      handleLocationError(error);
    } finally {
      setIsSendingLocation(false);
    }
  }, [
    selectedThreadId,
    isSendingLocation,
    isGroup,
    setMessages,
    setShowAttachmentMenu,
    getPosition,
    handleLocationError,
  ]);

  const sendLiveLocation = useCallback(
    async (durationMinutes: number = 15) => {
      if (!selectedThreadId || isSendingLocation) return;

      setIsSendingLocation(true);
      setShowAttachmentMenu(false);
      setShowLocationMenu(false);

      try {
        const position = await getPosition();
        const { latitude, longitude } = position.coords;

        const tempMessage: LocationMessage = {
          id: Date.now(),
          sender: 'You',
          content: '📍 Live Location',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSent: true,
          messageType: 'location',
          location: {
            latitude,
            longitude,
            isLiveLocation: true,
            expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000).toISOString(),
          },
        };

        setMessages((prev: any[]) => [...prev, tempMessage]);

        let response: any;

        if (isGroup) {
          response = await groupService.sendGroupMessage(selectedThreadId, {
            messageType: 'location',
            location: {
              latitude,
              longitude,
              isLive: true,
              duration: durationMinutes,
            },
          });
        } else {
          response = await chatService.sendMessage(selectedThreadId, {
            messageType: 'location',
            location: {
              latitude,
              longitude,
              isLiveLocation: true,
              duration: durationMinutes,
            },
          });
        }

        if (response.success && response.data) {
          setMessages((prev: any[]) =>
            prev.map((msg: any) =>
              msg.id === tempMessage.id ? { ...msg, id: response.data._id } : msg
            )
          );
          showToast.success(`Live location shared for ${durationMinutes} minutes`);
        }
      } catch (error: any) {
        handleLocationError(error);
      } finally {
        setIsSendingLocation(false);
      }
    },
    [
      selectedThreadId,
      isSendingLocation,
      isGroup,
      setMessages,
      setShowAttachmentMenu,
      getPosition,
      handleLocationError,
    ]
  );

  return {
    isSendingLocation,
    showLocationMenu,
    setShowLocationMenu,
    sendCurrentLocation,
    sendLiveLocation,
  };
}
