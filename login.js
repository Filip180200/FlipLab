// Function to toggle between login and registration forms
function toggleForm(formToShow) {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById(formToShow).style.display = 'block';

    if (formToShow === 'registerForm') {
        showNotification('You have 15 minutes to complete the registration', 900);
    }
}

// Function to create and show notification
function showNotification(message, duration = 15) {
    // Remove any existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create notification elements
    const notification = document.createElement('div');
    notification.className = 'notification warning';

    const content = document.createElement('div');
    content.className = 'notification-content';

    const messageEl = document.createElement('p');
    messageEl.className = 'notification-message';
    messageEl.textContent = message;

    const timer = document.createElement('div');
    timer.className = 'notification-timer';

    const button = document.createElement('button');
    button.className = 'notification-button';
    button.textContent = 'OK';

    // Assemble notification
    content.appendChild(messageEl);
    content.appendChild(timer);
    notification.appendChild(content);
    notification.appendChild(button);
    document.body.appendChild(notification);

    // Start countdown
    let timeLeft = duration;
    const interval = setInterval(() => {
        timeLeft--;
        timer.textContent = `Time remaining: ${timeLeft} seconds`;

        if (timeLeft <= 0) {
            clearInterval(interval);
            notification.remove();
            window.location.href = '/'; // Redirect to home page
        }
    }, 1000);

    // Handle OK button click
    button.addEventListener('click', () => {
        clearInterval(interval);
        notification.remove();
    });

    return notification;
}

// Handle registration form submission
document.getElementById('registerForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = {
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        age: parseInt(document.getElementById('age').value),
        gender: document.getElementById('gender').value,
        termsAccepted: document.getElementById('terms').checked
    };

    // Client-side validation
    if (formData.age < 18) {
        alert('You must be at least 18 years old to register');
        return;
    }

    if (!formData.firstName || !formData.lastName) {
        alert('First name and last name are required');
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Registration failed');
        }

        const data = await response.json();
        // Store the username in localStorage
        localStorage.setItem('username', data.username);
        // Redirect to main page
        window.location.href = '/web.html';
    } catch (error) {
        console.error('Error:', error);
        alert(error.message);
    }
});

// Handle login form submission
document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.getElementById('username').value.trim();
    // Format username to match registration format (capitalize first letter)
    const formattedUsername = username.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

    try {
        // Check if user exists
        const response = await fetch(`/api/check-username/${encodeURIComponent(formattedUsername)}`);
        const data = await response.json();

        if (data.exists) {
            // Store the username in localStorage
            localStorage.setItem('username', formattedUsername);
            // Redirect to main page
            window.location.href = '/web.html';
        } else {
            alert('Username not found. Please register first.');
            toggleForm('registerForm');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Login failed. Please try again.');
    }
});

// Check if user is already logged in
document.addEventListener('DOMContentLoaded', () => {
    const username = localStorage.getItem('username');
    if (username) {
        window.location.href = '/web.html';
    }
});
