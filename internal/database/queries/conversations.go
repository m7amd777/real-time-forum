package queries


import(
		
	"real-time-forum/internal/database"
	"real-time-forum/internal/models"
	"database/sql"
)

func GetConversations(userID int) ([]models.ConversationItem, error) {
	rows, err := database.DB.Query(`
		SELECT
			c.id,
			CASE 
				WHEN c.user1_id = ? THEN u2.id
				ELSE u1.id
			END AS other_user_id,
			CASE 
				WHEN c.user1_id = ? THEN u2.username
				ELSE u1.username
			END AS other_username,
			COALESCE(m.content, '') AS last_message,
			COALESCE(m.created_at, c.created_at) AS updated_at
		FROM conversations c
		JOIN users u1 ON u1.id = c.user1_id
		JOIN users u2 ON u2.id = c.user2_id
		LEFT JOIN messages m 
		  ON m.id = (
			  SELECT id FROM messages 
			  WHERE conversation_id = c.id 
			  ORDER BY created_at DESC 
			  LIMIT 1
		  )
		WHERE c.user1_id = ? OR c.user2_id = ?
		ORDER BY updated_at DESC
	`, userID, userID, userID, userID)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.ConversationItem

	for rows.Next() {
		var c models.ConversationItem
		if err := rows.Scan(
			&c.ID,
			&c.UserID,
			&c.Username,
			&c.LastMsg,
			&c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, c)
	}

	return items, nil
}


func GetOrCreateConversation(userA, userB int) (int, error) {
	if userA > userB {
		userA, userB = userB, userA
	}

	// check if conversation exists
	var convoID int
	err := database.DB.QueryRow(`
		SELECT id FROM conversations 
		WHERE user1_id = ? AND user2_id = ?
	`, userA, userB).Scan(&convoID)

	if err == nil {
		return convoID, nil
	}

	if err != sql.ErrNoRows {
		return 0, err
	}

	// create conversation
	res, err := database.DB.Exec(`
		INSERT INTO conversations (user1_id, user2_id)
		VALUES (?, ?)
	`, userA, userB)

	if err != nil {
		return 0, err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}

	return int(id), nil
}
