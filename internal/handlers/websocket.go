package handlers

import (
	"fmt"
	"net/http"
	"real-time-forum/internal/cookie"
	"real-time-forum/internal/database/queries"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type ChatClient struct {
	id   int
	conn *websocket.Conn
	send chan ServerEvent
}

type ClientEvent struct {
	
}

type ServerEvent struct {
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

	go c.readPump()
	go c.writePump()
}

func (c *ChatClient) readPump() {
	for {
		_,p,_ := c.conn.ReadMessage()
		// decode only when you want to convert to structs
		fmt.Println(p)


		p.receprien


		sendevent
	}

}

func (c *ChatClient) writePump() {
	for { 

		select:

		send<-
	}
}


sendevent {
	<-send
}