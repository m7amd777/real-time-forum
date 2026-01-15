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

type chatHub struct {
	mu      sync.RWMutex
	clients map[int64]*ChatClient // userID -> client
}

func newChatHub() *chatHub {
	return &chatHub{clients: make(map[int64]*ChatClient)}
}

func (h *chatHub) setOnline(userID int64, c *ChatClient) {
	h.mu.Lock()
	h.clients[userID] = c
	h.mu.Unlock()
}

func (h *chatHub) setOffline(userID int64, c *ChatClient) {
	h.mu.Lock()
	if existing, ok := h.clients[userID]; ok && existing == c {
		delete(h.clients, userID)
	}
	h.mu.Unlock()
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

type ChatClient struct {
	id   int
	conn *websocket.Conn
	send chan ServerEvent
}

// {"type":"message","conversation_id":1,"recipient_id":2,"content":"sdsgdsudvskdgsgdsdsgdsudvskdgsgdsdsgdsudvskdgsgdsdsgdsudvskdgsgd","temp_id":"1768487398524"}
type ClientEvent struct {
	Type            string `json:"type"`
	Conversation_id int    `json:"conversation_id"`
	Recipient_id    int    `json:"recipient_id"`
	Content         string `json:"content"`
}

// this has to change definitely
type ServerEvent struct {
	Type        string `json:"type"`
	SenderID    int    `json:"sender_id"`
	RecipientID int    `json:"recipient_id"`
	Content     string `json:"content"`
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
		fmt.Println("Failed to upgrade the cookie", err)

		return
	}

	clientID, err := queries.GetUserIDFromSession(r)
	if err != nil {
		fmt.Println("COULD NOT GET USER ID, ABORTING")
		return
	}

	//pointer to the client so we can use it always anywhere
	c := &ChatClient{
		id:   clientID,
		conn: conn,
		send: make(chan ServerEvent, 64),
	}
	hub.setOnline(int64(clientID), c)

	go c.readPump()
	go c.writePump()
}

// loop to read anything a client sends
func (c *ChatClient) readPump() {
	for {
		_, p, err := c.conn.NextReader()
		if err != nil {
			fmt.Println("err")
			break
		}

		var msg ClientEvent

		dec := json.NewDecoder(p)
		err = dec.Decode(&msg)
		if err != nil {
			fmt.Println("payload error")
			fmt.Println(err)
		}
		//knowing type of message

		switch msg.Type {
		case "message":
			c.handleMessage(msg)
		default:
			//send client first
			fmt.Println("client error")
		}

	}

}

func (c *ChatClient) writePump() {
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
	if !ok {
		// recipient is offline, just save to database
		return
	}
	rc.sendEvent(ServerEvent{
		Type:        "message",
		SenderID:    c.id,
		RecipientID: msg.Recipient_id,
		Content:     msg.Content,
	})
	//insert it in the database

}
