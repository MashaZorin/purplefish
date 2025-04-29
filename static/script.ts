type Message = {
    role: "user" | "assistant";
    content: string;
};

let currentConversationId: number | null = null;
const chatHistory: Message[] = [];

const conversationSelect = document.getElementById("conversationSelect") as HTMLSelectElement;
const chatBox = document.getElementById("chatBox") as HTMLElement;
const sendBtn = document.getElementById("sendBtn")  as HTMLButtonElement;
const inputEl = document.getElementById("userInput") as HTMLInputElement;
const newBtn = document.getElementById("newConversationBtn")!;

document.addEventListener("DOMContentLoaded", () => {
    loadConversations();
    sendBtn.addEventListener("click", sendMessage);
    inputEl.addEventListener("keydown", (e) => e.key === "Enter" && sendMessage());
    newBtn.addEventListener("click", createNewConversation);
    conversationSelect.addEventListener("change", () => {
        currentConversationId = parseInt(conversationSelect.value);
        loadMessages(currentConversationId);
    });
});

async function loadConversations() {
    const res = await fetch("http://localhost:5000/conversations");
    const data = await res.json();
    conversationSelect.innerHTML = "";
    data.forEach((convo: { id: number; title: string }) => {
        const option = document.createElement("option");
        option.value = convo.id.toString();
        option.text = convo.title;
        conversationSelect.appendChild(option);
    });
    if (data.length > 0) {
        currentConversationId = data[0].id;
        conversationSelect.value = currentConversationId?.toString() ?? '0';
        loadMessages(currentConversationId ?? 0);
    }
}

async function createNewConversation() {
    const res = await fetch("http://localhost:5000/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Chat" }),
    });
    const data = await res.json();
    await loadConversations();
    conversationSelect.value = data.id.toString();
    currentConversationId = data.id;
    chatBox.innerHTML = "";
    enableChat();
}

async function loadMessages(convoId: number) {
    const res = await fetch(`http://localhost:5000/conversations/${convoId}/messages`);
    const data = await res.json();
    chatBox.innerHTML = "";
    chatHistory.length = 0;
    data.forEach((msg: Message) => {
        chatHistory.push(msg);
        const bubble = document.createElement("div");
        bubble.className = `message ${msg.role}`;
        bubble.innerText = msg.content;
        chatBox.appendChild(bubble);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendMessage() {
    const message = inputEl.value.trim();
    if (!message || currentConversationId === null) return;

    const userBubble = document.createElement("div");
    userBubble.className = "message user";
    userBubble.innerText = message;
    chatBox.appendChild(userBubble);
    chatBox.scrollTop = chatBox.scrollHeight;

    inputEl.value = "";

    const res = await fetch("http://localhost:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversation_id: currentConversationId }),
    });

    const data = await res.json();
    const botBubble = document.createElement("div");
    botBubble.className = "message assistant";
    botBubble.innerText = data.response;
    chatBox.appendChild(botBubble);
    chatBox.scrollTop = chatBox.scrollHeight;

    if (data.ended) {
        disableChat();
      }
}

function enableChat() {
    inputEl.disabled = false;
    sendBtn.disabled = false;
    inputEl.placeholder = "Type a message...";
    sendBtn.style.opacity = "1";
    sendBtn.style.cursor = "pointer";
}

function disableChat() {
    inputEl.disabled = true;
    sendBtn.disabled = true;
    inputEl.placeholder = "This chat has ended.";
    sendBtn.style.opacity = "0.5";
    sendBtn.style.cursor = "not-allowed";
  }