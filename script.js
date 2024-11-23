// Konfiguracja
const API_URL = 'https://fliplab.onrender.com';
const DEFAULT_AVATAR = 'https://static-cdn.jtvnw.net/user-default-pictures-uv/13e5fa74-defa-11e9-809c-784f43822e80-profile_image-70x70.png';
const VIDEO_ID = 'jfKfPfyJRdk'; // lofi girl video ID

// Globalne zmienne do śledzenia stanu
let displayedCommentIds = new Set();
let simulatedCommentsScheduled = false;
let lastCommentTimestamp = new Date().toISOString();
let commentUpdateInterval;
let player;
let streamStartTime = new Date();

// Cache dla komentarzy użytkowników
const userCommentsCache = new Map();

// Set to store reported users with reporter information
const reportedUsersMap = new Map(); // Map of username -> Set of reporters

// Mock data for testing
const mockUserComments = {
    'User123': [
        { comment: 'Hello everyone!', timestamp: new Date().toISOString() },
        { comment: 'This stream is amazing!', timestamp: new Date(Date.now() - 5000).toISOString() },
        { comment: "Can't wait for the next one!", timestamp: new Date(Date.now() - 10000).toISOString() }
    ]
};

function addCommentToCache(username, comment) {
    if (!userCommentsCache.has(username)) {
        userCommentsCache.set(username, []);
    }
    const comments = userCommentsCache.get(username);
    comments.push(comment);
    // Zachowaj tylko ostatnie 3 komentarze
    if (comments.length > 3) {
        comments.shift();
    }
}

function getRecentComments(username) {
    return userCommentsCache.get(username) || [];
}

// Funkcje pomocnicze
async function fetchData(endpoint) {
    const response = await fetch(`${API_URL}${endpoint}`);
    return response.json();
}

async function postData(endpoint, data) {
    const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    return response.json();
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function showNotification(message, type = 'info') {
    // In-app notification only
    const notification = document.createElement('div');
    notification.className = `notification ${type} show`;
    
    const icon = document.createElement('i');
    icon.className = type === 'success' ? 'fas fa-check notification-icon' : 'fas fa-bell notification-icon';
    
    const messageText = document.createElement('p');
    messageText.className = 'notification-message';
    messageText.textContent = message;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'notification-close';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.onclick = () => notification.remove();
    
    notification.appendChild(icon);
    notification.appendChild(messageText);
    notification.appendChild(closeBtn);
    
    // Remove existing notifications of the same type
    const existingNotifications = document.querySelectorAll(`.notification.${type}`);
    existingNotifications.forEach(n => n.remove());
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Funkcje zarządzania komentarzami
async function loadComments(isInitialLoad = false) {
    try {
        // Only load simulated comments on initial load
        if (isInitialLoad) {
            const simulatedComments = await fetch('/api/simulated_comments').then(res => res.json());
            const chatMessages = document.querySelector('.chat-messages');
            chatMessages.innerHTML = '';
            displayedCommentIds.clear();
            
            // Schedule simulated comments
            if (!simulatedCommentsScheduled && simulatedComments.length > 0) {
                simulatedCommentsScheduled = true;
                simulatedComments.forEach(comment => {
                    setTimeout(() => {
                        if (!displayedCommentIds.has(comment.id)) {
                            const commentElement = createCommentElement(comment);
                            chatMessages.appendChild(commentElement);
                            displayedCommentIds.add(comment.id);
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }
                    }, comment.delay * 1000);
                });
            }

            // Start polling for new real-time comments
            startRealTimeComments();
        }
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

// New function to handle real-time comments
async function startRealTimeComments() {
    // Clear any existing interval
    if (commentUpdateInterval) {
        clearInterval(commentUpdateInterval);
    }

    const currentUser = localStorage.getItem('username');
    if (!currentUser) return;

    // Poll for new comments every 2 seconds
    commentUpdateInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/new-comments?lastTimestamp=${lastCommentTimestamp}&username=${encodeURIComponent(currentUser)}`);
            const newComments = await response.json();
            
            if (newComments.length > 0) {
                const chatMessages = document.querySelector('.chat-messages');
                newComments.forEach(comment => {
                    if (!displayedCommentIds.has(comment.id)) {
                        const commentElement = createCommentElement(comment);
                        chatMessages.appendChild(commentElement);
                        displayedCommentIds.add(comment.id);
                        addCommentToCache(comment.username, comment);
                    }
                });
                
                // Update the last timestamp
                lastCommentTimestamp = newComments[0].timestamp;
                
                // Scroll to bottom
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        } catch (error) {
            console.error('Error fetching new comments:', error);
        }
    }, 2000);
}

async function addComment(event) {
    event.preventDefault();
    
    const commentInput = document.getElementById('comment');
    const comment = commentInput.value.trim();
    const nickname = localStorage.getItem('username');
    
    if (!comment) return;
    
    try {
        // Send comment to server
        await postData('/api/comment', {
            username: nickname,
            comment: comment
        });

        // Clear input after successful submission
        commentInput.value = '';
        
        // Don't add the comment immediately - it will be fetched by the real-time update
    } catch (error) {
        console.error('Error adding comment:', error);
        showNotification('Error adding comment. Please try again.');
    }
}

function addSingleComment(comment, scrollToBottom = true) {
    const chatMessages = document.querySelector('.chat-messages');
    const commentElement = createCommentElement(comment);
    chatMessages.appendChild(commentElement);

    if (scrollToBottom) {
        commentElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    // Store the comment ID to avoid duplicates
    displayedCommentIds.add(comment.id);
}

function createCommentElement(comment) {
    const commentElement = document.createElement('div');
    commentElement.classList.add('chat-message');

    // Check if this user is reported by the current user
    const currentUser = localStorage.getItem('username') || 'Anonymous';
    if (reportedUsersMap.has(comment.username) && reportedUsersMap.get(comment.username).has(currentUser)) {
        commentElement.classList.add('reported');
    }

    const avatar = document.createElement('img');
    avatar.src = comment.avatar_url || DEFAULT_AVATAR;
    avatar.className = 'chat-avatar';
    avatar.alt = `${comment.username}'s avatar`;
    avatar.onerror = () => avatar.src = DEFAULT_AVATAR;

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content-wrapper';

    const header = document.createElement('div');
    header.className = 'message-header';

    const username = document.createElement('span');
    username.className = 'username';
    username.textContent = comment.username;
    username.onclick = () => openReportModal(comment.username);

    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = comment.comment;

    header.appendChild(username);
    contentWrapper.appendChild(header);
    contentWrapper.appendChild(content);
    commentElement.appendChild(avatar);
    commentElement.appendChild(contentWrapper);

    return commentElement;
}

// Funkcje raportu użytkownika
async function reportUser(username) {
    try {
        const reportingUsername = localStorage.getItem('username') || 'Anonymous';
        
        // Check if current user has already reported this user
        if (reportedUsersMap.has(username) && reportedUsersMap.get(username).has(reportingUsername)) {
            return false;
        }

        // Add to reportedUsersMap first
        if (!reportedUsersMap.has(username)) {
            reportedUsersMap.set(username, new Set());
        }
        reportedUsersMap.get(username).add(reportingUsername);

        // Mark user's messages as reported
        const userMessages = document.querySelectorAll('.chat-message');
        userMessages.forEach(message => {
            const messageUsername = message.querySelector('.username').textContent;
            if (messageUsername === username) {
                message.classList.add('reported');
            }
        });

        // Send report to server
        const response = await fetch('/api/report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reportedUsername: username,
                reportingUsername: reportingUsername,
                timestamp: new Date().toISOString()
            })
        });

        if (!response.ok) {
            // If server request fails, rollback the local changes
            reportedUsersMap.get(username).delete(reportingUsername);
            if (reportedUsersMap.get(username).size === 0) {
                reportedUsersMap.delete(username);
            }
            userMessages.forEach(message => {
                const messageUsername = message.querySelector('.username').textContent;
                if (messageUsername === username) {
                    message.classList.remove('reported');
                }
            });
            throw new Error('Failed to submit report');
        }

        // Show success notification
        showNotification(`${username} successfully reported`, 'success');
        return true;

    } catch (error) {
        console.error('Error reporting user:', error);
        showNotification('Failed to report user', 'error');
        return false;
    }
}

async function openReportModal(username) {
    try {
        const currentUser = localStorage.getItem('username') || 'Anonymous';
        
        // Check if already reported before opening modal
        if (reportedUsersMap.has(username) && reportedUsersMap.get(username).has(currentUser)) {
            showNotification(`${username} is already reported`, 'warning');
            return;
        }

        const userComments = document.querySelectorAll('.chat-message');
        let userAvatar = DEFAULT_AVATAR;
        let recentComments = new Set();
        
        userComments.forEach(commentEl => {
            const commentUsername = commentEl.querySelector('.username').textContent;
            if (commentUsername === username) {
                if (userAvatar === DEFAULT_AVATAR) {
                    const avatarImg = commentEl.querySelector('.chat-avatar');
                    userAvatar = avatarImg ? avatarImg.src : DEFAULT_AVATAR;
                }
                const commentText = commentEl.querySelector('.message-content').textContent;
                recentComments.add(commentText);
            }
        });
        
        const reportModal = document.getElementById('reportModal');
        const reportUsername = document.getElementById('reportUsername');
        const avatar = reportModal.querySelector('.chat-avatar');
        const commentsList = document.getElementById('reportUserComments');
        
        reportUsername.textContent = username;
        avatar.src = userAvatar;
        avatar.onerror = () => avatar.src = DEFAULT_AVATAR;
        commentsList.innerHTML = '';
        
        const uniqueComments = Array.from(recentComments).slice(-3);
        if (uniqueComments.length > 0) {
            uniqueComments.forEach(comment => {
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message';
                messageDiv.textContent = comment;
                commentsList.appendChild(messageDiv);
            });
        } else {
            const noCommentsDiv = document.createElement('div');
            noCommentsDiv.className = 'message';
            noCommentsDiv.textContent = 'No recent comments';
            commentsList.appendChild(noCommentsDiv);
        }
        
        const closeButton = reportModal.querySelector('.close-preview');
        const submitButton = reportModal.querySelector('.report-submit');
        const overlay = document.querySelector('.report-overlay');
        
        closeButton.onclick = closeReportModal;
        submitButton.onclick = async () => {
            const success = await reportUser(username);
            if (success) {
                closeReportModal();
            }
        };
        overlay.onclick = closeReportModal;
        
        reportModal.classList.add('active');
        overlay.classList.add('active');
    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Error loading user data', 'error');
    }
}

function closeReportModal() {
    const reportModal = document.getElementById('reportModal');
    const overlay = document.querySelector('.report-overlay');
    reportModal.classList.remove('active');
    overlay.classList.remove('active');
}

// Funkcje komentarzy użytkownika
// ... (rest of the code remains the same)