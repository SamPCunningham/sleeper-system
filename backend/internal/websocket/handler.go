package websocket

import (
	"log"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

// Handler handles WebSocket connection upgrades
type Handler struct {
	hub *Hub
}

// NewHandler creates a new WebSocket handler
func NewHandler(hub *Hub) *Handler {
	return &Handler{hub: hub}
}

// ServeWS handles WebSocket requests from clients
func (h *Handler) ServeWS(w http.ResponseWriter, r *http.Request) {
	// Get campaign ID from URL
	campaignIDStr := chi.URLParam(r, "campaignId")
	campaignID, err := strconv.Atoi(campaignIDStr)
	if err != nil {
		http.Error(w, "Invalid campaign ID", http.StatusBadRequest)
		return
	}

	// Get user ID from query param (passed from frontend after auth)
	// In a production app, you'd validate a token here
	userIDStr := r.URL.Query().Get("user_id")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	// Create new client and register with hub
	client := NewClient(h.hub, conn, campaignID, userID)
	h.hub.register <- client

	// Start the client's read/write pumps
	client.Start()

	log.Printf("New WebSocket connection: campaign=%d, user=%d", campaignID, userID)
}

// GetHub returns the hub instance (useful for broadcasting from other handlers)
func (h *Handler) GetHub() *Hub {
	return h.hub
}
