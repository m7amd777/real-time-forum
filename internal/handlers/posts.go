// posts.go
package handlers

import (
	"net/http"
	"encoding/json"
    "real-time-forum/internal/database/queries"
)

// Posts handler here

//uses the fetching query for data and returns json
func PostsHandler(w http.ResponseWriter, r *http.Request){
w.Header().Set("Content-Type", "application/json")
	posts, err := queries.GetAllPosts()
	if err != nil {
		http.Error(w, "Failed to load posts", http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(posts)
}


