import { connectState, connectWS, uiFlags } from '../ws.js';

// views/Chat.js
let ws = null;
let allUsers = [];
let allConversations = [];
export const chatState = {
  currentRecipient: null,
  currentConversation: null,
};

export default async function ChatView(params) {
  return `
    <div class="chatarea">
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
  console.log("params that are being used", params)
  uiFlags.chatOpen = true;


  // const usersContainer = document.getElementById("usersContainer");
  const chat = document.getElementById("chatsection");
  const sendBtn = document.getElementById("sendBtn");
  const entry = document.getElementById("entry");
  // const search = document.getElementById("userSearch");

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

  // function notifyUser(userId) {
  //   const li = usersContainer.querySelector(
  //     `.userContact[data-userid='${userId}']`
  //   );
  //   if (!li) return;
  //   li.classList.add("notify");
  // }

  //load the conversations that are available
  async function loadConversations() {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error("Failed to fetch conversations");

      allConversations = await res.json();
      // renderConversations(allConversations);

      // If user clicked from global list, auto-open chat with them
      if (uiFlags.targetUser) {
        const { id, username } = uiFlags.targetUser;
        uiFlags.targetUser = null;
        selectRecipient(id, username);
      }
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
  // function renderConversations(convs) {
  //   usersContainer.innerHTML = "";

  //   convs.forEach(c => {
  //     const li = document.createElement("li");
  //     li.className = "userContact";
  //     li.dataset.conversationid = c.id;
  //     li.dataset.userid = c.user_id;

  //     li.innerHTML = `
  //       <span class="contactUsername">${c.username}</span>
  //       <span class="contactStatus online">●</span>
  //     `;

  //     li.addEventListener("click", () => {
  //       selectConversation(c.id, c.user_id, c.username);
  //     });

  //     usersContainer.appendChild(li);
  //   });
  // }

  // function renderUsers(users) {
  //   usersContainer.innerHTML = "";

  //   users.forEach(u => {
  //     const li = document.createElement("li");
  //     li.className = "userContact";
  //     li.dataset.userid = u.id;

  //     li.innerHTML = `
  //       <span class="contactUsername">${u.username}</span>
  //       <span class="contactStatus online">●</span>
  //     `;

  //     li.addEventListener("click", () => {
  //       selectRecipient(u.id, u.username);
  //     });

  //     usersContainer.appendChild(li);
  //   });
  // }

  // =======================
  // SELECT FUNCTIONS
  // =======================
  async function selectRecipient(id, name) {
    try {
      // Create or get existing conversation
      const res = await fetch("/api/start-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: id }),
        credentials: "include",
      });

      const data = await res.json();
      selectConversation(data.conversation_id, id, name);
      loadConversations();
    } catch (err) {
      console.error("Start chat error:", err);
    }
  }

  //select conversation. means you load messages for a specific conversation id
  function selectConversation(convId, userId, name) {
    uiFlags.activeConversationId = String(convId);
    messageOffset = 0; // Reset offset for new conversation

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
    // const notifyLi = usersContainer.querySelector(
    //   `.userContact[data-userid='${userId}']`
    // );
    // if (notifyLi) notifyLi.classList.remove("notify");

    const header = document.querySelector(".usercard p");
    if (header) header.textContent = `${name}`;

    chat.innerHTML = "";
    loadMessages(convId);

    console.log("Conversation selected:", chatState.currentConversation, chatState.currentRecipient);
  }

  // =======================
  // MESSAGES
  // =======================
  let messageOffset = 0;
  let isLoadingMessages = false;
  const MESSAGES_PER_PAGE = 10;

  // Debounce helper
  function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }

  // load the messages assuming you have the covnersation id
  async function loadMessages(convId, offset = 0, append = false) {
    if (isLoadingMessages) return;
    isLoadingMessages = true;

    try {
      const res = await fetch(
        `/api/messages?conversation_id=${convId}&offset=${offset}&limit=${MESSAGES_PER_PAGE}`
      );
      if (!res.ok) throw new Error("Failed to load messages");

      const messages = await res.json();
      console.log("messages:", messages);

      // Handle null or undefined response
      if (!messages || !Array.isArray(messages)) {
        messages = [];
      }

      if (messages.length === 0) {
        isLoadingMessages = false;
        return;
      }

      if (append) {
        // Prepend older messages to the top
        // Messages come in DESC order, reverse to get ASC (oldest first)
        const fragment = document.createDocumentFragment();
        messages.reverse().forEach(msg => {
          const direction = Number(msg.sender_id) === Number(chatState.currentRecipient) ? "from" : "to";
          const bubble = createMessageElement(msg.content, direction, msg.timestamp || msg.created_at);
          fragment.appendChild(bubble);
        });
        const firstChild = chat.firstChild;
        if (firstChild) {
          chat.insertBefore(fragment, firstChild);
        } else {
          chat.appendChild(fragment);
        }
      } else {
        // Initial load - reverse DESC to ASC (oldest to newest)
        chat.innerHTML = "";
        messages.reverse().forEach(msg => {
          const direction = Number(msg.sender_id) === Number(chatState.currentRecipient) ? "from" : "to";
          const bubble = createMessageElement(msg.content, direction, msg.timestamp || msg.created_at);
          chat.appendChild(bubble);
        });
        chat.scrollTop = chat.scrollHeight;
      }

      messageOffset += messages.length;
    } catch (err) {
      console.error("Load messages error:", err);
    } finally {
      isLoadingMessages = false;
    }
  }

  // Debounced scroll handler for loading older messages
  const handleChatScroll = debounce(() => {
    // If scrolled to top, load older messages
    if (chat.scrollTop === 0 && messageOffset > 0) {
      console.log("Loading older messages...");
      loadMessages(chatState.currentConversation, messageOffset, true);
    }
  }, 300);

  chat.addEventListener("scroll", handleChatScroll);

  // =======================
  // SEARCH
  // =======================
  // search.addEventListener("input", e => {
  //   const value = e.target.value.toLowerCase();

  //   if (!value) {
  //     renderConversations(allConversations);
  //     return;
  //   }

  //   const filtered = allUsers.filter(u =>
  //     u.username.toLowerCase().includes(value)
  //   );

  //   renderUsers(filtered);
  // });

  // =======================
  // WEBSOCKET
  // =======================
  // const proto = window.location.protocol === "https:" ? "wss" : "ws";
  // const url = `${proto}://${window.location.host}/ws/chat`;

  ws = connectWS();


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

  if (params && params.uid) {
    // Wait for users to load, then select the target user
    setTimeout(() => {
      const user = allUsers.find(x => x.id == params.uid);
      console.log("Target user from params:", user);
      console.log(params.uid)
      if (user) {
        selectRecipient(user.id, user.username);
      }
    }, 500);
  }

  // =======================
  // CLEANUP
  // =======================
  return () => {
    uiFlags.chatOpen = false;
    uiFlags.activeConversationId = null;
    uiFlags.targetUser = null;
    sendBtn.removeEventListener("click", onSend);
    chat.removeEventListener("scroll", handleChatScroll);
    // if (ws) {
    //   ws.close(1000, "leaving chat");
    //   ws = null;
    // }
  };
}
