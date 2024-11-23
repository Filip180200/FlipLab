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

// Handle avatar file selection and preview
document.getElementById('avatar').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('avatar-preview');
            preview.style.backgroundImage = `url(${e.target.result})`;
        };
        reader.readAsDataURL(file);
    }
});

// Handle registration form submission
document.getElementById('registerForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData();
    formData.append('firstName', document.getElementById('firstName').value.trim());
    formData.append('lastName', document.getElementById('lastName').value.trim());
    formData.append('age', document.getElementById('age').value);
    formData.append('gender', document.getElementById('gender').value);
    formData.append('termsAccepted', document.getElementById('terms').checked);

    const avatarFile = document.getElementById('avatar').files[0];
    if (avatarFile) {
        formData.append('avatar', avatarFile);
    }

    // Client-side validation
    if (parseInt(formData.get('age')) < 18) {
        alert('You must be at least 18 years old to register');
        return;
    }

    if (!formData.get('firstName') || !formData.get('lastName')) {
        alert('First name and last name are required');
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            body: formData // Using FormData instead of JSON
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Registration failed');
        }

        const data = await response.json();
        localStorage.setItem('username', data.username);
        window.location.href = '/web.html';
    } catch (error) {
        console.error('Registration error:', error);
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
