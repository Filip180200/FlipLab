// Function to toggle between login and registration forms
function toggleForm(formToShow) {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById(formToShow).style.display = 'block';
}

// Handle registration form submission
document.getElementById('registerForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        age: parseInt(document.getElementById('age').value),
        gender: document.getElementById('gender').value,
        termsAccepted: document.getElementById('terms').checked
    };

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            throw new Error('Registration failed');
        }

        const data = await response.json();
        // Store the username in localStorage
        localStorage.setItem('username', data.username);
        // Redirect to main page
        window.location.href = '/web.html';
    } catch (error) {
        console.error('Error:', error);
        alert('Registration failed. Please try again.');
    }
});

// Handle login form submission
document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.getElementById('username').value;

    try {
        // Check if user exists
        const response = await fetch(`/api/check-username/${username}`);
        const data = await response.json();

        if (data.exists) {
            // Store the username in localStorage
            localStorage.setItem('username', username);
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
