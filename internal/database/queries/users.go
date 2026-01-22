// users.go
package queries

// User queries here
import (
	"database/sql"
	"fmt"
	"real-time-forum/internal/database"
	"real-time-forum/internal/models"
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

func CreateUser(username, email, password string, age int, gender string, firstname string, lastname string) error {
	_, err := database.DB.Exec(`
		INSERT INTO users (username, email, password_hash, age, gender, firstname, lastname,  created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, username, email, password, age, gender, firstname, lastname, time.Now())

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

func GetAllUsers() ([]models.User, error) {
	rows, err := database.DB.Query(`SELECT id, username FROM users`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User

	for rows.Next() {
		var u models.User

		if err := rows.Scan(&u.ID, &u.Username); err != nil {
			return nil, err
		}

		users = append(users, u)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return users, nil
}

// GetUserByID returns a user by ID
func GetUserByID(userID int) (models.User, error) {
	var u models.User
	err := database.DB.QueryRow(`SELECT id, username FROM users WHERE id = ?`, userID).Scan(&u.ID, &u.Username)
	if err != nil {
		if err == sql.ErrNoRows {
			return models.User{}, nil
		}
		return models.User{}, err
	}
	return u, nil
}
