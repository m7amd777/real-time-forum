import { connectState } from '../ws.js';

// views/Chat.js
let ws = null;
let allUsers = [];
let allConversations = [];
const chatState = {
  currentRecipient: null,
  currentConversation: null,
};

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

  function notifyUser(userId) {
    const li = usersContainer.querySelector(
      `.userContact[data-userid='${userId}']`
    );
    if (!li) return;
    li.classList.add("notify");
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

  function formatTimestamp(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return isNaN(d) ? ts : d.toLocaleString();
  }

  function createMessageElement(content, direction, timestamp) {
    const div = document.createElement("div");
    div.classList.add("message", direction);

    const text = document.createElement("div");
    text.className = "message-text";
    text.textContent = content;

    const time = document.createElement("div");
    time.className = "message-time";
    time.textContent = formatTimestamp(timestamp);

    div.appendChild(text);
    div.appendChild(time);
    return div;
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
    chatState.currentConversation = convId;
    chatState.currentRecipient = String(userId);

    document.querySelectorAll(".userContact").forEach(li =>
      li.classList.remove("active")
    );

    const selectedLi = document.querySelector(
      `.userContact[data-conversationid='${convId}']`
    );
    if (selectedLi) selectedLi.classList.add("active");

    // clear notification badge for this user
    const notifyLi = usersContainer.querySelector(
      `.userContact[data-userid='${userId}']`
    );
    if (notifyLi) notifyLi.classList.remove("notify");

    const header = document.querySelector(".usercard p");
    if (header) header.textContent = `${name}`;

    chat.innerHTML = "";
    loadMessages(convId);

    console.log("Conversation selected:", chatState.currentConversation, chatState.currentRecipient);
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
        const direction = Number(msg.sender_id) === Number(chatState.currentRecipient) ? "from" : "to";
        const bubble = createMessageElement(msg.content, direction, msg.timestamp || msg.created_at);
        chat.appendChild(bubble);
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
        const senderId = String(msg.sender_id);
        const isActive = chatState.currentRecipient && senderId === chatState.currentRecipient;

        if (isActive) {
          const direction = Number(msg.sender_id) === Number(chatState.currentRecipient) ? "from" : "to";
          const bubble = createMessageElement(msg.content, direction, msg.timestamp || msg.created_at);
          chat.appendChild(bubble);
          chat.scrollTop = chat.scrollHeight;
        } else {
          notifyUser(senderId);
        }
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
    if (!chatState.currentRecipient) return alert("Select a user first");

    const message = {
      type: "message",
      conversation_id: chatState.currentConversation,
      recipient_id: Number(chatState.currentRecipient),
      content: text,
      temp_id: Date.now().toString()
    };

    ws.send(JSON.stringify(message));
    entry.value = "";

    // locally add bubble immediately
    const bubble = createMessageElement(text, "to", new Date().toISOString());
    chat.appendChild(bubble);
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
