
package models 

type ConversationItem struct {
	ID        int    `json:"id"`
	UserID    int    `json:"user_id"`
	Username  string `json:"username"`
	LastMsg   string `json:"last_message"`
	UpdatedAt string `json:"updated_at"`
}