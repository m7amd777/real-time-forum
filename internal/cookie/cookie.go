package cookie 

import (
	//"fmt"
	"net/http"
	//"time"
	"real-time-forum/internal/database/queries"

)



func IsAuthenticated(r *http.Request) bool {
	cookie, err := r.Cookie("sessionID")
	if err != nil {
		// fmt.Println("error in cookie.go is:", err)
		return false
	}

	// check if the cookie has expired
	if !queries.ValidSession(cookie.Value) {
		return false
	}
	return true
}

func DeleteCookie(w http.ResponseWriter, r *http.Request) {
    http.SetCookie(w, &http.Cookie{
        Name:     "sessionID",
        Value:    "",
        Path:     "/",
        MaxAge:   -1,  
        HttpOnly: true,
    })
}

