// views/Chat.js
let ws = null;
let allUsers = [];
let currentRecipient = null;

export default async function ChatView() {
  return `
    <div class="chatarea">
      <div class="usersList">
        <input 
          type="text" 
          id="userSearch" 
          placeholder="Search users..." 
          class="userSearch"
        />
        <ul id="usersContainer"></ul>
      </div>

      <div class="chatspace">
        <div class="usercard">
          <p>Select a user</p>
        </div>

        <div class="chatsection" id="chatsection"></div>

        <div class="inputbar">
          <textarea class="entry" id="entry"></textarea>
          <button id="sendBtn">Send</button>
        </div>
      </div>
    </div>
  `;
}

export function mount(params) {
  const { conversationId } = params || {};

  const usersContainer = document.getElementById("usersContainer");
  const chat = document.getElementById("chatsection");
  const sendBtn = document.getElementById("sendBtn");
  const entry = document.getElementById("entry");
  const search = document.getElementById("userSearch");

  // =======================
  // USERS SIDEBAR
  // =======================

  async function loadUsers() {
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");

      allUsers = await res.json();
      renderUsers(allUsers);
    } catch (err) {
      console.error("Load users error:", err);
    }
  }

  function renderUsers(users) {
    usersContainer.innerHTML = "";

    users.forEach(u => {
      const li = document.createElement("li");
      li.className = "userContact";
      li.dataset.userid = u.id;

      li.innerHTML = `
        <span class="contactUsername">${u.username}</span>
        <span class="contactStatus online">●</span>
      `;

      li.addEventListener("click", () => {
        selectRecipient(u.id, u.username);
      });

      usersContainer.appendChild(li);
    });
  }

function selectRecipient(id, name) {
  currentRecipient = String(id); // fine for UI

  document.querySelectorAll(".userContact").forEach(li => li.classList.remove("active"));
  const selectedLi = document.querySelector(`.userContact[data-userid='${id}']`);
  if (selectedLi) selectedLi.classList.add("active");

  const header = document.querySelector(".usercard p");
  if (header) header.textContent = `${name} - active`;

  chat.innerHTML = "";
  console.log("Recipient set:", currentRecipient);
}


  search.addEventListener("input", e => {
    const value = e.target.value.toLowerCase();
    const filtered = allUsers.filter(u =>
      u.username.toLowerCase().includes(value)
    );
    renderUsers(filtered);
  });

  // =======================
  // WEBSOCKET
  // =======================

  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const url = `${proto}://${window.location.host}/ws/chat${conversationId ? `?conversation_id=${conversationId}` : ""}`;

  console.log("[Chat] Connecting:", url);
  ws = new WebSocket(url);

  ws.onopen = () => console.log("WS connected");
  ws.onclose = () => console.log("WS closed");
  ws.onerror = e => console.error("WS error:", e);

  ws.onmessage = event => {
    try {
      const msg = JSON.parse(event.data);
      console.log("WS message:", msg);

      if (msg.type === "message") {
        const h = document.createElement("h3");
        h.className = msg.sender_id === currentRecipient ? "to" : "from";
        h.textContent = `${msg.sender_id}: ${msg.content}`;
        chat.appendChild(h);
        chat.scrollTop = chat.scrollHeight;
      }
    } catch (e) {
      console.error("Parse error:", e);
    }
  };

  // =======================
  // SEND MESSAGE
  // =======================

  const onSend = () => {
    const text = entry.value.trim();
    if (!text) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!currentRecipient) return alert("Select a user first");

    const message = {
      type: "message",
      conversation_id: conversationId || 1,
      recipient_id: Number(currentRecipient),
      content: text,
      temp_id: Date.now().toString()
    };

    ws.send(JSON.stringify(message));
    entry.value = "";
  };

  sendBtn.addEventListener("click", onSend);

  loadUsers();

  // =======================
  // CLEANUP
  // =======================

  return () => {
    sendBtn.removeEventListener("click", onSend);
    if (ws) {
      ws.close(1000, "leaving chat");
      ws = null;
    }
  };
}
