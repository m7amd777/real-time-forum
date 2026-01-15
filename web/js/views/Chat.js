// views/Chat.js
let ws = null;

export default async function ChatView() {
  return `<div class="chatarea">
                <div class= "usersList">
                    <ul>
                        <li class="userContact">
                            <span class="contactUsername">____</span>
                            <span class ="contactStatus online">_____</span>
                        </li>
                    </ul>
                </div>
                <div class= "chatspace">
                    <div class ="usercard">
                        <p>_____ - active</p>
                        
                    </div>
                    <!-- scrollable -->
                    <div class ="chatsection" id="chatsection">
                        // fill it here with h3 and choose right class
                    </div>

                    <div class ="inputbar">
                        <textarea class="entry" id="entry"></textarea>
                        <button id="sendBtn">Send</button>
                    </div>
                </div>
            </div>`;

}





export function mount(params) {
  const { conversationId } = params || {}; // if you add /chat/:conversationId later

  // // Check if session cookie exists
  // const hasCookie = document.cookie.includes("sessionID");
  // console.log("[Chat] Session cookie present:", hasCookie);
  // console.log("[Chat] All cookies:", document.cookie);

  // if (!hasCookie) {
  //   const chat = document.getElementById("chatsection");
  //   if (chat) {
  //     const err = document.createElement("div");
  //     err.style.color = "red";
  //     err.textContent = "ERROR: No session cookie found. Please log in first.";
  //     chat.appendChild(err);
  //   }
  //   return () => {};
  // }

  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const url = `${proto}://${window.location.host}/ws/chat${conversationId ? `?conversation_id=${conversationId}` : ""}`;

  console.log("[Chat] Connecting to WebSocket:", url);
  ws = new WebSocket(url);

  ws.onopen = () => console.log("WS connected");
  ws.onclose = () => console.log("WS closed");
  ws.onerror = (e) => {
    console.error("WS error:", e);
    const chat = document.getElementById("chatsection");
    if (chat) {
      const err = document.createElement("div");
      err.style.color = "red";
      err.textContent = "Connection failed - are you logged in?";
      chat.appendChild(err);
    }
  };

  ws.onmessage = (event) => {

    const chat = document.getElementById("chatsection");
    // if (!chat) return;

    try {
      const msg = JSON.parse(event.data);
      console.log(msg)

      if (msg.type === "message") {
        const h = document.createElement("h3");
        h.className = "from";
        h.textContent = `${msg.sender_id}: ${msg.content}`;
        chat.appendChild(h);
      } else if (msg.type === "error") {
        console.error("Server error:", msg.error);
      }
    } catch (e) {
      console.error("Failed to parse message:", e);
    }
  };

  const sendBtn = document.getElementById("sendBtn");
  const entry = document.getElementById("entry");

  const onSend = () => {
    const text = entry.value.trim();
    if (!text) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const message = {
      type: "message",
      conversation_id: conversationId || 1,
      recipient_id: 8, // TODO: get actual recipient ID
      content: text,
      temp_id: Date.now().toString()
    };
    ws.send(JSON.stringify(message));
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
