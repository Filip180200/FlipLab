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
let streamStats = {
    viewers: 32500,
    followers: 12500,
    subscribers: 2300,
    isFollowing: false,
    isSubscribed: false,
    timeOffset: 0
};

// Cache dla komentarzy użytkowników
const userCommentsCache = new Map();

// Set to store reported users
const reportedUsers = new Set();

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
const fetchData = async (endpoint) => {
    const response = await fetch(`${API_URL}${endpoint}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
};

const postData = async (endpoint, data) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response;
};

// Funkcje kontroli panelu
function toggleControlPanel() {
    const panel = document.getElementById('controlPanel');
    panel.classList.toggle('visible');
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
    // Browser notification
    if (Notification.permission === "granted") {
        new Notification("FlipLab", {
            body: message,
            icon: '/assets/favicon.ico'
        });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                new Notification("FlipLab", {
                    body: message,
                    icon: '/assets/favicon.ico'
                });
            }
        });
    }

    // In-app notification
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

    // Poll for new comments every 2 seconds
    commentUpdateInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/new-comments?lastTimestamp=${lastCommentTimestamp}`);
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
    commentElement.dataset.commentId = comment.id;

    // Avatar
    const avatar = document.createElement('img');
    avatar.src = comment.avatar_url || DEFAULT_AVATAR;
    avatar.className = 'chat-avatar';
    avatar.alt = `${comment.username}'s avatar`;
    avatar.onerror = () => avatar.src = DEFAULT_AVATAR;

    // Message content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content-wrapper';

    // Message header
    const header = document.createElement('div');
    header.className = 'message-header';

    const username = document.createElement('span');
    username.className = 'username';
    username.textContent = comment.username;
    username.onclick = () => openReportModal(comment.username);

    // Message content
    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = comment.comment;

    // Assemble the elements
    header.appendChild(username);
    contentWrapper.appendChild(header);
    contentWrapper.appendChild(content);

    commentElement.appendChild(avatar);
    commentElement.appendChild(contentWrapper);

    return commentElement;
}

function createAvatarElement(comment) {
    const container = document.createElement('div');
    container.classList.add('avatar-container');
    
    const img = document.createElement('img');
    img.classList.add('avatar');
    img.src = comment.avatar_url || DEFAULT_AVATAR;
    img.alt = `${comment.username}'s avatar`;
    img.onerror = () => img.src = DEFAULT_AVATAR;
    
    container.appendChild(img);
    return container;
}

function createTextContainer(comment) {
    const container = document.createElement('div');
    container.classList.add('text-container');

    const messageText = document.createElement('p');
    messageText.classList.add('message');
    if (reportedUsers.has(comment.username)) {
        messageText.classList.add('reported-message');
    }
    messageText.innerHTML = `<span class="username" style="cursor: pointer;">${comment.username}</span>: ${comment.comment}`.replace('> :', '>:');
    
    const usernameSpan = messageText.querySelector('.username');
    usernameSpan.addEventListener('click', () => openReportModal(comment.username));

    container.appendChild(messageText);
    return container;
}

// Funkcje raportu użytkownika
async function openReportModal(username) {
    try {
        // Get the user's avatar from their comments
        const userComments = document.querySelectorAll('.chat-message');
        let userAvatar = DEFAULT_AVATAR;
        let recentComments = [];
        
        // Collect comments and avatar for the user
        userComments.forEach(commentEl => {
            const commentUsername = commentEl.querySelector('.username').textContent;
            if (commentUsername === username) {
                // Get avatar if we haven't found it yet
                if (userAvatar === DEFAULT_AVATAR) {
                    const avatarImg = commentEl.querySelector('.chat-avatar');
                    userAvatar = avatarImg ? avatarImg.src : DEFAULT_AVATAR;
                }
                
                // Get comment text
                const commentText = commentEl.querySelector('.message-content').textContent;
                recentComments.push({
                    comment: commentText,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        const reportPreview = document.querySelector('.report-preview');
        const previewUsername = reportPreview.querySelector('.preview-username');
        const avatar = reportPreview.querySelector('.user-avatar');
        const commentsList = document.getElementById('reportUserComments');
        
        previewUsername.textContent = username;
        avatar.src = userAvatar;
        avatar.onerror = () => avatar.src = DEFAULT_AVATAR;

        // Clear previous comments
        commentsList.innerHTML = '';
        
        // Add recent comments in reverse chronological order
        if (recentComments.length > 0) {
            recentComments.slice(-3).forEach(comment => {
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message';
                messageDiv.textContent = comment.comment;
                commentsList.appendChild(messageDiv);
            });
        } else {
            const noCommentsDiv = document.createElement('div');
            noCommentsDiv.className = 'message';
            noCommentsDiv.textContent = 'No recent comments';
            commentsList.appendChild(noCommentsDiv);
        }
        
        reportPreview.style.display = 'block';
    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Error loading user data', 'error');
    }
}

function closeReportModal() {
    const reportPreview = document.querySelector('.report-preview');
    reportPreview.style.display = 'none';
}

async function reportUser(username) {
    const reportingUsername = localStorage.getItem('username');
    if (!reportingUsername) {
        showNotification('Error: You must be logged in to report users');
        return;
    }

    try {
        await postData('/api/report', {
            reportedUsername: username,
            reportingUsername,
            timestamp: new Date().toISOString()
        });
        
        // Add user to reported set and update their messages
        reportedUsers.add(username);
        updateReportedUserMessages(username);
        
        showNotification(`User ${username} has been reported`);
        closeReportModal();
    } catch (error) {
        console.error('Error reporting user:', error);
        showNotification('Failed to report user. Please try again.');
    }
}

function updateReportedUserMessages(username) {
    const messages = document.querySelectorAll('.message');
    messages.forEach(message => {
        const usernameSpan = message.querySelector('.username');
        if (usernameSpan && usernameSpan.textContent === username) {
            message.classList.add('reported-message');
        }
    });
}

// Funkcje komentarzy użytkownika
async function addComment(event) {
    event.preventDefault();
    
    const commentInput = document.getElementById('comment');
    const comment = commentInput.value.trim();
    const nickname = localStorage.getItem('username');
    
    if (!comment) return;
    
    try {
        const response = await postData('/api/comment', {
            username: nickname,
            comment: comment
        });

        // Add comment to cache
        addCommentToCache(nickname, comment);

        // Create and display the comment immediately
        const commentObj = {
            id: Date.now(),  // Temporary ID
            username: nickname,
            comment: comment,
            timestamp: new Date().toISOString()
        };
        
        // Clear input before adding comment to prevent double-posting
        commentInput.value = '';
        
        // Add the comment to the chat
        const chatMessages = document.querySelector('.chat-messages');
        const commentElement = createCommentElement(commentObj);
        chatMessages.appendChild(commentElement);
        
        // Scroll to the new comment smoothly
        commentElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } catch (error) {
        console.error('Błąd podczas dodawania komentarza:', error);
        showNotification('Error adding comment. Please try again.');
    }
}

// Funkcje UI
function updateStreamStats() {
    // Update viewers
    const viewersElement = document.querySelector('.viewers');
    if (viewersElement) {
        viewersElement.innerHTML = `<i class="fas fa-user"></i> ${formatNumber(streamStats.viewers)} viewers`;
    }

    // Update uptime
    const uptimeElement = document.querySelector('.uptime');
    if (uptimeElement) {
        const elapsed = new Date() - streamStartTime + (streamStats.timeOffset * 1000);
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        uptimeElement.innerHTML = `<i class="fas fa-clock"></i> ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Update control panel values
    document.getElementById('viewerCount').textContent = formatNumber(streamStats.viewers);
    document.getElementById('followerCount').textContent = formatNumber(streamStats.followers);
    document.getElementById('subCount').textContent = formatNumber(streamStats.subscribers);
}

function setupStreamButtons() {
    const followBtn = document.querySelector('.follow-btn');
    const subscribeBtn = document.querySelector('.subscribe-btn');

    if (followBtn) {
        followBtn.addEventListener('click', () => {
            streamStats.isFollowing = !streamStats.isFollowing;
            if (streamStats.isFollowing) {
                streamStats.followers += 1;
                showNotification('Thanks for following! You will now receive notifications when we go live.', 'success');
                followBtn.innerHTML = '<i class="fas fa-heart"></i> Following';
                followBtn.style.background = '#2d2d2d';
            } else {
                streamStats.followers -= 1;
                showNotification('You have unfollowed the channel', 'info');
                followBtn.innerHTML = '<i class="fas fa-heart"></i> Follow';
                followBtn.style.background = '#3a3a3d';
            }
            updateStreamStats();
        });
    }

    if (subscribeBtn) {
        subscribeBtn.addEventListener('click', () => {
            if (!streamStats.isSubscribed) {
                streamStats.subscribers += 1;
                streamStats.isSubscribed = true;
                showNotification('Thanks for subscribing! ', 'success');
                subscribeBtn.innerHTML = '<i class="fas fa-star"></i> Subscribed';
                updateStreamStats();
            } else {
                showNotification('You are already subscribed!', 'info');
            }
        });
    }
}

function setupControlPanel() {
    // Viewer control
    const viewerSlider = document.getElementById('viewerSlider');
    viewerSlider.addEventListener('input', (e) => {
        streamStats.viewers = parseInt(e.target.value);
        updateStreamStats();
    });

    // Follower control
    const followerSlider = document.getElementById('followerSlider');
    followerSlider.addEventListener('input', (e) => {
        streamStats.followers = parseInt(e.target.value);
        updateStreamStats();
    });

    // Subscriber control
    const subSlider = document.getElementById('subSlider');
    subSlider.addEventListener('input', (e) => {
        streamStats.subscribers = parseInt(e.target.value);
        updateStreamStats();
    });
}

// Time control functions
function adjustTime(seconds) {
    streamStats.timeOffset += seconds;
    updateStreamStats();
}

function resetTime() {
    streamStats.timeOffset = 0;
    streamStartTime = new Date();
    updateStreamStats();
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

// Funkcje kanałów
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
            streamStats.viewers = parseInt(viewerCount.replace(/[^0-9]/g, ''));
            updateStreamStats();

            // Show notification
            showNotification(`Switched to ${channelName}'s channel`);

            // Reset follow/sub buttons
            const followBtn = document.querySelector('.follow-btn');
            const subscribeBtn = document.querySelector('.subscribe-btn');
            followBtn.innerHTML = '<i class="fas fa-heart"></i> Follow';
            followBtn.style.background = '#3a3a3d';
            subscribeBtn.innerHTML = '<i class="fas fa-star"></i> Subscribe';
            streamStats.isFollowing = false;
            streamStats.isSubscribed = false;
        });
    });
}

// Timer functionality
let sessionTime = 15 * 60; // 15 minutes in seconds
const countdownElement = document.getElementById('countdown');

// Start countdown timer
function startCountdown() {
    const endTime = Date.now() + (sessionTime * 1000);
    
    const timer = setInterval(() => {
        const now = Date.now();
        const timeLeft = Math.max(0, Math.floor((endTime - now) / 1000));
        
        if (timeLeft === 0) {
            clearInterval(timer);
            window.location.href = '/thank-you.html';
        }
        
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        countdownElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
    startCountdown();

    // Initialize stream stats and buttons first
    setupStreamButtons();
    setupControlPanel();
    updateStreamStats();

    // Handle comment form
    document.getElementById('commentForm').addEventListener('submit', addComment);

    // Initialize the app
    initializeApp();
});

// Inicjalizacja
async function initializeApp() {
    // Check if user is logged in
    const username = localStorage.getItem('username');
    if (!username) {
        // Redirect to login page if not logged in
        window.location.href = '/index.html';
        return;
    }

    // Load main content
    await loadComments(true);  // Initial load with true flag
    
    // Initialize YouTube player
    if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
        onYouTubeIframeAPIReady();
    }
}

// Add event listener for the close button
document.querySelector('.close-preview').addEventListener('click', closeReportModal);

// Add event listener for report submit button
document.querySelector('.report-submit').addEventListener('click', function() {
    const username = document.getElementById('reportUsername').textContent;
    reportUser(username);
    closeReportModal();
});

document.addEventListener('DOMContentLoaded', function() {
    const closeBtn = document.querySelector('.close-preview');
    const reportBtn = document.querySelector('.report-submit');
    const reportOverlay = document.querySelector('.report-overlay');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeReportModal);
    }

    if (reportBtn) {
        reportBtn.addEventListener('click', function() {
            const username = document.querySelector('.preview-username').textContent;
            reportUser(username);
            closeReportModal();
        });
    }

    if (reportOverlay) {
        reportOverlay.addEventListener('click', closeReportModal);
    }
});