// Konfiguracja
const API_URL = 'https://fliplab.onrender.com';
const DEFAULT_AVATAR = 'https://static-cdn.jtvnw.net/user-default-pictures-uv/13e5fa74-defa-11e9-809c-784f43822e80-profile_image-70x70.png';
const VIDEO_ID = 'jfKfPfyJRdk'; // lofi girl video ID

// Globalne zmienne do śledzenia stanu
let displayedCommentIds = new Set();
let simulatedCommentsScheduled = false;
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

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Funkcje zarządzania komentarzami
async function loadComments(isInitialLoad = false) {
    try {
        const [regularComments, simulatedComments] = await Promise.all([
            fetchData('/api/comments'),
            fetchData('/api/simulated_comments')
        ]);

        if (isInitialLoad) {
            const allComments = [...regularComments];
            allComments
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                .forEach(comment => {
                    if (!displayedCommentIds.has(comment.id)) {
                        displayedCommentIds.add(comment.id);
                        addSingleComment(comment, false);
                    }
                });
        } else {
            regularComments.forEach(comment => {
                if (!displayedCommentIds.has(comment.id)) {
                    displayedCommentIds.add(comment.id);
                    addSingleComment(comment, true);
                }
            });
        }

        // Zaplanuj symulowane komentarze tylko raz
        if (!simulatedCommentsScheduled) {
            simulatedCommentsScheduled = true;
            simulatedComments.forEach(comment => {
                if (!displayedCommentIds.has(comment.id)) {
                    displayedCommentIds.add(comment.id);
                    setTimeout(() => addSingleComment(comment, true), comment.delay * 1000);
                }
            });
        }
    } catch (error) {
        console.error('Błąd podczas pobierania komentarzy:', error);
    }
}

function addSingleComment(comment, scrollToBottom = true) {
    const commentsContainer = document.getElementById('comments');
    const commentElement = createCommentElement(comment);
    
    commentsContainer.appendChild(commentElement);

    if (scrollToBottom) {
        commentsContainer.scrollTop = commentsContainer.scrollHeight;
    }
}

function createCommentElement(comment) {
    const commentElement = document.createElement('div');
    commentElement.classList.add('comment', 'new-comment');
    commentElement.dataset.commentId = comment.id;

    const wrapper = document.createElement('div');
    wrapper.classList.add('comment-content-wrapper');

    // Avatar
    const avatarContainer = createAvatarElement(comment);
    
    // Tekst
    const textContainer = createTextContainer(comment);

    wrapper.appendChild(avatarContainer);
    wrapper.appendChild(textContainer);
    commentElement.appendChild(wrapper);

    // Usuń klasę animacji po zakończeniu
    setTimeout(() => commentElement.classList.remove('new-comment'), 500);

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
        const userData = await fetchData(`/api/user/${username}`);
        const userComments = await fetchData(`/api/user/${username}/last-comments`);
        
        const reportModal = document.getElementById('reportModal');
        const reportUsername = document.getElementById('reportUsername');
        const reportAvatar = document.getElementById('reportAvatar');
        const commentsList = document.getElementById('reportUserComments');
        
        reportUsername.innerText = `Zgłoś użytkownika: ${username}`;
        reportAvatar.src = userData.avatar_url || DEFAULT_AVATAR;
        reportAvatar.onerror = () => reportAvatar.src = DEFAULT_AVATAR;

        // Wyczyść poprzednie komentarze
        commentsList.innerHTML = '';
        
        // Wyświetl komentarze użytkownika
        userComments.forEach(comment => {
            const commentElement = document.createElement('div');
            commentElement.className = 'comment';
            commentElement.textContent = comment.comment;
            commentsList.appendChild(commentElement);
        });
        
        reportModal.style.display = 'block';
    } catch (error) {
        console.error('Błąd podczas pobierania danych użytkownika:', error);
        document.getElementById('reportModal').style.display = 'block';
    }
}

async function reportUser(username) {
    const reportingUsername = localStorage.getItem('nickname');
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

function closeReportModal() {
    document.getElementById('reportModal').style.display = 'none';
}

// Funkcje komentarzy użytkownika
async function addComment(event) {
    event.preventDefault();
    
    const commentInput = document.getElementById('comment');
    const comment = commentInput.value.trim();
    const nickname = localStorage.getItem('nickname');
    
    if (!comment) return;
    
    try {
        await postData('/api/comment', {
            username: nickname,
            comment: comment
        });

        // Dodaj komentarz do cache
        addCommentToCache(nickname, comment);

        commentInput.value = '';
        setTimeout(() => loadComments(false), 500);
    } catch (error) {
        console.error('Błąd podczas dodawania komentarza:', error);
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
                showNotification('Thanks for following!');
                followBtn.innerHTML = '<i class="fas fa-heart"></i> Following';
                followBtn.style.background = '#2d2d2d';
            } else {
                streamStats.followers -= 1;
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
                showNotification('Thanks for subscribing! ');
                subscribeBtn.innerHTML = '<i class="fas fa-star"></i> Subscribed';
                updateStreamStats();
            } else {
                showNotification('You are already subscribed!');
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

// Inicjalizacja
document.addEventListener('DOMContentLoaded', () => {
    // Initialize stream stats and buttons first
    setupStreamButtons();
    setupControlPanel();
    updateStreamStats();

    // Obsługa formularza nicku
    document.getElementById('nicknameForm').addEventListener('submit', function(event) {
        event.preventDefault();
        const nickname = document.getElementById('nickname').value;
        if (nickname.trim()) {
            localStorage.setItem('nickname', nickname);
            document.getElementById('nicknamePrompt').style.display = 'none';
            document.getElementById('mainContent').style.display = 'block';
            
            // Initialize YouTube player after showing main content
            if (!window.YT) {
                const tag = document.createElement('script');
                tag.src = 'https://www.youtube.com/iframe_api';
                const firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            } else {
                onYouTubeIframeAPIReady();
            }
        }
    });

    // Check if nickname exists
    const savedNickname = localStorage.getItem('nickname');
    if (savedNickname) {
        document.getElementById('nicknamePrompt').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        
        // Initialize YouTube player if nickname exists
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else {
            onYouTubeIframeAPIReady();
        }
    }

    // Obsługa formularza komentarzy
    document.getElementById('commentForm').addEventListener('submit', addComment);

    // Pierwsze ładowanie komentarzy
    loadComments(true);
    
    // Odświeżanie komentarzy
    setInterval(() => loadComments(false), 5000);

    // Aktualizacja statystyk streamu
    setInterval(updateStreamStats, 1000);

    // Initialize channel interactions
    setupChannelInteractions();
});