import { connectState, connectWS, uiFlags } from '../ws.js';

// views/Chat.js
let ws = null;
export const chatState = {
  currentRecipient: null,
  currentConversation: null,
};

// Toast helper for user feedback
function showChatToast(text) {
  const TOAST_CONTAINER_ID = "chat-toast-container";
  let container = document.getElementById(TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement("div");
    container.id = TOAST_CONTAINER_ID;
    container.className = "chat-toast-container";
    document.body.appendChild(container);
  }

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
  }, 4000);
}

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
    if (connectState.allUsers) return; // Skip if already loaded
    try {
      const res = await fetch("/api/users");
      connectState.allUsers = await res.json();
    } catch (err) {
      console.error("Load users error:", err);
    }
  }


  //load the conversations that are available
  async function loadConversations() {
    if (connectState.allConversations) {
      // If user clicked from global list, auto-open chat with them


      // if (uiFlags.targetUser) {
      //   const { id, username } = uiFlags.targetUser;
      //   uiFlags.targetUser = null;
      //   selectRecipient(id, username);
      // }
      return;
    }
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error("Failed to fetch conversations");

      connectState.allConversations = await res.json();
      // renderConversations(connectState.allConversations);

      // If user clicked from global list, auto-open chat with them
      
      // if (uiFlags.targetUser) {
      //   const { id, username } = uiFlags.targetUser;
      //   uiFlags.targetUser = null;
      //   selectRecipient(id, username);
      // }
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
  // Remove listener if it exists (prevents accumulation on remount)
  chat.removeEventListener("scroll", handleChatScroll);
  chat.addEventListener("scroll", handleChatScroll);




  //opening WS function
  ws = connectWS();


  // =======================
  // SEND MESSAGE
  // =======================
  const onSend = () => {
    const text = entry.value.trim();
    if (!text) return;

    if (!chatState.currentRecipient) {
      showChatToast("Select a user first");
      return;
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showChatToast("Connection unavailable. Please try again.");
      return;
    }

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

  // Remove listener if it exists (prevents accumulation on remount)
  sendBtn.removeEventListener("click", onSend);
  sendBtn.addEventListener("click", onSend);

  // =======================
  // INIT
  // =======================
  loadUsers();
  loadConversations();

  if (params && params.uid) {
    // Wait for users to load, then select the target user
    setTimeout(() => {
      const user = connectState.allUsers.find(x => x.id == params.uid);
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
