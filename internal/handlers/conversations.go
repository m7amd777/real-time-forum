package handlers

import (
	"net/http"
	"real-time-forum/internal/database/queries"
	"encoding/json"

)

func ConversationsHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := queries.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "unauthorized", 401)
		return
	}

	convs, err := queries.GetConversations(userID)
	if err != nil {
		http.Error(w, "failed", 500)
		return
	}

	json.NewEncoder(w).Encode(convs)
}

func StartChatHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := queries.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		UserID int `json:"user_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	if req.UserID == 0 || req.UserID == userID {
		http.Error(w, "invalid user", http.StatusBadRequest)
		return
	}

	conversationID, err := queries.GetOrCreateConversation(userID, req.UserID)
	if err != nil {
		http.Error(w, "failed to create conversation", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{
		"conversation_id": conversationID,
	})
}


