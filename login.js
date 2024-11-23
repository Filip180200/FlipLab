// Function to toggle between login and registration forms
function toggleForm(formToShow) {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById(formToShow).style.display = 'block';

    if (formToShow === 'registerForm') {
        showNotification('You have 15 minutes to complete the registration', 900);
    }
}

// Function to show notification
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
            window.location.href = '/';
        }
    }, 1000);

    // Handle OK button click
    button.addEventListener('click', () => {
        clearInterval(interval);
        notification.remove();
    });

    return notification;
}

let cropper = null;
let croppedImageData = null;

// Image Editor Modal Elements
const modal = document.getElementById('imageEditorModal');
const imageToCrop = document.getElementById('image-to-crop');
const closeModal = document.querySelector('.close-modal');
const cropButton = document.getElementById('cropImage');
const cancelButton = document.getElementById('cancelCrop');
const rotateLeftBtn = document.getElementById('rotateLeft');
const rotateRightBtn = document.getElementById('rotateRight');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');

// Avatar input and preview elements
const avatarInput = document.getElementById('avatar');
const avatarPreview = document.getElementById('avatar-preview');
const avatarImage = document.getElementById('avatar-image');

// Handle file selection
avatarInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        // Show the modal
        modal.style.display = 'block';
        
        // Create a URL for the selected image
        const imageUrl = URL.createObjectURL(file);
        imageToCrop.src = imageUrl;
        
        // Initialize Cropper
        if (cropper) {
            cropper.destroy();
        }
        
        cropper = new Cropper(imageToCrop, {
            aspectRatio: 1,
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 1,
            cropBoxMovable: false,
            cropBoxResizable: false,
            guides: false,
            center: false,
            highlight: false,
            background: false
        });
    }
});

// Editor Controls
rotateLeftBtn.addEventListener('click', () => cropper.rotate(-90));
rotateRightBtn.addEventListener('click', () => cropper.rotate(90));
zoomInBtn.addEventListener('click', () => cropper.zoom(0.1));
zoomOutBtn.addEventListener('click', () => cropper.zoom(-0.1));

// Handle modal close
closeModal.addEventListener('click', closeImageEditor);
cancelButton.addEventListener('click', closeImageEditor);

function closeImageEditor() {
    modal.style.display = 'none';
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    if (!croppedImageData) {
        avatarInput.value = ''; // Clear the file input if no crop was saved
    }
}

// Handle crop save
cropButton.addEventListener('click', () => {
    if (!cropper) return;
    
    const canvas = cropper.getCroppedCanvas({
        width: 300,
        height: 300
    });
    
    croppedImageData = canvas.toDataURL('image/jpeg', 0.8);
    avatarImage.src = croppedImageData;
    avatarImage.style.display = 'block';
    
    closeImageEditor();
});

// Close modal if clicking outside
window.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeImageEditor();
    }
});

// Update form submission to handle the cropped image
const form = document.getElementById('registerForm');
form.addEventListener('submit', async function(e) {
    e.preventDefault();

    // Create FormData object
    const formData = new FormData();
    
    // Get form values
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const age = document.getElementById('age').value;
    const gender = document.getElementById('gender').value;
    const username = document.getElementById('username').value.trim();
    const termsAccepted = document.getElementById('terms').checked;

    // Client-side validation
    if (!firstName || !lastName) {
        alert('First name and last name are required');
        return;
    }

    if (!username) {
        alert('Username is required');
        return;
    }

    if (parseInt(age) < 18) {
        alert('You must be at least 18 years old to register');
        return;
    }

    if (!termsAccepted) {
        alert('You must accept the terms and conditions');
        return;
    }

    // Add form fields to FormData
    formData.append('firstName', firstName);
    formData.append('lastName', lastName);
    formData.append('age', age);
    formData.append('gender', gender);
    formData.append('username', username);
    formData.append('termsAccepted', termsAccepted);
    
    // Add the cropped image if available
    if (croppedImageData) {
        // Convert base64 to blob
        const response = await fetch(croppedImageData);
        const blob = await response.blob();
        formData.append('avatar', blob, 'avatar.jpg');
    }
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store username in localStorage
            localStorage.setItem('username', data.username);
            // Show success message
            showNotification('Registration successful! Redirecting...', 3);
            // Redirect to main page after a short delay
            setTimeout(() => {
                window.location.href = 'web.html';
            }, 2000);
        } else {
            showNotification(data.error || 'Registration failed. Please try again.', 5);
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Registration failed. Please try again.', 5);
    }
});

// Check if user is already logged in
document.addEventListener('DOMContentLoaded', () => {
    const username = localStorage.getItem('username');
    if (username) {
        window.location.href = '/web.html';
    }
});
