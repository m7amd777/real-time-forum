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
func PostsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	category := r.URL.Query().Get("category")

	posts, err := queries.GetAllPosts(category)
	if err != nil {
		http.Error(w, "Failed to load posts", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(posts)
}


func CreatePostHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		models.SendJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req models.CreatePostRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.SendJSONError(w, http.StatusBadRequest, "Invalid JSON")
		fmt.Println(err.Error())
		return
	}

	authorID, err := queries.GetUserIDFromSession(r)
	if err != nil {
		models.SendJSONError(w, http.StatusUnauthorized, "Unauthorized")
		fmt.Println(err.Error())
		return
	}

	var categories []models.Category
	for _, name := range req.Categories {
		categories = append(categories, models.Category{
			CategoryName: name,
		})
	}

	fmt.Println("Wrapped categories:", categories)

	if err := queries.CreatePost(authorID, req.Title, categories, req.Content); err != nil {
		models.SendJSONError(w, http.StatusInternalServerError, "Could not create post")
		fmt.Println(err.Error())
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"message": "Created post successfully",
	})
}


