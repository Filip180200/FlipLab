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

function formatNumberWithCommas(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
    const username = localStorage.getItem('username');
    if (!username) return;

    try {
        // Only load simulated comments on initial load
        if (isInitialLoad) {
            const simulatedComments = await fetch(`/api/simulated_comments?username=${encodeURIComponent(username)}`).then(res => res.json());
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
async function startRealTimeComments(commentsTable = 1) {
    // Clear any existing interval
    if (commentUpdateInterval) {
        clearInterval(commentUpdateInterval);
    }

    const currentUser = localStorage.getItem('username');
    if (!currentUser) return;

    // Poll for new comments every 2 seconds
    commentUpdateInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/new-comments?lastTimestamp=${lastCommentTimestamp}&username=${encodeURIComponent(currentUser)}&table=${commentsTable}`);
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

// YouTube Player API
function onYouTubeIframeAPIReady() {
    console.log('YouTube API Ready');
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: VIDEO_ID,
        playerVars: {
            'playsinline': 1,
            'autoplay': 1,
            'controls': 1,
            'modestbranding': 1,
            'rel': 0,
            'showinfo': 0,
            'fs': 1
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });

    // Make sure buttons are visible after player loads
    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) {
        videoContainer.style.display = 'flex';
        videoContainer.style.flexDirection = 'column';
    }
}

function onPlayerReady(event) {
    console.log('Player Ready');
    event.target.playVideo();
}

function onPlayerStateChange(event) {
    console.log('Player State Changed:', event.data);
}

// Channel video IDs
const channelVideos = {
    'ChilledCow': 'jfKfPfyJRdk',
    'pokimane': '5qap5aO4i9A',
    'Faker': 'DWZIfsaIgtE',
    'Dream': '21X5lGlDOfg'
};

// Channel setup functions
function setupChannelInteractions() {
    const channelItems = document.querySelectorAll('.channel-item');
    channelItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active class from all items
            channelItems.forEach(i => i.classList.remove('active'));
            // Add active class to clicked item
            item.classList.add('active');

            const channelName = item.querySelector('h4').textContent;
            const gameName = item.querySelector('p').textContent;
            const viewerCount = item.querySelector('.viewer-count').textContent;
            const avatarSrc = item.querySelector('.channel-preview img').src;
            const tags = item.querySelector('.tags').textContent.split('•').map(tag => tag.trim());

            // Change video if player is ready
            if (player && player.loadVideoById && channelVideos[channelName]) {
                player.loadVideoById(channelVideos[channelName]);
            }

            // Update stream info
            document.querySelector('.channel-name').textContent = channelName;
            document.querySelector('.channel-game').textContent = gameName;
            document.querySelector('.channel-avatar img').src = avatarSrc;
            
            // Update stream tags
            const tagsContainer = document.querySelector('.stream-tags');
            tagsContainer.innerHTML = '';
            tags.forEach(tag => {
                const tagSpan = document.createElement('span');
                tagSpan.className = 'tag';
                tagSpan.textContent = tag;
                tagsContainer.appendChild(tagSpan);
            });

            // Update viewer count
            document.querySelector('.viewers').innerHTML = `<i class="fas fa-user"></i> ${viewerCount} viewers`;

            // Show notification
            showNotification(`Switched to ${channelName}'s channel`);

            // Reset follow/sub buttons
            const followBtn = document.querySelector('.follow-btn');
            const subscribeBtn = document.querySelector('.subscribe-btn');
            followBtn.innerHTML = '<i class="fas fa-heart"></i> Follow';
            followBtn.style.background = '#3a3a3d';
            followBtn.classList.remove('following');
            subscribeBtn.innerHTML = '<i class="far fa-star"></i> Subscribe';
            subscribeBtn.style.background = '#3a3a3d';
            subscribeBtn.classList.remove('subscribed');
        });
    });
}

// Timer functionality
let sessionTime = 0; // Will be set from API
let timerInterval = null;
const countdownElement = document.getElementById('countdown');

// Session management functions
async function endSession(username) {
    try {
        await fetch(`${API_URL}/api/end-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })
        });
    } catch (error) {
        console.error('Error ending session:', error);
    }
}

async function checkSessionStatus() {
    const username = localStorage.getItem('username');
    if (!username) {
        redirectToThankYou();
        return false;
    }

    try {
        const response = await fetch(`${API_URL}/api/session-status/${username}`);
        const data = await response.json();

        if (data.session_ended) {
            redirectToThankYou();
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error checking session status:', error);
        return false;
    }
}

function redirectToThankYou() {
    if (window.location.pathname !== '/thank-you.html') {
        window.location.href = '/thank-you.html';
    }
}

// Start countdown
async function startCountdown() {
    const username = localStorage.getItem('username');
    if (!username) {
        redirectToThankYou();
        return;
    }

    try {
        // First check if session is already ended
        const statusResponse = await fetch(`${API_URL}/api/session-status/${username}`);
        const statusData = await statusResponse.json();
        
        if (statusData.session_ended) {
            redirectToThankYou();
            return;
        }

        const response = await fetch(`${API_URL}/api/time-left/${username}`);
        if (!response.ok) {
            throw new Error('Failed to get time left');
        }

        const data = await response.json();
        sessionTime = data.timeLeft;

        // If time is already up, end session and redirect
        if (sessionTime <= 0) {
            await endSession(username);
            redirectToThankYou();
            return;
        }

        updateTimerDisplay(sessionTime);

        // Clear any existing interval
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }

        // Start countdown
        timerInterval = setInterval(async () => {
            if (sessionTime > 0) {
                sessionTime--;
                updateTimerDisplay(sessionTime);
                
                // Send periodic updates to server without resetting timer
                try {
                    await fetch(`${API_URL}/api/update-time`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            username,
                            timeLeft: sessionTime
                        })
                    });
                } catch (error) {
                    console.error('Error updating time:', error);
                }
                
                if (sessionTime <= 0) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                    await endSession(username);
                    redirectToThankYou();
                }
            }
        }, 1000);
    } catch (error) {
        console.error('Error starting countdown:', error);
    }
}

// Update timer display
function updateTimerDisplay(time) {
    if (!countdownElement) return;
    
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    countdownElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Handle page visibility change
document.addEventListener('visibilitychange', async function() {
    const username = localStorage.getItem('username');
    if (!username) return;

    if (document.visibilityState === 'hidden') {
        await endSession(username);
        redirectToThankYou();
    }
});

// Handle page unload
window.addEventListener('beforeunload', async (event) => {
    const username = localStorage.getItem('username');
    if (username) {
        await endSession(username);
    }
});

// Initialize countdown on page load
document.addEventListener('DOMContentLoaded', async () => {
    const username = localStorage.getItem('username');
    if (username) {
        const isValid = await checkSessionStatus();
        if (isValid) {
            startCountdown();
        }
    }
});

// Subscribe button functionality
document.addEventListener('DOMContentLoaded', function() {
    const subscribeBtn = document.querySelector('.subscribe-btn');
    if (subscribeBtn) {
        let isSubscribed = false;
        subscribeBtn.addEventListener('click', function() {
            isSubscribed = !isSubscribed;
            if (isSubscribed) {
                this.innerHTML = '<i class="fas fa-star"></i> Subscribed';
                this.style.background = '#9147ff';  // Purple color when subscribed
                showNotification('Thanks for subscribing!', 'success');
            } else {
                this.innerHTML = '<i class="far fa-star"></i> Subscribe';
                this.style.background = '#3a3a3d';  // Default color
                showNotification('Subscription cancelled', 'info');
            }
        });
    }
});

// Follow button functionality
document.addEventListener('DOMContentLoaded', function() {
    const followBtn = document.querySelector('.follow-btn');
    if (followBtn) {
        let isFollowing = false;
        followBtn.addEventListener('click', function() {
            isFollowing = !isFollowing;
            if (isFollowing) {
                this.innerHTML = '<i class="fas fa-heart-broken"></i> Unfollow';
                this.style.background = '#f00';  // Red color when following
                showNotification('Thanks for following! You will now receive notifications when we go live.', 'success');
            } else {
                this.innerHTML = '<i class="fas fa-heart"></i> Follow';
                this.style.background = '#3a3a3d';  // Default color
                showNotification('You have unfollowed the channel', 'info');
            }
        });
    }
});

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Settings button notification
    const settingsButton = document.querySelector('.settings-btn');
    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            showNotification('Settings will be available in a future update!', 'info');
        });
    }

    // Handle clicks for reporting
    document.addEventListener('click', function(e) {
        const reportModal = document.getElementById('reportModal');
        const reportOverlay = document.querySelector('.report-overlay');

        // Handle username clicks
        if (e.target.classList.contains('username')) {
            const messageEl = e.target.closest('.chat-message');
            const username = messageEl.querySelector('.username').textContent;
            const avatar = messageEl.querySelector('.chat-avatar').src;
            openReportModal(username, avatar);
        }

        // Handle report button clicks
        if (e.target.closest('.report-btn')) {
            const messageEl = e.target.closest('.chat-message');
            const username = messageEl.querySelector('.username').textContent;
            const avatar = messageEl.querySelector('.chat-avatar').src;
            openReportModal(username, avatar);
        }

        // Close on overlay click
        if (e.target.classList.contains('report-overlay')) {
            closeReportModal();
        }

        // Close on close button click
        if (e.target.closest('.close-preview')) {
            closeReportModal();
        }

        // Handle report submit
        if (e.target.closest('.report-submit')) {
            const username = reportModal.querySelector('#reportUsername').textContent;
            reportUser(username);
        }
    });

    // Handle comment form
    const commentForm = document.getElementById('commentForm');
    if (commentForm) {
        commentForm.addEventListener('submit', addComment);
    }

    // Initialize app
    initializeApp();
});

// Prevent going back to web.html if session is ended
window.addEventListener('load', async () => {
    const username = localStorage.getItem('username');
    if (!username) {
        window.location.href = '/thank-you.html';
        return;
    }

    // Check if time is still valid
    try {
        const response = await fetch(`${API_URL}/api/time-left/${username}`);
        if (response.ok) {
            const data = await response.json();
            if (!data.timeLeft || data.timeLeft <= 0) {
                localStorage.removeItem('username');
                window.location.href = '/thank-you.html';
                return;
            }
        } else {
            localStorage.removeItem('username');
            window.location.href = '/thank-you.html';
            return;
        }
    } catch (error) {
        console.error('Error checking time:', error);
        localStorage.removeItem('username');
        window.location.href = '/thank-you.html';
        return;
    }
});

// Format number with commas
function formatNumberWithCommas(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Update viewer count
function updateViewerCount(viewerNumber) {
    console.log('Updating viewer count to:', viewerNumber);
    const viewerCountElement = document.getElementById('viewerCount');
    if (viewerCountElement) {
        viewerCountElement.textContent = formatNumberWithCommas(viewerNumber);
        console.log('Viewer count updated successfully');
    } else {
        console.error('Viewer count element not found');
    }
}

// Initialize app with test group info
async function initializeApp() {
    console.log('Initializing app...');
    
    const username = localStorage.getItem('username');
    if (!username) {
        window.location.href = '/thank-you.html';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/user/${username}`);
        if (!response.ok) {
            throw new Error('Failed to fetch user data');
        }
        const userData = await response.json();
        console.log('User data received:', userData);
        
        // Update viewer count from database
        if (typeof userData.viewer_number === 'number') {
            console.log('Setting viewer count to:', userData.viewer_number);
            updateViewerCount(userData.viewer_number);
        } else {
            console.error('Invalid viewer number in user data:', userData.viewer_number);
        }

        // Load initial comments
        loadComments(true);
        
        // Start countdown
        startCountdown();
        
        // Setup channel interactions
        setupChannelInteractions();
    } catch (error) {
        console.error('Error initializing app:', error);
        showNotification('Error loading user data', 'error');
    }
}

// Make sure DOM is loaded before initializing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}