package queries

import (
	"errors"
	"net/http"
	"real-time-forum/internal/database"
	"time"

	"github.com/google/uuid"
)

func GenerateToken() (string, error) {
	u, err := uuid.NewRandom()

	if err != nil {
		return "", err
	}

	return u.String(), nil
}

func AddSession(email string) (http.Cookie, error) {

	var userID int
	err := database.DB.QueryRow("SELECT id FROM users WHERE email = ?",
		email).Scan(&userID)
	if err != nil {
		return http.Cookie{}, err
	}

	value, err := GenerateToken()
	expires := time.Now().Add(7 * 24 * time.Hour)
	created := time.Now()

	if err != nil {
		return http.Cookie{}, err
	}

	_, err = database.DB.Exec("INSERT INTO sessions (session_id, user_id, user_agent, real_ip, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		value, userID, "agent", "0.0.0.0", expires, created)
	if err != nil {
		return http.Cookie{}, errors.New("database insert error")
	}

	cookie := http.Cookie{
		Name:     "sessionID",
		Value:    value,
		Expires:  expires,
		HttpOnly: true,
	}

	return cookie, nil
}

// all sessions for that user as expired (sets expires_at to now).
func DeletePastSessions(sessionID string) error {
	var userID int
	err := database.DB.QueryRow("SELECT user_id FROM sessions WHERE session_id = ?", sessionID).Scan(&userID)
	if err != nil {
		return err
	}

	_, err = database.DB.Exec("UPDATE sessions SET expires_at = ? WHERE user_id = ?", time.Now(), userID)
	return err
}

func ValidSession(value string) bool {
	var expiry time.Time
	err := database.DB.QueryRow("SELECT expires_at FROM sessions WHERE session_id = ?", value).Scan(&expiry)
	if err != nil {
		return false
	}

	return time.Now().Before(expiry)
}