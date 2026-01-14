// views/Chat.js
let ws = null;

let state = {
  myId: null,           // string
  online: [],           // array of string user ids
  activePeerId: null,   // string
  activeConvoId: null,  // convo key "a:b"
};

export default async function ChatView() {
  return `
    <div class="chatarea" style="display:flex; gap:12px;">
      
      <div class="onlinePanel" style="width:260px; border:1px solid #555; padding:10px;">
        <h3 style="margin-top:0;">Online users</h3>
        <div id="myIdLine" style="font-size:12px; opacity:0.8; margin-bottom:8px;"></div>
        <div id="onlineUsers"></div>
      </div>

      <div style="flex:1; display:flex; flex-direction:column; border:1px solid #555;">
        <div style="padding:10px; border-bottom:1px solid #555;">
          <div id="activeChatTitle" style="font-weight:600;">Select a user to start</div>
          <div id="activeChatMeta" style="font-size:12px; opacity:0.8;"></div>
        </div>

        <div class="chatsection" id="chatsection" style="flex:1; padding:10px; overflow:auto;"></div>

        <div class="inputbar" style="display:flex; gap:8px; padding:10px; border-top:1px solid #555;">
          <textarea class="entry" id="entry" style="flex:1; resize:none;" rows="2" placeholder="Type..."></textarea>
          <button id="sendBtn">Send</button>
        </div>
      </div>

    </div>
  `;
}

function renderOnlineUsers() {
  const box = document.getElementById("onlineUsers");
  if (!box) return;

  box.innerHTML = "";

  if (!state.online.length) {
    box.textContent = "No one online.";
    return;
  }

  state.online.forEach((id) => {
    // optionally hide yourself from the list
    if (state.myId && id === state.myId) return;

    const btn = document.createElement("button");
    btn.textContent = `User ${id}`;
    btn.style.display = "block";
    btn.style.width = "100%";
    btn.style.textAlign = "left";
    btn.style.marginBottom = "6px";
    btn.dataset.userId = id;

    if (state.activePeerId === id) {
      btn.style.opacity = "1";
      btn.style.fontWeight = "700";
    } else {
      btn.style.opacity = "0.9";
    }

    btn.addEventListener("click", () => {
      openConversationWith(id);
    });

    box.appendChild(btn);
  });
}

function setMyIdLine() {
  const el = document.getElementById("myIdLine");
  if (!el) return;
  el.textContent = state.myId ? `You are: ${state.myId}` : "You are: (unknown)";
}

function setActiveChatHeader() {
  const title = document.getElementById("activeChatTitle");
  const meta = document.getElementById("activeChatMeta");
  if (!title || !meta) return;

  if (!state.activePeerId) {
    title.textContent = "Select a user to start";
    meta.textContent = "";
    return;
  }

  title.textContent = `Chat with User ${state.activePeerId}`;
  meta.textContent = state.activeConvoId ? `Conversation: ${state.activeConvoId}` : "";
}

function appendMsg({ sender_id, content, created_at }) {
  const chat = document.getElementById("chatsection");
  if (!chat) return;

  const row = document.createElement("div");
  row.style.marginBottom = "8px";

  const who = sender_id === state.myId ? "me" : `user ${sender_id}`;
  const time = created_at ? new Date(created_at).toLocaleTimeString() : "";

  row.innerHTML = `
    <div style="font-size:12px; opacity:0.8;">${who} ${time ? "• " + time : ""}</div>
    <div style="white-space:pre-wrap;">${escapeHtml(content)}</div>
  `;

  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

function clearChat() {
  const chat = document.getElementById("chatsection");
  if (chat) chat.innerHTML = "";
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}

function openConversationWith(peerId) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  state.activePeerId = String(peerId);
  state.activeConvoId = null;

  clearChat();
  setActiveChatHeader();
  renderOnlineUsers();

  ws.send(JSON.stringify({
    type: "open",
    peer_id: String(peerId),
  }));
}

export function mount(params) {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const url = `${proto}://${window.location.host}/ws/chat`;

  ws = new WebSocket(url);

  ws.onopen = () => console.log("[Chat] WS connected");
  ws.onclose = () => console.log("[Chat] WS closed");
  ws.onerror = (e) => console.error("[Chat] WS error:", e);

  ws.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch (e) {
      console.error("[Chat] Failed JSON parse:", e, event.data);
      return;
    }

    switch (msg.type) {
      case "hello":
        // server tells you your string user id
        state.myId = String(msg.user_id || "");
        setMyIdLine();
        renderOnlineUsers();
        return;

      case "presence_snapshot":
        state.online = Array.isArray(msg.online) ? msg.online.map(String) : [];
        renderOnlineUsers();
        return;

      case "presence":
        // optional single updates; snapshot already covers it, but keep it for smoothness
        // you can apply it incrementally or ignore
        return;

      case "history":
        // server returns messages for convo between me & active peer
        state.activeConvoId = msg.conversation_id || null;
        setActiveChatHeader();

        clearChat();
        if (Array.isArray(msg.messages)) {
          msg.messages.forEach((m) => appendMsg(m));
        }
        return;

      case "message":
        // only show if it belongs to currently active convo
        // (or you can show it regardless, but then you need multi-thread UI)
        if (!state.activePeerId) return;

        const sender = String(msg.sender_id || "");
        const recipient = String(msg.recipient_id || "");

        // belongs to the currently open peer if:
        // (sender == peer && recipient == me) OR (sender == me && recipient == peer)
        const isForActive =
          (sender === state.activePeerId && recipient === state.myId) ||
          (sender === state.myId && recipient === state.activePeerId);

        if (!isForActive) return;

        appendMsg({
          sender_id: sender,
          content: msg.content,
          created_at: msg.created_at,
        });
        return;

      case "error":
        console.error("[Chat] Server error:", msg.error);
        return;

      case "sent_ack":
        // optional: delivered flag (true/false)
        // console.log("[Chat] ack:", msg.temp_id, msg.delivered);
        return;

      default:
        console.log("[Chat] unknown event:", msg);
        return;
    }
  };

  const sendBtn = document.getElementById("sendBtn");
  const entry = document.getElementById("entry");

  const onSend = () => {
    const text = entry.value.trim();
    if (!text) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (!state.activePeerId) {
      alert("Select an online user first.");
      return;
    }

    ws.send(JSON.stringify({
      type: "message",
      recipient_id: String(state.activePeerId),
      content: text,
      temp_id: Date.now().toString(),
    }));

    entry.value = "";
  };

  sendBtn?.addEventListener("click", onSend);

  return () => {
    sendBtn?.removeEventListener("click", onSend);
    if (ws) {
      ws.close(1000, "leaving chat");
      ws = null;
    }
  };
}
