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
