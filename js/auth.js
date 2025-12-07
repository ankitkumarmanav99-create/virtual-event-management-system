// auth.js - Authentication Logic for EventSphere

// DOM Elements
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginFormWrapper = document.getElementById('loginFormWrapper');
const signupFormWrapper = document.getElementById('signupFormWrapper');
const showSignupLink = document.getElementById('showSignup');
const showLoginLink = document.getElementById('showLogin');
const notification = document.getElementById('notification');
const notificationMessage = document.getElementById('notificationMessage');

// Form Inputs
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const signupUsername = document.getElementById('signupUsername');
const signupEmail = document.getElementById('signupEmail');
const signupPassword = document.getElementById('signupPassword');
const confirmPassword = document.getElementById('confirmPassword');

// Buttons
const loginSubmitBtn = document.getElementById('loginSubmit');
const signupSubmitBtn = document.getElementById('signupSubmit');
const showLoginPasswordBtn = document.getElementById('showLoginPassword');
const showSignupPasswordBtn = document.getElementById('showSignupPassword');

// Store users in localStorage (in real app, this would be server-side)
const STORAGE_KEY = 'eventsphere_users';
const CURRENT_USER_KEY = 'eventsphere_current_user';

// Initialize users storage if not exists
function initializeUsers() {
    if (!localStorage.getItem(STORAGE_KEY)) {
        const defaultUsers = [
            {
                id: 1,
                username: 'demo',
                email: 'demo@eventsphere.com',
                password: 'demo123',
                createdAt: new Date().toISOString(),
                lastLogin: null
            },
            {
                id: 2,
                username: 'admin',
                email: 'admin@eventsphere.com',
                password: 'admin123',
                createdAt: new Date().toISOString(),
                lastLogin: null
            }
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultUsers));
    }
}

// Get all users
function getUsers() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

// Save users
function saveUsers(users) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

// Get current user
function getCurrentUser() {
    return JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || 'null');
}

// Set current user
function setCurrentUser(user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

// Clear current user
function clearCurrentUser() {
    localStorage.removeItem(CURRENT_USER_KEY);
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Show notification
function showNotification(message, type = 'info') {
    notificationMessage.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// Hide notification
function hideNotification() {
    notification.classList.remove('show');
}

// Validate email format
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Validate username format
function isValidUsername(username) {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
}

// Validate password strength
function validatePassword(password) {
    const errors = [];
    
    if (password.length < 6) {
        errors.push('Password must be at least 6 characters long');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*]/.test(password)) {
        errors.push('Password must contain at least one special character (!@#$%^&*)');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

// Update password strength indicator
function updatePasswordStrength(password) {
    const strengthBar = document.querySelector('.strength-bar');
    const strengthClasses = ['strength-weak', 'strength-medium', 'strength-strong'];
    
    if (!strengthBar) return;
    
    // Remove existing strength classes
    strengthClasses.forEach(cls => strengthBar.classList.remove(cls));
    
    if (password.length === 0) {
        strengthBar.style.width = '0%';
        return;
    }
    
    let strength = 0;
    if (password.length >= 6) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*]/.test(password)) strength++;
    
    if (strength === 1) {
        strengthBar.classList.add('strength-weak');
        strengthBar.style.width = '33%';
    } else if (strength === 2 || strength === 3) {
        strengthBar.classList.add('strength-medium');
        strengthBar.style.width = '66%';
    } else if (strength === 4) {
        strengthBar.classList.add('strength-strong');
        strengthBar.style.width = '100%';
    }
}

// Toggle form visibility
function toggleForm() {
    const isLoginVisible = loginFormWrapper.style.display !== 'none';
    
    if (isLoginVisible) {
        loginFormWrapper.style.display = 'none';
        signupFormWrapper.style.display = 'block';
        signupUsername.focus();
    } else {
        signupFormWrapper.style.display = 'none';
        loginFormWrapper.style.display = 'block';
        loginUsername.focus();
    }
    
    // Reset forms
    loginForm.reset();
    signupForm.reset();
    hideNotification();
    
    // Reset password strength
    const strengthBar = document.querySelector('.strength-bar');
    if (strengthBar) {
        strengthBar.style.width = '0%';
        strengthBar.className = 'strength-bar';
    }
}

// Toggle password visibility
function togglePasswordVisibility(inputId, button) {
    const input = document.getElementById(inputId);
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// Show loading state
function setLoading(button, isLoading) {
    if (isLoading) {
        button.classList.add('loading');
        button.disabled = true;
        const span = button.querySelector('span');
        if (span) {
            button.dataset.originalText = span.textContent;
            span.textContent = 'Processing...';
        }
    } else {
        button.classList.remove('loading');
        button.disabled = false;
        const span = button.querySelector('span');
        if (span && button.dataset.originalText) {
            span.textContent = button.dataset.originalText;
        }
    }
}

// Check if user is already logged in
function checkExistingSession() {
    const user = getCurrentUser();
    if (user) {
        // Show welcome back message
        showNotification(`Welcome back, ${user.username}!`, 'success');
        
        // Redirect to landing page after a delay
        setTimeout(() => {
            window.location.href = '/landing.html';
        }, 1000);
    }
}

// Login function
async function handleLogin(e) {
    e.preventDefault();
    
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();
    
    // Validation
    if (!username || !password) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    // Set loading state
    setLoading(loginSubmitBtn, true);
    
    try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));

        const users = getUsers();

        // Find user by username or email
        let user = users.find(u =>
            u.username.toLowerCase() === username.toLowerCase() ||
            u.email.toLowerCase() === username.toLowerCase()
        );

        if (!user) {
            // Create new user if not exists (allow any email/password)
            user = {
                id: generateId(),
                username: username.includes('@') ? username.split('@')[0] : username,
                email: username.includes('@') ? username : `${username}@example.com`,
                password: password,
                createdAt: new Date().toISOString(),
                lastLogin: null
            };
            users.push(user);
            saveUsers(users);
        }

        // Update last login
        user.lastLogin = new Date().toISOString();
        saveUsers(users);

        // Set current user (without password)
        const { password: _, ...userWithoutPassword } = user;
        setCurrentUser(userWithoutPassword);
        
        // Show success message
        showNotification('Login successful! Redirecting...', 'success');
        
        // Redirect to landing page
        setTimeout(() => {
            window.location.href = '/landing.html';
        }, 1500);
        
    } catch (error) {
        console.error('Login error:', error);
        showNotification('An error occurred during login', 'error');
    } finally {
        setLoading(loginSubmitBtn, false);
    }
}

// Signup function
async function handleSignup(e) {
    e.preventDefault();
    
    const username = signupUsername.value.trim();
    const email = signupEmail.value.trim();
    const password = signupPassword.value.trim();
    const confirm = confirmPassword.value.trim();
    
    // Validation
    if (!username || !email || !password || !confirm) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    if (!isValidEmail(email)) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }
    
    if (!isValidUsername(username)) {
        showNotification('Username must be 3-20 characters (letters, numbers, underscores only)', 'error');
        return;
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
        showNotification(passwordValidation.errors[0], 'error');
        return;
    }
    
    if (password !== confirm) {
        showNotification('Passwords do not match', 'error');
        return;
    }
    
    // Set loading state
    setLoading(signupSubmitBtn, true);
    
    try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const users = getUsers();
        
        // Check if username already exists
        if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            showNotification('Username already exists', 'error');
            return;
        }
        
        // Check if email already exists
        if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
            showNotification('Email already registered', 'error');
            return;
        }
        
        // Create new user
        const newUser = {
            id: generateId(),
            username,
            email,
            password, // In real app, this would be hashed
            createdAt: new Date().toISOString(),
            lastLogin: null
        };
        
        // Add user to storage
        users.push(newUser);
        saveUsers(users);
        
        // Set current user (without password)
        const { password: _, ...userWithoutPassword } = newUser;
        setCurrentUser(userWithoutPassword);
        
        // Show success message
        showNotification('Account created successfully! Welcome to EventSphere!', 'success');
        
        // Redirect to landing page
        setTimeout(() => {
            window.location.href = '/landing.html';
        }, 1500);
        
    } catch (error) {
        console.error('Signup error:', error);
        showNotification('An error occurred during signup', 'error');
    } finally {
        setLoading(signupSubmitBtn, false);
    }
}

// Social login (demo function)
function handleSocialLogin(provider) {
    showNotification(`${provider} login is currently in demo mode. Please use regular login.`, 'info');
    
    // In a real app, this would redirect to OAuth provider
    // For demo, we'll create a temporary user
    const demoUser = {
        id: `social_${Date.now()}`,
        username: `social_${provider.toLowerCase()}`,
        email: `demo@${provider.toLowerCase()}.com`,
        isSocial: true,
        provider: provider,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
    };
    
    setCurrentUser(demoUser);
    
    // Show message and redirect
    showNotification(`Logged in with ${provider} (demo mode)`, 'success');
    
    setTimeout(() => {
        window.location.href = '/landing.html';
    }, 1500);
}

// Handle forgot password (demo function)
function handleForgotPassword() {
    showNotification('Password reset feature is coming soon!', 'info');
    
    // In a real app, this would:
    // 1. Show a modal to enter email
    // 2. Send reset email
    // 3. Handle reset token
    
    // For demo purposes
    const forgotEmail = prompt('Enter your email to reset password:');
    if (forgotEmail) {
        showNotification(`Reset instructions would be sent to ${forgotEmail} in a real app.`, 'info');
    }
}

// Handle terms and privacy links
function handleTermsClick(e) {
    e.preventDefault();
    showNotification('Terms of Service and Privacy Policy documents are coming soon!', 'info');
}

// Initialize the authentication system
function initAuth() {
    // Initialize users storage
    initializeUsers();
    
    // Check for existing session
    checkExistingSession();
    
    // Event Listeners
    showSignupLink.addEventListener('click', (e) => {
        e.preventDefault();
        toggleForm();
    });
    
    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        toggleForm();
    });
    
    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);
    
    // Password visibility toggles
    showLoginPasswordBtn.addEventListener('click', () => {
        togglePasswordVisibility('loginPassword', showLoginPasswordBtn);
    });
    
    showSignupPasswordBtn.addEventListener('click', () => {
        togglePasswordVisibility('signupPassword', showSignupPasswordBtn);
    });
    
    // Password strength indicator
    signupPassword.addEventListener('input', (e) => {
        updatePasswordStrength(e.target.value);
    });
    
    // Forgot password link
    const forgotPasswordLink = document.querySelector('.forgot-password');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            handleForgotPassword();
        });
    }
    
    // Terms and privacy links
    const termsLinks = document.querySelectorAll('.terms a');
    termsLinks.forEach(link => {
        link.addEventListener('click', handleTermsClick);
    });
    
    // Social login buttons
    const socialButtons = document.querySelectorAll('.social-btn');
    socialButtons.forEach(button => {
        button.addEventListener('click', () => {
            const provider = button.classList.contains('google') ? 'Google' : 'GitHub';
            handleSocialLogin(provider);
        });
    });
    
    // Auto-focus on username field
    if (loginUsername) loginUsername.focus();
    
    // Demo auto-fill for testing
    if (window.location.hash === '#demo') {
        loginUsername.value = 'demo';
        loginPassword.value = 'demo123';
        showNotification('Demo credentials loaded. Click Login to continue.', 'info');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initAuth);

// Utility functions for other pages to use
window.authUtils = {
    getCurrentUser,
    clearCurrentUser,
    logout: function() {
        clearCurrentUser();
        window.location.href = '/index.html';
    },
    isAuthenticated: function() {
        return !!getCurrentUser();
    },
    requireAuth: function() {
        if (!this.isAuthenticated()) {
            window.location.href = '/index.html';
            return false;
        }
        return true;
    }
};

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to submit form
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const activeForm = loginFormWrapper.style.display !== 'none' ? loginForm : signupForm;
        const submitButton = activeForm.querySelector('.submit-btn');
        if (submitButton && !submitButton.disabled) {
            submitButton.click();
        }
    }
    
    // Escape to hide notification
    if (e.key === 'Escape' && notification.classList.contains('show')) {
        hideNotification();
    }
    
    // Tab switching between forms
    if (e.key === 'Tab' && e.shiftKey) {
        // Handle reverse tab navigation
    }
});

// Handle browser back/forward buttons
window.addEventListener('popstate', () => {
    // Ensure form state is preserved
    const user = getCurrentUser();
    if (user) {
        window.location.href = '/landing.html';
    }
});

// Export for module usage (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initAuth,
        handleLogin,
        handleSignup,
        getCurrentUser,
        clearCurrentUser
    };
}