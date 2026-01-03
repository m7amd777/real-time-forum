// post.go
package models

import (
	"time"
)

// Post model here

// this holds the information of each post 

type Post struct{
	ID        int       `json:"id"`
    Title     string    `json:"title"`
    Content   string    `json:"content"`
    Author    string    `json:"author"`
    CreatedAt time.Time `json:"created_at"`

}