// landing.js - Landing Page Functionality

// DOM Elements
const startMeetingBtn = document.getElementById('startMeetingBtn');
const joinMeetingBtn = document.getElementById('joinMeetingBtn');
const quickStartBtn = document.getElementById('quickStartBtn');
const logoutBtn = document.getElementById('logoutBtn');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const navMenu = document.getElementById('navMenu');
const usernameDisplay = document.getElementById('usernameDisplay');
const generateCodeBtn = document.getElementById('generateCodeBtn');
const generatedCode = document.getElementById('generatedCode');
const meetingCode = document.getElementById('meetingCode');
const meetingCodeJoin = document.getElementById('meetingCode');
const meetingCodeInput = document.getElementById('meetingCode');
const userProfile = document.getElementById('userProfile');
const navLinks = document.querySelectorAll('.nav-link');
const mobileMenuBtnIcon = document.querySelector('#mobileMenuBtn i');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const quickJoinBtn = document.getElementById('joinMeetingBtn'); // From hero section

// Constants
const MEETING_STORAGE_KEY = 'eventsphere_recent_meetings';
const USER_PREFERENCES_KEY = 'eventsphere_user_prefs';
const MEETING_CODES_KEY = 'eventsphere_generated_codes';

// Generate random meeting code
function generateMeetingCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    
    for (let i = 0; i < 9; i++) {
        if (i > 0 && i % 3 === 0) {
            code += '-';
        }
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return code;
}

// Show toast notification
function showToast(message, type = 'info') {
    toastMessage.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard!', 'success');
        return true;
    } catch (err) {
        console.error('Failed to copy: ', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            showToast('Copied to clipboard!', 'success');
            return true;
        } catch (fallbackErr) {
            console.error('Fallback copy failed: ', fallbackErr);
            showToast('Failed to copy to clipboard', 'error');
            return false;
        } finally {
            document.body.removeChild(textArea);
        }
    }
}

// Get current user
function getCurrentUser() {
    const user = localStorage.getItem('eventsphere_current_user');
    return user ? JSON.parse(user) : null;
}

// Save recent meeting
function saveRecentMeeting(meetingData) {
    const meetings = getRecentMeetings();
    
    // Remove if already exists
    const existingIndex = meetings.findIndex(m => m.code === meetingData.code);
    if (existingIndex > -1) {
        meetings.splice(existingIndex, 1);
    }
    
    // Add to beginning
    meetings.unshift(meetingData);
    
    // Keep only last 10 meetings
    const limitedMeetings = meetings.slice(0, 10);
    localStorage.setItem(MEETING_STORAGE_KEY, JSON.stringify(limitedMeetings));
}

// Get recent meetings
function getRecentMeetings() {
    const meetings = localStorage.getItem(MEETING_STORAGE_KEY);
    return meetings ? JSON.parse(meetings) : [];
}

// Save generated code
function saveGeneratedCode(code) {
    const codes = getGeneratedCodes();
    if (!codes.includes(code)) {
        codes.push(code);
        localStorage.setItem(MEETING_CODES_KEY, JSON.stringify(codes));
    }
}

// Get generated codes
function getGeneratedCodes() {
    const codes = localStorage.getItem(MEETING_CODES_KEY);
    return codes ? JSON.parse(codes) : [];
}

// Check meeting code existence (demo - in real app, check server)
function checkMeetingCode(code) {
    // Clean code format
    const cleanCode = code.replace(/-/g, '').toUpperCase();
    
    // Check if it's a generated code
    const generatedCodes = getGeneratedCodes();
    if (generatedCodes.includes(cleanCode)) {
        return {
            exists: true,
            active: true,
            type: 'generated'
        };
    }
    
    // Check recent meetings
    const recentMeetings = getRecentMeetings();
    const recentMeeting = recentMeetings.find(m => m.code === cleanCode);
    if (recentMeeting) {
        return {
            exists: true,
            active: recentMeeting.active || false,
            type: 'recent'
        };
    }
    
    // For demo, accept any valid format code
    if (/^[A-Z0-9]{9}$/.test(cleanCode)) {
        return {
            exists: true,
            active: true,
            type: 'demo'
        };
    }
    
    return {
        exists: false,
        active: false,
        type: 'invalid'
    };
}

// Get user preferences
function getUserPreferences() {
    const prefs = localStorage.getItem(USER_PREFERENCES_KEY);
    return prefs ? JSON.parse(prefs) : {
        joinWithVideo: true,
        joinWithAudio: true,
        enableEncryption: true,
        autoGenerateCode: true
    };
}

// Save user preferences
function saveUserPreferences(prefs) {
    localStorage.setItem(USER_PREFERENCES_KEY, JSON.stringify(prefs));
}

// Start a new meeting
async function startMeeting() {
    const user = getCurrentUser();
    if (!user) {
        showToast('Please log in first', 'error');
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 1000);
        return;
    }
    
    showToast('Creating new meeting...', 'info');
    
    // Generate meeting data
    const meetingCode = generateMeetingCode();
    const meetingData = {
        id: `meeting_${Date.now()}`,
        code: meetingCode.replace(/-/g, ''),
        host: user.username,
        hostId: user.id,
        createdAt: new Date().toISOString(),
        active: true,
        participants: 1,
        type: 'instant'
    };
    
    // Save generated code
    saveGeneratedCode(meetingData.code);
    
    // Save as recent meeting
    saveRecentMeeting(meetingData);
    
    // Redirect to meeting page with code as query parameter
    setTimeout(() => {
        window.location.href = `/meeting.html?code=${meetingData.code}&host=true`;
    }, 500);
}

// Join existing meeting
function joinMeeting(code = null) {
    const user = getCurrentUser();
    if (!user) {
        showToast('Please log in first', 'error');
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 1000);
        return;
    }
    
    let meetingCodeToJoin = code;
    
    // If no code provided, get from input
    if (!meetingCodeToJoin) {
        meetingCodeToJoin = meetingCodeInput ? meetingCodeInput.value.trim() : '';
    }
    
    if (!meetingCodeToJoin) {
        showToast('Please enter a meeting code', 'error');
        if (meetingCodeInput) {
            meetingCodeInput.focus();
            meetingCodeInput.classList.add('error');
            setTimeout(() => meetingCodeInput.classList.remove('error'), 2000);
        }
        return;
    }
    
    // Clean and validate code
    const cleanCode = meetingCodeToJoin.replace(/-/g, '').toUpperCase();
    
    if (!/^[A-Z0-9]{9}$/.test(cleanCode)) {
        showToast('Invalid meeting code format. Use format: ABC-DEF-GHI', 'error');
        if (meetingCodeInput) {
            meetingCodeInput.focus();
            meetingCodeInput.classList.add('error');
            setTimeout(() => meetingCodeInput.classList.remove('error'), 2000);
        }
        return;
    }
    
    // Check if meeting exists
    const meetingCheck = checkMeetingCode(cleanCode);
    
    if (!meetingCheck.exists) {
        showToast('Meeting not found. Check the code and try again.', 'error');
        return;
    }
    
    if (!meetingCheck.active) {
        showToast('This meeting has ended or is inactive', 'error');
        return;
    }
    
    showToast(`Joining meeting ${cleanCode.match(/.{1,3}/g).join('-')}...`, 'info');
    
    // Get user preferences
    const prefs = getUserPreferences();
    
    // Save as recent meeting if not already
    if (meetingCheck.type === 'demo') {
        const meetingData = {
            id: `meeting_${Date.now()}`,
            code: cleanCode,
            host: 'Demo Host',
            hostId: 'demo',
            joinedAt: new Date().toISOString(),
            active: true,
            participants: 2,
            type: 'joined'
        };
        saveRecentMeeting(meetingData);
    }
    
    // Redirect to meeting page with code and user data
    setTimeout(() => {
        const params = new URLSearchParams({
            code: cleanCode,
            name: user.username,
            video: prefs.joinWithVideo,
            audio: prefs.joinWithAudio,
            encrypted: prefs.enableEncryption
        });
        window.location.href = `/meeting.html?${params.toString()}`;
    }, 500);
}

// Generate meeting code for scheduling
function generateMeetingCodeForScheduling() {
    const code = generateMeetingCode();
    const cleanCode = code.replace(/-/g, '');
    
    // Save generated code
    saveGeneratedCode(cleanCode);
    
    // Update display
    generatedCode.textContent = code;
    generatedCode.style.cursor = 'pointer';
    
    // Add click to copy
    generatedCode.onclick = () => {
        copyToClipboard(code);
    };
    
    // Save meeting data for later
    const user = getCurrentUser();
    const meetingData = {
        id: `scheduled_${Date.now()}`,
        code: cleanCode,
        host: user ? user.username : 'Guest',
        hostId: user ? user.id : 'guest',
        createdAt: new Date().toISOString(),
        scheduled: true,
        active: false,
        participants: 0,
        type: 'scheduled'
    };
    
    saveRecentMeeting(meetingData);
    
    showToast('Meeting code generated! Click to copy.', 'success');
    
    return code;
}

// Update user interface
function updateUI() {
    const user = getCurrentUser();
    
    if (user) {
        // Display username
        if (usernameDisplay) {
            usernameDisplay.textContent = user.username;
        }
        
        // Update user profile
        if (userProfile) {
            const avatar = userProfile.querySelector('i');
            if (avatar) {
                // Add first letter as avatar if no icon
                avatar.textContent = user.username.charAt(0).toUpperCase();
            }
        }
    } else {
        // Redirect to login if not authenticated
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 100);
    }
    
    // Load recent meetings
    loadRecentMeetings();
    
    // Initialize meeting code input formatting
    initMeetingCodeInput();
}

// Load recent meetings
function loadRecentMeetings() {
    const meetingList = document.getElementById('meetingList');
    if (!meetingList) return;
    
    const meetings = getRecentMeetings();
    
    if (meetings.length === 0) {
        meetingList.innerHTML = `
            <div class="empty-state">
                <p style="text-align: center; color: #666; font-style: italic;">
                    No recent meetings found
                </p>
            </div>
        `;
        return;
    }
    
    meetingList.innerHTML = meetings.map(meeting => {
        const formattedCode = meeting.code.match(/.{1,3}/g).join('-');
        const date = new Date(meeting.createdAt || meeting.joinedAt);
        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateString = date.toLocaleDateString();
        
        return `
            <div class="meeting-item" data-code="${meeting.code}">
                <div class="meeting-info">
                    <h4>${formattedCode}</h4>
                    <p>${meeting.host} • ${dateString} ${timeString}</p>
                </div>
                <div class="meeting-status">
                    <span class="status-dot ${meeting.active ? 'active' : 'ended'}"></span>
                    <span>${meeting.active ? 'Active' : 'Ended'}</span>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click handlers to meeting items
    document.querySelectorAll('.meeting-item').forEach(item => {
        item.addEventListener('click', () => {
            const code = item.dataset.code;
            meetingCodeInput.value = code.match(/.{1,3}/g).join('-');
            joinMeeting(code);
        });
    });
}

// Initialize meeting code input with auto-formatting
function initMeetingCodeInput() {
    if (!meetingCodeInput) return;
    
    meetingCodeInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        
        // Auto-insert dashes
        if (value.length > 3) {
            value = value.substring(0, 3) + '-' + value.substring(3);
        }
        if (value.length > 7) {
            value = value.substring(0, 7) + '-' + value.substring(7);
        }
        if (value.length > 11) {
            value = value.substring(0, 11);
        }
        
        e.target.value = value;
        
        // Auto-focus next input part (for join page)
        const codeParts = document.querySelectorAll('.code-part');
        if (codeParts.length > 0) {
            const currentIndex = parseInt(e.target.dataset.index || 0);
            if (e.target.value.length === 3 && currentIndex < 2) {
                codeParts[currentIndex + 1].focus();
            }
        }
    });
    
    // Handle paste
    meetingCodeInput.addEventListener('paste', function(e) {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        const cleanText = pastedText.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        
        if (cleanText.length >= 9) {
            const formatted = cleanText.substring(0, 9).match(/.{1,3}/g).join('-');
            this.value = formatted;
            
            // Trigger join if auto-join is enabled
            const prefs = getUserPreferences();
            if (prefs.autoJoinOnPaste) {
                setTimeout(() => joinMeeting(cleanText.substring(0, 9)), 100);
            }
        }
    });
}

// Toggle mobile menu
function toggleMobileMenu() {
    navMenu.classList.toggle('show');
    if (mobileMenuBtnIcon) {
        if (navMenu.classList.contains('show')) {
            mobileMenuBtnIcon.classList.remove('fa-bars');
            mobileMenuBtnIcon.classList.add('fa-times');
        } else {
            mobileMenuBtnIcon.classList.add('fa-bars');
            mobileMenuBtnIcon.classList.remove('fa-times');
        }
    }
}

// Handle navigation smooth scroll
function initSmoothScroll() {
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId.startsWith('#')) {
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    // Close mobile menu if open
                    if (navMenu.classList.contains('show')) {
                        toggleMobileMenu();
                    }
                    
                    // Scroll to section
                    window.scrollTo({
                        top: targetElement.offsetTop - 80,
                        behavior: 'smooth'
                    });
                    
                    // Update active nav link
                    navLinks.forEach(l => l.classList.remove('active'));
                    this.classList.add('active');
                }
            } else {
                // Handle external links
                window.location.href = targetId;
            }
        });
    });
    
    // Update active nav link on scroll
    window.addEventListener('scroll', () => {
        const scrollPosition = window.scrollY + 100;
        
        // Get all sections
        const sections = document.querySelectorAll('section[id]');
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            const sectionId = section.getAttribute('id');
            
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    });
}

// Handle keyboard shortcuts
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + N to start new meeting
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            startMeeting();
        }
        
        // Ctrl/Cmd + J to focus join input
        if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
            e.preventDefault();
            if (meetingCodeInput) {
                meetingCodeInput.focus();
                meetingCodeInput.select();
            }
        }
        
        // Escape to close mobile menu
        if (e.key === 'Escape' && navMenu.classList.contains('show')) {
            toggleMobileMenu();
        }
        
        // Enter in join input to join meeting
        if (e.key === 'Enter' && meetingCodeInput && 
            meetingCodeInput === document.activeElement && 
            meetingCodeInput.value.trim()) {
            joinMeeting();
        }
    });
}

// Handle user profile click
function initUserProfile() {
    if (userProfile) {
        userProfile.addEventListener('click', () => {
            showToast(`Logged in as ${getCurrentUser()?.username || 'Guest'}`, 'info');
        });
    }
}

// Initialize statistics animation
function initStatsAnimation() {
    const stats = document.querySelectorAll('.stat h3');
    if (stats.length === 0) return;
    
    const observerOptions = {
        threshold: 0.5
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                stats.forEach(stat => {
                    const target = parseInt(stat.textContent.replace(/,/g, ''));
                    const suffix = stat.textContent.replace(/[0-9,]/g, '');
                    animateCounter(stat, 0, target, 2000, suffix);
                });
                observer.disconnect();
            }
        });
    }, observerOptions);
    
    const statsSection = document.querySelector('.hero-stats');
    if (statsSection) {
        observer.observe(statsSection);
    }
}

// Animate counter
function animateCounter(element, start, end, duration, suffix = '') {
    const startTime = performance.now();
    const step = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const currentValue = Math.floor(progress * (end - start) + start);
        element.textContent = currentValue.toLocaleString() + suffix;
        
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    };
    
    requestAnimationFrame(step);
}

// Initialize floating card animation
function initFloatingCard() {
    const card = document.querySelector('.floating-card');
    if (!card) return;
    
    let mouseX = 0;
    let mouseY = 0;
    let cardX = 0;
    let cardY = 0;
    
    const updateCardPosition = () => {
        const dx = (mouseX - window.innerWidth / 2) * 0.01;
        const dy = (mouseY - window.innerHeight / 2) * 0.01;
        
        cardX += (dx - cardX) * 0.1;
        cardY += (dy - cardY) * 0.1;
        
        card.style.transform = `translate(${cardX}px, ${cardY}px) rotateX(${cardY * 0.1}deg) rotateY(${cardX * 0.1}deg)`;
        
        requestAnimationFrame(updateCardPosition);
    };
    
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });
    
    updateCardPosition();
}

// Initialize page
function initLandingPage() {
    // Check authentication
    const user = getCurrentUser();
    if (!user) {
        window.location.href = '/index.html';
        return;
    }
    
    // Update UI with user data
    updateUI();
    
    // Initialize event listeners
    if (startMeetingBtn) {
        startMeetingBtn.addEventListener('click', startMeeting);
    }
    
    if (joinMeetingBtn) {
        joinMeetingBtn.addEventListener('click', () => joinMeeting());
    }
    
    if (quickStartBtn) {
        quickStartBtn.addEventListener('click', startMeeting);
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('eventsphere_current_user');
            showToast('Logged out successfully', 'success');
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 1000);
        });
    }
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }
    
    if (generateCodeBtn) {
        generateCodeBtn.addEventListener('click', generateMeetingCodeForScheduling);
    }
    
    // Initialize generated code display
    if (generatedCode) {
        generatedCode.addEventListener('click', () => {
            if (generatedCode.textContent !== 'Click to generate') {
                copyToClipboard(generatedCode.textContent);
            }
        });
    }
    
    // Initialize features
    initSmoothScroll();
    initKeyboardShortcuts();
    initUserProfile();
    initStatsAnimation();
    initFloatingCard();
    
    // Pre-generate a code for display
    if (generatedCode && generatedCode.textContent === 'Click to generate') {
        const prefs = getUserPreferences();
        if (prefs.autoGenerateCode) {
            generateMeetingCodeForScheduling();
        }
    }
    
    // Handle demo mode
    if (window.location.hash === '#demo') {
        showToast('Demo mode activated. Try creating or joining a meeting!', 'info');
    }
    
    // Show welcome message
    setTimeout(() => {
        showToast(`Welcome to EventSphere, ${user.username}!`, 'success');
    }, 1000);
}

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        // Page became visible again, refresh user data
        updateUI();
    }
});

// Handle beforeunload
window.addEventListener('beforeunload', () => {
    // Save any unsaved preferences
    const prefs = getUserPreferences();
    saveUserPreferences(prefs);
});

// Chatbot functionality
function initChatbot() {
    const chatbotToggle = document.getElementById('chatbot-toggle');
    const chatbotPopup = document.getElementById('chatbot-popup');
    const chatbotClose = document.getElementById('chatbot-close');
    const chatbotInput = document.getElementById('chatbot-input-field');
    const chatbotSend = document.getElementById('chatbot-send');
    const chatbotMessages = document.getElementById('chatbot-messages');

    // Toggle chatbot
    chatbotToggle.addEventListener('click', () => {
        chatbotPopup.classList.toggle('show');
    });

    // Close chatbot
    chatbotClose.addEventListener('click', () => {
        chatbotPopup.classList.remove('show');
    });

    // Send message
    function sendMessage() {
        const message = chatbotInput.value.trim();
        if (!message) return;

        // Add user message
        addMessage(message, 'user-message');
        chatbotInput.value = '';

        // Generate bot response
        setTimeout(() => {
            const response = generateBotResponse(message);
            addMessage(response, 'bot-message');
        }, 500);
    }

    // Add message to chat
    function addMessage(content, className) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${className}`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;

        messageDiv.appendChild(contentDiv);
        chatbotMessages.appendChild(messageDiv);

        // Scroll to bottom
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }

    // Generate bot response
    function generateBotResponse(userMessage) {
        const message = userMessage.toLowerCase();

        // Basic responses
        if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
            return "Hello! I'm your EventSphere assistant. How can I help you today?";
        }

        if (message.includes('meeting') && message.includes('start')) {
            return "To start a new meeting, click the 'Start New Meeting' button in the hero section above. You'll get a unique meeting code to share with participants.";
        }

        if (message.includes('meeting') && message.includes('join')) {
            return "To join a meeting, enter the meeting code in the 'Join' section and click the join button. Make sure you have the correct 9-character code.";
        }

        if (message.includes('schedule') || message.includes('calendar')) {
            return "You can schedule events using the Schedule link in the navigation menu. Click on any date in the calendar to create a new event.";
        }

        if (message.includes('code') && message.includes('generate')) {
            return "You can generate a meeting code by clicking the 'Generate Meeting Code' button in the quick start section. This creates a unique code for your scheduled meeting.";
        }

        if (message.includes('help') || message.includes('support')) {
            return "I'm here to help! You can ask me about:\n• Starting meetings\n• Joining meetings\n• Scheduling events\n• Generating codes\n• Using the platform features";
        }

        if (message.includes('video') || message.includes('audio')) {
            return "EventSphere supports HD video and audio conferencing. Make sure your camera and microphone permissions are enabled in your browser.";
        }

        if (message.includes('bye') || message.includes('goodbye')) {
            return "Goodbye! Feel free to come back anytime if you need assistance.";
        }

        // Default responses
        const defaultResponses = [
            "I'm not sure I understand. Could you please rephrase your question?",
            "Let me help you with that. What specific feature are you interested in?",
            "I can assist you with meetings, scheduling, and platform features. What would you like to know?",
            "That's an interesting question! I'm here to help with EventSphere features and functionality."
        ];

        return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
    }

    // Event listeners
    chatbotSend.addEventListener('click', sendMessage);

    chatbotInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!chatbotPopup.contains(e.target) && !chatbotToggle.contains(e.target)) {
            chatbotPopup.classList.remove('show');
        }
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initLandingPage();
    initChatbot();
});

// Export for testing/module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateMeetingCode,
        checkMeetingCode,
        startMeeting,
        joinMeeting,
        getCurrentUser,
        getRecentMeetings,
        saveRecentMeeting
    };
}