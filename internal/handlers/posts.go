// posts.go
package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"real-time-forum/internal/database/queries"
	"real-time-forum/internal/models"
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

func CreatePostHandler(w http.ResponseWriter, r *http.Request){

	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		models.SendJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req models.Post

	err := json.NewDecoder(r.Body).Decode(&req)

	if err != nil {
		models.SendJSONError(w, http.StatusInternalServerError, "Internal Server Error: Cant decode JSON")
				fmt.Println(err.Error())
		return
	}

	authorID , err := queries.GetUserIDFromSession(r)
	if err != nil {
		models.SendJSONError(w, http.StatusInternalServerError, "Internal Server Error: Cant get userID from session")
				fmt.Println(err.Error())

		return
	}

	 e := queries.CreatePost(authorID, req.Title, req.Categories, req.Content)
	 if e != nil {
		models.SendJSONError(w, http.StatusInternalServerError, "Internal Server Error: Cant create post")
				fmt.Println(e.Error())
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"message": "Created post successfully",
	})
}


