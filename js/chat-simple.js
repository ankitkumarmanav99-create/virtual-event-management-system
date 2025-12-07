// Simple chat using Socket.IO
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');

let socket;
let meetingCode;
let userName = localStorage.getItem('userName') || 'Guest';

// Initialize socket.io
function initSocketIO() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to chat server');
    });
    
    // Listen for incoming chat messages
    socket.on('chat-message', (data) => {
        displayMessage(data.userName, data.message, 'incoming');
    });
    
    // Listen for typing indicators
    socket.on('user-typing', (data) => {
        if (data.isTyping && data.userName !== userName) {
            showTypingIndicator(data.userName);
        }
    });
}

// Get meeting code from URL
function getMeetingCode() {
    const params = new URLSearchParams(window.location.search);
    return params.get('code') || 'demo-meeting';
}

// Initialize chat
function initChat() {
    meetingCode = getMeetingCode();
    initSocketIO();
    
    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', sendMessage);
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Typing indicator
        chatInput.addEventListener('input', () => {
            if (socket) {
                socket.emit('typing', { meetingCode, isTyping: true });
                clearTimeout(chatInput.typingTimeout);
                chatInput.typingTimeout = setTimeout(() => {
                    socket.emit('typing', { meetingCode, isTyping: false });
                }, 1000);
            }
        });
    }
    
    // Load chat history
    loadChatHistory();
}

// Send message
function sendMessage() {
    if (!chatInput || !chatInput.value.trim()) return;
    
    const message = chatInput.value.trim();
    
    // Emit to server
    if (socket) {
        socket.emit('chat-message', {
            meetingCode,
            message,
            type: 'text'
        });
    }
    
    // Display in our chat
    displayMessage(userName, message, 'own');
    
    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';
}

// Display message in chat
function displayMessage(sender, message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="sender">${escapeHtml(sender)}</span>
            <span class="timestamp">${new Date().toLocaleTimeString()}</span>
        </div>
        <div class="message-content">${escapeHtml(message)}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show typing indicator
function showTypingIndicator(name) {
    const existingIndicator = chatMessages.querySelector('.typing-indicator');
    if (existingIndicator) existingIndicator.remove();
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.innerHTML = `<em>${escapeHtml(name)} is typing...</em>`;
    chatMessages.appendChild(typingDiv);
    
    setTimeout(() => {
        typingDiv.remove();
    }, 3000);
}

// Load chat history (stub for now)
function loadChatHistory() {
    // Could fetch from server if persisted
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Start chat when DOM is ready
document.addEventListener('DOMContentLoaded', initChat);
