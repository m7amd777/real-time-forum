// comments.go
package handlers

import (
	"net/http"
	"strconv"
	"encoding/json"
    "real-time-forum/internal/database/queries"
	    "real-time-forum/internal/models"

)

// Comments handler here

type PostComment struct  {
    Post     models.Post `json:"post"`
    Comments []models.Comment  `json:"comments"`
}


func CommentsHandler(w http.ResponseWriter, r *http.Request){
	w.Header().Set("Content-Type", "application/json")

	q := r.URL.Query().Get("post")
	if q == ""{
		http.Error(w, "missing post id", http.StatusBadRequest)
        return
	}

	   postID, err := strconv.Atoi(q)
    if err != nil {
        http.Error(w, "invalid post id", http.StatusBadRequest)
        return
    }

	post, comments, err:= queries.GetPostComments(postID)
	if err != nil {
		http.Error(w, "Failed to load post and comments", http.StatusInternalServerError)
		return
	}


    toEncode := PostComment{ Post : post, Comments: comments, } 
	
	json.NewEncoder(w).Encode(toEncode)

}