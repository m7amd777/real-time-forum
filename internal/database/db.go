package database

import (
	"database/sql"
	"log"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB() {
	var err error
	DB, err = sql.Open("sqlite3", "database.db")
	if err != nil {
		log.Fatal(err)
	}

	if err = DB.Ping(); err != nil {
		log.Fatal("Error connecting to DB:", err)
	}

	runSchema()
	go cleanupExpiredSessions()
}

func runSchema() {
	schema := `
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS "categories" (
	"id" INTEGER,
	"name" TEXT NOT NULL UNIQUE,
	"description" TEXT,
	"created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id" AUTOINCREMENT)
);

CREATE TABLE IF NOT EXISTS "users" (
	"id" INTEGER,
	"username" TEXT NOT NULL UNIQUE,
	"email" TEXT NOT NULL UNIQUE,
	"password_hash" TEXT NOT NULL,
	"created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
	"age" INTEGER NOT NULL,
	"gender" TEXT NOT NULL,
	"firstname" TEXT NOT NULL,
	"lastname" TEXT NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);

CREATE TABLE IF NOT EXISTS "posts" (
	"id" INTEGER,
	"title" TEXT NOT NULL,
	"content" TEXT NOT NULL,
	"user_id" INTEGER NOT NULL,
	"created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("user_id") REFERENCES "users"("id")
);

CREATE TABLE IF NOT EXISTS "comments" (
	"id" INTEGER,
	"content" TEXT NOT NULL,
	"post_id" INTEGER NOT NULL,
	"user_id" INTEGER NOT NULL,
	"created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("post_id") REFERENCES "posts"("id"),
	FOREIGN KEY("user_id") REFERENCES "users"("id")
);

CREATE TABLE IF NOT EXISTS "likes" (
	"id" INTEGER,
	"user_id" INTEGER NOT NULL,
	"post_id" INTEGER,
	"comment_id" INTEGER,
	"type" TEXT NOT NULL CHECK("type" IN ('like', 'dislike')),
	"created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("comment_id") REFERENCES "comments"("id"),
	FOREIGN KEY("post_id") REFERENCES "posts"("id"),
	FOREIGN KEY("user_id") REFERENCES "users"("id")
);

CREATE TABLE IF NOT EXISTS "post_categories" (
	"post_id" INTEGER NOT NULL,
	"category_id" INTEGER NOT NULL,
	PRIMARY KEY("post_id","category_id"),
	FOREIGN KEY("category_id") REFERENCES "categories"("id") ON DELETE CASCADE,
	FOREIGN KEY("post_id") REFERENCES "posts"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "sessions" (
	"id" INTEGER,
	"session_id" TEXT NOT NULL UNIQUE,
	"user_id" INTEGER NOT NULL,
	"user_agent" TEXT,
	"real_ip" TEXT,
	"expires_at" DATETIME NOT NULL,
	"created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("user_id") REFERENCES "users"("id")
);

CREATE TABLE IF NOT EXISTS "conversations" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1_id INTEGER NOT NULL,
    user2_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (user1_id < user2_id),
    UNIQUE (user1_id, user2_id)
);

CREATE TABLE IF NOT EXISTS "messages" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    conversation_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    content TEXT NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME, -- NULL = unread, NOT NULL = read

    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

COMMIT;
`

	if _, err := DB.Exec(schema); err != nil {
		log.Fatal("Error running database schema:", err)
	}

	log.Println("Using database file: database.db (relative to working directory)")

}

func cleanupExpiredSessions() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		_, err := DB.Exec(
			"DELETE FROM sessions WHERE expires_at < ?",
			time.Now(),
		)
		if err != nil {
			log.Printf("Error cleaning expired sessions: %v", err)
		}
	}
}
