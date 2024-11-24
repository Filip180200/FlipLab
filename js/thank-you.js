const API_URL = 'https://fliplab.onrender.com';

async function checkFeedbackStatus() {
    const username = localStorage.getItem('username');
    const feedbackSection = document.getElementById('feedbackSection');
    
    if (!username) {
        feedbackSection.style.display = 'none';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/feedback-status/${username}`);
        const data = await response.json();
        
        if (data.hasFeedback) {
            feedbackSection.innerHTML = `
                <div class="feedback-submitted">
                    <p>Thank you for your feedback!</p>
                    <p class="submitted-feedback">"${data.feedback}"</p>
                </div>
            `;
        } else {
            feedbackSection.innerHTML = `
                <div class="feedback-form">
                    <h2>Share Your Feedback</h2>
                    <p>Please take a moment to share your thoughts about the experience:</p>
                    <textarea id="feedbackText" placeholder="Your feedback..."></textarea>
                    <button onclick="submitFeedback(event)" class="submit-btn">Submit Feedback</button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error checking feedback status:', error);
        showMessage('Error checking feedback status', 'error');
    }
}

async function submitFeedback(event) {
    event.preventDefault();
    
    const username = localStorage.getItem('username');
    if (!username) {
        showMessage('User not found', 'error');
        return;
    }

    const feedbackText = document.getElementById('feedbackText').value.trim();
    if (!feedbackText) {
        showMessage('Please enter your feedback', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                feedback: feedbackText
            })
        });

        if (response.ok) {
            showMessage('Thank you for your feedback!', 'success');
            // Refresh the feedback section
            checkFeedbackStatus();
        } else {
            const data = await response.json();
            showMessage(data.error || 'Failed to submit feedback', 'error');
        }
    } catch (error) {
        console.error('Error submitting feedback:', error);
        showMessage('Error submitting feedback', 'error');
    }
}

function showMessage(message, type = 'info') {
    const existingMsg = document.querySelector('.message');
    if (existingMsg) {
        existingMsg.remove();
    }

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;
    msgDiv.textContent = message;
    document.body.appendChild(msgDiv);

    setTimeout(() => {
        msgDiv.remove();
    }, 3000);
}

// Check feedback status when page loads
document.addEventListener('DOMContentLoaded', checkFeedbackStatus);

// Prevent going back
history.pushState(null, null, document.URL);
window.addEventListener('popstate', function () {
    history.pushState(null, null, document.URL);
});
