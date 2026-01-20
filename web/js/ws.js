
export const connectState = {
  allUsers: null,
  onlineUsers: null,
}
let ws = null;
let allUsers = null;
let lastUsersFetchTime = 0;
const USER_FETCH_INTERVAL = 30000; // 30 seconds
//add reconnectors later

async function extractUsers() {
  const res = await fetch("api/users", {
    credentials: "include"
  })

  if (!res.ok) return false;
  const users = await res.json();
  connectState.allUsers = users;
  lastUsersFetchTime = Date.now();
}



async function renderOnlineUsers(onlineUserIds) {

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

  // Render online users
  const onlineUsersList = onlineUsers.map(user => `
        <li class="userContact">
        <span class="contactUsername">${user.username}</span>
        <span class="contactStatus online">●</span>
        </li>
      `).join("");

  // Render offline users
  const offlineUsersList = offlineUsers.map(user => `
        <li class="userContact">
        <span class="contactUsername">${user.username}</span>
        <span class="contactStatus offline">●</span>
        </li>
      `).join("");

  container.innerHTML = `
        <h3 id="headingma">Online</h3>
        <ul id = "globalOnlineUsers">${onlineUsersList}</ul>
        <h3 id="headingma">Offline</h3>
        <ul id = "globalOnlineUsers">${offlineUsersList}</ul>
  `;

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

      // Handle online_users broadcast

      switch (data.type) {
        case "online_users":
          console.log("[ws] online users update:", data.online_users);
          connectState.onlineUsers = data.online_users;
          renderOnlineUsers(data.online_users);
          break
        case "this is just a test":
          const chat = document.getElementById("chatsection")
          if (chat != null) {
            const div = document.createElement("div");
            div.classList.add("message");
            div.classList.add(Number(msg.sender_id) === Number(currentRecipient) ? "from" : "to");
            div.textContent = msg.content;
            chat.appendChild(div);
            chat.scrollTop = chat.scrollHeight;
          } else {

          }
          break
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