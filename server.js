// server.js - Express Server for EventSphere

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configuration
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.json');
const MEETINGS_FILE = path.join(__dirname, 'meetings.json');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Serve HTML files from root directory
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/:file.html', (req, res) => {
    res.sendFile(path.join(__dirname, req.params.file + '.html'));
});

// API Routes

// Initialize data files
async function initializeDataFiles() {
    try {
        // Create users.json if it doesn't exist
        try {
            await fs.access(USERS_FILE);
        } catch {
            const defaultUsers = [
                {
                    id: '1',
                    username: 'demo',
                    email: 'demo@eventsphere.com',
                    password: 'demo123',
                    createdAt: new Date().toISOString(),
                    lastLogin: null
                },
                {
                    id: '2',
                    username: 'admin',
                    email: 'admin@eventsphere.com',
                    password: 'admin123',
                    createdAt: new Date().toISOString(),
                    lastLogin: null
                }
            ];
            await fs.writeFile(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
        }

        // Create meetings.json if it doesn't exist
        try {
            await fs.access(MEETINGS_FILE);
        } catch {
            await fs.writeFile(MEETINGS_FILE, JSON.stringify([], null, 2));
        }

        console.log('Data files initialized successfully');
    } catch (error) {
        console.error('Error initializing data files:', error);
    }
}

// User Authentication Routes

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username and password are required' 
            });
        }

        const usersData = await fs.readFile(USERS_FILE, 'utf8');
        const users = JSON.parse(usersData);
        
        // Find user by username or email
        const user = users.find(u => 
            u.username.toLowerCase() === username.toLowerCase() || 
            u.email.toLowerCase() === username.toLowerCase()
        );
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid username or email' 
            });
        }
        
        if (user.password !== password) {
            return res.status(401).json({ 
                success: false, 
                message: 'Incorrect password' 
            });
        }
        
        // Update last login
        user.lastLogin = new Date().toISOString();
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
        
        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;
        
        res.json({
            success: true,
            message: 'Login successful',
            user: userWithoutPassword
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'An error occurred during login' 
        });
    }
});

// Signup
app.post('/api/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'All fields are required' 
            });
        }
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please enter a valid email address' 
            });
        }
        
        // Username validation
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!usernameRegex.test(username)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username must be 3-20 characters (letters, numbers, underscores only)' 
            });
        }
        
        // Password validation
        if (password.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: 'Password must be at least 6 characters long' 
            });
        }
        
        const usersData = await fs.readFile(USERS_FILE, 'utf8');
        const users = JSON.parse(usersData);
        
        // Check if username already exists
        if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username already exists' 
            });
        }
        
        // Check if email already exists
        if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email already registered' 
            });
        }
        
        // Create new user
        const newUser = {
            id: crypto.randomBytes(16).toString('hex'),
            username,
            email,
            password, // In production, hash this password!
            createdAt: new Date().toISOString(),
            lastLogin: null
        };
        
        users.push(newUser);
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
        
        // Remove password from response
        const { password: _, ...userWithoutPassword } = newUser;
        
        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            user: userWithoutPassword
        });
        
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'An error occurred during signup' 
        });
    }
});

// Meeting Routes

// Create new meeting
app.post('/api/meetings', async (req, res) => {
    try {
        const { userId, userName } = req.body;
        
        if (!userId || !userName) {
            return res.status(400).json({ 
                success: false, 
                message: 'User ID and name are required' 
            });
        }
        
        // Generate meeting code
        const meetingCode = generateMeetingCode();
        
        const meetingsData = await fs.readFile(MEETINGS_FILE, 'utf8');
        const meetings = JSON.parse(meetingsData);
        
        // Check for duplicate meeting code (very unlikely but possible)
        if (meetings.some(m => m.code === meetingCode)) {
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to generate unique meeting code' 
            });
        }
        
        // Create meeting
        const newMeeting = {
            id: crypto.randomBytes(16).toString('hex'),
            code: meetingCode,
            hostId: userId,
            hostName: userName,
            createdAt: new Date().toISOString(),
            participants: [],
            active: true,
            settings: {
                requireAuth: false,
                allowScreenShare: true,
                allowRecording: true,
                maxParticipants: 50
            }
        };
        
        meetings.push(newMeeting);
        await fs.writeFile(MEETINGS_FILE, JSON.stringify(meetings, null, 2));
        
        res.status(201).json({
            success: true,
            message: 'Meeting created successfully',
            meeting: newMeeting
        });
        
    } catch (error) {
        console.error('Create meeting error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create meeting' 
        });
    }
});

// Join meeting
app.post('/api/meetings/:code/join', async (req, res) => {
    try {
        const { code } = req.params;
        const { userId, userName } = req.body;
        
        if (!userId || !userName) {
            return res.status(400).json({ 
                success: false, 
                message: 'User ID and name are required' 
            });
        }
        
        const meetingsData = await fs.readFile(MEETINGS_FILE, 'utf8');
        const meetings = JSON.parse(meetingsData);
        
        const meeting = meetings.find(m => m.code === code);
        
        if (!meeting) {
            return res.status(404).json({ 
                success: false, 
                message: 'Meeting not found' 
            });
        }
        
        if (!meeting.active) {
            return res.status(400).json({ 
                success: false, 
                message: 'Meeting has ended' 
            });
        }
        
        // Check if user is already in the meeting
        const existingParticipant = meeting.participants.find(p => p.userId === userId);
        
        if (existingParticipant) {
            // User rejoining
            existingParticipant.joinedAt = new Date().toISOString();
            existingParticipant.leftAt = null;
        } else {
            // New participant
            meeting.participants.push({
                userId,
                userName,
                joinedAt: new Date().toISOString(),
                leftAt: null,
                isHost: userId === meeting.hostId
            });
        }
        
        await fs.writeFile(MEETINGS_FILE, JSON.stringify(meetings, null, 2));
        
        // Emit participant joined event via socket
        io.to(`meeting-${code}`).emit('participant-joined', {
            userId,
            userName,
            isHost: userId === meeting.hostId
        });
        
        res.json({
            success: true,
            message: 'Joined meeting successfully',
            meeting: {
                id: meeting.id,
                code: meeting.code,
                hostName: meeting.hostName,
                participantCount: meeting.participants.filter(p => !p.leftAt).length
            }
        });
        
    } catch (error) {
        console.error('Join meeting error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to join meeting' 
        });
    }
});

// Leave meeting
app.post('/api/meetings/:code/leave', async (req, res) => {
    try {
        const { code } = req.params;
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ 
                success: false, 
                message: 'User ID is required' 
            });
        }
        
        const meetingsData = await fs.readFile(MEETINGS_FILE, 'utf8');
        const meetings = JSON.parse(meetingsData);
        
        const meeting = meetings.find(m => m.code === code);
        
        if (!meeting) {
            return res.status(404).json({ 
                success: false, 
                message: 'Meeting not found' 
            });
        }
        
        // Find and update participant
        const participant = meeting.participants.find(p => p.userId === userId && !p.leftAt);
        
        if (participant) {
            participant.leftAt = new Date().toISOString();
            
            await fs.writeFile(MEETINGS_FILE, JSON.stringify(meetings, null, 2));
            
            // Emit participant left event via socket
            io.to(`meeting-${code}`).emit('participant-left', {
                userId,
                userName: participant.userName
            });
            
            // If host left and no participants remain, end meeting
            if (userId === meeting.hostId) {
                const activeParticipants = meeting.participants.filter(p => !p.leftAt);
                if (activeParticipants.length === 0) {
                    meeting.active = false;
                    meeting.endedAt = new Date().toISOString();
                    await fs.writeFile(MEETINGS_FILE, JSON.stringify(meetings, null, 2));
                }
            }
        }
        
        res.json({
            success: true,
            message: 'Left meeting successfully'
        });
        
    } catch (error) {
        console.error('Leave meeting error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to leave meeting' 
        });
    }
});

// Get meeting info
app.get('/api/meetings/:code', async (req, res) => {
    try {
        const { code } = req.params;
        
        const meetingsData = await fs.readFile(MEETINGS_FILE, 'utf8');
        const meetings = JSON.parse(meetingsData);
        
        const meeting = meetings.find(m => m.code === code);
        
        if (!meeting) {
            return res.status(404).json({ 
                success: false, 
                message: 'Meeting not found' 
            });
        }
        
        // Don't expose all participants data, just count
        const participantCount = meeting.participants.filter(p => !p.leftAt).length;
        
        res.json({
            success: true,
            meeting: {
                id: meeting.id,
                code: meeting.code,
                hostName: meeting.hostName,
                createdAt: meeting.createdAt,
                active: meeting.active,
                participantCount,
                settings: meeting.settings
            }
        });
        
    } catch (error) {
        console.error('Get meeting error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get meeting info' 
        });
    }
});

// (scheduling endpoints removed)

// End meeting (host only)
app.post('/api/meetings/:code/end', async (req, res) => {
    try {
        const { code } = req.params;
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ 
                success: false, 
                message: 'User ID is required' 
            });
        }
        
        const meetingsData = await fs.readFile(MEETINGS_FILE, 'utf8');
        const meetings = JSON.parse(meetingsData);
        
        const meeting = meetings.find(m => m.code === code);
        
        if (!meeting) {
            return res.status(404).json({ 
                success: false, 
                message: 'Meeting not found' 
            });
        }
        
        if (meeting.hostId !== userId) {
            return res.status(403).json({ 
                success: false, 
                message: 'Only the host can end the meeting' 
            });
        }
        
        meeting.active = false;
        meeting.endedAt = new Date().toISOString();
        
        await fs.writeFile(MEETINGS_FILE, JSON.stringify(meetings, null, 2));
        
        // Emit meeting ended event via socket
        io.to(`meeting-${code}`).emit('meeting-ended', {
            endedBy: userId,
            endedAt: meeting.endedAt
        });
        
        res.json({
            success: true,
            message: 'Meeting ended successfully'
        });
        
    } catch (error) {
        console.error('End meeting error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to end meeting' 
        });
    }
});

// Generate meeting code
function generateMeetingCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 9; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Socket.io WebRTC Signaling

// Store active connections
const activeConnections = new Map();

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    // Join meeting room
    socket.on('join-meeting', (data) => {
        const { meetingCode, userName, isHost } = data;
        
        socket.meetingCode = meetingCode;
        socket.userName = userName;
        socket.isHost = isHost;
        
        // Join meeting room
        socket.join(`meeting-${meetingCode}`);
        
        // Store connection info
        activeConnections.set(socket.id, {
            meetingCode,
            userName,
            isHost,
            socketId: socket.id
        });
        
        console.log(`${userName} (${socket.id}) joined meeting ${meetingCode}`);
        
        // Notify others in the meeting
        socket.to(`meeting-${meetingCode}`).emit('user-joined', {
            userId: socket.id,
            userName,
            isHost,
            timestamp: new Date().toISOString()
        });
        
        // Send list of existing participants to new user
        const participants = Array.from(activeConnections.values())
            .filter(conn => conn.meetingCode === meetingCode && conn.socketId !== socket.id)
            .map(conn => ({
                userId: conn.socketId,
                userName: conn.userName,
                isHost: conn.isHost
            }));
        
        socket.emit('existing-participants', participants);
    });
    
    // WebRTC signaling
    socket.on('webrtc-signal', (data) => {
        const { to, signal } = data;
        
        // Forward signal to target user
        io.to(to).emit('webrtc-signal', {
            from: socket.id,
            signal
        });
    });
    
    // Chat messages
    socket.on('chat-message', (data) => {
        const { meetingCode, message, type = 'text' } = data;
        
        // Broadcast message to all in meeting
        io.to(`meeting-${meetingCode}`).emit('chat-message', {
            from: socket.id,
            userName: socket.userName,
            message,
            type,
            timestamp: new Date().toISOString()
        });
    });
    
    // Typing indicator
    socket.on('typing', (data) => {
        const { meetingCode, isTyping } = data;
        
        socket.to(`meeting-${meetingCode}`).emit('user-typing', {
            userId: socket.id,
            userName: socket.userName,
            isTyping
        });
    });
    
    // File sharing
    socket.on('file-share', (data) => {
        const { meetingCode, fileName, fileData, fileMimeType, fileType } = data;
        
        // Broadcast file to all in meeting
        io.to(`meeting-${meetingCode}`).emit('file-shared', {
            from: socket.id,
            userName: socket.userName,
            fileName,
            fileUrl: fileData,
            fileType,
            fileMimeType,
            timestamp: new Date().toISOString()
        });
    });
    
    // Screen sharing status
    socket.on('screen-share', (data) => {
        const { meetingCode, isSharing } = data;
        
        socket.to(`meeting-${meetingCode}`).emit('screen-share-status', {
            userId: socket.id,
            userName: socket.userName,
            isSharing
        });
    });
    
    // Recording status
    socket.on('recording', (data) => {
        const { meetingCode, isRecording } = data;
        
        socket.to(`meeting-${meetingCode}`).emit('recording-status', {
            userId: socket.id,
            userName: socket.userName,
            isRecording
        });
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        
        const connection = activeConnections.get(socket.id);
        
        if (connection) {
            const { meetingCode, userName } = connection;
            
            // Remove from active connections
            activeConnections.delete(socket.id);
            
            // Notify others in the meeting
            socket.to(`meeting-${meetingCode}`).emit('user-left', {
                userId: socket.id,
                userName,
                timestamp: new Date().toISOString()
            });
            
            console.log(`${userName} (${socket.id}) left meeting ${meetingCode}`);
            
            // Update meeting participants in database
            updateMeetingParticipants(meetingCode, socket.id).catch(console.error);
        }
    });
});

// Update meeting participants when user disconnects
async function updateMeetingParticipants(meetingCode, socketId) {
    try {
        const meetingsData = await fs.readFile(MEETINGS_FILE, 'utf8');
        const meetings = JSON.parse(meetingsData);
        
        const meeting = meetings.find(m => m.code === meetingCode);
        
        if (meeting) {
            // In a real app, you'd have a mapping from socketId to userId
            // For now, we'll just decrement participant count
            const activeParticipants = meeting.participants.filter(p => !p.leftAt);
            
            // If no active participants remain, mark meeting as inactive
            if (activeParticipants.length === 0) {
                meeting.active = false;
                meeting.endedAt = new Date().toISOString();
            }
            
            await fs.writeFile(MEETINGS_FILE, JSON.stringify(meetings, null, 2));
        }
    } catch (error) {
        console.error('Error updating meeting participants:', error);
    }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        activeConnections: activeConnections.size
    });
});

// Get server stats
app.get('/api/stats', async (req, res) => {
    try {
        const usersData = await fs.readFile(USERS_FILE, 'utf8');
        const meetingsData = await fs.readFile(MEETINGS_FILE, 'utf8');
        
        const users = JSON.parse(usersData);
        const meetings = JSON.parse(meetingsData);
        
        const activeMeetings = meetings.filter(m => m.active);
        const totalParticipants = activeMeetings.reduce((sum, meeting) => {
            return sum + meeting.participants.filter(p => !p.leftAt).length;
        }, 0);
        
        res.json({
            users: users.length,
            meetings: meetings.length,
            activeMeetings: activeMeetings.length,
            activeParticipants: totalParticipants,
            socketConnections: activeConnections.size
        });
        
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get server stats' 
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'Something went wrong!' 
    });
});

// 404 handler
app.use((req, res) => {
    if (req.accepts('html')) {
        res.status(404).sendFile(path.join(__dirname, 'views', '404.html'));
    } else if (req.accepts('json')) {
        res.status(404).json({ 
            success: false, 
            message: 'Resource not found' 
        });
    } else {
        res.status(404).type('txt').send('404 Not Found');
    }
});

// Start server
async function startServer() {
    try {
        // Initialize data files
        await initializeDataFiles();

        // Scheduling feature removed; no background activator started
        
        server.listen(PORT, () => {
            console.log(`
╔══════════════════════════════════════════════════════════╗
║           VideoMeet Server Started Successfully!         ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  🌐 Server running at: http://localhost:${PORT}            ║
║  📡 WebSocket ready for real-time communication         ║
║  📁 Static files served from: /public                   ║
║  📄 HTML views served from: /views                      ║
║  💾 User data stored in: users.json                     ║
║  🎯 Meeting data stored in: meetings.json               ║
║                                                          ║
║  Available Endpoints:                                    ║
║  • POST /api/login        - User authentication         ║
║  • POST /api/signup       - Create new account          ║
║  • POST /api/meetings     - Create new meeting          ║
║  • GET  /api/meetings/:id - Get meeting info            ║
║  • GET  /api/health       - Server health check         ║
║  • GET  /api/stats        - Server statistics           ║
║                                                          ║
║  Demo Accounts:                                          ║
║  • Username: demo        Password: demo123              ║
║  • Username: admin       Password: admin123             ║
║                                                          ║
║  Press Ctrl+C to stop the server                        ║
╚══════════════════════════════════════════════════════════╝
            `);
        });
        
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Scheduling activator removed

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    
    // Close all socket connections
    io.close();
    
    // Close HTTP server
    server.close(() => {
        console.log('Server stopped successfully');
        process.exit(0);
    });
    
    // Force close after 5 seconds
    setTimeout(() => {
        console.error('Could not close connections in time, forcing shutdown');
        process.exit(1);
    }, 5000);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
startServer();

// Export for testing
module.exports = { app, server, io };