
export const connectState = {
  allUsers: null,
  onlineUsers: null,
}

export const uiFlags = {
  chatOpen: false,
  activeConversationId: null,
};


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

    li.addEventListener("click", () => {
      // selectRecipient(u.id, u.username);
      console.log("online user is clicked, next time i should navigate")
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

    li.addEventListener("click", () => {
      // selectRecipient(u.id, u.username);
      console.log("offline user is clicked, next time i should navigate")
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

          if (canRenderInChat) {
            // quick bubble (keep it simple)
            const div = document.createElement("div");
            div.classList.add("message", "from");
            div.textContent = data.content;
            chatEl.appendChild(div);
            chatEl.scrollTop = chatEl.scrollHeight;
          } else {
            // ping in global list (or conversation list)
            const li = document.querySelector(
              `.userContact[data-userid='${senderId}']`
            );
            console.log("li found", li)
            if (li) li.classList.add("notify");
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