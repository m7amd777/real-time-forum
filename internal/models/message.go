// message.go
package models

import "time"

// Message model here
type MessageItem struct {
	Id              int        `json:"id"`
	Conversation_id int        `json:"converation_id"`
	Sender_id       int        `json:"sender_id"`
	Content         string     `json:"content"`
	Created_at      time.Time  `json:"created_at"`
	Read_at         *time.Time `json:"read_at"`
}
