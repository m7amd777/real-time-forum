// auth.go
package handlers

import (
	"encoding/json"
	"net/http"

	// "strconv"
	// "encoding/json"
	// "real-time-forum/internal/database/queries"
	"fmt"
	"real-time-forum/internal/cookie"
	"real-time-forum/internal/database/queries"
	"real-time-forum/internal/models"
)

// Auth handler here

//receives form data through an HTTP request sent by the frontend (JS)

func RegisterHandler(w http.ResponseWriter, r *http.Request) {

	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		models.SendJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req models.RegisterRequest

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		models.SendJSONError(w, http.StatusBadRequest, "Invalid request")
		fmt.Println("")
		return
	}

	fmt.Println(req.Username)
	fmt.Println(req.Password)
	fmt.Println(req.Email)

	exists, err := queries.UserExists(req.Username, req.Email)
	if err != nil {
		models.SendJSONError(w, http.StatusInternalServerError, "Server error")
		return
	}

	if exists {
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Username or email already exists",
		})
		return
	}

	err = queries.CreateUser(req.Username, req.Email, string(req.Password), req.Age, req.Gender, req.FirstName, req.LastName)
	fmt.Println("error for register")
	if err != nil {
		models.SendJSONError(w, http.StatusInternalServerError, "Failed to create user")

		fmt.Print("THIS IS THE ERROR FOR CREATING A USER IN THE REGISTER HANDLER: ", err)
		return
	}

	cookie, err := queries.AddSession(req.Email)
	if err != nil {
		models.SendJSONError(w, http.StatusInternalServerError, "Failed to create session")
		return
	}

	http.SetCookie(w, &cookie)

	fmt.Println("SUCCESSSSS REGISTERING")

	json.NewEncoder(w).Encode(map[string]string{
		"message": "Registration successful",
	})

}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		models.SendJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req models.LoginRequest

	err := json.NewDecoder(r.Body).Decode(&req)

	if err != nil {
		models.SendJSONError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	// allow login by either email or username — check identifier exists
	exists, err := queries.UserExists(req.Email, req.Email)
	if err != nil {
		models.SendJSONError(w, http.StatusInternalServerError, "Server error")
		return
	}

	if !exists {
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "User does not exist. Please Register",
		})
		return
	}

	ok, userEmail, err := queries.CheckLoginCredentials(req.Email, req.Password)
	if err != nil {
		models.SendJSONError(w, http.StatusInternalServerError, "Server error")
		return
	}

	if !ok {
		models.SendJSONError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	cookie, err := queries.AddSession(userEmail)
	if err != nil {
		models.SendJSONError(w, http.StatusInternalServerError, "Failed to create session")
		return
	}

	http.SetCookie(w, &cookie)

	fmt.Println("SUCCESSSSS LOGIN")

	json.NewEncoder(w).Encode(map[string]string{
		"message": "Login successful",
	})

}

func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		models.SendJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	c, err := r.Cookie("sessionID")
	if err != nil {
		models.SendJSONError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	sessionError := queries.DeletePastSessions(c.Value)
	if sessionError != nil {
		models.SendJSONError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	cookie.DeleteCookie(w, r)

	json.NewEncoder(w).Encode(map[string]string{
		"message": "Logout successful",
	})

}

func AuthStatusHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if cookie.IsAuthenticated(r) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]bool{
			"authenticated": true,
		})
		return
	}

	w.WriteHeader(http.StatusUnauthorized)
	json.NewEncoder(w).Encode(map[string]bool{
		"authenticated": false,
	})
}
