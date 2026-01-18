// messages.go
package queries

import (
	"database/sql"
	"fmt"
	"real-time-forum/internal/database"
	"real-time-forum/internal/models"
)

// Message queries here

func InsertMessage(conversationID int, senderID int, content string) error {
	_, err := database.DB.Exec(
		`INSERT INTO messages (conversation_id,sender_id,content)
		VALUES (?,?,?)`, conversationID, senderID, content)

	if err != nil {
		return fmt.Errorf("insert message failed: %w", err)
	}

	return nil
}

// temp, we need to get 10 messages
func GetAllMessages(conversationID int) ([]models.MessageItem, error) {
	rows, err := database.DB.Query(
		`SELECT m.id, m.conversation_id, m.sender_id, m.content, m.created_at, m.read_at
		FROM messages m
		WHERE m.conversation_id = ?
		ORDER BY m.created_at ASC`, conversationID)

	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var messages []models.MessageItem
	for rows.Next() {
		var m models.MessageItem
		var read sql.NullTime
		err := rows.Scan(
			&m.Id,
			&m.Conversation_id,
			&m.Sender_id,
			&m.Content,
			&m.Created_at,
			&read,
		)

		if read.Valid {
			m.Read_at = &read.Time
		} else {
			m.Read_at = nil
		}

		if err != nil {
			return nil, fmt.Errorf("error scanning row: %w", err)
		}
		messages = append(messages, m)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %w", err)
	}

	return messages, nil
}
