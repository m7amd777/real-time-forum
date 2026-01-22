import { chatState } from './views/Chat.js'

export const connectState = {
  allUsers: null,
  onlineUsers: null,
  allConversations: null,
  currentUserId: null,
  currentUsername: null,
}

export const uiFlags = {
  chatOpen: false,
  activeConversationId: null,
  targetUser: null,
};


let ws = null;
let allUsers = null;
let lastUsersFetchTime = 0;
const USER_FETCH_INTERVAL = 30000; // 30 seconds
const TOAST_DURATION_MS = 4000;
const TOAST_CONTAINER_ID = "chat-toast-container";

// Reconnection state
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000; // 1 second
let reconnectTimeout = null;

function ensureToastContainer() {
  let container = document.getElementById(TOAST_CONTAINER_ID);
  if (container) return container;

  container = document.createElement("div");
  container.id = TOAST_CONTAINER_ID;
  container.className = "chat-toast-container";
  document.body.appendChild(container);
  return container;
}

function showChatToast(text) {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = "chat-toast";
  toast.textContent = text;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add("visible");
  });

  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 180);
  }, TOAST_DURATION_MS);
}

function lookupUsername(userId) {
  if (!connectState.allUsers) return null;
  const user = connectState.allUsers.find(u => String(u.id) === String(userId));
  return user ? user.username : null;
}

async function extractMe() {
  try {
    const res = await fetch("/api/me", { credentials: "include" });
    if (!res.ok) return;
    const me = await res.json();
    connectState.currentUserId = me.id;
    connectState.currentUsername = me.username;
  } catch (err) {
    console.error("Failed to fetch current user:", err);
  }
}

async function extractUsers() {
  const res = await fetch("/api/users", {
    credentials: "include"
  })
  console.log("extracting users")

  if (!res.ok) return false;
  const users = await res.json();
  connectState.allUsers = users;
  console.log(users)
  lastUsersFetchTime = Date.now();
}

async function extractConversations() {
  try {
    const res = await fetch("/api/conversations", {
      credentials: "include"
    });
    if (!res.ok) return [];
    connectState.allConversations = await res.json();
    return connectState.allConversations;
  } catch (err) {
    console.error("Failed to fetch conversations:", err);
    return [];
  }
}

async function renderOnlineUsers(onlineUserIds) {
  console.log("rendering online users")
  // Refetch if null or if 30 seconds have passed since last fetch
  if (connectState.allUsers == null || Date.now() - lastUsersFetchTime > USER_FETCH_INTERVAL) {
    await extractUsers();
  }

  // Always fetch conversations for ordering
  await extractConversations();

  // Ensure we know the current user to filter self out
  if (!connectState.currentUserId) {
    await extractMe();
  }

  const container = document.getElementById("globalOnlineUsers");
  const count = document.getElementById("onlineCount");
  if (!container) {
    console.warn("[ws] globalOnlineUsers element not found");
    return;
  }

  // Create a map of user_id -> conversation (for users with conversations)
  const conversationMap = new Map();
  console.log(connectState.allConversations)
  if (connectState.allConversations) {
    connectState.allConversations.forEach(conv => {
      conversationMap.set(conv.user_id, conv);
    });
  }


  // Separate users into three categories
  const usersWithConversations = [];
  const usersWithoutConversations = [];

  connectState.allUsers.forEach(user => {
    // Skip current user from the online users list
    if (connectState.currentUserId && Number(user.id) === Number(connectState.currentUserId)) {
      return;
    }
    if (conversationMap.has(user.id)) {
      usersWithConversations.push({
        ...user,
        conversation: conversationMap.get(user.id)
      });
    } else {
      usersWithoutConversations.push(user);
    }
  });

  // Sort users with conversations by updated_at (already ordered from backend, but ensure)
  usersWithConversations.sort((a, b) => {
    const timeA = new Date(a.conversation.updated_at || 0);
    const timeB = new Date(b.conversation.updated_at || 0);
    return timeB - timeA; // DESC (most recent first)
  });

  // Sort users without conversations alphabetically
  usersWithoutConversations.sort((a, b) =>
    a.username.localeCompare(b.username)
  );

  // Combine: conversations first, then alphabetical
  const sortedUsers = [...usersWithConversations, ...usersWithoutConversations];

  // Render
  container.innerHTML = "";

  sortedUsers.forEach(u => {
    const isOnline = onlineUserIds.includes(u.id);
    const li = document.createElement("li");
    li.className = "userContact";
    li.dataset.userid = u.id;

    li.innerHTML = `
        <span class="contactUsername">${u.username}</span>
        <span class="contactStatus ${isOnline ? 'online' : 'offline'}">●</span>
      `;

    li.addEventListener("click", async () => {
      // Prevent clicking on offline users
      if (!isOnline) {
        showChatToast(`${u.username} is offline`);
        return;
      }
      // Prevent clicking on offline users
      if (!isOnline) {
        showChatToast(`${u.username} is offline`);
        return;
      }
      // Prevent clicking on yourself
      if (connectState.currentUserId && Number(u.id) === Number(connectState.currentUserId)) {
        showChatToast(`You cannot chat with yourself`);
        return;
      }
      uiFlags.targetUser = { id: u.id, username: u.username };
      try {
        uiFlags.activeConversationId = u.id;
        const { navigateTo } = await import("./router.js");
        await navigateTo(`/chat/${u.id}`);
      } catch (err) {
        console.error("Failed to navigate to chat:", err);
        window.location.href = "/chat";
      }
    });

    container.appendChild(li);
  });

  const onlineCount = sortedUsers.filter(u => onlineUserIds.includes(u.id)).length;
  count.innerHTML = `Online Users (${onlineCount})`;
}

export function connectWS() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    console.log("[ws] already connected/connecting");
    return ws;
  }

  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws/chat`);

  // Attach listeners RIGHT AWAY (before anything can happen)
  ws.addEventListener("open", () => {
    console.log("[ws] open");
    reconnectAttempts = 0; // Reset on successful connection
  });

  ws.addEventListener("message", (e) => {
    console.log("[ws] message", e.data);

    try {
      const data = JSON.parse(e.data);
      console.log("data", data)

      // Handle online_users broadcast

      switch (data.type) {
        case "online_users":
          console.log("[ws] online users update:", data.online_users);
          connectState.onlineUsers = data.online_users;
          renderOnlineUsers(data.online_users);
          break
        case "message":
          const chatEl = document.getElementById("chatsection");

          const convId = String(data.conversation_id);
          const senderId = String(data.sender_id);

          const canRenderInChat =
            uiFlags.chatOpen &&
            chatEl &&
            uiFlags.activeConversationId === convId;
          console.log("canrender in chat", canRenderInChat)
          console.log("ui flag is open", uiFlags.chatOpen)
          console.log("chatelement exists in chat", chatEl)
          console.log("conversationid matching", uiFlags.activeConversationId === convId)
          console.log("convid", convId)
          console.log("active convid", uiFlags.activeConversationId)

          if (canRenderInChat) {
            const direction = Number(data.sender_id) === Number(chatState.currentRecipient) ? "from" : "to";
            const username = lookupUsername(senderId) || "Unknown";
            const bubble = createMessageElement(data.content, direction, data.timestamp || data.created_at, username);
            chatEl.appendChild(bubble);
            chatEl.scrollTop = chatEl.scrollHeight;
          } else {
            const senderName = lookupUsername(senderId) || "Someone";
            showChatToast(`${senderName} sent you a message. Open chat to view.`);
          }

          // Re-render user list to move this conversation to top
          if (connectState.onlineUsers) {
            renderOnlineUsers(connectState.onlineUsers);
          }
          break;
      }

    } catch (err) {
      console.error("[ws] failed to parse message:", err);
    }
  });

  ws.addEventListener("close", (e) => {
    console.log("[ws] close", e.code, e.reason);
    ws = null;

    // Attempt to reconnect with exponential backoff
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts);
      console.log(`[ws] attempting reconnection (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms`);
      showChatToast("Connection lost. Reconnecting...");

      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(() => {
        reconnectAttempts++;
        connectWS();
      }, delay);
    } else {
      console.error("[ws] max reconnection attempts reached");
      showChatToast("Failed to reconnect. Please refresh the page.");
    }
  });

  ws.addEventListener("error", (e) => {
    console.log("[ws] error", e);
    showChatToast("Connection error. Attempting to reconnect...");
  });

  return ws;
}

export function getWS() {
  return ws;
}


export function closeWS(reason = "logout") {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    ws.close(1000, reason);
  }
  ws = null;
  reconnectAttempts = 0;
}

//redundant type shi but letts keep it here for now----------------------------------------
function createMessageElement(content, direction, timestamp, username) {
  const div = document.createElement("div");
  div.classList.add("message", direction);

  const text = document.createElement("div");
  text.className = "message-text";
  text.textContent = content;

  const time = document.createElement("div");
  time.className = "message-time";
  time.textContent = formatTimestamp(timestamp);

  const name = document.createElement("div");
  name.className = "namehandler";
  if (direction === "from") {
    name.textContent = username || "Unknown";
  } else {
    name.textContent = "You";
  }

  div.appendChild(name)
  div.appendChild(text);
  div.appendChild(time);
  return div;
}

function formatTimestamp(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return isNaN(d) ? ts : d.toLocaleString();
}