// posts.go
package queries

import (
	"real-time-forum/internal/database"
    "real-time-forum/internal/models"
	"time"

)

// Post queries here

// fetches all the posts and returns an array of structs (of type Post)


func GetAllPosts() ([]models.Post, error) {
	rows, err := database.DB.Query(`
		SELECT
			p.id,
			p.title,
			p.content,
			u.username,
			p.created_at,
			x.name
		FROM posts p
		JOIN users u ON p.user_id = u.id
		JOIN post_categories pc ON p.id = pc.post_id
		JOIN categories x ON pc.category_id = x.id
		ORDER BY p.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	postMap := make(map[int]*models.Post)

	for rows.Next() {
		var (
			postID    int
			title     string
			content   string
			author    string
			createdAt time.Time
			catName   string
		)

		err := rows.Scan(
			&postID,
			&title,
			&content,
			&author,
			&createdAt,
			&catName,
		)
		if err != nil {
			return nil, err
		}

		// create post if not exists
		if _, exists := postMap[postID]; !exists {
			postMap[postID] = &models.Post{
				ID:        postID,
				Title:     title,
				Content:   content,
				Author:    author,
				CreatedAt: createdAt,
				Categories: []models.Category{},
			}
		}

		// append category
		postMap[postID].Categories = append(
			postMap[postID].Categories,
			models.Category{CategoryName: catName},
		)
	}

	// convert map → slice
	var posts []models.Post
	for _, p := range postMap {
		posts = append(posts, *p)
	}

	return posts, nil
}



func GetPost(postID int) (models.Post, error) {
	var post models.Post

	row := database.DB.QueryRow(
		`SELECT 
    p.id, p.title, p.content, u.username, p.created_at
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE p.id = ?`,
		postID,
	)

	err := row.Scan(
		&post.ID,
		&post.Title,
		&post.Content,
		&post.Author,
		&post.CreatedAt,
	)

	if err != nil {
		return models.Post{}, err
	}

	return post, nil
}

func CreatePost(authorID int, title string, categories []string, content string) error {
	

	// link the post
	result, err := database.DB.Exec(`
		INSERT INTO posts (title, content, user_id, created_at, updated_at)
		VALUES (?, ?, ?, NOW(), NOW())
	`,  title, content, authorID)
	if err != nil {
		return err
	}

	postID, err := result.LastInsertId()
	if err != nil {
		return err
	}

	// link the categories
	for _, catName := range categories {
		var categoryID int

		err := database.DB.QueryRow(`
			SELECT id FROM categories WHERE name = ?
		`, catName).Scan(&categoryID)

		if err != nil {
			return err
		}

		_, err = database.DB.Exec(`
			INSERT INTO post_categories (post_id, category_id)
			VALUES (?, ?)
		`, postID, categoryID)

		if err != nil {
			return err
		}
	}

	return err
}
