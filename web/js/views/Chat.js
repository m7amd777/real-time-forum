// views/Chat.js
let ws = null;

export default async function ChatView() {
  return `
    <div class="chatarea">
      ...
      <div class="chatsection" id="chatsection"></div>
      <div class="inputbar">
        <textarea class="entry" id="entry"></textarea>
        <button id="sendBtn">Send</button>
      </div>
    </div>
  `;
}

export function mount(params) {
  const { conversationId } = params || {}; // if you add /chat/:conversationId later

  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const url = `${proto}://${window.location.host}/ws${conversationId ? `?conversation_id=${conversationId}` : ""}`;

  ws = new WebSocket(url);

  ws.onopen = () => console.log("WS connected");
  ws.onclose = () => console.log("WS closed");
  ws.onerror = (e) => console.log("WS error", e);

  ws.onmessage = (event) => {
    const chat = document.getElementById("chatsection");
    if (!chat) return;

    const h = document.createElement("h3");
    h.className = "from";
    h.textContent = event.data;
    chat.appendChild(h);
  };

  const sendBtn = document.getElementById("sendBtn");
  const entry = document.getElementById("entry");

  const onSend = () => {
    const text = entry.value.trim();
    if (!text) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(text); // change to JSON if your server expects JSON
    entry.value = "";
  };

  sendBtn?.addEventListener("click", onSend);

  // IMPORTANT: return cleanup function (router will call it before leaving)
  return () => {
    sendBtn?.removeEventListener("click", onSend);
    if (ws) {
      ws.close(1000, "leaving chat");
      ws = null;
    }
  };
}
