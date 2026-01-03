export default async function ThreadView() {
    const params = new URLSearchParams(location.search);
    const postId = params.get("post");

    if (!postId) {
        return `<div class="home"><p>Missing post id.</p></div>`;
    }

    let post = null;
    let comments = [];

    try {
        const res = await fetch(`/api/comments?post=${encodeURIComponent(postId)}`);
        if (res.ok) {
            const data = await res.json();
            // endpoint returns { post: {...}, comments: [...] }
            post = data.post || null;
            comments = data.comments || [];
        }
    } catch {
        post = null;
        comments = [];
    }

    function escapeHtml(str) {
        if (!str) return "";
        return String(str).replace(/[&<>'\"]/g, (m) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[m]));
    }

    function formatDate(t) {
        if (!t) return "";
        try {
            const d = new Date(t);
            return isNaN(d) ? "" : d.toLocaleString();
        } catch {
            return "";
        }
    }

    const commentsHtml = comments.length > 0
        ? comments.map(c => `
            <div class="comment-block">
                <div class="comment-user">
                    <div class="username">
                        <h2>${escapeHtml(c.author)}</h2>
                        <span class="comment-date">${formatDate(c.created_at)}</span>
                    </div>
                </div>
                <div class="content1">
                    <pre>${escapeHtml(c.content)}</pre>
                </div>
            </div>
        `).join("")
        : `<p class="no-comments">No comments yet. Be the first to comment!</p>`;

    const postTitle = post ? escapeHtml(post.title) : "Post not found";
    const postAuthor = post ? `@${escapeHtml(post.author)}` : "@unknown";
    const postContent = post ? escapeHtml(post.content || "") : "";
    const postDate = post ? formatDate(post.created_at) : "";
    

    return `
        <!-- POST (always visible) -->
        <div class="focus-post">
            <h2>${postAuthor}</h2>

            <div class="frame">
                <h3>${postTitle}</h3>
                <div class="content">
                    <pre>${postContent}</pre>
                </div>
                <div class="post-meta">
                    <span class="post-date">${postDate}</span>
                </div>
            </div>
        </div>

        <!-- COMMENT FORM (always visible) -->
        <div class="comment-input-container">
            <div class="comment-user">
                <div class="username">
                    <h2>@you</h2>
                </div>
            </div>

            <form class="comment-input-section">
                <input type="hidden" name="post_id" value="${escapeHtml(postId)}">
                <textarea
                    name="content"
                    placeholder="Write your comment..."
                    required
                ></textarea>
                <button class="post-comment-btn">Post Comment</button>
            </form>
        </div>

        <!-- COMMENT COUNT (always visible) -->
        <div class="comment-count">
            <span>${comments.length} Comments</span>
        </div>

        <!-- COMMENTS LIST (content changes) -->
        <div id="comments-list">
            ${commentsHtml}
        </div>
    `;
}
