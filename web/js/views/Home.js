
export default async function HomeView() {
  let posts = [];
  try {
    const res = await fetch("/api/posts");
    if (res.ok) posts = await res.json();
  } catch (e) {
    posts = [];
  }

  if (!posts || posts.length === 0) {
    return `<div class="home"><p>No posts yet.</p></div>`;
  }

  return `
    <div class="home">
      ${posts
        .map(
          (p) => `
        <div class="block3" id="post-${p.id}">
          <div class="frame">
            <div class="username">
              <h3>@${escapeHtml(p.author)} <span class="post-date"> • ${formatDate(
                p.created_at
              )}</span></h3>
            </div>

            <a href="/thread?post=${p.id}" style="text-decoration:none; color:black;">
              <h3>${escapeHtml(p.title)}</h3>
            </a>

            <div class="content">
              <p>${escapeHtml(truncate(p.content || "", 300))}</p>
            </div>

            <div class="post-meta">
              <div class="category-flairs">
                <span>General</span>
              </div>

              <div class="post-engagement">
                <div class="post-like-dislike">
                  <button class="like-btn" data-post="${p.id}">
                    <span class="material-icons">thumb_up</span>
                    <span>Like</span>
                  </button>
                  <button class="dislike-btn" data-post="${p.id}">
                    <span class="material-icons">thumb_down</span>
                    <span>Dislike</span>
                  </button>
                </div>

                <div class="comments">
                  <a class="comment-btn" href="/thread?post=${p.id}" style="text-decoration:none;">
                    <span class="material-icons">comment</span>
                    <span> Comments</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
function formatDate(t) {
  try {
    const d = new Date(t);
    return isNaN(d) ? "" : d.toLocaleDateString();
  } catch {
    return "";
  }
}