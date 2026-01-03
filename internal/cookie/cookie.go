package cookie 

import (
	"fmt"
	"net/http"
	"time"
	"real-time-forum/internal/database/queries"

)



func IsAuthenticated(r *http.Request) bool {
	cookie, err := r.Cookie("sessionID")
	if err != nil {
		fmt.Println("error in authenticate.go is:", err)
		return false
	}

	// check if the cookie has expired
	if !queries.ValidSession(cookie.Value) {
		return false
	}
	return true
}

func DeleteCookie(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("sessionID")
	if err != nil {
		return
	}

	cookie = &http.Cookie{
		Name:     "sessionID",
		Value:    "",
		MaxAge:   -1,
		Expires:  time.Now().Add(-1 * time.Hour),
		HttpOnly: true,
	}
	http.SetCookie(w, cookie)

}

