// comment.go
package models

import (
	"time"
)


type Comment struct{
	 ID        int       `json:"id"`
	 Content string    `json:"content"`
	 PostID int 		`json:"post_id"`
	 Author string 			`json:"author"`
	 CreatedAt time.Time 		`json:"created_at"`
}