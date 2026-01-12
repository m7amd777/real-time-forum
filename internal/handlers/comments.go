// comments.go
package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"real-time-forum/internal/database/queries"
	"real-time-forum/internal/models"
	"strconv"
)

// Comments handler here

type PostComment struct {
	Post     models.Post      `json:"post"`
	Comments []models.Comment `json:"comments"`
}

func CommentsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	q := r.URL.Query().Get("post")
	if q == "" {
		http.Error(w, "missing post id", http.StatusBadRequest)
		return
	}

	postID, err := strconv.Atoi(q)
	if err != nil {
		http.Error(w, "invalid post id", http.StatusBadRequest)
		return
	}

	post, comments, err := queries.GetPostComments(postID)
	if err != nil {
		http.Error(w, "Failed to load post and comments", http.StatusInternalServerError)
		return
	}

	toEncode := PostComment{Post: post, Comments: comments}

	json.NewEncoder(w).Encode(toEncode)

}

func CreateCommentHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		models.SendJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req models.Comment
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

	fmt.Println("post ID from the comment request: ", req.PostID)
	fmt.Println("Author ID from the cookie: ", authorID)
	fmt.Println("Content from the request: ", req.Content)

	if err := queries.CreateComment(req.PostID, authorID, req.Content); err != nil {
		models.SendJSONError(w, http.StatusInternalServerError, "Could not create comment")
		fmt.Println(err.Error())
		return
	}

	fmt.Println("COMMENT CREATED SUCCESSFULLY")

	json.NewEncoder(w).Encode(map[string]string{
		"message": "Created comment successfully",
	})

}
