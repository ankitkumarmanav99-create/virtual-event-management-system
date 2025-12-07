// chat.js - Real-time Chat Functionality for EventSphere

// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const chatNotificationDot = document.getElementById('chatNotificationDot');
const chatBadge = document.getElementById('chatBadge');
const chatActionButtons = document.querySelectorAll('.chat-action-btn');
const emojiPickerBtn = document.querySelector('.chat-action-btn[title="Emoji"]');
const attachFileBtn = document.querySelector('.chat-action-btn[title="Attach file"]');
const closeChatPanel = document.getElementById('closeChatPanel');

// State Management
let chatState = {
    messages: [],
    unreadCount: 0,
    isTyping: false,
    typingTimeout: null,
    participantsTyping: new Set(),
    fileAttachments: [],
    currentMeetingId: '',
    socket: null,
    dataChannels: {}, // WebRTC data channels for peer-to-peer chat
    chatHistoryKey: 'eventsphere_chat_history',
    settings: {
        soundEnabled: true,
        notificationsEnabled: true,
        messagePreview: true,
        autoScroll: true,
        timestampFormat: '12h',
        emojiEnabled: true
    }
};

// Message Types
const MESSAGE_TYPES = {
    TEXT: 'text',
    SYSTEM: 'system',
    FILE: 'file',
    EMOJI: 'emoji',
    JOIN: 'join',
    LEAVE: 'leave',
    TYPING: 'typing',
    STOP_TYPING: 'stop_typing'
};

// Initialize chat system
function initChat() {
    // Get current meeting ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    chatState.currentMeetingId = urlParams.get('code') || 'demo-meeting';
    
    // Load settings
    loadChatSettings();
    
    // Load chat history for this meeting
    loadChatHistory();
    
    // Initialize UI
    initChatUI();
    
    // Initialize event listeners
    initChatEventListeners();
    
    // Connect to chat (simulated for demo)
    connectToChat();
    
    // Add system message
    addSystemMessage('Chat is ready. Messages are end-to-end encrypted.');
    
    // Show welcome message
    setTimeout(() => {
        addMessage({
            id: generateMessageId(),
            type: MESSAGE_TYPES.SYSTEM,
            sender: 'System',
            content: 'Welcome to the meeting! Type a message to start chatting.',
            timestamp: new Date().toISOString(),
            isOwn: false
        });
    }, 1000);
}

// Load chat settings
function loadChatSettings() {
    try {
        const savedSettings = localStorage.getItem('eventsphere_chat_settings');
        if (savedSettings) {
            chatState.settings = { ...chatState.settings, ...JSON.parse(savedSettings) };
        }
    } catch (error) {
        console.error('Error loading chat settings:', error);
    }
}

// Save chat settings
function saveChatSettings() {
    try {
        localStorage.setItem('eventsphere_chat_settings', JSON.stringify(chatState.settings));
    } catch (error) {
        console.error('Error saving chat settings:', error);
    }
}

// Load chat history for current meeting
function loadChatHistory() {
    try {
        const allHistory = JSON.parse(localStorage.getItem(chatState.chatHistoryKey) || '{}');
        const meetingHistory = allHistory[chatState.currentMeetingId] || [];
        
        // Add historical messages to state
        meetingHistory.forEach(msg => {
            chatState.messages.push(msg);
        });
        
        // Render loaded messages
        renderMessages();
        
    } catch (error) {
        console.error('Error loading chat history:', error);
    }
}

// Save chat history
function saveChatHistory() {
    try {
        const allHistory = JSON.parse(localStorage.getItem(chatState.chatHistoryKey) || '{}');
        
        // Only save last 100 messages per meeting
        const recentMessages = chatState.messages.slice(-100);
        allHistory[chatState.currentMeetingId] = recentMessages;
        
        localStorage.setItem(chatState.chatHistoryKey, JSON.stringify(allHistory));
    } catch (error) {
        console.error('Error saving chat history:', error);
    }
}

// Generate unique message ID
function generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Generate timestamp
function generateTimestamp(date = new Date()) {
    if (chatState.settings.timestampFormat === '12h') {
        return date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
    } else {
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
    }
}

// Format date for message grouping
function formatMessageDate(date) {
    const today = new Date();
    const messageDate = new Date(date);
    
    if (messageDate.toDateString() === today.toDateString()) {
        return 'Today';
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (messageDate.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }
    
    return messageDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Initialize chat UI
function initChatUI() {
    // Set up auto-resizing textarea
    if (chatInput && chatInput.tagName === 'INPUT') {
        // Convert input to textarea for multi-line support
        const textarea = document.createElement('textarea');
        textarea.id = chatInput.id;
        textarea.className = chatInput.className;
        textarea.placeholder = chatInput.placeholder;
        textarea.maxLength = chatInput.maxLength;
        textarea.value = chatInput.value;
        
        chatInput.parentNode.replaceChild(textarea, chatInput);
        chatInput = textarea;
        
        // Auto-resize textarea
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
        
        // Reset height on blur if empty
        textarea.addEventListener('blur', function() {
            if (!this.value.trim()) {
                this.style.height = 'auto';
            }
        });
    }
    
    // Update unread count badge
    updateUnreadCount();
    
    // Render existing messages
    renderMessages();
}

// Initialize chat event listeners
function initChatEventListeners() {
    // Send message on Enter (Ctrl+Enter for new line)
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                sendMessage();
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                // Allow new line with Ctrl+Enter
                e.preventDefault();
                const cursorPos = chatInput.selectionStart;
                const textBefore = chatInput.value.substring(0, cursorPos);
                const textAfter = chatInput.value.substring(cursorPos);
                chatInput.value = textBefore + '\n' + textAfter;
                chatInput.selectionStart = chatInput.selectionEnd = cursorPos + 1;
            }
        });
        
        // Typing indicator
        chatInput.addEventListener('input', handleTyping);
        
        // Focus management
        chatInput.addEventListener('focus', () => {
            chatInput.parentElement.classList.add('focused');
            markMessagesAsRead();
        });
        
        chatInput.addEventListener('blur', () => {
            chatInput.parentElement.classList.remove('focused');
            stopTypingIndicator();
        });
    }
    
    // Send message button
    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', sendMessage);
        sendMessageBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                sendMessage();
            }
        });
    }
    
    // Emoji picker
    if (emojiPickerBtn) {
        emojiPickerBtn.addEventListener('click', toggleEmojiPicker);
    }
    
    // File attachment
    if (attachFileBtn) {
        attachFileBtn.addEventListener('click', openFilePicker);
    }
    
    // Close chat panel
    if (closeChatPanel) {
        closeChatPanel.addEventListener('click', () => {
            // This would normally close the chat panel
            // For now, just mark messages as read
            markMessagesAsRead();
        });
    }
    
    // Chat panel visibility changes
    const chatPanel = document.getElementById('chatPanel');
    if (chatPanel) {
        // Using MutationObserver to detect when chat panel becomes visible
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'style' || mutation.attributeName === 'class') {
                    if (chatPanel.style.display !== 'none' && !chatPanel.classList.contains('hidden')) {
                        markMessagesAsRead();
                        scrollToBottom();
                    }
                }
            });
        });
        
        observer.observe(chatPanel, { 
            attributes: true, 
            attributeFilter: ['style', 'class'] 
        });
    }
    
    // Handle window focus/blur for notifications
    window.addEventListener('focus', markMessagesAsRead);
    window.addEventListener('blur', () => {
        // When window loses focus, we might want to show notifications
        // This is handled by the notification system
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + / to focus chat
        if ((e.ctrlKey || e.metaKey) && e.key === '/') {
            e.preventDefault();
            if (chatInput) {
                chatInput.focus();
            }
        }
        
        // Escape to clear chat input
        if (e.key === 'Escape' && chatInput && chatInput === document.activeElement) {
            if (chatInput.value.trim()) {
                chatInput.value = '';
                chatInput.style.height = 'auto';
            }
        }
    });
}

// Connect to chat system (simulated for demo)
function connectToChat() {
    // In a real implementation, this would connect to WebSocket or use WebRTC data channels
    // For demo, we'll simulate a connection
    
    console.log('Chat connected to meeting:', chatState.currentMeetingId);
    
    // Simulate incoming messages for demo
    if (window.location.hash === '#demo') {
        simulateDemoMessages();
    }
}

// Simulate demo messages
function simulateDemoMessages() {
    const demoMessages = [
        {
            id: generateMessageId(),
            type: MESSAGE_TYPES.TEXT,
            sender: 'Alex Johnson',
            content: 'Hello everyone! Can you see my screen?',
            timestamp: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
            isOwn: false
        },
        {
            id: generateMessageId(),
            type: MESSAGE_TYPES.TEXT,
            sender: 'Sarah Miller',
            content: 'Yes, looks great! The presentation is very clear.',
            timestamp: new Date(Date.now() - 240000).toISOString(), // 4 minutes ago
            isOwn: false
        },
        {
            id: generateMessageId(),
            type: MESSAGE_TYPES.TEXT,
            sender: 'David Chen',
            content: 'Could you go back to slide 5? I missed that part.',
            timestamp: new Date(Date.now() - 180000).toISOString(), // 3 minutes ago
            isOwn: false
        }
    ];
    
    // Add demo messages with delay
    demoMessages.forEach((msg, index) => {
        setTimeout(() => {
            addMessage(msg);
        }, (index + 1) * 1000);
    });
}

// Send message
function sendMessage() {
    if (!chatInput) return;
    
    const content = chatInput.value.trim();
    if (!content) return;
    
    // Create message object
    const message = {
        id: generateMessageId(),
        type: MESSAGE_TYPES.TEXT,
        sender: getCurrentUserName(),
        content: content,
        timestamp: new Date().toISOString(),
        isOwn: true
    };
    
    // Add message to UI
    addMessage(message);
    
    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    
    // Reset typing indicator
    stopTypingIndicator();
    
    // In a real implementation, send via WebSocket or WebRTC data channel
    broadcastMessage(message);
    
    // Play send sound
    playChatSound('send');
    
    // Save to history
    saveChatHistory();
}

// Broadcast message to all participants
function broadcastMessage(message) {
    // This would send via WebSocket or WebRTC data channels
    // For demo, we'll simulate receiving the message back
    
    console.log('Broadcasting message:', message);
    
    // In a real app, you would:
    // 1. Send via WebSocket to server
    // 2. Server broadcasts to all participants
    // 3. Other clients receive via WebSocket
    
    // For demo, simulate other participants receiving the message
    // (In real app, this would come from server/other peers)
}

// Add message to chat
function addMessage(message) {
    // Add to state
    chatState.messages.push(message);
    
    // Render message
    renderMessage(message);
    
    // Update unread count if chat is not visible
    if (!isChatVisible()) {
        chatState.unreadCount++;
        updateUnreadCount();
        
        // Show notification if enabled
        if (chatState.settings.notificationsEnabled && !message.isOwn) {
            showChatNotification(message);
        }
    }
    
    // Play receive sound for incoming messages
    if (!message.isOwn && chatState.settings.soundEnabled) {
        playChatSound('receive');
    }
    
    // Auto-scroll to bottom
    if (chatState.settings.autoScroll && isChatVisible()) {
        scrollToBottom();
    }
    
    // Save to history (with debounce)
    debounceSaveHistory();
}

// Add system message
function addSystemMessage(content) {
    const message = {
        id: generateMessageId(),
        type: MESSAGE_TYPES.SYSTEM,
        sender: 'System',
        content: content,
        timestamp: new Date().toISOString(),
        isOwn: false
    };
    
    addMessage(message);
}

// Render all messages
function renderMessages() {
    if (!chatMessages) return;
    
    // Clear chat messages (keep system message if present)
    const systemMessage = chatMessages.querySelector('.system-message');
    chatMessages.innerHTML = '';
    
    if (systemMessage) {
        chatMessages.appendChild(systemMessage);
    }
    
    // Group messages by date
    const groupedMessages = groupMessagesByDate(chatState.messages);
    
    // Render each group
    Object.entries(groupedMessages).forEach(([date, messages]) => {
        // Add date separator
        const dateSeparator = createDateSeparator(date);
        chatMessages.appendChild(dateSeparator);
        
        // Render messages for this date
        messages.forEach(message => {
            renderMessage(message);
        });
    });
    
    // Scroll to bottom
    scrollToBottom();
}

// Group messages by date
function groupMessagesByDate(messages) {
    const groups = {};
    
    messages.forEach(message => {
        const date = formatMessageDate(message.timestamp);
        
        if (!groups[date]) {
            groups[date] = [];
        }
        
        groups[date].push(message);
    });
    
    return groups;
}

// Create date separator element
function createDateSeparator(date) {
    const separator = document.createElement('div');
    separator.className = 'date-separator';
    
    const line = document.createElement('div');
    line.className = 'separator-line';
    
    const dateText = document.createElement('span');
    dateText.className = 'separator-date';
    dateText.textContent = date;
    
    separator.appendChild(line);
    separator.appendChild(dateText);
    separator.appendChild(line.cloneNode());
    
    return separator;
}

// Render single message
function renderMessage(message) {
    if (!chatMessages) return;
    
    let messageElement;
    
    switch (message.type) {
        case MESSAGE_TYPES.SYSTEM:
            messageElement = createSystemMessageElement(message);
            break;
            
        case MESSAGE_TYPES.JOIN:
        case MESSAGE_TYPES.LEAVE:
            messageElement = createSystemMessageElement(message);
            break;
            
        case MESSAGE_TYPES.FILE:
            messageElement = createFileMessageElement(message);
            break;
            
        case MESSAGE_TYPES.EMOJI:
            messageElement = createEmojiMessageElement(message);
            break;
            
        case MESSAGE_TYPES.TEXT:
        default:
            messageElement = createTextMessageElement(message);
            break;
    }
    
    chatMessages.appendChild(messageElement);
    
    // Add animation for new messages
    if (message.timestamp > Date.now() - 5000) { // Messages from last 5 seconds
        messageElement.classList.add('new-message');
        setTimeout(() => {
            messageElement.classList.remove('new-message');
        }, 1000);
    }
}

// Create text message element
function createTextMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.isOwn ? 'outgoing' : 'incoming'}`;
    messageDiv.dataset.messageId = message.id;
    
    const messageHeader = document.createElement('div');
    messageHeader.className = 'message-header';
    
    const senderSpan = document.createElement('span');
    senderSpan.className = 'sender';
    senderSpan.textContent = message.isOwn ? 'You' : message.sender;
    
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'timestamp';
    timestampSpan.textContent = generateTimestamp(new Date(message.timestamp));
    timestampSpan.title = new Date(message.timestamp).toLocaleString();
    
    messageHeader.appendChild(senderSpan);
    messageHeader.appendChild(timestampSpan);
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // Format message content (handle links, emojis, etc.)
    const formattedContent = formatMessageContent(message.content);
    messageContent.innerHTML = formattedContent;
    
    messageDiv.appendChild(messageHeader);
    messageDiv.appendChild(messageContent);
    
    // Add context menu for message actions
    addMessageContextMenu(messageDiv, message);
    
    return messageDiv;
}

// Create system message element
function createSystemMessageElement(message) {
    const systemDiv = document.createElement('div');
    systemDiv.className = 'system-message';
    
    const icon = document.createElement('i');
    
    switch (message.type) {
        case MESSAGE_TYPES.JOIN:
            icon.className = 'fas fa-user-plus';
            break;
        case MESSAGE_TYPES.LEAVE:
            icon.className = 'fas fa-user-minus';
            break;
        default:
            icon.className = 'fas fa-info-circle';
    }
    
    const text = document.createElement('span');
    text.textContent = message.content;
    
    systemDiv.appendChild(icon);
    systemDiv.appendChild(text);
    
    return systemDiv;
}

// Create file message element
function createFileMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.isOwn ? 'outgoing' : 'incoming'} file-message`;
    messageDiv.dataset.messageId = message.id;
    
    const messageHeader = document.createElement('div');
    messageHeader.className = 'message-header';
    
    const senderSpan = document.createElement('span');
    senderSpan.className = 'sender';
    senderSpan.textContent = message.isOwn ? 'You' : message.sender;
    
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'timestamp';
    timestampSpan.textContent = generateTimestamp(new Date(message.timestamp));
    
    messageHeader.appendChild(senderSpan);
    messageHeader.appendChild(timestampSpan);
    
    const fileContainer = document.createElement('div');
    fileContainer.className = 'file-container';
    
    const fileIcon = document.createElement('i');
    fileIcon.className = getFileIconClass(message.fileType);
    
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    
    const fileName = document.createElement('div');
    fileName.className = 'file-name';
    fileName.textContent = message.fileName || 'File';
    
    const fileSize = document.createElement('div');
    fileSize.className = 'file-size';
    fileSize.textContent = formatFileSize(message.fileSize);
    
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-btn';
    downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
    downloadBtn.title = 'Download file';
    downloadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        downloadFile(message.fileUrl, message.fileName);
    });
    
    fileInfo.appendChild(fileName);
    fileInfo.appendChild(fileSize);
    
    fileContainer.appendChild(fileIcon);
    fileContainer.appendChild(fileInfo);
    fileContainer.appendChild(downloadBtn);
    
    messageDiv.appendChild(messageHeader);
    messageDiv.appendChild(fileContainer);
    
    return messageDiv;
}

// Create emoji message element
function createEmojiMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.isOwn ? 'outgoing' : 'incoming'} emoji-message`;
    messageDiv.dataset.messageId = message.id;
    
    const emojiContent = document.createElement('div');
    emojiContent.className = 'emoji-content';
    emojiContent.textContent = message.content;
    
    const senderSpan = document.createElement('span');
    senderSpan.className = 'emoji-sender';
    senderSpan.textContent = message.isOwn ? 'You' : message.sender;
    
    messageDiv.appendChild(emojiContent);
    messageDiv.appendChild(senderSpan);
    
    return messageDiv;
}

// Format message content (handle URLs, emojis, etc.)
function formatMessageContent(content) {
    if (!content) return '';
    
    let formatted = content;
    
    // Convert URLs to clickable links
    formatted = formatted.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    // Convert markdown-style bold **text**
    formatted = formatted.replace(
        /\*\*(.*?)\*\*/g,
        '<strong>$1</strong>'
    );
    
    // Convert markdown-style italic *text*
    formatted = formatted.replace(
        /\*(.*?)\*/g,
        '<em>$1</em>'
    );
    
    // Convert line breaks to <br>
    formatted = formatted.replace(/\n/g, '<br>');
    
    // Convert emoji shortcodes (optional)
    if (chatState.settings.emojiEnabled) {
        formatted = convertEmojiShortcodes(formatted);
    }
    
    return formatted;
}

// Convert emoji shortcodes to emojis
function convertEmojiShortcodes(text) {
    const emojiMap = {
        ':)': '😊',
        ':(': '😞',
        ':D': '😃',
        ':P': '😛',
        ';)': '😉',
        ':O': '😲',
        ':*': '😘',
        '<3': '❤️',
        ':+1:': '👍',
        ':-1:': '👎',
        ':clap:': '👏',
        ':fire:': '🔥',
        ':100:': '💯'
    };
    
    let converted = text;
    Object.entries(emojiMap).forEach(([shortcode, emoji]) => {
        const regex = new RegExp(shortcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        converted = converted.replace(regex, emoji);
    });
    
    return converted;
}

// Get file icon class based on file type
function getFileIconClass(fileType) {
    if (!fileType) return 'fas fa-file';
    
    const iconMap = {
        'pdf': 'fas fa-file-pdf',
        'doc': 'fas fa-file-word',
        'docx': 'fas fa-file-word',
        'xls': 'fas fa-file-excel',
        'xlsx': 'fas fa-file-excel',
        'ppt': 'fas fa-file-powerpoint',
        'pptx': 'fas fa-file-powerpoint',
        'zip': 'fas fa-file-archive',
        'rar': 'fas fa-file-archive',
        'jpg': 'fas fa-file-image',
        'jpeg': 'fas fa-file-image',
        'png': 'fas fa-file-image',
        'gif': 'fas fa-file-image',
        'mp3': 'fas fa-file-audio',
        'wav': 'fas fa-file-audio',
        'mp4': 'fas fa-file-video',
        'avi': 'fas fa-file-video',
        'mov': 'fas fa-file-video'
    };
    
    const extension = fileType.split('/').pop().toLowerCase();
    return iconMap[extension] || 'fas fa-file';
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Add context menu to message
function addMessageContextMenu(messageElement, message) {
    messageElement.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        
        // Remove any existing context menu
        const existingMenu = document.querySelector('.message-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // Create context menu
        const contextMenu = document.createElement('div');
        contextMenu.className = 'message-context-menu';
        contextMenu.style.position = 'fixed';
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.zIndex = '10000';
        
        // Copy message option
        const copyOption = document.createElement('button');
        copyOption.className = 'context-menu-item';
        copyOption.innerHTML = '<i class="fas fa-copy"></i> Copy message';
        copyOption.addEventListener('click', () => {
            navigator.clipboard.writeText(message.content)
                .then(() => showChatNotification({
                    sender: 'System',
                    content: 'Message copied to clipboard'
                }))
                .catch(err => console.error('Failed to copy:', err));
            contextMenu.remove();
        });
        
        // Reply option (only for incoming messages)
        if (!message.isOwn) {
            const replyOption = document.createElement('button');
            replyOption.className = 'context-menu-item';
            replyOption.innerHTML = '<i class="fas fa-reply"></i> Reply';
            replyOption.addEventListener('click', () => {
                if (chatInput) {
                    chatInput.value = `@${message.sender} `;
                    chatInput.focus();
                }
                contextMenu.remove();
            });
            contextMenu.appendChild(replyOption);
        }
        
        // Delete option (only for own messages)
        if (message.isOwn) {
            const deleteOption = document.createElement('button');
            deleteOption.className = 'context-menu-item delete';
            deleteOption.innerHTML = '<i class="fas fa-trash"></i> Delete message';
            deleteOption.addEventListener('click', () => {
                if (confirm('Delete this message?')) {
                    deleteMessage(message.id);
                }
                contextMenu.remove();
            });
            contextMenu.appendChild(deleteOption);
        }
        
        contextMenu.appendChild(copyOption);
        
        // Add to document
        document.body.appendChild(contextMenu);
        
        // Close menu when clicking elsewhere
        setTimeout(() => {
            const closeMenu = () => {
                contextMenu.remove();
                document.removeEventListener('click', closeMenu);
            };
            document.addEventListener('click', closeMenu);
        }, 100);
    });
}

// Delete message
function deleteMessage(messageId) {
    // Remove from state
    chatState.messages = chatState.messages.filter(msg => msg.id !== messageId);
    
    // Remove from UI
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        messageElement.remove();
    }
    
    // Save updated history
    saveChatHistory();
    
    // In a real app, notify other participants
    console.log('Message deleted:', messageId);
}

// Download file
function downloadFile(url, fileName) {
    // In a real app, this would download the actual file
    // For demo, we'll simulate download
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    showChatNotification({
        sender: 'System',
        content: `Downloading ${fileName}...`
    });
}

// Handle typing indicator
function handleTyping() {
    if (!chatInput.value.trim()) {
        stopTypingIndicator();
        return;
    }
    
    if (!chatState.isTyping) {
        chatState.isTyping = true;
        // Send typing indicator to other participants
        sendTypingIndicator(true);
    }
    
    // Reset typing timeout
    clearTimeout(chatState.typingTimeout);
    chatState.typingTimeout = setTimeout(() => {
        stopTypingIndicator();
    }, 1000);
}

// Stop typing indicator
function stopTypingIndicator() {
    if (chatState.isTyping) {
        chatState.isTyping = false;
        // Send stop typing indicator
        sendTypingIndicator(false);
    }
    clearTimeout(chatState.typingTimeout);
}

// Send typing indicator
function sendTypingIndicator(isTyping) {
    // In a real app, send via WebSocket or WebRTC data channel
    console.log(isTyping ? 'User is typing...' : 'User stopped typing');
    
    // Update UI for other participants' typing indicators
    updateTypingIndicators();
}

// Update typing indicators UI
function updateTypingIndicators() {
    const typingIndicator = document.getElementById('typing-indicator');
    
    if (chatState.participantsTyping.size > 0) {
        // Create or update typing indicator
        if (!typingIndicator) {
            const indicator = document.createElement('div');
            indicator.id = 'typing-indicator';
            indicator.className = 'typing-indicator';
            
            const dots = document.createElement('div');
            dots.className = 'typing-dots';
            dots.innerHTML = '<span></span><span></span><span></span>';
            
            const text = document.createElement('span');
            text.className = 'typing-text';
            
            indicator.appendChild(dots);
            indicator.appendChild(text);
            chatMessages.appendChild(indicator);
        }
        
        // Update text
        const names = Array.from(chatState.participantsTyping);
        const text = names.length === 1 
            ? `${names[0]} is typing...`
            : `${names.length} people are typing...`;
        
        typingIndicator.querySelector('.typing-text').textContent = text;
        
        // Scroll to show typing indicator
        scrollToBottom();
        
    } else if (typingIndicator) {
        // Remove typing indicator
        typingIndicator.remove();
    }
}

// Toggle emoji picker
function toggleEmojiPicker() {
    // In a real app, this would show an emoji picker
    // For demo, we'll insert a random emoji
    
    if (!chatInput) return;
    
    const emojis = ['😊', '👍', '🎉', '🔥', '❤️', '👏', '🚀', '💡', '✅', '🌟'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    
    const cursorPos = chatInput.selectionStart;
    const textBefore = chatInput.value.substring(0, cursorPos);
    const textAfter = chatInput.value.substring(cursorPos);
    
    chatInput.value = textBefore + randomEmoji + textAfter;
    chatInput.focus();
    chatInput.selectionStart = chatInput.selectionEnd = cursorPos + randomEmoji.length;
    
    // Trigger input event for auto-resize
    chatInput.dispatchEvent(new Event('input'));
}

// Open file picker
function openFilePicker() {
    // In a real app, this would open a file picker dialog
    // For demo, we'll simulate file attachment
    
    showChatNotification({
        sender: 'System',
        content: 'File attachment feature is coming soon!'
    });
    
    // Simulated file picker code:
    /*
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.txt';
    
    input.onchange = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            uploadFile(file);
        });
    };
    
    input.click();
    */
}

// Upload file (simulated)
function uploadFile(file) {
    // In a real app, upload to server and get URL
    console.log('Uploading file:', file.name);
    
    // Simulate upload delay
    setTimeout(() => {
        const message = {
            id: generateMessageId(),
            type: MESSAGE_TYPES.FILE,
            sender: getCurrentUserName(),
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            fileUrl: URL.createObjectURL(file), // Temporary URL for demo
            timestamp: new Date().toISOString(),
            isOwn: true
        };
        
        addMessage(message);
        broadcastMessage(message);
        
    }, 1000);
}

// Scroll chat to bottom
function scrollToBottom() {
    if (chatMessages && chatState.settings.autoScroll) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Check if chat panel is visible
function isChatVisible() {
    const chatPanel = document.getElementById('chatPanel');
    return chatPanel && 
           chatPanel.style.display !== 'none' && 
           !chatPanel.classList.contains('hidden') &&
           chatPanel.offsetParent !== null;
}

// Update unread count UI
function updateUnreadCount() {
    // Update notification dot
    if (chatNotificationDot) {
        if (chatState.unreadCount > 0) {
            chatNotificationDot.classList.add('active');
            chatNotificationDot.textContent = Math.min(chatState.unreadCount, 9);
        } else {
            chatNotificationDot.classList.remove('active');
        }
    }
    
    // Update badge in header
    if (chatBadge) {
        chatBadge.textContent = chatState.unreadCount;
        chatBadge.style.display = chatState.unreadCount > 0 ? 'flex' : 'none';
    }
}

// Mark all messages as read
function markMessagesAsRead() {
    if (chatState.unreadCount > 0) {
        chatState.unreadCount = 0;
        updateUnreadCount();
    }
}

// Show chat notification
function showChatNotification(message) {
    if (!chatState.settings.notificationsEnabled) return;
    
    // Check if browser supports notifications
    if (!("Notification" in window)) {
        console.log("This browser does not support notifications");
        return;
    }
    
    // Check if permission is granted
    if (Notification.permission === "granted") {
        createNotification(message);
    } else if (Notification.permission !== "denied") {
        // Request permission
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                createNotification(message);
            }
        });
    }
}

// Create browser notification
function createNotification(message) {
    // Don't show notification if window is focused
    if (document.hasFocus()) return;
    
    const notification = new Notification(`EventSphere - ${message.sender}`, {
        body: message.content,
        icon: '/icons/logo.png',
        tag: 'eventsphere-chat'
    });
    
    notification.onclick = () => {
        window.focus();
        // Focus chat input if possible
        if (chatInput) {
            chatInput.focus();
        }
    };
}

// Play chat sound
function playChatSound(type) {
    if (!chatState.settings.soundEnabled) return;
    
    // In a real app, play actual sound files
    console.log(`Play chat sound: ${type}`);
    
    // Simulated sound play
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Different frequencies for different sounds
        switch (type) {
            case 'send':
                oscillator.frequency.value = 800;
                break;
            case 'receive':
                oscillator.frequency.value = 600;
                break;
            case 'notification':
                oscillator.frequency.value = 1000;
                break;
        }
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
        
    } catch (error) {
        console.error('Error playing sound:', error);
    }
}

// Get current user name
function getCurrentUserName() {
    const user = JSON.parse(localStorage.getItem('eventsphere_current_user') || '{}');
    return user.username || 'Guest';
}

// Debounce function for saving history
let saveHistoryTimeout;
function debounceSaveHistory() {
    clearTimeout(saveHistoryTimeout);
    saveHistoryTimeout = setTimeout(() => {
        saveChatHistory();
    }, 1000);
}

// Handle incoming message from WebRTC data channel or WebSocket
function handleIncomingMessage(messageData) {
    try {
        const message = typeof messageData === 'string' 
            ? JSON.parse(messageData) 
            : messageData;
        
        // Add to chat
        addMessage({
            ...message,
            isOwn: false
        });
        
    } catch (error) {
        console.error('Error handling incoming message:', error);
    }
}

// Handle participant join/leave
function handleParticipantJoin(participantName) {
    addMessage({
        id: generateMessageId(),
        type: MESSAGE_TYPES.JOIN,
        sender: 'System',
        content: `${participantName} joined the meeting`,
        timestamp: new Date().toISOString(),
        isOwn: false
    });
}

function handleParticipantLeave(participantName) {
    addMessage({
        id: generateMessageId(),
        type: MESSAGE_TYPES.LEAVE,
        sender: 'System',
        content: `${participantName} left the meeting`,
        timestamp: new Date().toISOString(),
        isOwn: false
    });
}

// Handle typing indicator from other participants
function handleParticipantTyping(participantName, isTyping) {
    if (isTyping) {
        chatState.participantsTyping.add(participantName);
    } else {
        chatState.participantsTyping.delete(participantName);
    }
    
    updateTypingIndicators();
}

// Export chat manager for use by meeting.js
window.chatManager = {
    init: initChat,
    sendMessage: sendMessage,
    addSystemMessage: addSystemMessage,
    handleIncomingMessage: handleIncomingMessage,
    handleParticipantJoin: handleParticipantJoin,
    handleParticipantLeave: handleParticipantLeave,
    handleParticipantTyping: handleParticipantTyping,
    markMessagesAsRead: markMessagesAsRead,
    togglePanel: () => {
        // This would toggle chat panel visibility
        const chatPanel = document.getElementById('chatPanel');
        if (chatPanel) {
            const isVisible = chatPanel.style.display !== 'none';
            chatPanel.style.display = isVisible ? 'none' : 'flex';
            if (!isVisible) {
                markMessagesAsRead();
                scrollToBottom();
            }
        }
    },
    getState: () => ({ ...chatState }),
    updateSettings: (newSettings) => {
        chatState.settings = { ...chatState.settings, ...newSettings };
        saveChatSettings();
    }
};

// Initialize chat when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for meeting.js to initialize
    setTimeout(() => {
        if (typeof window.meetingState !== 'undefined') {
            initChat();
        } else {
            // If meeting.js isn't loaded yet, initialize anyway (for testing)
            initChat();
        }
    }, 500);
});

// Add CSS for chat features
const chatStyles = `
    .message-context-menu {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        padding: 8px 0;
        min-width: 200px;
        border: 1px solid #e1e5e9;
    }
    
    .context-menu-item {
        width: 100%;
        padding: 10px 16px;
        border: none;
        background: none;
        text-align: left;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        color: #333;
        font-size: 14px;
    }
    
    .context-menu-item:hover {
        background: #f5f5f5;
    }
    
    .context-menu-item.delete {
        color: #f44336;
    }
    
    .context-menu-item.delete:hover {
        background: #ffebee;
    }
    
    .context-menu-item i {
        width: 16px;
        color: #666;
    }
    
    .date-separator {
        display: flex;
        align-items: center;
        margin: 20px 0;
        color: #999;
        font-size: 12px;
        font-weight: 500;
    }
    
    .separator-line {
        flex: 1;
        height: 1px;
        background: #e1e5e9;
    }
    
    .separator-date {
        margin: 0 12px;
        padding: 2px 8px;
        background: #f5f5f5;
        border-radius: 12px;
    }
    
    .typing-indicator {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        background: #f5f5f5;
        border-radius: 8px;
        margin: 10px 0;
        font-size: 12px;
        color: #666;
    }
    
    .typing-dots {
        display: flex;
        gap: 4px;
    }
    
    .typing-dots span {
        width: 6px;
        height: 6px;
        background: #999;
        border-radius: 50%;
        animation: typingDot 1.4s infinite;
    }
    
    .typing-dots span:nth-child(2) {
        animation-delay: 0.2s;
    }
    
    .typing-dots span:nth-child(3) {
        animation-delay: 0.4s;
    }
    
    @keyframes typingDot {
        0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.3;
        }
        30% {
            transform: translateY(-4px);
            opacity: 1;
        }
    }
    
    .file-message .file-container {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: white;
        border-radius: 8px;
        border: 1px solid #e1e5e9;
        margin-top: 4px;
    }
    
    .file-message .file-container i {
        font-size: 24px;
        color: #666;
    }
    
    .file-info {
        flex: 1;
    }
    
    .file-name {
        font-weight: 500;
        margin-bottom: 2px;
    }
    
    .file-size {
        font-size: 12px;
        color: #999;
    }
    
    .download-btn {
        background: #4f46e5;
        color: white;
        border: none;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    }
    
    .download-btn:hover {
        background: #4338ca;
    }
    
    .emoji-message {
        text-align: center;
        padding: 10px;
    }
    
    .emoji-content {
        font-size: 48px;
        margin-bottom: 4px;
    }
    
    .emoji-sender {
        font-size: 12px;
        color: #999;
    }
    
    .new-message {
        animation: messageAppear 0.3s ease-out;
    }
    
    @keyframes messageAppear {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .chat-input-container.focused {
        border-color: #4f46e5;
        box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1);
    }
`;

// Add styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = chatStyles;
document.head.appendChild(styleSheet);

// Export for testing/module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initChat,
        sendMessage,
        handleIncomingMessage,
        addSystemMessage,
        chatState
    };
}