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

	// Parse offset and limit query parameters
	offset := 0
	limit := 10

	if offsetStr := r.URL.Query().Get("offset"); offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil {
			offset = o
		}
	}

	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 50 {
			limit = l
		}
	}

	messages, err := queries.GetAllMessages(conversation_id, offset, limit)
	if err != nil {
		fmt.Println("error in retrieving messages", err)
		// Return empty array instead of null on error
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]interface{}{})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}
