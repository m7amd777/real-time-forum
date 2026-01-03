// main.go
package main

import(
	"fmt"
	"net/http"
	"html/template"
	"real-time-forum/internal/handlers"
	"real-time-forum/internal/database"

)

// "real-time-forum/internal/databasedsdsds"
func main() {
	// Entry point for the server
	database.InitDB()
	//./ is working anyways	
	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("../web/"))))

	http.HandleFunc("/", homeHandler)

	// define the endpoint for the posts, this will be used by the frontend to fetch data and populate the js views
	http.HandleFunc("/api/posts", handlers.PostsHandler) 

	http.HandleFunc("/api/comments", handlers.CommentsHandler)
	http.HandleFunc("/api/register", handlers.RegisterHandler)

	http.HandleFunc("/api/login", handlers.LoginHandler)
	http.HandleFunc("/api/logout", handlers.LogoutHandler)



	// Start server
	fmt.Println("Server running on http://localhost:8080")
	http.ListenAndServe(":8080", nil)

}

func homeHandler(w http.ResponseWriter, r *http.Request) {
	// Parse template file
	tmpl, err := template.ParseFiles("../web/index.html")
	if err != nil {
		fmt.Println(err)
		http.Error(w, "Error loading template", http.StatusInternalServerError)
		return
	}

	// Render template
	if err := tmpl.Execute(w, nil); err != nil {
		fmt.Println("ansabsbas",err)
		http.Error(w, "Error rendering template", http.StatusInternalServerError)
		return
	}
}