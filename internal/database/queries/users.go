// users.go
package queries

// User queries here
import (
	"database/sql"
	"fmt"
	"real-time-forum/internal/database"
	"time"
)

// chekc if either exist
func UserExists(username, email string) (bool, error) {
	var exists int

	err := database.DB.QueryRow(`
		SELECT 1
		FROM users
		WHERE username = ? OR email = ?
		LIMIT 1
	`, username, email).Scan(&exists)

	fmt.Println("INSIDE USER & EMAIL CHECKING: ", err)
	fmt.Println("INSIDE USER & EMAIL CHECKING: ", exists)

	if err == sql.ErrNoRows {
		return false, nil
	}

	if err != nil {
		return false, err
	}

	return true, nil
}

func EmailExists(email string) (bool, error) {
	var exists int
	err := database.DB.QueryRow(`
		SELECT 1
		FROM users
		WHERE email = ?
		LIMIT 1
	`, email).Scan(&exists)

	fmt.Println("DOES USER EXIST????  ", exists)

	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func CreateUser(username, email, password string) error {
	_, err := database.DB.Exec(`
		INSERT INTO users (username, email, password_hash, created_at)
		VALUES (?, ?, ?, ?)
	`, username, email, password, time.Now())

	return err
}

func CheckLoginCredentials(identifier, password string) (bool, string, error) {
	var storedHash string
	var email string

	err := database.DB.QueryRow(`
		SELECT password_hash, email
		FROM users
		WHERE email = ? OR username = ?
	`, identifier, identifier).Scan(&storedHash, &email)

	// user does not exist
	if err == sql.ErrNoRows {
		return false, "", nil
	}

	if err != nil {
		return false, "", err
	}

	// plain-text comparison for now (replace with proper hashing later)
	if storedHash != password {
		return false, "", nil
	}

	return true, email, nil
}
