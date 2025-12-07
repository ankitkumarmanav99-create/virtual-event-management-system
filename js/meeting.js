// meeting.js - Video Meeting WebRTC Logic

// DOM Elements
const localVideo = document.getElementById('localVideo');
const videoGrid = document.getElementById('videoGrid');
const videoPlaceholder = document.getElementById('videoPlaceholder');
const toggleVideoBtn = document.getElementById('toggleVideoBtn');
const toggleAudioBtn = document.getElementById('toggleAudioBtn');
const screenShareBtn = document.getElementById('screenShareBtn');
const mainControlBtn = document.getElementById('mainControlBtn');
const recordBtn = document.getElementById('recordBtn');
const toggleChatBtn = document.getElementById('toggleChatBtn');
const toggleParticipantsBtn = document.getElementById('toggleParticipantsBtn');
const leaveMeetingBtn = document.getElementById('leaveMeetingBtn');
const meetingTitle = document.getElementById('meetingTitle');
const meetingId = document.getElementById('meetingId');
const meetingTimer = document.getElementById('meetingTimer');
const participantCount = document.getElementById('participantCount');
const participantsList = document.getElementById('participantsList');
const copyMeetingIdBtn = document.getElementById('copyMeetingId');
const sidebar = document.getElementById('sidebar');
const minimizeChatBtn = document.getElementById('minimizeChat');
const toggleParticipants = document.getElementById('toggleParticipants');
const settingsBtn = document.getElementById('settingsBtn');
const chatPanel = document.getElementById('chatPanel');
const participantsPanel = document.getElementById('participantsPanel');
const settingsPanel = document.getElementById('settingsPanel');

// State Management
let state = {
    // User and Meeting Info
    meetingCode: '',
    userName: '',
    isHost: false,
    
    // Media State
    localStream: null,
    isVideoEnabled: true,
    isAudioEnabled: true,
    isScreenSharing: false,
    isRecording: false,
    recordingStartTime: null,
    
    // WebRTC
    peerConnections: {},
    dataChannels: {},
    remoteStreams: {},
    
    // Participants
    participants: new Map(),
    participantCount: 1, // Start with self
    
    // UI State
    isChatOpen: true,
    isParticipantsOpen: false,
    isSettingsOpen: false,
    isFullscreen: false,
    
    // Timer
    meetingStartTime: Date.now(),
    timerInterval: null,
    
    // Socket
    socket: null,
    socketConnected: false,
    
    // Settings
    settings: {
        videoQuality: 'sd',
        showTimer: true,
        showSpeakingIndicator: true,
        playSounds: true,
        selectedCamera: 'default',
        selectedMicrophone: 'default',
        selectedSpeaker: 'default'
    }
};

// Configuration
const CONFIG = {
    ICE_SERVERS: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
    ],
    MEDIA_CONSTRAINTS: {
        video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
        },
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }
    },
    SCREEN_SHARE_CONSTRAINTS: {
        video: {
            cursor: 'always',
            displaySurface: 'monitor'
        }
    },
    DATA_CHANNEL_CONFIG: {
        ordered: true,
        maxRetransmits: 3
    }
};

// Initialize meeting
async function initMeeting() {
    try {
        // Get meeting parameters from URL
        const urlParams = new URLSearchParams(window.location.search);
        state.meetingCode = urlParams.get('code') || generateMeetingCode();
        state.userName = urlParams.get('name') || getCurrentUserName();
        state.isHost = urlParams.has('host');
        
        // Update UI
        updateMeetingInfo();
        updateParticipantCount();
        startTimer();
        loadSettings();
        
        // Initialize media devices
        await initMediaDevices();
        
        // Initialize socket connection
        await initSocketConnection();
        
        // Initialize WebRTC for existing participants
        if (state.socketConnected) {
            state.socket.emit('join-meeting', {
                meetingCode: state.meetingCode,
                userName: state.userName,
                isHost: state.isHost
            });
        }
        
        // Initialize event listeners
        initEventListeners();
        
        // Initialize UI controls
        updateControlButtons();
        
        // Show success notification
        showNotification('Meeting joined successfully!', 'success');
        
        // Play join sound
        playSound('join');
        
    } catch (error) {
        console.error('Failed to initialize meeting:', error);
        showNotification('Failed to start meeting. Please try again.', 'error');
        setTimeout(() => {
            window.location.href = '/landing.html';
        }, 3000);
    }
}

// Generate meeting code
function generateMeetingCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 9; i++) {
        if (i > 0 && i % 3 === 0) code += '-';
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code.replace(/-/g, '');
}

// Get current user name
function getCurrentUserName() {
    const user = JSON.parse(localStorage.getItem('eventsphere_current_user') || '{}');
    return user.username || 'Guest';
}
// Ensure a local user object exists in localStorage and return its id
function ensureLocalUser() {
    let user = JSON.parse(localStorage.getItem('eventsphere_current_user') || 'null');
    if (!user || !user.id) {
        const id = 'guest_' + Math.random().toString(36).slice(2, 10);
        user = { id, username: 'Guest' };
        localStorage.setItem('eventsphere_current_user', JSON.stringify(user));
    }
    return user;
}

function getCurrentUserId() {
    const user = ensureLocalUser();
    return user.id;
}

// Try to auto-join when ?code= is present in the URL
async function preJoinFlow() {
    // If no explicit code in URL, skip
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code');
    if (!codeParam) return;

    try {
        // Normalize code (server stores codes without dashes)
        const code = codeParam.replace(/-/g, '').toUpperCase();

        // Fetch meeting info
        const res = await fetch(`/api/meetings/${code}`);
        if (res.status === 404) {
            showNotification('Meeting not found. Please check the code.', 'error');
            return;
        }
        const data = await res.json();
        if (!data.success) {
            showNotification(data.message || 'Unable to fetch meeting', 'error');
            return;
        }

        const meeting = data.meeting;
        const now = new Date();

        if (meeting.scheduledAt) {
            const scheduled = new Date(meeting.scheduledAt);
            if (scheduled > now && !meeting.active) {
                // Scheduled in the future
                const ok = confirm(`This meeting is scheduled for ${scheduled.toLocaleString()}. Do you want to join anyway?`);
                if (!ok) return;
            }
        }

        // Ensure local user exists
        const userId = getCurrentUserId();
        const userName = getCurrentUserName() || 'Guest';

        // Call join API to register participant server-side
        const joinRes = await fetch(`/api/meetings/${code}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, userName })
        });

        const joinData = await joinRes.json();
        if (!joinData.success) {
            showNotification(joinData.message || 'Failed to join meeting', 'error');
            return;
        }

        // Update state to use the normalized code and user's name
        state.meetingCode = code;
        state.userName = userName;
        updateMeetingInfo();
    } catch (err) {
        console.error('preJoinFlow error', err);
    }
}

// Update meeting info display
function updateMeetingInfo() {
    if (meetingTitle) {
        meetingTitle.textContent = state.isHost ? 'Hosting Meeting' : 'In Meeting';
    }
    
    if (meetingId) {
        const formattedCode = state.meetingCode.match(/.{1,3}/g).join('-');
        meetingId.textContent = formattedCode;
    }
}

// Start meeting timer
function startTimer() {
    if (!state.settings.showTimer) return;
    
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(updateTimer, 1000);
}

// Update timer display
function updateTimer() {
    if (!meetingTimer) return;
    
    const elapsed = Date.now() - state.meetingStartTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    meetingTimer.querySelector('span').textContent = timeString;
    
    // Update recording time if recording
    if (state.isRecording) {
        updateRecordingTimer();
    }
}

// Initialize media devices
async function initMediaDevices() {
    try {
        // Get user media
        const stream = await navigator.mediaDevices.getUserMedia({
            video: getVideoConstraints(),
            audio: getAudioConstraints()
        });
        
            // Ensure local user exists
            ensureLocalUser();

            // If code provided, attempt to pre-join via API (schedules or existing meetings)
            await preJoinFlow();
        state.localStream = stream;
        
        // Set local video source
        if (localVideo) {
            localVideo.srcObject = stream;
            
            // Add event listener for video load
            localVideo.onloadedmetadata = () => {
                console.log('Local video loaded');
            };
        }
        
        // Update audio/video toggle states
        state.isVideoEnabled = stream.getVideoTracks()[0]?.enabled || false;
        state.isAudioEnabled = stream.getAudioTracks()[0]?.enabled || false;
        
        // List available devices
        await listMediaDevices();
        
    } catch (error) {
        console.error('Error accessing media devices:', error);
        
        // Handle permission denied
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            showNotification('Camera/microphone access is required for video meetings.', 'error');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            showNotification('No camera/microphone found. Please check your devices.', 'error');
        } else {
            showNotification('Failed to access camera/microphone.', 'error');
        }
        
        // Create placeholder stream for audio-only
        createPlaceholderStream();
    }
}

// Get video constraints based on quality setting
function getVideoConstraints() {
    const baseConstraints = { ...CONFIG.MEDIA_CONSTRAINTS.video };
    
    switch (state.settings.videoQuality) {
        case 'hd':
            return { ...baseConstraints, width: { ideal: 1920 }, height: { ideal: 1080 } };
        case 'sd':
            return { ...baseConstraints, width: { ideal: 1280 }, height: { ideal: 720 } };
        case 'low':
            return { ...baseConstraints, width: { ideal: 640 }, height: { ideal: 480 } };
        default:
            return baseConstraints;
    }
}

// Get audio constraints
function getAudioConstraints() {
    const deviceId = state.settings.selectedMicrophone;
    const constraints = { ...CONFIG.MEDIA_CONSTRAINTS.audio };
    
    if (deviceId && deviceId !== 'default') {
        constraints.deviceId = { exact: deviceId };
    }
    
    return constraints;
}

// Create placeholder stream for when camera is not available
function createPlaceholderStream() {
    // Create a black video stream
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const stream = canvas.captureStream(30);
    
    // Add silent audio track
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const destination = audioContext.createMediaStreamDestination();
    oscillator.connect(destination);
    oscillator.start();
    
    const audioStream = destination.stream;
    stream.addTrack(audioStream.getAudioTracks()[0]);
    
    state.localStream = stream;
    
    if (localVideo) {
        localVideo.srcObject = stream;
    }
    
    state.isVideoEnabled = false;
    state.isAudioEnabled = true;
}

// List available media devices
async function listMediaDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
        
        // Update device selectors in settings panel
        updateDeviceSelectors(videoInputs, audioInputs, audioOutputs);
        
    } catch (error) {
        console.error('Error listing media devices:', error);
    }
}

// Update device selectors in settings
function updateDeviceSelectors(videoInputs, audioInputs, audioOutputs) {
    const videoSelect = document.getElementById('videoInputSelect');
    const audioInputSelect = document.getElementById('audioInputSelect');
    const audioOutputSelect = document.getElementById('audioOutputSelect');
    
    if (videoSelect) {
        videoSelect.innerHTML = '<option value="default">Default Camera</option>' +
            videoInputs.map(device => 
                `<option value="${device.deviceId}">${device.label || `Camera ${videoSelect.options.length}`}</option>`
            ).join('');
        
        if (state.settings.selectedCamera && state.settings.selectedCamera !== 'default') {
            videoSelect.value = state.settings.selectedCamera;
        }
    }
    
    if (audioInputSelect) {
        audioInputSelect.innerHTML = '<option value="default">Default Microphone</option>' +
            audioInputs.map(device => 
                `<option value="${device.deviceId}">${device.label || `Microphone ${audioInputSelect.options.length}`}</option>`
            ).join('');
        
        if (state.settings.selectedMicrophone && state.settings.selectedMicrophone !== 'default') {
            audioInputSelect.value = state.settings.selectedMicrophone;
        }
    }
    
    if (audioOutputSelect) {
        audioOutputSelect.innerHTML = '<option value="default">Default Speaker</option>' +
            audioOutputs.map(device => 
                `<option value="${device.deviceId}">${device.label || `Speaker ${audioOutputSelect.options.length}`}</option>`
            ).join('');
        
        if (state.settings.selectedSpeaker && state.settings.selectedSpeaker !== 'default') {
            audioOutputSelect.value = state.settings.selectedSpeaker;
        }
    }
}

// Initialize socket connection
function initSocketConnection() {
    return new Promise((resolve, reject) => {
        try {
            // For demo purposes, we'll simulate socket behavior
            // In production, connect to actual socket server
            state.socket = {
                emit: (event, data) => {
                    console.log(`Socket emit: ${event}`, data);
                    handleSocketMessage(event, data);
                },
                on: (event, callback) => {
                    console.log(`Socket listening for: ${event}`);
                    // Store callback for simulated responses
                    if (!window.socketCallbacks) window.socketCallbacks = {};
                    window.socketCallbacks[event] = callback;
                },
                disconnect: () => console.log('Socket disconnected')
            };
            
            // Simulate connection
            setTimeout(() => {
                state.socketConnected = true;
                console.log('Socket connected (simulated)');
                resolve();
                
                // Demo participants removed - waiting for real participants to join
                
            }, 500);
            
        } catch (error) {
            console.error('Socket connection failed:', error);
            reject(error);
        }
    });
}

// Handle socket messages
function handleSocketMessage(event, data) {
    // This simulates server responses
    setTimeout(() => {
        switch (event) {
            case 'join-meeting':
                handleParticipantJoined(data);
                break;
            case 'signal':
                handleWebRTCSignal(data);
                break;
            case 'leave-meeting':
                handleParticipantLeft(data);
                break;
            case 'chat-message':
                // Handled in chat.js
                break;
        }
    }, 100);
}

// Simulate participants for demo
function simulateParticipants() {
    const demoParticipants = [
        { id: 'demo1', userName: 'Alex Johnson', isHost: false },
        { id: 'demo2', userName: 'Sarah Miller', isHost: false },
        { id: 'demo3', userName: 'David Chen', isHost: false }
    ];
    
    demoParticipants.forEach(participant => {
        setTimeout(() => {
            handleParticipantJoined(participant);
        }, Math.random() * 2000 + 1000);
    });
}

// Handle participant joined
function handleParticipantJoined(participant) {
    if (participant.id === state.socket?.id) return; // Skip self
    
    console.log('Participant joined:', participant);
    
    // Add to participants map
    state.participants.set(participant.id, {
        ...participant,
        stream: null,
        videoEnabled: true,
        audioEnabled: true,
        isSpeaking: false,
        joinedAt: Date.now()
    });
    
    // Update participant count
    updateParticipantCount();
    
    // Create WebRTC connection
    createPeerConnection(participant.id);
    
    // Send offer
    sendOffer(participant.id);
    
    // Update participants list UI
    updateParticipantsList();
    
    // Show notification
    if (state.settings.playSounds) {
        playSound('join');
    }
    
    showNotification(`${participant.userName} joined the meeting`, 'info');
}

// Create WebRTC peer connection
function createPeerConnection(participantId) {
    try {
        const configuration = {
            iceServers: CONFIG.ICE_SERVERS,
            iceTransportPolicy: 'all'
        };
        
        const peerConnection = new RTCPeerConnection(configuration);
        
        // Add local stream tracks
        if (state.localStream) {
            state.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, state.localStream);
            });
        }
        
        // Handle ICE candidate
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal(participantId, {
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            }
        };
        
        // Handle connection state
        peerConnection.onconnectionstatechange = () => {
            console.log(`Connection state with ${participantId}:`, peerConnection.connectionState);
            
            if (peerConnection.connectionState === 'connected') {
                console.log(`Connected to ${participantId}`);
            } else if (peerConnection.connectionState === 'disconnected' || 
                       peerConnection.connectionState === 'failed') {
                console.log(`Disconnected from ${participantId}`);
                removeParticipant(participantId);
            }
        };
        
        // Handle track events (incoming media)
        peerConnection.ontrack = (event) => {
            console.log('Received track from:', participantId);
            
            const [stream] = event.streams;
            if (stream) {
                handleRemoteStream(participantId, stream);
            }
        };
        
        // Create data channel for chat
        const dataChannel = peerConnection.createDataChannel(
            'chat',
            CONFIG.DATA_CHANNEL_CONFIG
        );
        
        setupDataChannel(participantId, dataChannel);
        
        // Store connections
        state.peerConnections[participantId] = peerConnection;
        state.dataChannels[participantId] = dataChannel;
        
        return peerConnection;
        
    } catch (error) {
        console.error('Error creating peer connection:', error);
        return null;
    }
}

// Setup data channel for chat
function setupDataChannel(participantId, dataChannel) {
    dataChannel.onopen = () => {
        console.log(`Data channel opened with ${participantId}`);
    };
    
    dataChannel.onclose = () => {
        console.log(`Data channel closed with ${participantId}`);
    };
    
    dataChannel.onerror = (error) => {
        console.error(`Data channel error with ${participantId}:`, error);
    };
    
    dataChannel.onmessage = (event) => {
        console.log(`Message from ${participantId}:`, event.data);
        // Handle chat messages (processed in chat.js)
        handleChatMessage(participantId, event.data);
    };
}

// Handle incoming chat message
function handleChatMessage(senderId, messageData) {
    try {
        const message = JSON.parse(messageData);
        
        // Update UI via chat.js
        if (window.chatManager) {
            window.chatManager.handleIncomingMessage(message);
        }
        
    } catch (error) {
        console.error('Error parsing chat message:', error);
    }
}

// Send WebRTC offer
async function sendOffer(participantId) {
    const peerConnection = state.peerConnections[participantId];
    if (!peerConnection) return;
    
    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        sendSignal(participantId, {
            type: 'offer',
            offer: offer
        });
        
    } catch (error) {
        console.error('Error creating/sending offer:', error);
    }
}

// Handle WebRTC signal
async function handleWebRTCSignal(data) {
    const { from: participantId, signal } = data;
    
    try {
        switch (signal.type) {
            case 'offer':
                await handleOffer(participantId, signal.offer);
                break;
                
            case 'answer':
                await handleAnswer(participantId, signal.answer);
                break;
                
            case 'ice-candidate':
                await handleICECandidate(participantId, signal.candidate);
                break;
        }
    } catch (error) {
        console.error('Error handling signal:', error);
    }
}

// Handle offer from remote peer
async function handleOffer(participantId, offer) {
    let peerConnection = state.peerConnections[participantId];
    
    if (!peerConnection) {
        peerConnection = createPeerConnection(participantId);
    }
    
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Create and send answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        sendSignal(participantId, {
            type: 'answer',
            answer: answer
        });
        
    } catch (error) {
        console.error('Error handling offer:', error);
    }
}

// Handle answer from remote peer
async function handleAnswer(participantId, answer) {
    const peerConnection = state.peerConnections[participantId];
    if (!peerConnection) return;
    
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
        console.error('Error handling answer:', error);
    }
}

// Handle ICE candidate
async function handleICECandidate(participantId, candidate) {
    const peerConnection = state.peerConnections[participantId];
    if (!peerConnection) return;
    
    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
        console.error('Error adding ICE candidate:', error);
    }
}

// Send signal via socket
function sendSignal(to, signal) {
    if (state.socket && state.socketConnected) {
        state.socket.emit('signal', {
            to,
            from: state.socket.id,
            signal
        });
    }
}

// Handle remote stream
function handleRemoteStream(participantId, stream) {
    const participant = state.participants.get(participantId);
    if (!participant) return;
    
    // Store stream
    participant.stream = stream;
    state.remoteStreams[participantId] = stream;
    
    // Create video element
    createRemoteVideoElement(participantId, stream);
    
    // Update UI
    hideVideoPlaceholder();
    updateParticipantsList();
    
    // Monitor audio levels for speaking indicator
    monitorAudioLevels(participantId, stream);
}

// Create remote video element
function createRemoteVideoElement(participantId, stream) {
    // Remove existing video element for this participant
    const existingVideo = document.getElementById(`remote-video-${participantId}`);
    if (existingVideo) {
        existingVideo.remove();
    }
    
    // Create video container
    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container remote-video';
    videoContainer.id = `remote-container-${participantId}`;
    
    // Create video element
    const video = document.createElement('video');
    video.id = `remote-video-${participantId}`;
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;
    
    // Add video info overlay
    const overlay = document.createElement('div');
    overlay.className = 'video-overlay';
    
    const videoInfo = document.createElement('div');
    videoInfo.className = 'video-info';
    
    const participantName = document.createElement('span');
    participantName.className = 'participant-name';
    participantName.textContent = state.participants.get(participantId)?.userName || 'Participant';
    
    const audioIndicator = document.createElement('div');
    audioIndicator.className = 'audio-indicator';
    audioIndicator.innerHTML = '<i class="fas fa-microphone"></i>';
    
    videoInfo.appendChild(participantName);
    videoInfo.appendChild(audioIndicator);
    
    const connectionStatus = document.createElement('div');
    connectionStatus.className = 'connection-status connected';
    connectionStatus.innerHTML = '<i class="fas fa-wifi"></i> Connected';
    
    overlay.appendChild(videoInfo);
    overlay.appendChild(connectionStatus);
    
    // Create video controls overlay
    const controlsOverlay = document.createElement('div');
    controlsOverlay.className = 'video-controls-overlay';
    
    videoContainer.appendChild(video);
    videoContainer.appendChild(overlay);
    videoContainer.appendChild(controlsOverlay);
    
    // Add to video grid (before placeholder)
    if (videoPlaceholder && videoPlaceholder.parentNode) {
        videoGrid.insertBefore(videoContainer, videoPlaceholder);
    } else {
        videoGrid.appendChild(videoContainer);
    }
    
    // Handle video loading
    video.onloadedmetadata = () => {
        console.log(`Remote video loaded for ${participantId}`);
    };
}

// Monitor audio levels for speaking indicator
function monitorAudioLevels(participantId, stream) {
    if (!state.settings.showSpeakingIndicator) return;
    
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    const javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);
    
    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 1024;
    
    microphone.connect(analyser);
    analyser.connect(javascriptNode);
    javascriptNode.connect(audioContext.destination);
    
    javascriptNode.onaudioprocess = () => {
        const array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        
        const values = array.reduce((a, b) => a + b) / array.length;
        const isSpeaking = values > 50; // Threshold
        
        const participant = state.participants.get(participantId);
        if (participant && participant.isSpeaking !== isSpeaking) {
            participant.isSpeaking = isSpeaking;
            updateSpeakingIndicator(participantId, isSpeaking);
        }
    };
}

// Update speaking indicator
function updateSpeakingIndicator(participantId, isSpeaking) {
    const videoContainer = document.getElementById(`remote-container-${participantId}`);
    if (!videoContainer) return;
    
    if (isSpeaking) {
        videoContainer.classList.add('active-speaking');
    } else {
        videoContainer.classList.remove('active-speaking');
    }
}

// Hide video placeholder
function hideVideoPlaceholder() {
    if (videoPlaceholder && state.participants.size > 0) {
        videoPlaceholder.style.display = 'none';
    }
}

// Show video placeholder
function showVideoPlaceholder() {
    if (videoPlaceholder && state.participants.size === 0) {
        videoPlaceholder.style.display = 'flex';
    }
}

// Update participant count
function updateParticipantCount() {
    state.participantCount = state.participants.size + 1; // +1 for self
    
    if (participantCount) {
        participantCount.querySelector('span').textContent = 
            `${state.participantCount} participant${state.participantCount !== 1 ? 's' : ''}`;
    }
    
    // Update badge
    const participantBadge = document.getElementById('participantBadge');
    const peopleBadge = document.getElementById('peopleBadge');
    
    if (participantBadge) participantBadge.textContent = state.participantCount;
    if (peopleBadge) peopleBadge.textContent = state.participantCount;
}

// Update participants list UI
function updateParticipantsList() {
    if (!participantsList) return;
    
    // Start with host (self)
    const user = getCurrentUser();
    let html = `
        <div class="participant-item host">
            <div class="participant-info">
                <div class="participant-avatar">
                    <i class="fas fa-user"></i>
                    <span class="host-badge" title="Host">
                        <i class="fas fa-crown"></i>
                    </span>
                </div>
                <div class="participant-details">
                    <span class="participant-name">${user.username || 'You'}</span>
                    <span class="participant-status">Host</span>
                </div>
            </div>
            <div class="participant-actions">
                <div class="media-status">
                    <i class="fas fa-microphone${state.isAudioEnabled ? '' : '-slash'}" 
                       title="${state.isAudioEnabled ? 'Audio on' : 'Audio off'}"></i>
                    <i class="fas fa-video${state.isVideoEnabled ? '' : '-slash'}" 
                       title="${state.isVideoEnabled ? 'Video on' : 'Video off'}"></i>
                </div>
            </div>
        </div>
    `;
    
    // Add other participants
    state.participants.forEach((participant, id) => {
        html += `
            <div class="participant-item" data-id="${id}">
                <div class="participant-info">
                    <div class="participant-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="participant-details">
                        <span class="participant-name">${participant.userName}</span>
                        <span class="participant-status">${participant.isHost ? 'Co-host' : 'Member'}</span>
                    </div>
                </div>
                <div class="participant-actions">
                    <div class="media-status">
                        <i class="fas fa-microphone${participant.audioEnabled ? '' : '-slash'}" 
                           title="${participant.audioEnabled ? 'Audio on' : 'Audio off'}"></i>
                        <i class="fas fa-video${participant.videoEnabled ? '' : '-slash'}" 
                           title="${participant.videoEnabled ? 'Video on' : 'Video off'}"></i>
                    </div>
                </div>
            </div>
        `;
    });
    
    participantsList.innerHTML = html;
}

// Remove participant
function removeParticipant(participantId) {
    const participant = state.participants.get(participantId);
    if (!participant) return;
    
    // Close peer connection
    const peerConnection = state.peerConnections[participantId];
    if (peerConnection) {
        peerConnection.close();
        delete state.peerConnections[participantId];
    }
    
    // Close data channel
    const dataChannel = state.dataChannels[participantId];
    if (dataChannel) {
        dataChannel.close();
        delete state.dataChannels[participantId];
    }
    
    // Remove remote stream
    delete state.remoteStreams[participantId];
    
    // Remove from participants map
    state.participants.delete(participantId);
    
    // Remove video element
    const videoContainer = document.getElementById(`remote-container-${participantId}`);
    if (videoContainer) {
        videoContainer.remove();
    }
    
    // Update UI
    updateParticipantCount();
    updateParticipantsList();
    showVideoPlaceholder();
    
    // Show notification
    if (state.settings.playSounds) {
        playSound('leave');
    }
    
    showNotification(`${participant.userName} left the meeting`, 'info');
}

// Handle participant left
function handleParticipantLeft(data) {
    removeParticipant(data.participantId);
}

// Toggle video
async function toggleVideo() {
    if (!state.localStream) return;
    
    const videoTrack = state.localStream.getVideoTracks()[0];
    if (!videoTrack) return;
    
    state.isVideoEnabled = !state.isVideoEnabled;
    videoTrack.enabled = state.isVideoEnabled;
    
    // Update UI
    updateControlButtons();
    updateParticipantsList();
    
    // Send state to other participants
    broadcastStateUpdate('video', state.isVideoEnabled);
    
    // Show notification
    showNotification(
        state.isVideoEnabled ? 'Video turned on' : 'Video turned off',
        'info'
    );
}

// Toggle audio
async function toggleAudio() {
    if (!state.localStream) return;
    
    const audioTrack = state.localStream.getAudioTracks()[0];
    if (!audioTrack) return;
    
    state.isAudioEnabled = !state.isAudioEnabled;
    audioTrack.enabled = state.isAudioEnabled;
    
    // Update UI
    updateControlButtons();
    updateParticipantsList();
    
    // Send state to other participants
    broadcastStateUpdate('audio', state.isAudioEnabled);
    
    // Show notification
    showNotification(
        state.isAudioEnabled ? 'Microphone unmuted' : 'Microphone muted',
        'info'
    );
}

// Broadcast state update to all participants
function broadcastStateUpdate(type, value) {
    Object.keys(state.dataChannels).forEach(participantId => {
        const dataChannel = state.dataChannels[participantId];
        if (dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(JSON.stringify({
                type: 'state-update',
                data: { [type]: value }
            }));
        }
    });
}

// Start/stop screen sharing
async function toggleScreenShare() {
    try {
        if (!state.isScreenSharing) {
            // Start screen sharing
            const screenStream = await navigator.mediaDevices.getDisplayMedia(
                CONFIG.SCREEN_SHARE_CONSTRAINTS
            );
            
            // Stop previous screen share if any
            if (state.screenShareStream) {
                state.screenShareStream.getTracks().forEach(track => track.stop());
            }
            
            state.screenShareStream = screenStream;
            state.isScreenSharing = true;
            
            // Replace video track in all peer connections
            const screenVideoTrack = screenStream.getVideoTracks()[0];
            replaceVideoTrack(screenVideoTrack);
            
            // Handle screen share ending
            screenVideoTrack.onended = () => {
                stopScreenShare();
            };
            
            // Update UI
            updateControlButtons();
            showNotification('Screen sharing started', 'success');
            
        } else {
            // Stop screen sharing
            stopScreenShare();
        }
        
    } catch (error) {
        console.error('Screen share error:', error);
        
        if (error.name !== 'NotAllowedError') {
            showNotification('Failed to share screen', 'error');
        }
        
        state.isScreenSharing = false;
        updateControlButtons();
    }
}

// Stop screen sharing
function stopScreenShare() {
    if (state.screenShareStream) {
        state.screenShareStream.getTracks().forEach(track => track.stop());
        state.screenShareStream = null;
    }
    
    state.isScreenSharing = false;
    
    // Restore camera video track
    if (state.localStream) {
        const cameraVideoTrack = state.localStream.getVideoTracks()[0];
        if (cameraVideoTrack) {
            replaceVideoTrack(cameraVideoTrack);
        }
    }
    
    // Update UI
    updateControlButtons();
    showNotification('Screen sharing stopped', 'info');
}

// Replace video track in all peer connections
function replaceVideoTrack(newTrack) {
    Object.values(state.peerConnections).forEach(peerConnection => {
        const sender = peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'video'
        );
        
        if (sender) {
            sender.replaceTrack(newTrack);
        }
    });
    
    // Update local video if it's a camera track
    if (newTrack.kind === 'video' && localVideo.srcObject) {
        const stream = localVideo.srcObject;
        const oldTrack = stream.getVideoTracks()[0];
        
        if (oldTrack) {
            stream.removeTrack(oldTrack);
        }
        
        stream.addTrack(newTrack);
    }
}

// Start/stop recording
function toggleRecording() {
    if (!state.isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
}

// Start recording
function startRecording() {
    // For demo purposes - in production, use MediaRecorder API
    state.isRecording = true;
    state.recordingStartTime = Date.now();
    
    // Show recording indicator
    showRecordingIndicator();
    
    // Update UI
    updateControlButtons();
    
    showNotification('Recording started', 'success');
}

// Stop recording
function stopRecording() {
    state.isRecording = false;
    state.recordingStartTime = null;
    
    // Hide recording indicator
    hideRecordingIndicator();
    
    // Update UI
    updateControlButtons();
    
    showNotification('Recording stopped and saved', 'success');
}

// Show recording indicator
function showRecordingIndicator() {
    const indicator = document.getElementById('recordingIndicator');
    if (indicator) {
        indicator.style.display = 'flex';
    }
}

// Hide recording indicator
function hideRecordingIndicator() {
    const indicator = document.getElementById('recordingIndicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

// Update recording timer
function updateRecordingTimer() {
    if (!state.isRecording || !state.recordingStartTime) return;
    
    const indicator = document.getElementById('recordingIndicator');
    if (!indicator) return;
    
    const elapsed = Date.now() - state.recordingStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    
    const timeElement = indicator.querySelector('.recording-time');
    if (timeElement) {
        timeElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Update control buttons UI
function updateControlButtons() {
    // Video button
    if (toggleVideoBtn) {
        const icon = toggleVideoBtn.querySelector('i');
        const text = toggleVideoBtn.querySelector('span');
        
        if (state.isVideoEnabled) {
            icon.className = 'fas fa-video';
            text.textContent = 'Video';
        } else {
            icon.className = 'fas fa-video-slash';
            text.textContent = 'Video';
        }
    }
    
    // Audio button
    if (toggleAudioBtn) {
        const icon = toggleAudioBtn.querySelector('i');
        const text = toggleAudioBtn.querySelector('span');
        
        if (state.isAudioEnabled) {
            icon.className = 'fas fa-microphone';
            text.textContent = 'Mute';
        } else {
            icon.className = 'fas fa-microphone-slash';
            text.textContent = 'Unmute';
        }
    }
    
    // Screen share button
    if (screenShareBtn) {
        const icon = screenShareBtn.querySelector('i');
        const text = screenShareBtn.querySelector('span');
        
        if (state.isScreenSharing) {
            icon.className = 'fas fa-stop-circle';
            text.textContent = 'Stop Share';
            screenShareBtn.classList.add('active');
        } else {
            icon.className = 'fas fa-desktop';
            text.textContent = 'Share Screen';
            screenShareBtn.classList.remove('active');
        }
    }
    
    // Record button
    if (recordBtn) {
        const icon = recordBtn.querySelector('i');
        const text = recordBtn.querySelector('span');
        
        if (state.isRecording) {
            icon.className = 'fas fa-stop-circle';
            text.textContent = 'Stop';
            recordBtn.classList.add('recording');
            recordBtn.classList.add('danger');
        } else {
            icon.className = 'fas fa-circle';
            text.textContent = 'Record';
            recordBtn.classList.remove('recording');
            recordBtn.classList.remove('danger');
        }
    }
    
    // Main control button
    if (mainControlBtn) {
        if (state.isRecording) {
            mainControlBtn.classList.add('call-end');
        } else {
            mainControlBtn.classList.remove('call-end');
        }
    }
}

// Toggle sidebar panels
function togglePanel(panelType) {
    // Hide all panels
    [chatPanel, participantsPanel, settingsPanel].forEach(panel => {
        if (panel) {
            panel.classList.remove('active');
            panel.style.display = 'none';
        }
    });
    
    // Show selected panel
    let selectedPanel;
    switch (panelType) {
        case 'chat':
            selectedPanel = chatPanel;
            state.isChatOpen = true;
            state.isParticipantsOpen = false;
            state.isSettingsOpen = false;
            break;
        case 'participants':
            selectedPanel = participantsPanel;
            state.isChatOpen = false;
            state.isParticipantsOpen = true;
            state.isSettingsOpen = false;
            break;
        case 'settings':
            selectedPanel = settingsPanel;
            state.isChatOpen = false;
            state.isParticipantsOpen = false;
            state.isSettingsOpen = true;
            break;
    }
    
    if (selectedPanel) {
        selectedPanel.classList.add('active');
        selectedPanel.style.display = 'flex';
    }
    
    // Update sidebar visibility
    if (sidebar) {
        if (panelType === 'none') {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
        }
    }
}

// Leave meeting
function leaveMeeting() {
    if (confirm('Are you sure you want to leave the meeting?')) {
        // Stop all media tracks
        if (state.localStream) {
            state.localStream.getTracks().forEach(track => track.stop());
        }
        
        if (state.screenShareStream) {
            state.screenShareStream.getTracks().forEach(track => track.stop());
        }
        
        // Close all peer connections
        Object.values(state.peerConnections).forEach(pc => pc.close());
        
        // Stop recording if active
        if (state.isRecording) {
            stopRecording();
        }
        
        // Clear timer
        clearInterval(state.timerInterval);
        
        // Notify server
        if (state.socket && state.socketConnected) {
            state.socket.emit('leave-meeting', {
                meetingCode: state.meetingCode
            });
            state.socket.disconnect();
        }
        
        // Save meeting to history
        saveMeetingToHistory();
        
        // Redirect to landing page
        showNotification('Left the meeting', 'info');
        setTimeout(() => {
            window.location.href = '/landing.html';
        }, 1000);
    }
}

// Save meeting to history
function saveMeetingToHistory() {
    try {
        const history = JSON.parse(localStorage.getItem('eventsphere_meeting_history') || '[]');
        
        history.unshift({
            code: state.meetingCode,
            name: state.isHost ? 'Hosted meeting' : 'Joined meeting',
            participants: state.participantCount,
            duration: Date.now() - state.meetingStartTime,
            timestamp: new Date().toISOString(),
            isHost: state.isHost
        });
        
        // Keep only last 50 meetings
        const limitedHistory = history.slice(0, 50);
        localStorage.setItem('eventsphere_meeting_history', JSON.stringify(limitedHistory));
        
    } catch (error) {
        console.error('Error saving meeting history:', error);
    }
}

// Copy meeting ID to clipboard
async function copyMeetingId() {
    const formattedCode = state.meetingCode.match(/.{1,3}/g).join('-');
    await copyToClipboard(formattedCode);
}

// Copy to clipboard utility
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showNotification('Meeting ID copied to clipboard!', 'success');
    } catch (error) {
        console.error('Failed to copy:', error);
        showNotification('Failed to copy to clipboard', 'error');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const toast = document.getElementById('notificationToast');
    const toastText = document.getElementById('notificationToastText');
    
    if (toast && toastText) {
        toastText.textContent = message;
        toast.className = `notification-toast ${type}`;
        
        // Show toast
        toast.style.display = 'flex';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }
}

// Play sound
function playSound(type) {
    if (!state.settings.playSounds) return;
    
    // In production, play actual sound files
    console.log(`Play sound: ${type}`);
}

// Load settings from localStorage
function loadSettings() {
    try {
        const savedSettings = JSON.parse(localStorage.getItem('eventsphere_settings') || '{}');
        state.settings = { ...state.settings, ...savedSettings };
        
        // Apply settings to UI
        applySettings();
        
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Save settings to localStorage
function saveSettings() {
    try {
        localStorage.setItem('eventsphere_settings', JSON.stringify(state.settings));
        showNotification('Settings saved', 'success');
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

// Apply settings to UI
function applySettings() {
    // Timer visibility
    if (meetingTimer) {
        meetingTimer.style.display = state.settings.showTimer ? 'flex' : 'none';
    }
    
    // Update device selectors if they exist
    const videoQualitySelect = document.getElementById('videoQualitySelect');
    const showTimerToggle = document.getElementById('showTimerToggle');
    const showSpeakingIndicator = document.getElementById('showSpeakingIndicator');
    const playSoundsToggle = document.getElementById('playSoundsToggle');
    
    if (videoQualitySelect) videoQualitySelect.value = state.settings.videoQuality;
    if (showTimerToggle) showTimerToggle.checked = state.settings.showTimer;
    if (showSpeakingIndicator) showSpeakingIndicator.checked = state.settings.showSpeakingIndicator;
    if (playSoundsToggle) playSoundsToggle.checked = state.settings.playSounds;
}

// Initialize event listeners
function initEventListeners() {
    // Control buttons
    if (toggleVideoBtn) toggleVideoBtn.addEventListener('click', toggleVideo);
    if (toggleAudioBtn) toggleAudioBtn.addEventListener('click', toggleAudio);
    if (screenShareBtn) screenShareBtn.addEventListener('click', toggleScreenShare);
    if (recordBtn) recordBtn.addEventListener('click', toggleRecording);
    if (mainControlBtn) mainControlBtn.addEventListener('click', leaveMeeting);
    if (leaveMeetingBtn) leaveMeetingBtn.addEventListener('click', leaveMeeting);
    
    // Sidebar controls
    if (toggleChatBtn) toggleChatBtn.addEventListener('click', () => togglePanel('chat'));
    if (toggleParticipantsBtn) toggleParticipantsBtn.addEventListener('click', () => togglePanel('participants'));
    if (minimizeChatBtn) minimizeChatBtn.addEventListener('click', () => togglePanel('none'));
    if (toggleParticipants) toggleParticipants.addEventListener('click', () => togglePanel('participants'));
    if (settingsBtn) settingsBtn.addEventListener('click', () => togglePanel('settings'));
    
    // Copy meeting ID
    if (copyMeetingIdBtn) copyMeetingIdBtn.addEventListener('click', copyMeetingId);
    
    // Panel close buttons
    const closeButtons = document.querySelectorAll('.panel-close, .modal-close');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => togglePanel('none'));
    });
    
    // Settings save button
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            // Get settings from form
            const videoQualitySelect = document.getElementById('videoQualitySelect');
            const showTimerToggle = document.getElementById('showTimerToggle');
            const showSpeakingIndicator = document.getElementById('showSpeakingIndicator');
            const playSoundsToggle = document.getElementById('playSoundsToggle');
            const videoInputSelect = document.getElementById('videoInputSelect');
            const audioInputSelect = document.getElementById('audioInputSelect');
            const audioOutputSelect = document.getElementById('audioOutputSelect');
            
            if (videoQualitySelect) state.settings.videoQuality = videoQualitySelect.value;
            if (showTimerToggle) state.settings.showTimer = showTimerToggle.checked;
            if (showSpeakingIndicator) state.settings.showSpeakingIndicator = showSpeakingIndicator.checked;
            if (playSoundsToggle) state.settings.playSounds = playSoundsToggle.checked;
            if (videoInputSelect) state.settings.selectedCamera = videoInputSelect.value;
            if (audioInputSelect) state.settings.selectedMicrophone = audioInputSelect.value;
            if (audioOutputSelect) state.settings.selectedSpeaker = audioOutputSelect.value;
            
            saveSettings();
            applySettings();
        });
    }
    
    // Stop recording button
    const stopRecordingBtn = document.getElementById('stopRecordingBtn');
    if (stopRecordingBtn) {
        stopRecordingBtn.addEventListener('click', stopRecording);
    }
    
    // Handle window resize
    window.addEventListener('resize', handleResize);
    
    // Handle beforeunload
    window.addEventListener('beforeunload', (e) => {
        if (state.participants.size > 0) {
            e.preventDefault();
            e.returnValue = 'Are you sure you want to leave the meeting?';
        }
    });
    
    // Handle page visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Page is hidden (tab switched)
            showNotification('Meeting is running in background', 'info');
        }
    });
}

// Handle window resize
function handleResize() {
    // Update video grid layout if needed
    // You could implement responsive video layout changes here
}

// Get current user from localStorage
function getCurrentUser() {
    return JSON.parse(localStorage.getItem('eventsphere_current_user') || '{}');
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is authenticated
    const user = getCurrentUser();
    if (!user || !user.username) {
        showNotification('Please log in first', 'error');
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 1000);
        return;
    }
    
    // Initialize meeting
    initMeeting();
});

// Export for testing/module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initMeeting,
        toggleVideo,
        toggleAudio,
        toggleScreenShare,
        leaveMeeting,
        state
    };
}