import { chatState } from './views/Chat.js'

export const connectState = {
  allUsers: null,
  onlineUsers: null,
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
//add reconnectors later

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


async function renderOnlineUsers(onlineUserIds) {
  console.log("rendering online users")
  // Refetch if null or if 30 seconds have passed since last fetch
  if (connectState.allUsers == null || Date.now() - lastUsersFetchTime > USER_FETCH_INTERVAL) {
    await extractUsers();
  }

  const container = document.getElementById("globalOnlineUsers");
  const count = document.getElementById("onlineCount");
  if (!container) {
    console.warn("[ws] globalOnlineUsers element not found");
    return;
  }

  // Separate users into online and offline arrays
  const onlineUsers = [];
  const offlineUsers = [];
  console.log(onlineUsers, "onlineUsers")
  console.log(offlineUsers, "offlineUsers")
  connectState.allUsers.forEach(user => {
    if (onlineUserIds.includes(user.id)) {
      onlineUsers.push(user);
    } else {
      offlineUsers.push(user);
    }
  });

  if (onlineUserIds.length === 0) {
    container.innerHTML = "<p>No users online</p>";
    return;
  }

  const heading1 = document.createElement("h3");
  const heading2 = document.createElement("h3");
  heading1.id = "headingma";
  heading2.id = "headingma";
  heading1.textContent = "Online";
  heading2.textContent = "Offline";

  //online users----------------------------
  container.innerHTML = "";
  container.appendChild(heading1);

  onlineUsers.forEach(u => {
    const li = document.createElement("li");
    li.className = "userContact";
    li.dataset.userid = u.id;

    li.innerHTML = `
        <span class="contactUsername">${u.username}</span>
        <span class="contactStatus online">●</span>
      `;

    li.addEventListener("click", async () => {
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

  //offline users------------------------------------------------------------
  container.appendChild(heading2);

  offlineUsers.forEach(u => {
    const li = document.createElement("li");
    li.className = "userContact";
    li.dataset.userid = u.id;

    li.innerHTML = `
        <span class="contactUsername">${u.username}</span>
        <span class="contactStatus offline">●</span>
      `;

    li.addEventListener("click", async () => {
      uiFlags.targetUser = { id: u.id, username: u.username };
      try {
        const { navigateTo } = await import("./router.js");
        await navigateTo("/chat");
      } catch (err) {
        console.error("Failed to navigate to chat:", err);
        window.location.href = "/chat";
      }
    });

    container.appendChild(li);
  });

  count.innerHTML = `
    Online Users (${onlineUsers.length})
  `;
}

export function connectWS() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    console.log("[ws] already connected/connecting");
    return ws;
  }

  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws/chat`);

  // Attach listeners RIGHT AWAY (before anything can happen)
  ws.addEventListener("open", () => console.log("[ws] open"));
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
            const bubble = createMessageElement(data.content, direction, data.timestamp || data.created_at);
            chatEl.appendChild(bubble);
            chatEl.scrollTop = chatEl.scrollHeight;
          } else {
            const senderName = lookupUsername(senderId) || "Someone";
            showChatToast(`${senderName} sent you a message. Open chat to view.`);
          }
          break;
      }

    } catch (err) {
      console.error("[ws] failed to parse message:", err);
    }
  });
  ws.addEventListener("close", (e) => console.log("[ws] close", e.code, e.reason));
  ws.addEventListener("error", (e) => console.log("[ws] error", e));

  return ws;
}

export function getWS() {
  return ws;
}


export function closeWS(reason = "logout") {
  if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
    ws.close(1000, reason);
  }
  ws = null;
}

//redundant type shi but letts keep it here for now----------------------------------------
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

function formatTimestamp(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return isNaN(d) ? ts : d.toLocaleString();
}