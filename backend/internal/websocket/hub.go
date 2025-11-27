package websocket

import (
	"encoding/json"
	"log"
	"sync"
)

// MessageType defines the type of WebSocket message
type MessageType string

const (
	MessageTypeRollComplete    MessageType = "roll_complete"
	MessageTypeDicePoolUpdated MessageType = "dice_pool_updated"
	MessageTypeChallengeUpdate MessageType = "challenge_update"
	MessageTypeDayIncremented  MessageType = "day_incremented"
)

// Message is the structure sent over WebSocket
type Message struct {
	Type       MessageType    `json:"type"`
	CampaignID int            `json:"campaign_id"`
	Payload    map[string]any `json:"payload"`
}

// Hub maintains the set of active clients and broadcasts messages to clients
type Hub struct {
	// Registered clients grouped by campaign ID
	campaigns map[int]map[*Client]bool

	// Register requests from clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// Inbound messages to broadcast to a campaign
	broadcast chan Message

	// Mutex for thread-safe access to campaigns map
	mu sync.RWMutex
}

// NewHub creates a new Hub instance
func NewHub() *Hub {
	return &Hub{
		campaigns:  make(map[int]map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan Message),
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if h.campaigns[client.CampaignID] == nil {
				h.campaigns[client.CampaignID] = make(map[*Client]bool)
			}
			h.campaigns[client.CampaignID][client] = true
			log.Printf("Client registered for campaign %d (total: %d)",
				client.CampaignID, len(h.campaigns[client.CampaignID]))
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if clients, ok := h.campaigns[client.CampaignID]; ok {
				if _, ok := clients[client]; ok {
					delete(clients, client)
					close(client.send)
					log.Printf("Client unregistered from campaign %d (remaining: %d)",
						client.CampaignID, len(clients))

					// Clean up empty campaign rooms
					if len(clients) == 0 {
						delete(h.campaigns, client.CampaignID)
					}
				}
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			clients := h.campaigns[message.CampaignID]
			h.mu.RUnlock()

			messageBytes, err := json.Marshal(message)
			if err != nil {
				log.Printf("Error marshaling message: %v", err)
				continue
			}

			for client := range clients {
				select {
				case client.send <- messageBytes:
				default:
					// Client's send buffer is full, remove them
					h.mu.Lock()
					close(client.send)
					delete(h.campaigns[message.CampaignID], client)
					h.mu.Unlock()
				}
			}
		}
	}
}

// BroadcastToCampaign sends a message to all clients in a campaign
func (h *Hub) BroadcastToCampaign(campaignID int, msgType MessageType, payload map[string]any) {
	h.broadcast <- Message{
		Type:       msgType,
		CampaignID: campaignID,
		Payload:    payload,
	}
}

// GetCampaignClientCount returns the number of connected clients for a campaign
func (h *Hub) GetCampaignClientCount(campaignID int) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.campaigns[campaignID])
}
