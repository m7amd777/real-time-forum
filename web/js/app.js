// app.js
// Main JS logic here


//static logic

//render page 1
//render page 2
//and so on
//

document.addEventListener("click", (e) => console.log("clicked:", e.target));


let maincontent = document.getElementById("mainarea")
let addPostBtn = document.getElementById("add")
let homeBtn = document.getElementById("home")
let chatBtn = document.getElementById('chatBtn')

addPostBtn.addEventListener("click", (e) => {
  e.preventDefault();
  addPostRender();
});

homeBtn.addEventListener("click", (e) => {
  e.preventDefault();
  homeRender();
});

chatBtn.addEventListener("click", (e) => {
    e.preventDefault();
    chatRender();
});


function addPostRender() {
    maincontent.innerHTML = `<main class="makepost-card-horizontal">
        <div class="makepost-header">
            <h1 class="post-title">Create a Post</h1>
            <p class="post-subtitle">Share your thoughts with the community.</p>
        </div>

        <form class="form-horizontal" method="POST" action="/create-post">
            <div class="makepost-form-row">
                <!-- Left column -->
                <div class="makepost-form-left">
                    <div class="post-title">
                        <label for="title-input" class="label">Title</label>
                        <input class="input" type="text" id="title-input" name="title" placeholder="Write your title..."
                            minlength="3" maxlength="100" required />
                    </div>

                    <fieldset class="post-categories" aria-describedby="category-help">
                        <legend class="label">Choose Categories</legend>

                        <select id="category-select" name="category" class="input multi-select" multiple required
                            aria-describedby="category-help">
                            <option value="gaming">Gaming</option>
                            <option value="life">Life</option>
                            <option value="coding">Coding</option>
                            <option value="memes">Memes</option>
                        </select>

                        <small class="help-text" id="category-help">
                            Click on Ctrl/⌘ to multi-select or to Undo selection.
                        </small>
                    </fieldset>
                </div>

                <!-- Right column -->
                <div class="makepost-form-right">
                    <div class="post-content">
                        <label for="content-input" class="label">Content</label>
                        <textarea class="input" id="content-input" name="content"
                            placeholder="Write your post content here..." minlength="10" maxlength="3000"
                            required></textarea>
                    </div>
                </div>
            </div>

            <div class="makepost-form-bottom">
                <button class="btn btn-primary" type="submit">Post</button>
            </div>
        </form>
    </main>`
}


// for now it is just static data for views then we implement some shit soon/
function homeRender() {
    maincontent.innerHTML = 
            `<div class="block3" id="11">
                <div class="frame">
                    <div class="username">
                        <h3>@m7amd777 <span class="post-date"> • 2025</span></h3>
                    </div>

                    <a href="/post/{{$post.ID}}" style="text-decoration:none; color:black;">
                        <h3>New GTA 6 Leks</h3>
                    </a>
                    <div class="content">

                        <p>
                            bro im just clckbaiting yall
                        </p>
                    </div>
                    <div class="post-meta">
                        <div class="category-flairs">
                            <span>General</span>
                            <span>Gaming</span>
                            <span>Music</span>
                        </div>

                        <div class="post-engagement">
                            <div class="post-like-dislike">
                                <form method="POST" action="/like#{{$i}}">
                                    <input type="hidden" name="direction" value="{{$.CurrentPath}}">
                                    <input type="hidden" name="post_id" value="{{.ID}}">
                                    <button type="submit" name="type" value="like" style="display: inline;"
                                        class="like-btn">
                                        <span class="material-icons">thumb_up</span>
                                        <span>66</span>
                                    </button>
                                    <button type="submit" name="type" value="dislike" style="display: inline;"
                                        class="dislike-btn">
                                        <span class="material-icons">thumb_down</span>
                                        <span>2</span>
                                    </button>
                                </form>
                            </div>


                            <div class="comments">
                                <a class="comment-btn" href="/post/{{.ID}}#comment-input" style="text-decoration:none;">
                                    <span class="material-icons">comment</span>
                                    <span> 23 </span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`
}


function chatRender() {
    console.log("rendering the chat")
    maincontent.innerHTML = `<div class="chatarea">
                <div class= "usersList">
                    <ul>
                        <li class="userContact">
                            <span class="contactUsername">@Mo</span>
                            <span class ="contactStatus online">Online</span>
                        </li>
                    </ul>

                </div>
                <div class= "chatspace">
                    <div class ="usercard">
                        <p>Mohamed - active</p>
                        
                    </div>
                    <!-- scrollable -->
                    <div class ="chatsection">
                        <h3 class="from">yo broski</h3>
                        <h3 class="to">How are you man</h3>
                    </div>
                    <div class ="inputbar">
                        <textarea class="entry"></textarea>
                        <button id="sendBtn">Send</button>
                    </div>
                </div>
            </div>`;
}