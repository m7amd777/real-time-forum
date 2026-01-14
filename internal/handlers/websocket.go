package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"sync"
	"time"

	"real-time-forum/internal/cookie"
	"real-time-forum/internal/database/queries"

	"github.com/gorilla/websocket"
)

// =====================
// WS protocol structs
// =====================

// Client -> Server
type ClientEvent struct {
	Type   string `json:"type"`              // "open" | "message"
	PeerID string `json:"peer_id,omitempty"` // used by "open"

	RecipientID string `json:"recipient_id,omitempty"` // used by "message"
	Content     string `json:"content,omitempty"`
	TempID      string `json:"temp_id,omitempty"`
}

// Server -> Client
type ServerEvent struct {
	Type string `json:"type"` // "hello" | "presence_snapshot" | "presence" | "history" | "message" | "sent_ack" | "error"

	// identity / presence
	UserID string   `json:"user_id,omitempty"`  // for "hello" or "presence"
	Status string   `json:"status,omitempty"`   // "online"/"offline"
	Online []string `json:"online,omitempty"`   // for "presence_snapshot"

	// chat
	ConversationID string        `json:"conversation_id,omitempty"` // derived key from 2 user IDs
	SenderID       string        `json:"sender_id,omitempty"`
	RecipientID    string        `json:"recipient_id,omitempty"`
	Content        string        `json:"content,omitempty"`
	CreatedAt      string        `json:"created_at,omitempty"`
	TempID         string        `json:"temp_id,omitempty"`
	Delivered      *bool         `json:"delivered,omitempty"`
	Error          string        `json:"error,omitempty"`
	Messages       []ChatMessage `json:"messages,omitempty"` // for "history"
}

type ChatMessage struct {
	SenderID    string `json:"sender_id"`
	RecipientID string `json:"recipient_id"`
	Content     string `json:"content"`
	CreatedAt   string `json:"created_at"`
}

// =====================
// Gorilla WS setup
// =====================

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 16 * 1024
)

var chatUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// =====================
// In-memory message store
// =====================

type messageStore struct {
	mu    sync.RWMutex
	byKey map[string][]ChatMessage
	limit int
}

func newMessageStore(limit int) *messageStore {
	return &messageStore{
		byKey:  make(map[string][]ChatMessage),
		limit:  limit,
	}
}

func convoKey(a, b string) string {
	ids := []string{a, b}
	sort.Strings(ids)
	return ids[0] + ":" + ids[1]
}

func (s *messageStore) append(key string, m ChatMessage) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.byKey[key] = append(s.byKey[key], m)
	if s.limit > 0 && len(s.byKey[key]) > s.limit {
		// keep last N
		s.byKey[key] = s.byKey[key][len(s.byKey[key])-s.limit:]
	}
}

func (s *messageStore) get(key string) []ChatMessage {
	s.mu.RLock()
	defer s.mu.RUnlock()

	msgs := s.byKey[key]
	// return a copy so callers can't mutate store
	out := make([]ChatMessage, len(msgs))
	copy(out, msgs)
	return out
}

var store = newMessageStore(200) // keep last 200 messages per convo in RAM

// =====================
// Hub (online users)
// =====================

type chatHub struct {
	mu      sync.RWMutex
	clients map[string]*chatClient // userID -> client
}

func newChatHub() *chatHub {
	return &chatHub{clients: make(map[string]*chatClient)}
}

func (h *chatHub) setOnline(userID string, c *chatClient) {
	h.mu.Lock()
	h.clients[userID] = c
	h.mu.Unlock()
}

func (h *chatHub) setOffline(userID string, c *chatClient) {
	h.mu.Lock()
	if existing, ok := h.clients[userID]; ok && existing == c {
		delete(h.clients, userID)
	}
	h.mu.Unlock()
}

func (h *chatHub) get(userID string) (*chatClient, bool) {
	h.mu.RLock()
	c, ok := h.clients[userID]
	h.mu.RUnlock()
	return c, ok
}

func (h *chatHub) listOnlineIDs() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()

	out := make([]string, 0, len(h.clients))
	for id := range h.clients {
		out = append(out, id)
	}
	sort.Strings(out)
	return out
}

func (h *chatHub) broadcast(ev ServerEvent) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, c := range h.clients {
		c.sendEvent(ev)
	}
}

func (h *chatHub) broadcastPresenceSnapshot() {
	online := h.listOnlineIDs()
	h.broadcast(ServerEvent{Type: "presence_snapshot", Online: online})
}

var hub = newChatHub()

// =====================
// Client
// =====================

type chatClient struct {
	userID string
	conn   *websocket.Conn
	send   chan ServerEvent
}

func (c *chatClient) sendEvent(ev ServerEvent) {
	select {
	case c.send <- ev:
	default:
		_ = c.conn.Close()
	}
}

func (c *chatClient) sendError(msg string) {
	c.sendEvent(ServerEvent{Type: "error", Error: msg})
}

func (c *chatClient) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		_ = c.conn.Close()
	}()

	for {
		select {
		case ev, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			enc := json.NewEncoder(w)
			_ = enc.Encode(ev) // note: this writes JSON + newline, your client can still parse it
			_ = w.Close()

		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *chatClient) readPump() {
	defer func() {
		hub.setOffline(c.userID, c)

		// tell everyone one user went offline
		hub.broadcast(ServerEvent{Type: "presence", UserID: c.userID, Status: "offline"})
		hub.broadcastPresenceSnapshot()

		_ = c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		msgType, r, err := c.conn.NextReader()
		if err != nil {
			return
		}
		if msgType != websocket.TextMessage {
			continue
		}

		var ev ClientEvent
		dec := json.NewDecoder(r)
		if err := dec.Decode(&ev); err != nil {
			c.sendError("invalid json payload")
			continue
		}

		switch ev.Type {
		case "open":
			c.handleOpen(ev)
		case "message":
			c.handleMessage(ev)
		default:
			c.sendError("unknown event type")
		}
	}
}

func (c *chatClient) handleOpen(ev ClientEvent) {
	if ev.PeerID == "" {
		c.sendError("open requires peer_id")
		return
	}
	if ev.PeerID == c.userID {
		c.sendError("peer_id cannot be yourself")
		return
	}

	key := convoKey(c.userID, ev.PeerID)
	msgs := store.get(key)

	c.sendEvent(ServerEvent{
		Type:           "history",
		ConversationID: key,
		Messages:       msgs,
	})
}

func (c *chatClient) handleMessage(ev ClientEvent) {
	if ev.RecipientID == "" || ev.Content == "" {
		c.sendError("invalid message payload")
		return
	}
	if ev.RecipientID == c.userID {
		c.sendError("recipient_id cannot be yourself")
		return
	}

	now := time.Now().UTC().Format(time.RFC3339Nano)
	key := convoKey(c.userID, ev.RecipientID)

	msg := ChatMessage{
		SenderID:    c.userID,
		RecipientID: ev.RecipientID,
		Content:     ev.Content,
		CreatedAt:   now,
	}
	store.append(key, msg)

	// Always echo to sender (so UI stays consistent even if you don't append locally)
	c.sendEvent(ServerEvent{
		Type:           "message",
		ConversationID: key,
		SenderID:       c.userID,
		RecipientID:    ev.RecipientID,
		Content:        ev.Content,
		CreatedAt:      now,
		TempID:         ev.TempID,
	})

	recipientClient, online := hub.get(ev.RecipientID)
	if online {
		recipientClient.sendEvent(ServerEvent{
			Type:           "message",
			ConversationID: key,
			SenderID:       c.userID,
			RecipientID:    ev.RecipientID,
			Content:        ev.Content,
			CreatedAt:      now,
			TempID:         ev.TempID,
		})
		delivered := true
		c.sendEvent(ServerEvent{Type: "sent_ack", TempID: ev.TempID, Delivered: &delivered})
		return
	}

	delivered := false
	c.sendEvent(ServerEvent{Type: "sent_ack", TempID: ev.TempID, Delivered: &delivered})
}

// =====================
// Public handler: /ws/chat
// =====================

func ChatWSHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Println("WS path:", r.URL.Path)

	if !cookie.IsAuthenticated(r) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// Your existing session -> user id lookup (currently returns int)
	userIDInt, err := userIDFromSessionCookie(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// IMPORTANT: WS protocol uses STRING user ids
	userID := fmt.Sprintf("%d", userIDInt)

	conn, err := chatUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	c := &chatClient{
		userID: userID,
		conn:   conn,
		send:   make(chan ServerEvent, 64),
	}

	// Replace old connection if reconnect
	if old, ok := hub.get(userID); ok {
		_ = old.conn.Close()
	}
	hub.setOnline(userID, c)

	// tell this client who they are
	c.sendEvent(ServerEvent{Type: "hello", UserID: userID})

	// presence updates
	hub.broadcast(ServerEvent{Type: "presence", UserID: userID, Status: "online"})
	hub.broadcastPresenceSnapshot()

	go c.writePump()
	go c.readPump()
}

// =====================
// Session -> userID (your existing stub)
// =====================

func userIDFromSessionCookie(r *http.Request) (int64, error) {
	userID, err := queries.GetUserIDFromSession(r)
	return int64(userID), err
}
