// join.js - Join Meeting Functionality

// DOM Elements
const joinMeetingBtn = document.getElementById('joinMeetingBtn');
const cancelBtn = document.getElementById('cancelBtn');
const backToHome = document.getElementById('backToHome');
const meetingList = document.getElementById('meetingList');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const meetingLink = document.getElementById('meetingLink');
const copyMeetingLinkBtn = document.getElementById('copyMeetingLink');
const inviteMeetingId = document.getElementById('inviteMeetingId');
const copyMeetingId2 = document.getElementById('copyMeetingId2');
const closeHelpModal = document.getElementById('closeHelpModal');
const closeHelpBtn = document.getElementById('closeHelpBtn');
const helpModal = document.getElementById('helpModal');
const displayNameInput = document.getElementById('displayName');
const codeParts = document.querySelectorAll('.code-part');
const joinWithVideo = document.getElementById('joinWithVideo');
const joinWithAudio = document.getElementById('joinWithAudio');
const enableEncryption = document.getElementById('enableEncryption');
const shareButtons = document.querySelectorAll('.share-btn');

// State Management
let joinState = {
    meetingCode: '',
    displayName: '',
    joinOptions: {
        video: true,
        audio: true,
        encryption: true
    },
    recentMeetings: [],
    generatedMeetingLink: '',
    userPreferences: {}
};

// Constants
const RECENT_MEETINGS_KEY = 'eventsphere_recent_meetings_join';
const USER_PREFERENCES_KEY = 'eventsphere_join_preferences';
const MEETING_HISTORY_KEY = 'eventsphere_meeting_history';

// Initialize join page
function initJoinPage() {
    // Check if user is authenticated
    const user = getCurrentUser();
    if (!user) {
        showError('Please log in first');
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 2000);
        return;
    }
    
    // Load user preferences
    loadUserPreferences();
    
    // Load recent meetings
    loadRecentMeetings();
    
    // Initialize UI
    initUI();
    
    // Initialize event listeners
    initEventListeners();
    
    // Set focus to first code input
    if (codeParts.length > 0) {
        codeParts[0].focus();
    }
    
    // Set default display name
    if (displayNameInput) {
        displayNameInput.value = user.username || '';
        joinState.displayName = displayNameInput.value;
    }
    
    // Update join options from preferences
    updateJoinOptionsFromPreferences();
}

// Get current user
function getCurrentUser() {
    const user = localStorage.getItem('eventsphere_current_user');
    return user ? JSON.parse(user) : null;
}

// Load user preferences
function loadUserPreferences() {
    try {
        const prefs = localStorage.getItem(USER_PREFERENCES_KEY);
        if (prefs) {
            joinState.userPreferences = JSON.parse(prefs);
        }
    } catch (error) {
        console.error('Error loading preferences:', error);
    }
}

// Save user preferences
function saveUserPreferences() {
    try {
        localStorage.setItem(USER_PREFERENCES_KEY, JSON.stringify(joinState.userPreferences));
    } catch (error) {
        console.error('Error saving preferences:', error);
    }
}

// Load recent meetings
function loadRecentMeetings() {
    try {
        const meetings = localStorage.getItem(RECENT_MEETINGS_KEY);
        joinState.recentMeetings = meetings ? JSON.parse(meetings) : [];
        
        // Also load from meeting history
        const history = localStorage.getItem(MEETING_HISTORY_KEY);
        if (history) {
            const meetingHistory = JSON.parse(history);
            // Add history meetings that aren't already in recent
            meetingHistory.forEach(meeting => {
                const exists = joinState.recentMeetings.some(m => m.code === meeting.code);
                if (!exists && meeting.code) {
                    joinState.recentMeetings.push({
                        code: meeting.code,
                        name: meeting.name || 'Meeting',
                        timestamp: meeting.timestamp || new Date().toISOString(),
                        participants: meeting.participants || 0,
                        duration: meeting.duration || 0,
                        isHost: meeting.isHost || false,
                        active: false // Mark as inactive since it's from history
                    });
                }
            });
        }
        
        // Sort by most recent
        joinState.recentMeetings.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        // Limit to 10 most recent
        joinState.recentMeetings = joinState.recentMeetings.slice(0, 10);
        
    } catch (error) {
        console.error('Error loading recent meetings:', error);
        joinState.recentMeetings = [];
    }
}

// Save recent meeting
function saveRecentMeeting(meetingData) {
    try {
        // Add to beginning of array
        joinState.recentMeetings.unshift(meetingData);
        
        // Remove duplicates
        const uniqueMeetings = [];
        const seenCodes = new Set();
        
        joinState.recentMeetings.forEach(meeting => {
            if (!seenCodes.has(meeting.code)) {
                seenCodes.add(meeting.code);
                uniqueMeetings.push(meeting);
            }
        });
        
        // Keep only 10 most recent
        joinState.recentMeetings = uniqueMeetings.slice(0, 10);
        
        // Save to localStorage
        localStorage.setItem(RECENT_MEETINGS_KEY, JSON.stringify(joinState.recentMeetings));
        
    } catch (error) {
        console.error('Error saving recent meeting:', error);
    }
}

// Initialize UI
function initUI() {
    // Initialize meeting code input
    initMeetingCodeInput();
    
    // Update recent meetings list
    updateRecentMeetingsList();
    
    // Generate meeting link placeholder
    if (meetingLink) {
        meetingLink.value = 'Generating...';
        generateMeetingLink();
    }
    
    // Update invite meeting ID
    if (inviteMeetingId) {
        inviteMeetingId.textContent = '-----';
    }
}

// Initialize meeting code input with auto-focus
function initMeetingCodeInput() {
    codeParts.forEach((part, index) => {
        // Handle input
        part.addEventListener('input', function(e) {
            const value = e.target.value.toUpperCase();
            
            // Only allow letters and numbers
            const filteredValue = value.replace(/[^A-Z0-9]/g, '');
            
            if (filteredValue !== value) {
                e.target.value = filteredValue;
            }
            
            // Move to next input if this one is filled
            if (filteredValue.length === 3 && index < 2) {
                codeParts[index + 1].focus();
            }
            
            // Update visual state
            updateCodePartState(part, filteredValue.length > 0);
            
            // Update meeting code
            updateMeetingCode();
        });
        
        // Handle paste
        part.addEventListener('paste', function(e) {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            handlePastedCode(pastedText);
        });
        
        // Handle backspace
        part.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && this.value.length === 0 && index > 0) {
                e.preventDefault();
                codeParts[index - 1].focus();
                codeParts[index - 1].select();
            }
            
            // Handle arrow keys
            if (e.key === 'ArrowLeft' && this.selectionStart === 0 && index > 0) {
                codeParts[index - 1].focus();
                codeParts[index - 1].setSelectionRange(3, 3);
            }
            
            if (e.key === 'ArrowRight' && this.selectionStart === this.value.length && index < 2) {
                codeParts[index + 1].focus();
                codeParts[index + 1].setSelectionRange(0, 0);
            }
        });
        
        // Handle focus
        part.addEventListener('focus', function() {
            this.select();
            updateCodePartState(this, true, 'focus');
        });
        
        // Handle blur
        part.addEventListener('blur', function() {
            updateCodePartState(this, this.value.length > 0, 'blur');
        });
    });
}

// Update visual state of code part
function updateCodePartState(element, filled, state = '') {
    element.classList.remove('filled', 'error', 'focus');
    
    if (filled) {
        element.classList.add('filled');
    }
    
    if (state === 'focus') {
        element.classList.add('focus');
    }
    
    if (state === 'error') {
        element.classList.add('error');
    }
}

// Handle pasted code
function handlePastedCode(pastedText) {
    // Clean the pasted text
    const cleanText = pastedText.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    
    if (cleanText.length >= 9) {
        // Fill all three parts
        const part1 = cleanText.substring(0, 3);
        const part2 = cleanText.substring(3, 6);
        const part3 = cleanText.substring(6, 9);
        
        codeParts[0].value = part1;
        codeParts[1].value = part2;
        codeParts[2].value = part3;
        
        // Update visual states
        codeParts.forEach(part => updateCodePartState(part, true));
        
        // Focus the last part
        codeParts[2].focus();
        
        // Update meeting code
        updateMeetingCode();
        
        // Auto-join if preference is set
        if (joinState.userPreferences.autoJoinOnPaste) {
            setTimeout(() => {
                joinMeetingBtn.click();
            }, 300);
        }
    } else if (cleanText.length > 0) {
        // Not enough characters, show error
        showError('Pasted code is too short. Need 9 characters.');
    }
}

// Update meeting code from input parts
function updateMeetingCode() {
    const code = Array.from(codeParts)
        .map(part => part.value.toUpperCase())
        .join('');
    
    joinState.meetingCode = code;
    
    // Update invite meeting ID if displayed
    if (inviteMeetingId && code.length === 9) {
        const formattedCode = code.match(/.{1,3}/g).join('-');
        inviteMeetingId.textContent = formattedCode;
    }
}

// Update recent meetings list UI
function updateRecentMeetingsList() {
    if (!meetingList || joinState.recentMeetings.length === 0) {
        return;
    }
    
    let html = '';
    
    joinState.recentMeetings.forEach((meeting, index) => {
        const formattedCode = meeting.code.match(/.{1,3}/g)?.join('-') || meeting.code;
        const date = new Date(meeting.timestamp);
        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateString = date.toLocaleDateString();
        
        html += `
            <div class="meeting-item" data-index="${index}">
                <div class="meeting-info">
                    <h4>${formattedCode}</h4>
                    <p>${meeting.name} • ${dateString} ${timeString}</p>
                </div>
                <div class="meeting-status">
                    <span class="status-dot ${meeting.active ? 'active' : 'ended'}"></span>
                    <span>${meeting.active ? 'Active' : 'Ended'}</span>
                </div>
            </div>
        `;
    });
    
    meetingList.innerHTML = html;
    
    // Add click handlers to meeting items
    document.querySelectorAll('.meeting-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            const meeting = joinState.recentMeetings[index];
            
            // Fill the meeting code
            const formattedCode = meeting.code.match(/.{1,3}/g)?.join('-') || meeting.code;
            const codeArray = formattedCode.split('-');
            
            codeParts.forEach((part, i) => {
                part.value = codeArray[i] || '';
                updateCodePartState(part, part.value.length > 0);
            });
            
            // Update meeting code
            updateMeetingCode();
            
            // Focus the join button
            joinMeetingBtn.focus();
            
            // Show info message
            showError(`Loaded meeting: ${meeting.name}`, 'info');
        });
    });
}

// Update join options from preferences
function updateJoinOptionsFromPreferences() {
    if (joinState.userPreferences.joinWithVideo !== undefined) {
        joinWithVideo.checked = joinState.userPreferences.joinWithVideo;
        joinState.joinOptions.video = joinState.userPreferences.joinWithVideo;
    }
    
    if (joinState.userPreferences.joinWithAudio !== undefined) {
        joinWithAudio.checked = joinState.userPreferences.joinWithAudio;
        joinState.joinOptions.audio = joinState.userPreferences.joinWithAudio;
    }
    
    if (joinState.userPreferences.enableEncryption !== undefined) {
        enableEncryption.checked = joinState.userPreferences.enableEncryption;
        joinState.joinOptions.encryption = joinState.userPreferences.enableEncryption;
    }
}

// Generate meeting link
function generateMeetingLink() {
    if (!meetingLink) return;
    
    // In a real app, this would be a proper URL
    // For demo, we'll create a placeholder
    const baseUrl = window.location.origin;
    joinState.generatedMeetingLink = `${baseUrl}/meeting.html?code=DEMO12345`;
    
    meetingLink.value = joinState.generatedMeetingLink;
}

// Validate meeting code
function validateMeetingCode(code) {
    if (!code || code.length !== 9) {
        return {
            isValid: false,
            message: 'Meeting code must be 9 characters (letters and numbers only)'
        };
    }
    
    if (!/^[A-Z0-9]{9}$/.test(code)) {
        return {
            isValid: false,
            message: 'Invalid characters. Use only letters (A-Z) and numbers (0-9)'
        };
    }
    
    return {
        isValid: true,
        message: 'Valid meeting code'
    };
}

// Validate display name
function validateDisplayName(name) {
    if (!name || name.trim().length === 0) {
        return {
            isValid: false,
            message: 'Please enter your name'
        };
    }
    
    if (name.length > 50) {
        return {
            isValid: false,
            message: 'Name must be less than 50 characters'
        };
    }
    
    if (/[<>]/.test(name)) {
        return {
            isValid: false,
            message: 'Name contains invalid characters'
        };
    }
    
    return {
        isValid: true,
        message: 'Valid name'
    };
}

// Show error message
function showError(message, type = 'error') {
    if (!errorMessage || !errorText) return;
    
    errorText.textContent = message;
    errorMessage.className = 'error-message';
    
    if (type === 'error') {
        errorMessage.classList.add('show');
        errorMessage.style.backgroundColor = '#fee';
        errorMessage.style.color = '#c33';
    } else if (type === 'info') {
        errorMessage.classList.add('show');
        errorMessage.style.backgroundColor = '#e8f4fd';
        errorMessage.style.color = '#0366d6';
    } else if (type === 'success') {
        errorMessage.classList.add('show');
        errorMessage.style.backgroundColor = '#d4edda';
        errorMessage.style.color = '#155724';
    }
    
    // Auto-hide after 5 seconds for non-error messages
    if (type !== 'error') {
        setTimeout(() => {
            errorMessage.classList.remove('show');
        }, 5000);
    }
}

// Hide error message
function hideError() {
    if (errorMessage) {
        errorMessage.classList.remove('show');
    }
}

// Join meeting
async function joinMeeting() {
    // Get values
    const meetingCode = joinState.meetingCode;
    const displayName = displayNameInput ? displayNameInput.value.trim() : '';
    
    // Validate
    const codeValidation = validateMeetingCode(meetingCode);
    if (!codeValidation.isValid) {
        showError(codeValidation.message);
        highlightInvalidCodeParts();
        return;
    }
    
    const nameValidation = validateDisplayName(displayName);
    if (!nameValidation.isValid) {
        showError(nameValidation.message);
        if (displayNameInput) {
            displayNameInput.focus();
            displayNameInput.classList.add('error');
            setTimeout(() => displayNameInput.classList.remove('error'), 2000);
        }
        return;
    }
    
    // Update state
    joinState.displayName = displayName;
    
    // Update join options from checkboxes
    joinState.joinOptions.video = joinWithVideo ? joinWithVideo.checked : true;
    joinState.joinOptions.audio = joinWithAudio ? joinWithAudio.checked : true;
    joinState.joinOptions.encryption = enableEncryption ? enableEncryption.checked : true;
    
    // Save user preferences
    joinState.userPreferences = {
        ...joinState.userPreferences,
        joinWithVideo: joinState.joinOptions.video,
        joinWithAudio: joinState.joinOptions.audio,
        enableEncryption: joinState.joinOptions.encryption,
        lastDisplayName: displayName
    };
    saveUserPreferences();
    
    // Check if meeting exists (demo simulation)
    const meetingExists = await checkMeetingExists(meetingCode);
    
    if (!meetingExists) {
        showError('Meeting not found. Please check the code and try again.');
        return;
    }
    
    // Save as recent meeting
    saveRecentMeeting({
        code: meetingCode,
        name: 'Meeting ' + meetingCode.match(/.{1,3}/g).join('-'),
        timestamp: new Date().toISOString(),
        participants: 0,
        duration: 0,
        isHost: false,
        active: true
    });
    
    // Show loading state
    if (joinMeetingBtn) {
        const originalText = joinMeetingBtn.innerHTML;
        joinMeetingBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Joining...';
        joinMeetingBtn.disabled = true;
        
        // Restore button after delay
        setTimeout(() => {
            joinMeetingBtn.innerHTML = originalText;
            joinMeetingBtn.disabled = false;
        }, 2000);
    }
    
    // Simulate joining process
    showError('Joining meeting...', 'info');
    
    // Redirect to meeting page after delay
    setTimeout(() => {
        redirectToMeeting(meetingCode, displayName);
    }, 1500);
}

// Highlight invalid code parts
function highlightInvalidCodeParts() {
    codeParts.forEach(part => {
        if (!part.value || part.value.length < 3) {
            updateCodePartState(part, false, 'error');
        }
    });
}

// Check if meeting exists (demo simulation)
async function checkMeetingExists(meetingCode) {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // For demo purposes:
    // 1. Check if it's a valid format
    // 2. Check if it's in recent meetings (active ones)
    // 3. For demo, accept any valid format code
    
    const formattedCode = meetingCode.match(/.{1,3}/g)?.join('-');
    
    // Check recent active meetings
    const activeMeeting = joinState.recentMeetings.find(m => 
        m.code === meetingCode && m.active === true
    );
    
    if (activeMeeting) {
        return true;
    }
    
    // For demo, accept certain patterns
    const demoPatterns = ['DEMO', 'TEST', 'MEET', 'VIDEO', 'JOIN'];
    const isDemoCode = demoPatterns.some(pattern => 
        meetingCode.includes(pattern)
    );
    
    if (isDemoCode) {
        return true;
    }
    
    // Accept any code that looks valid (for demo purposes)
    // In production, this would check against a database
    return /^[A-Z0-9]{9}$/.test(meetingCode);
}

// Redirect to meeting page
function redirectToMeeting(meetingCode, displayName) {
    const params = new URLSearchParams({
        code: meetingCode,
        name: displayName,
        video: joinState.joinOptions.video ? 'true' : 'false',
        audio: joinState.joinOptions.audio ? 'true' : 'false',
        encrypted: joinState.joinOptions.encryption ? 'true' : 'false'
    });
    
    window.location.href = `/meeting.html?${params.toString()}`;
}

// Copy meeting link to clipboard
async function copyMeetingLink() {
    if (!joinState.generatedMeetingLink) {
        generateMeetingLink();
    }
    
    try {
        await navigator.clipboard.writeText(joinState.generatedMeetingLink);
        showError('Meeting link copied to clipboard!', 'success');
        
        // Update button text temporarily
        if (copyMeetingLinkBtn) {
            const originalText = copyMeetingLinkBtn.innerHTML;
            copyMeetingLinkBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            
            setTimeout(() => {
                copyMeetingLinkBtn.innerHTML = originalText;
            }, 2000);
        }
    } catch (error) {
        console.error('Failed to copy:', error);
        showError('Failed to copy to clipboard', 'error');
    }
}

// Copy meeting ID to clipboard
async function copyMeetingId() {
    if (!joinState.meetingCode || joinState.meetingCode.length !== 9) {
        showError('Please enter a valid meeting code first');
        return;
    }
    
    const formattedCode = joinState.meetingCode.match(/.{1,3}/g).join('-');
    
    try {
        await navigator.clipboard.writeText(formattedCode);
        showError('Meeting ID copied to clipboard!', 'success');
    } catch (error) {
        console.error('Failed to copy:', error);
        showError('Failed to copy to clipboard', 'error');
    }
}

// Share via different platforms
function shareMeeting(platform) {
    if (!joinState.meetingCode || joinState.meetingCode.length !== 9) {
        showError('Please enter a valid meeting code first');
        return;
    }
    
    const formattedCode = joinState.meetingCode.match(/.{1,3}/g).join('-');
    const shareText = `Join my meeting on EventSphere!\nMeeting ID: ${formattedCode}\n`;
    const shareUrl = window.location.origin + '/join.html';
    
    let shareUrlFinal = '';
    
    switch (platform) {
        case 'email':
            shareUrlFinal = `mailto:?subject=EventSphere Meeting Invitation&body=${encodeURIComponent(shareText + '\n' + shareUrl)}`;
            break;
            
        case 'whatsapp':
            shareUrlFinal = `https://wa.me/?text=${encodeURIComponent(shareText + shareUrl)}`;
            break;
            
        case 'slack':
            // This would open Slack's sharing dialog in a real app
            shareUrlFinal = '#';
            showError('Slack sharing coming soon!', 'info');
            break;
            
        case 'copy-link':
            copyMeetingLink();
            return;
    }
    
    if (shareUrlFinal && shareUrlFinal !== '#') {
        window.open(shareUrlFinal, '_blank');
    }
}

// Show help modal
function showHelpModal() {
    if (helpModal) {
        helpModal.style.display = 'flex';
        setTimeout(() => {
            helpModal.style.opacity = '1';
        }, 10);
    }
}

// Hide help modal
function hideHelpModal() {
    if (helpModal) {
        helpModal.style.opacity = '0';
        setTimeout(() => {
            helpModal.style.display = 'none';
        }, 300);
    }
}

// Initialize event listeners
function initEventListeners() {
    // Join meeting button
    if (joinMeetingBtn) {
        joinMeetingBtn.addEventListener('click', joinMeeting);
    }
    
    // Cancel button
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            window.location.href = '/landing.html';
        });
    }
    
    // Back to home link
    if (backToHome) {
        backToHome.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/landing.html';
        });
    }
    
    // Display name input
    if (displayNameInput) {
        displayNameInput.addEventListener('input', () => {
            hideError();
        });
        
        displayNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                joinMeeting();
            }
        });
    }
    
    // Copy meeting link button
    if (copyMeetingLinkBtn) {
        copyMeetingLinkBtn.addEventListener('click', copyMeetingLink);
    }
    
    // Copy meeting ID button (second one)
    if (copyMeetingId2) {
        copyMeetingId2.addEventListener('click', copyMeetingId);
    }
    
    // Share buttons
    if (shareButtons) {
        shareButtons.forEach(button => {
            button.addEventListener('click', () => {
                const platform = button.classList.contains('email') ? 'email' :
                               button.classList.contains('whatsapp') ? 'whatsapp' :
                               button.classList.contains('slack') ? 'slack' :
                               button.classList.contains('copy-link') ? 'copy-link' : 'copy';
                shareMeeting(platform);
            });
        });
    }
    
    // Help modal
    const helpModalTriggers = document.querySelectorAll('[data-help]');
    helpModalTriggers.forEach(trigger => {
        trigger.addEventListener('click', showHelpModal);
    });
    
    if (closeHelpModal) {
        closeHelpModal.addEventListener('click', hideHelpModal);
    }
    
    if (closeHelpBtn) {
        closeHelpBtn.addEventListener('click', hideHelpModal);
    }
    
    // Close help modal when clicking outside
    if (helpModal) {
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                hideHelpModal();
            }
        });
    }
    
    // Join options change listeners
    if (joinWithVideo) {
        joinWithVideo.addEventListener('change', () => {
            joinState.joinOptions.video = joinWithVideo.checked;
        });
    }
    
    if (joinWithAudio) {
        joinWithAudio.addEventListener('change', () => {
            joinState.joinOptions.audio = joinWithAudio.checked;
        });
    }
    
    if (enableEncryption) {
        enableEncryption.addEventListener('change', () => {
            joinState.joinOptions.encryption = enableEncryption.checked;
        });
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter to join meeting
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            joinMeeting();
        }
        
        // Escape to cancel/go back
        if (e.key === 'Escape') {
            e.preventDefault();
            window.history.back();
        }
        
        // F1 or Ctrl+H for help
        if (e.key === 'F1' || ((e.ctrlKey || e.metaKey) && e.key === 'h')) {
            e.preventDefault();
            showHelpModal();
        }
        
        // Tab through code parts
        if (e.key === 'Tab' && !e.shiftKey) {
            const focusedElement = document.activeElement;
            if (codeParts[2] === focusedElement && focusedElement.value.length === 3) {
                e.preventDefault();
                if (displayNameInput) {
                    displayNameInput.focus();
                    displayNameInput.select();
                }
            }
        }
    });
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            // Page became visible, refresh data
            loadRecentMeetings();
            updateRecentMeetingsList();
        }
    });
    
    // Handle beforeunload
    window.addEventListener('beforeunload', () => {
        // Save any unsaved preferences
        saveUserPreferences();
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initJoinPage);

// Demo functions for testing
function demoFillMeetingCode(code = 'DEMO12345') {
    if (code.length >= 9) {
        const part1 = code.substring(0, 3);
        const part2 = code.substring(3, 6);
        const part3 = code.substring(6, 9);
        
        codeParts[0].value = part1;
        codeParts[1].value = part2;
        codeParts[2].value = part3;
        
        codeParts.forEach(part => updateCodePartState(part, true));
        
        updateMeetingCode();
        
        if (displayNameInput && !displayNameInput.value) {
            displayNameInput.value = 'Demo User';
        }
        
        showError('Demo meeting code loaded. Click "Join Meeting" to continue.', 'info');
    }
}

// Auto-fill demo code if #demo hash is present
if (window.location.hash === '#demo') {
    setTimeout(() => {
        demoFillMeetingCode();
    }, 500);
}

// Export for testing/module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initJoinPage,
        joinMeeting,
        validateMeetingCode,
        validateDisplayName,
        checkMeetingExists,
        copyMeetingLink,
        copyMeetingId,
        shareMeeting,
        demoFillMeetingCode
    };
}