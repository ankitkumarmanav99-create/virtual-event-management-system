// Enhanced chat using Socket.IO with emoji and file sharing
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');

let socket;
let meetingCode;
let userName = localStorage.getItem('userName') || 'Guest';

// Emoji list
const emojis = ['😀', '😂', '😍', '😘', '😭', '😡', '🤔', '👍', '👎', '❤️', '🎉', '🎈', '🎊', '🔥', '⭐', '🌟', '💯', '✨', '🚀', '💪'];

// Initialize socket.io
function initSocketIO() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to chat server');
    });
    
    // Listen for incoming chat messages
    socket.on('chat-message', (data) => {
        displayMessage(data.userName, data.message, 'incoming', data.type);
    });
    
    // Listen for file shares
    socket.on('file-shared', (data) => {
        displayFileMessage(data.userName, data.fileName, data.fileUrl, data.fileType, 'incoming');
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
    
    // Send button with better styling
    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', sendMessage);
        sendMessageBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
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
    
    // Setup action buttons - find them by their position
    const actionButtons = document.querySelectorAll('.chat-action-btn');
    if (actionButtons.length >= 2) {
        const emojiBtn = actionButtons[0];
        const fileBtn = actionButtons[1];
        
        // Emoji picker
        emojiBtn.addEventListener('click', (e) => {
            e.preventDefault();
            toggleEmojiPicker();
        });
        
        // File attachment
        fileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt';
            input.addEventListener('change', handleFileUpload);
            input.click();
        });
    }
    
    // Load chat history
    loadChatHistory();
}

// Toggle emoji picker
function toggleEmojiPicker() {
    let emojiPickerContainer = document.getElementById('emojiPickerContainer');
    
    if (!emojiPickerContainer) {
        // Create wrapper to break out of flex container
        emojiPickerContainer = document.createElement('div');
        emojiPickerContainer.id = 'emojiPickerContainer';
        emojiPickerContainer.style.cssText = `
            position: absolute;
            bottom: 150px;
            left: 20px;
            width: 300px;
            background: var(--meeting-surface);
            border: 1px solid var(--meeting-border);
            border-radius: 8px;
            padding: 12px;
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 8px;
            z-index: 1000;
            max-height: 250px;
            overflow-y: auto;
        `;
        
        emojiPickerContainer.innerHTML = emojis.map(emoji => 
            `<button class="emoji-btn-absolute" type="button" style="
                background: var(--meeting-surface-light);
                border: 1px solid var(--meeting-border);
                border-radius: 6px;
                padding: 8px;
                font-size: 20px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 40px;
                transition: all 0.2s ease;
            ">${emoji}</button>`
        ).join('');
        
        document.querySelector('.sidebar').appendChild(emojiPickerContainer);
        
        // Add emoji click handlers
        emojiPickerContainer.querySelectorAll('.emoji-btn-absolute').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (chatInput) {
                    chatInput.value += btn.textContent;
                    chatInput.focus();
                }
            });
            
            btn.addEventListener('mouseover', (e) => {
                e.target.style.background = 'var(--meeting-primary)';
                e.target.style.transform = 'scale(1.1)';
            });
            
            btn.addEventListener('mouseout', (e) => {
                e.target.style.background = 'var(--meeting-surface-light)';
                e.target.style.transform = 'scale(1)';
            });
        });
    } else {
        // Toggle visibility
        emojiPickerContainer.style.display = emojiPickerContainer.style.display === 'none' ? 'grid' : 'none';
    }
}

// Handle file upload
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const fileType = file.type.split('/')[0]; // 'image', 'video', 'application'
    const isImage = fileType === 'image';
    const isVideo = fileType === 'video';
    const isDocument = fileType === 'application';
    
    if (!isImage && !isVideo && !isDocument) {
        alert('File type not supported. Please upload images, videos, or documents.');
        return;
    }
    
    // Read file and convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
        const fileData = event.target.result;
        const fileName = file.name;
        const fileMimeType = file.type;
        
        // Emit file to server
        if (socket) {
            socket.emit('file-share', {
                meetingCode,
                fileName,
                fileData,
                fileMimeType,
                fileType: isImage ? 'image' : isVideo ? 'video' : 'document'
            });
        }
        
        // Display in our chat
        displayFileMessage(userName, fileName, fileData, isImage ? 'image' : isVideo ? 'video' : 'document', 'own');
    };
    
    reader.readAsDataURL(file);
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
    displayMessage(userName, message, 'own', 'text');
    
    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';
}

// Display message in chat
function displayMessage(sender, message, type, messageType = 'text') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    if (messageType === 'emoji') {
        messageDiv.innerHTML = `
            <div class="message-content emoji-message">${escapeHtml(message)}</div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="sender">${escapeHtml(sender)}</span>
                <span class="timestamp">${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="message-content">${escapeHtml(message)}</div>
        `;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Display file message
function displayFileMessage(sender, fileName, fileUrl, fileType, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    let content = '';
    if (fileType === 'image') {
        content = `
            <div class="message-header">
                <span class="sender">${escapeHtml(sender)}</span>
                <span class="timestamp">${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="message-content file-message">
                <img src="${fileUrl}" alt="${escapeHtml(fileName)}" class="file-preview">
                <p class="file-name">${escapeHtml(fileName)}</p>
            </div>
        `;
    } else if (fileType === 'video') {
        content = `
            <div class="message-header">
                <span class="sender">${escapeHtml(sender)}</span>
                <span class="timestamp">${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="message-content file-message">
                <video controls class="file-preview">
                    <source src="${fileUrl}">
                    Your browser does not support the video tag.
                </video>
                <p class="file-name">${escapeHtml(fileName)}</p>
            </div>
        `;
    } else {
        content = `
            <div class="message-header">
                <span class="sender">${escapeHtml(sender)}</span>
                <span class="timestamp">${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="message-content file-message">
                <a href="${fileUrl}" download="${escapeHtml(fileName)}" class="file-download">
                    <i class="fas fa-file"></i>
                    <span class="file-name">${escapeHtml(fileName)}</span>
                </a>
            </div>
        `;
    }
    
    messageDiv.innerHTML = content;
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

// Handle file upload
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const fileType = file.type.split('/')[0]; // 'image', 'video', 'application'
    const isImage = fileType === 'image';
    const isVideo = fileType === 'video';
    const isDocument = fileType === 'application';
    
    if (!isImage && !isVideo && !isDocument) {
        alert('File type not supported. Please upload images, videos, or documents.');
        return;
    }
    
    // Read file and convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
        const fileData = event.target.result;
        const fileName = file.name;
        const fileMimeType = file.type;
        
        // Emit file to server
        if (socket) {
            socket.emit('file-share', {
                meetingCode,
                fileName,
                fileData,
                fileMimeType,
                fileType: isImage ? 'image' : isVideo ? 'video' : 'document'
            });
        }
        
        // Display in our chat
        displayFileMessage(userName, fileName, fileData, isImage ? 'image' : isVideo ? 'video' : 'document', 'own');
    };
    
    reader.readAsDataURL(file);
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
    displayMessage(userName, message, 'own', 'text');
    
    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';
}

// Display message in chat
function displayMessage(sender, message, type, messageType = 'text') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    if (messageType === 'emoji') {
        messageDiv.innerHTML = `
            <div class="message-content emoji-message">${escapeHtml(message)}</div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="sender">${escapeHtml(sender)}</span>
                <span class="timestamp">${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="message-content">${escapeHtml(message)}</div>
        `;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Display file message
function displayFileMessage(sender, fileName, fileUrl, fileType, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    let content = '';
    if (fileType === 'image') {
        content = `
            <div class="message-header">
                <span class="sender">${escapeHtml(sender)}</span>
                <span class="timestamp">${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="message-content file-message">
                <img src="${fileUrl}" alt="${escapeHtml(fileName)}" class="file-preview">
                <p class="file-name">${escapeHtml(fileName)}</p>
            </div>
        `;
    } else if (fileType === 'video') {
        content = `
            <div class="message-header">
                <span class="sender">${escapeHtml(sender)}</span>
                <span class="timestamp">${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="message-content file-message">
                <video controls class="file-preview">
                    <source src="${fileUrl}">
                    Your browser does not support the video tag.
                </video>
                <p class="file-name">${escapeHtml(fileName)}</p>
            </div>
        `;
    } else {
        content = `
            <div class="message-header">
                <span class="sender">${escapeHtml(sender)}</span>
                <span class="timestamp">${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="message-content file-message">
                <a href="${fileUrl}" download="${escapeHtml(fileName)}" class="file-download">
                    <i class="fas fa-file"></i>
                    <span class="file-name">${escapeHtml(fileName)}</span>
                </a>
            </div>
        `;
    }
    
    messageDiv.innerHTML = content;
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
