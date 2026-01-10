// post.go
package models

import (
	"time"
)

// Post model here

// this holds the information of each post 

type Post struct {
	ID         int        `json:"id"`
	Title      string     `json:"title"`
	Content    string     `json:"content"`
	Author     string     `json:"author"`
	CreatedAt  time.Time  `json:"created_at"`
	Categories []Category `json:"categories"`
}

type Category struct {
	CategoryName string `json:"category_name"`
}


type CreatePostRequest struct {
	Title      string   `json:"title"`
	Content    string   `json:"content"`
	Categories []string `json:"categories"`
}	