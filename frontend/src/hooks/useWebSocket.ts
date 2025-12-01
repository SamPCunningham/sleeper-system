import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { WS_HOST } from '../services/api';

export type MessageType = 
  | 'roll_complete'
  | 'dice_pool_updated'
  | 'challenge_update'
  | 'day_incremented';

export interface WebSocketMessage {
  type: MessageType;
  campaign_id: number;
  payload: Record<string, any>;
}

interface UseWebSocketOptions {
  campaignId: number;
  onMessage?: (message: WebSocketMessage) => void;
  onRollComplete?: (payload: any) => void;
  onDicePoolUpdated?: (payload: any) => void;
  onChallengeUpdate?: (payload: any) => void;
  onDayIncremented?: (payload: any) => void;
}

export function useWebSocket({
  campaignId,
  onMessage,
  onRollComplete,
  onDicePoolUpdated,
  onChallengeUpdate,
  onDayIncremented,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const user = useAuthStore((state) => state.user);

  const connect = useCallback(() => {
    if (!user?.id || !campaignId) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Build WebSocket URL
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = WS_HOST;
    const wsUrl = `${wsProtocol}//${wsHost}/ws/campaigns/${campaignId}?user_id=${user.id}`;

    console.log('Connecting to WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      setIsConnected(false);
      
      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('Attempting to reconnect...');
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        // Handle multiple messages separated by newlines
        const messages = event.data.split('\n').filter(Boolean);
        
        for (const messageStr of messages) {
          const message: WebSocketMessage = JSON.parse(messageStr);
          console.log('WebSocket message received:', message);

          // Call general message handler
          onMessage?.(message);

          // Call specific handlers based on message type
          switch (message.type) {
            case 'roll_complete':
              onRollComplete?.(message.payload);
              break;
            case 'dice_pool_updated':
              onDicePoolUpdated?.(message.payload);
              break;
            case 'challenge_update':
              onChallengeUpdate?.(message.payload);
              break;
            case 'day_incremented':
              onDayIncremented?.(message.payload);
              break;
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    wsRef.current = ws;
  }, [campaignId, user?.id, onMessage, onRollComplete, onDicePoolUpdated, onChallengeUpdate, onDayIncremented]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected };
}