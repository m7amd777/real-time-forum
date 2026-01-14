package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"sync"
	"time"

	"real-time-forum/internal/cookie"

	"github.com/gorilla/websocket"
)

// =====================
// WS protocol structs
// =====================

type ClientEvent struct {
	Type           string `json:"type"` // "message"
	ConversationID int64  `json:"conversation_id"`
	RecipientID    int64  `json:"recipient_id"`
	Content        string `json:"content"`
	TempID         string `json:"temp_id,omitempty"`
}

type ServerEvent struct {
	Type           string `json:"type"` // "message" | "sent_ack" | "error" | "presence"
	ConversationID int64  `json:"conversation_id,omitempty"`
	SenderID       int64  `json:"sender_id,omitempty"`
	RecipientID    int64  `json:"recipient_id,omitempty"`
	Content        string `json:"content,omitempty"`
	CreatedAt      string `json:"created_at,omitempty"`
	TempID         string `json:"temp_id,omitempty"`
	Delivered      *bool  `json:"delivered,omitempty"`
	Error          string `json:"error,omitempty"`

	// optional presence event
	UserID int64  `json:"user_id,omitempty"`
	Status string `json:"status,omitempty"` // "online"/"offline"
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
	CheckOrigin: func(r *http.Request) bool { return true }, // replace later if you want
}

// =====================
// Hub (online users)
// =====================

type chatHub struct {
	mu      sync.RWMutex
	clients map[int64]*chatClient // userID -> client
}

func newChatHub() *chatHub {
	return &chatHub{clients: make(map[int64]*chatClient)}
}

func (h *chatHub) setOnline(userID int64, c *chatClient) {
	h.mu.Lock()
	h.clients[userID] = c
	h.mu.Unlock()
}

func (h *chatHub) setOffline(userID int64, c *chatClient) {
	h.mu.Lock()
	if existing, ok := h.clients[userID]; ok && existing == c {
		delete(h.clients, userID)
	}
	h.mu.Unlock()
}

func (h *chatHub) get(userID int64) (*chatClient, bool) {
	h.mu.RLock()
	c, ok := h.clients[userID]
	h.mu.RUnlock()
	return c, ok
}

// single global hub instance (simple + works)
var hub = newChatHub()

// =====================
// Client
// =====================

type chatClient struct {
	userID int64
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
			_ = enc.Encode(ev)
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

		// --- DB: mark offline (commented) ---
		// _ = dbMarkUserOffline(c.userID)

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
		case "message":
			c.handleMessage(ev)
		default:
			c.sendError("unknown event type")
		}
	}
}

func (c *chatClient) handleMessage(ev ClientEvent) {
	// basic validation
	if ev.ConversationID <= 0 || ev.RecipientID <= 0 || ev.Content == "" {
		c.sendError("invalid message payload")
		return
	}
	if ev.RecipientID == c.userID {
		c.sendError("recipient_id cannot be yourself")
		return
	}

	// --- OPTIONAL security check (commented) ---
	// Verify (conversation_id, sender_id, recipient_id) match the conversations table.
	// ok, err := dbIsConversationMember(ev.ConversationID, c.userID, ev.RecipientID)
	// if err != nil { c.sendError("server error"); return }
	// if !ok { c.sendError("not allowed"); return }

	now := time.Now().UTC().Format(time.RFC3339Nano)
	recipientClient, online := hub.get(ev.RecipientID)

	// Your rule:
	// If online -> forward
	// Else -> save only to DB
	//
	// IMPORTANT: per your rule, online messages are NOT stored.
	// (I’m not changing that unless you tell me.)

	if online {
		recipientClient.sendEvent(ServerEvent{
			Type:           "message",
			ConversationID: ev.ConversationID,
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

	// offline -> save only (commented)
	// err := dbInsertMessage(ev.ConversationID, c.userID, ev.Content)
	// if err != nil { c.sendError("server error"); return }

	delivered := false
	c.sendEvent(ServerEvent{Type: "sent_ack", TempID: ev.TempID, Delivered: &delivered})
}

// =====================
// Public handler: /ws/chat
// =====================

func ChatWSHandler(w http.ResponseWriter, r *http.Request) {
	// You already have cookie.IsAuthenticated(r)
	if !cookie.IsAuthenticated(r) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// You need a way to get userID from sessionID cookie.
	// This MUST come from your DB session table query.
	userID, err := userIDFromSessionCookie(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := chatUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	c := &chatClient{
		userID: userID,
		conn:   conn,
		send:   make(chan ServerEvent, 64),
	}

	// Replace old connection if user reconnects (keeps routing simple)
	if old, ok := hub.get(userID); ok {
		_ = old.conn.Close()
	}
	hub.setOnline(userID, c)

	// --- DB: mark online (commented) ---
	// _ = dbMarkUserOnline(userID)

	go c.writePump()
	go c.readPump()
}

// =====================
// Session -> userID (stub)
// =====================

func userIDFromSessionCookie(r *http.Request) (int64, error) {
	// You already use cookie name "sessionID" in earlier code.
	ck, err := r.Cookie("sessionID")
	if err != nil {
		return 0, errors.New("missing session cookie")
	}

	sessionID := ck.Value

	// --- DB QUERY YOU WILL IMPLEMENT (commented) ---
	// userID, err := queries.GetUserIDBySession(sessionID)
	// if err != nil { return 0, err }
	// return userID, nil

	_ = sessionID
	return 0, errors.New("TODO: implement GetUserIDBySession(sessionID)")
}

/*
---------- DB stubs (commented out) ----------
func dbMarkUserOnline(userID int64) error { return nil }
func dbMarkUserOffline(userID int64) error { return nil }
func dbInsertMessage(conversationID, senderID int64, content string) error { return nil }
func dbIsConversationMember(conversationID, senderID, recipientID int64) (bool, error) { return true, nil }
*/
