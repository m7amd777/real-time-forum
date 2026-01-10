// posts.go
package queries

import (
	"real-time-forum/internal/database"
    "real-time-forum/internal/models"
	"fmt"
)

// Post queries here

// fetches all the posts and returns an array of structs (of type Post)


func GetAllPosts()([]models.Post, error){
	

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
			fmt.Println("error occured getting all posts: ", err)
			return  nil, err
		}

		defer rows.Close()

		var posts []models.Post

		for rows.Next(){
			var post models.Post 
			if err := rows.Scan(&post.ID, &post.Title, &post.Content, &post.Author, &post.CreatedAt); err != nil{
				continue
			}
			posts = append(posts, post)
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

func CreatePost(userID int, title string, categories []string, content string) error {
	

	// link the post
	result, err := database.DB.Exec(`
		INSERT INTO posts (user_id, title, content, created_at)
		VALUES (?, ?, ?, NOW())
	`, userID, title, content)
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
