package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"real-time-forum/internal/cookie"
	"real-time-forum/internal/database/queries"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

//we need to track the users and what they are doing if they are online or not

// // =====================
// // Hub (online users)
// // =====================

type ChatClient struct {
	id   int
	conn *websocket.Conn
	send chan ServerEvent
	done chan struct{} // signal to prevent duplicate cleanup
}

type chatHub struct {
	mu      sync.RWMutex
	clients map[int64]*ChatClient // userID -> client
}

// {"type":"message","conversation_id":1,"recipient_id":2,"content":"sdsgdsudvskdgsgdsdsgdsudvskdgsgdsdsgdsudvskdgsgdsdsgdsudvskdgsgd","temp_id":"1768487398524"}
type ClientEvent struct {
	Type            string `json:"type"`
	Conversation_id int    `json:"conversation_id"`
	Recipient_id    int    `json:"recipient_id"`
	Content         string `json:"content"`
	TimeStamp       string `json:"time"`
}

// this has to change definitely
type ServerEvent struct {
	Type        string  `json:"type"`
	SenderID    int     `json:"sender_id"`
	RecipientID int     `json:"recipient_id"`
	Content     string  `json:"content"`
	Timestamp   string  `json:"timestamp,omitempty"`
	OnlineUsers []int64 `json:"online_users,omitempty"`
}

func newChatHub() *chatHub {
	return &chatHub{clients: make(map[int64]*ChatClient)}
}

func (h *chatHub) setOnline(userID int64, c *ChatClient) {
	h.mu.Lock()
	h.clients[userID] = c
	h.mu.Unlock()
	h.broadcastOnlineUsers()
}

func (h *chatHub) setOffline(userID int64, c *ChatClient) {
	h.mu.Lock()
	if existing, ok := h.clients[userID]; ok && existing == c {
		delete(h.clients, userID)
	}
	h.mu.Unlock()
	h.broadcastOnlineUsers()
}

func (h *chatHub) get(userID int64) (*ChatClient, bool) {
	h.mu.RLock()
	c, ok := h.clients[userID]
	h.mu.RUnlock()
	return c, ok
}

// single global hub instance (simple + works)
var hub = newChatHub()

// idk what is this but i kept it here for now
const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 16 * 1024
)

//mohamed work is below for now=============================================================================

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func (h *chatHub) trackingUsers() {
	h.mu.RLock()
	defer h.mu.RUnlock()

	fmt.Println("Online users:")
	for userID, client := range h.clients {
		fmt.Printf("UserID: %d, ClientID: %d\n", userID, client.id)
	}
}

func ChatWSHandler(w http.ResponseWriter, r *http.Request) {
	auth := cookie.IsAuthenticated(r)
	if !auth {
		//return to the pahe ot dont ugrade
		fmt.Println("not authorized at all")
		return
	}

	//now call the damn upgrader
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Println("Failed to upgrade:", err)
		return
	}

	clientID, err := queries.GetUserIDFromSession(r)
	if err != nil {
		fmt.Println("COULD NOT GET USER ID, ABORTING")
		conn.Close()
		return
	}

	//pointer to the client so we can use it always anywhere
	c := &ChatClient{
		id:   clientID,
		conn: conn,
		send: make(chan ServerEvent, 64),
		done: make(chan struct{}),
	}
	hub.setOnline(int64(clientID), c)
	hub.trackingUsers()
	fmt.Printf("User %d connected\n", clientID)

	hub.trackingUsers() // Call it once to see current state

	go c.readPump()
	go c.writePump()
}

// loop to read anything a client sends
func (c *ChatClient) readPump() {
	defer func() {
		select {
		case <-c.done:
			// Already cleaned up
		default:
			close(c.done)
			hub.setOffline(int64(c.id), c)
			c.conn.Close()
			fmt.Printf("User %d disconnected\n", c.id)
			hub.trackingUsers()
		}
	}()

	for {
		_, p, err := c.conn.NextReader()
		if err != nil {
			fmt.Println("connection error:", err)
			break
		}

		var msg ClientEvent
		dec := json.NewDecoder(p)
		err = dec.Decode(&msg)
		if err != nil {
			fmt.Println("payload error:", err)
			continue
		}

		switch msg.Type {
		case "message":
			c.handleMessage(msg)
		default:
			fmt.Println("unknown message type:", msg.Type)
		}
	}
}

func (c *ChatClient) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		select {
		case <-c.done:
			// Already cleaned up
		default:
			close(c.done)
			hub.setOffline(int64(c.id), c)
			_ = c.conn.Close()
			fmt.Printf("User %d disconnected\n", c.id)
			hub.trackingUsers()
		}
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

func (c *ChatClient) sendEvent(ev ServerEvent) {
	fmt.Println("sending event")
	select {
	case c.send <- ev:
	default:
		_ = c.conn.Close()
	}
}

func (c *ChatClient) handleMessage(msg ClientEvent) {
	// need to check if the user is online (later)

	// forward it to the other client\
	// now := time.Now()
	fmt.Println("handling the message to", msg.Recipient_id)
	rc, ok := hub.get(int64(msg.Recipient_id))
	if ok {
		// recipient is offline, just save to database
		rc.sendEvent(ServerEvent{
			Type:        "message",
			SenderID:    c.id,
			RecipientID: msg.Recipient_id,
			Content:     msg.Content,
			Timestamp:   time.Now().UTC().Format(time.RFC3339),
		})
	}

	err := queries.InsertMessage(1, c.id, msg.Content)
	if err != nil {
		fmt.Println("error while inserting messsage in handleMessage", err)
	}
	//insert it in the database

}

func GetOnlineUsersHandler(w http.ResponseWriter, r *http.Request) {
	hub.trackingUsers() // Debug output

	users := hub.getOnlineUsers()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"online_users": users,
		"count":        len(users),
	})
}

func (h *chatHub) getOnlineUsers() []int64 {
	h.mu.RLock()
	defer h.mu.RUnlock()

	users := make([]int64, 0, len(h.clients))
	for userID := range h.clients {
		users = append(users, userID)
	}
	return users
}

func (h *chatHub) broadcastOnlineUsers() {
	onlineUsers := h.getOnlineUsers()
	event := ServerEvent{
		Type:        "online_users",
		OnlineUsers: onlineUsers,
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, client := range h.clients {
		select {
		case client.send <- event:
		default:
			// Client's send channel is full, skip
		}
	}
}
