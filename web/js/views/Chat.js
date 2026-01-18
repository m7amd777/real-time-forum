// views/Chat.js
let ws = null;
let allUsers = [];
let allConversations = [];
let currentRecipient = null;
let currentConversation = null;

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
  const usersContainer = document.getElementById("usersContainer");
  const chat = document.getElementById("chatsection");
  const sendBtn = document.getElementById("sendBtn");
  const entry = document.getElementById("entry");
  const search = document.getElementById("userSearch");

  // =======================
  // LOAD DATA
  // =======================
  async function loadUsers() {
    try {
      const res = await fetch("/api/users");
      allUsers = await res.json();
    } catch (err) {
      console.error("Load users error:", err);
    }
  }

  async function loadConversations() {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error("Failed to fetch conversations");

      allConversations = await res.json();
      renderConversations(allConversations);
    } catch (err) {
      console.error("Load conversations error:", err);
    }
  }

  // =======================
  // RENDER FUNCTIONS
  // =======================
  function renderConversations(convs) {
    usersContainer.innerHTML = "";

    convs.forEach(c => {
      const li = document.createElement("li");
      li.className = "userContact";
      li.dataset.conversationid = c.id;
      li.dataset.userid = c.user_id;

      li.innerHTML = `
        <span class="contactUsername">${c.username}</span>
        <span class="contactStatus online">●</span>
      `;

      li.addEventListener("click", () => {
        selectConversation(c.id, c.user_id, c.username);
      });

      usersContainer.appendChild(li);
    });
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

  // =======================
  // SELECT FUNCTIONS
  // =======================
  async function selectRecipient(id, name) {
    try {
      // Create or get existing conversation
      const res = await fetch("/api/start-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: id })
      });

      const data = await res.json();
      selectConversation(data.conversation_id, id, name);
      loadConversations();
    } catch (err) {
      console.error("Start chat error:", err);
    }
  }

  function selectConversation(convId, userId, name) {
    currentConversation = convId;
    currentRecipient = String(userId);

    document.querySelectorAll(".userContact").forEach(li =>
      li.classList.remove("active")
    );

    const selectedLi = document.querySelector(
      `.userContact[data-conversationid='${convId}']`
    );
    if (selectedLi) selectedLi.classList.add("active");

    const header = document.querySelector(".usercard p");
    if (header) header.textContent = `${name} - active`;

    chat.innerHTML = "";
    loadMessages(convId);

    console.log("Conversation selected:", currentConversation, currentRecipient);
  }

  // =======================
  // MESSAGES
  // =======================
  async function loadMessages(convId) {
    try {
      const res = await fetch(`/api/messages?conversation_id=${convId}`);
      if (!res.ok) throw new Error("Failed to load messages");


      const messages = await res.json();
      console.log("messages")
      console.log(messages)

      messages.forEach(msg => {
        const div = document.createElement("div");
        div.classList.add("message");
        div.classList.add(Number(msg.sender_id) === Number(currentRecipient) ? "from" : "to");
        div.textContent = msg.content;
        chat.appendChild(div);
      });


      chat.scrollTop = chat.scrollHeight;
    } catch (err) {
      console.error("Load messages error:", err);
    }
  }

  // =======================
  // SEARCH
  // =======================
  search.addEventListener("input", e => {
    const value = e.target.value.toLowerCase();

    if (!value) {
      renderConversations(allConversations);
      return;
    }

    const filtered = allUsers.filter(u =>
      u.username.toLowerCase().includes(value)
    );

    renderUsers(filtered);
  });

  // =======================
  // WEBSOCKET
  // =======================
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const url = `${proto}://${window.location.host}/ws/chat`;

  ws = new WebSocket(url);

  ws.onopen = () => console.log("WS connected");
  ws.onclose = () => console.log("WS closed");
  ws.onerror = e => console.error("WS error:", e);

  ws.onmessage = event => {
    try {
      const msg = JSON.parse(event.data);

      if (msg.type === "message") {
        const div = document.createElement("div");
        div.classList.add("message");
        div.classList.add(Number(msg.sender_id) === Number(currentRecipient) ? "from" : "to");
        div.textContent = msg.content;
        chat.appendChild(div);
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
      conversation_id: currentConversation,
      recipient_id: Number(currentRecipient),
      content: text,
      temp_id: Date.now().toString()
    };

    ws.send(JSON.stringify(message));
    entry.value = "";

    // locally add bubble immediately
    const div = document.createElement("div");
    div.classList.add("message", "to");
    div.textContent = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  };

  sendBtn.addEventListener("click", onSend);

  // =======================
  // INIT
  // =======================
  loadUsers();
  loadConversations();

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
