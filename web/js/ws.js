let ws = null;
//add reconnectors later

function renderOnlineUsers(users) {
  const container = document.getElementById("aa");
  if (!container) {
    console.warn("[ws] globalOnlineUsers element not found");
    return;
  }

  if (!users || users.length === 0) {
    container.innerHTML = "<p>No users online</p>";
    return;
  }

  const usersList = users.map(userID => `<li>User ${userID}</li>`).join("");
  container.innerHTML = `
      <h3>Online Users (${users.length})</h3>
      <li class="usersContact">
        ${usersList}
      </ul>
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
      if (data.type === "online_users") {
        console.log("[ws] online users update:", data.online_users);
        renderOnlineUsers(data.online_users);
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