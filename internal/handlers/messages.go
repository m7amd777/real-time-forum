// messages.go
package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"real-time-forum/internal/database/queries"
	"strconv"
)

// Messages handler here

func MessagesHandler(w http.ResponseWriter, r *http.Request) {

	convID := r.URL.Query().Get("conversation_id")
	if convID == "" {
		//missing conversation_id
	}

	conversation_id, err := strconv.Atoi(convID)
	if err != nil {
		fmt.Println("failed atoi")
		return
	}

	messages, err := queries.GetAllMessages(conversation_id)
	if err != nil {
		fmt.Println("error in retrieving messages", err)
	}

	json.NewEncoder(w).Encode(messages)
}
