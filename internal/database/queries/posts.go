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
        SELECT p.id, p.title, p.content, u.username, p.created_at
        FROM posts p
        JOIN users u ON p.user_id = u.id
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
