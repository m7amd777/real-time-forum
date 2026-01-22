package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"real-time-forum/internal/database/queries"
)

func UsersHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	users, err := queries.GetAllUsers()
	if err != nil {
		http.Error(w, "Failed to load users", http.StatusInternalServerError)
		fmt.Println("GetAllUsers error:", err)
		return
	}

	json.NewEncoder(w).Encode(users)
}

// MeHandler returns the authenticated user's id and username
func MeHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, err := queries.GetUserIDFromSession(r)
	if err != nil || userID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	user, err := queries.GetUserByID(userID)
	if err != nil {
		http.Error(w, "failed", http.StatusInternalServerError)
		fmt.Println("GetUserByID error:", err)
		return
	}

	if user.ID == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(user)
}
