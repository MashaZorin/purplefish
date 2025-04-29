"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
let currentConversationId = null;
const chatHistory = [];
const conversationSelect = document.getElementById("conversationSelect");
const chatBox = document.getElementById("chatBox");
const sendBtn = document.getElementById("sendBtn");
const inputEl = document.getElementById("userInput");
const newBtn = document.getElementById("newConversationBtn");
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
function loadConversations() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const res = yield fetch("http://localhost:5000/conversations");
        const data = yield res.json();
        conversationSelect.innerHTML = "";
        data.forEach((convo) => {
            const option = document.createElement("option");
            option.value = convo.id.toString();
            option.text = convo.title;
            conversationSelect.appendChild(option);
        });
        if (data.length > 0) {
            currentConversationId = data[0].id;
            conversationSelect.value = (_a = currentConversationId === null || currentConversationId === void 0 ? void 0 : currentConversationId.toString()) !== null && _a !== void 0 ? _a : '0';
            loadMessages(currentConversationId !== null && currentConversationId !== void 0 ? currentConversationId : 0);
        }
    });
}
function createNewConversation() {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield fetch("http://localhost:5000/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "Chat" }),
        });
        const data = yield res.json();
        yield loadConversations();
        conversationSelect.value = data.id.toString();
        currentConversationId = data.id;
        chatBox.innerHTML = "";
        enableChat();
    });
}
function loadMessages(convoId) {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield fetch(`http://localhost:5000/conversations/${convoId}/messages`);
        const data = yield res.json();
        chatBox.innerHTML = "";
        chatHistory.length = 0;
        data.forEach((msg) => {
            chatHistory.push(msg);
            const bubble = document.createElement("div");
            bubble.className = `message ${msg.role}`;
            bubble.innerText = msg.content;
            chatBox.appendChild(bubble);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}
function sendMessage() {
    return __awaiter(this, void 0, void 0, function* () {
        const message = inputEl.value.trim();
        if (!message || currentConversationId === null)
            return;
        const userBubble = document.createElement("div");
        userBubble.className = "message user";
        userBubble.innerText = message;
        chatBox.appendChild(userBubble);
        chatBox.scrollTop = chatBox.scrollHeight;
        inputEl.value = "";
        const res = yield fetch("http://localhost:5000/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, conversation_id: currentConversationId }),
        });
        const data = yield res.json();
        const botBubble = document.createElement("div");
        botBubble.className = "message assistant";
        botBubble.innerText = data.response;
        chatBox.appendChild(botBubble);
        chatBox.scrollTop = chatBox.scrollHeight;
        if (data.ended) {
            disableChat();
        }
    });
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
