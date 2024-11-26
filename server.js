// Required dependencies
const { Pool } = require('pg');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const PORT = process.env.PORT || 3001;

// Database configuration
let pool;
if (process.env.DATABASE_URL) {
    // Use connection string if available
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });
} else {
    // Fallback to individual credentials
    pool = new Pool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 5432,
        ssl: {
            rejectUnauthorized: false
        }
    });
}

// Express app initialization
const app = express();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image! Please upload an image.'), false);
        }
    }
});

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
};

// Database connection handler
const connectToDatabase = async () => {
    try {
        await pool.connect();
        console.log('Connected to database successfully');
    } catch (err) {
        console.error('Error connecting to database:', err.stack);
        process.exit(1);
    }
};

// Database initialization
const initializeDatabase = async () => {
    try {
        // Create tables if they don't exist
        await pool.query(`
            -- Alter users table to add new columns
            DO $$ 
            BEGIN
                -- Add test_group column if it doesn't exist
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name='users' AND column_name='test_group') THEN
                    ALTER TABLE users ADD COLUMN test_group VARCHAR(1) DEFAULT 'a';
                END IF;

                -- Add viewer_number column if it doesn't exist
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name='users' AND column_name='viewer_number') THEN
                    ALTER TABLE users ADD COLUMN viewer_number INTEGER;
                END IF;

                -- Add device_type column if it doesn't exist
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name='users' AND column_name='device_type') THEN
                    ALTER TABLE users ADD COLUMN device_type VARCHAR(50);
                END IF;
            END $$;

            -- Update viewer numbers based on test group
            UPDATE users 
            SET viewer_number = 
                CASE 
                    WHEN test_group IN ('a', 'b') THEN 124
                    WHEN test_group IN ('c', 'd') THEN 11
                    ELSE 124
                END
            WHERE viewer_number IS NULL OR viewer_number != 
                CASE 
                    WHEN test_group IN ('a', 'b') THEN 124
                    WHEN test_group IN ('c', 'd') THEN 11
                    ELSE 124
                END;

            -- Update existing users to have viewer_number if not set
            UPDATE users SET viewer_number = 124 WHERE viewer_number IS NULL;

            -- Create comments table if it doesn't exist
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                comment TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Create simulated_comments_1 table
            CREATE TABLE IF NOT EXISTS simulated_comments_1 (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                avatar_url TEXT,
                comment TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                delay INTEGER DEFAULT 0
            );

            -- Create simulated_comments_2 table
            CREATE TABLE IF NOT EXISTS simulated_comments_2 (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                avatar_url TEXT,
                comment TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                delay INTEGER DEFAULT 0
            );

            -- Create users table if it doesn't exist
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                first_name VARCHAR(255),
                last_name VARCHAR(255),
                age INTEGER,
                gender VARCHAR(50),
                time_left INTEGER DEFAULT 3600,
                terms_accepted BOOLEAN DEFAULT false,
                avatar_url TEXT,
                feedback TEXT,
                session_ended BOOLEAN DEFAULT false
            );

            -- Create reports table if it doesn't exist
            CREATE TABLE IF NOT EXISTS reports (
                id SERIAL PRIMARY KEY,
                reported_username VARCHAR(255) NOT NULL,
                reporting_username VARCHAR(255) NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Drop the old simulated_comments table if it exists
            DROP TABLE IF EXISTS simulated_comments;
        `);
        console.log('Database tables initialized successfully');
    } catch (err) {
        console.error('Error initializing database tables:', err);
        process.exit(1);
    }
};

// Add test group assignment to registration
const assignTestGroup = async (username) => {
    const groups = ['a', 'b', 'c', 'd'];
    const randomGroup = groups[Math.floor(Math.random() * groups.length)];
    const viewerNumber = (randomGroup === 'a' || randomGroup === 'b') ? 124 : 11;
    
    await pool.query(
        'UPDATE users SET test_group = $1, viewer_number = $2 WHERE username = $3',
        [randomGroup, viewerNumber, username]
    );
    return { group: randomGroup, viewerNumber };
};

// Database query helper
const executeQuery = async (query, params = []) => {
    try {
        const result = await pool.query(query, params);
        return result.rows;
    } catch (err) {
        console.error('Query execution error:', err.stack);
        throw err;
    }
};

// Route handlers
const getComments = async (req, res, next) => {
    try {
        // Get both simulated and real comments
        const query = `
            WITH ranked_comments AS (
                SELECT 
                    id,
                    username,
                    comment,
                    timestamp,
                    'simulated' as type,
                    delay,
                    avatar_url
                FROM simulated_comments_1
                UNION ALL
                SELECT 
                    id,
                    username,
                    comment,
                    timestamp,
                    'simulated' as type,
                    delay,
                    avatar_url
                FROM simulated_comments_2
                UNION ALL
                SELECT 
                    c.id,
                    c.username,
                    c.comment,
                    c.timestamp,
                    'normal' as type,
                    0 as delay,
                    u.avatar_url
                FROM comments c
                LEFT JOIN users u ON u.username = c.username
            )
            SELECT * FROM ranked_comments 
            ORDER BY timestamp DESC
        `;
        const comments = await executeQuery(query);
        res.json(comments);
    } catch (err) {
        next(err);
    }
};

const getNewComments = async (req, res, next) => {
    try {
        const { lastTimestamp, username } = req.query;
        const query = `
            WITH ranked_comments AS (
                SELECT 
                    id,
                    username,
                    comment,
                    timestamp,
                    'simulated' as type,
                    delay,
                    avatar_url
                FROM simulated_comments_1
                WHERE timestamp > $1 AND username = $2
                UNION ALL
                SELECT 
                    id,
                    username,
                    comment,
                    timestamp,
                    'simulated' as type,
                    delay,
                    avatar_url
                FROM simulated_comments_2
                WHERE timestamp > $1 AND username = $2
                UNION ALL
                SELECT 
                    c.id,
                    c.username,
                    c.comment,
                    c.timestamp,
                    'normal' as type,
                    0 as delay,
                    u.avatar_url
                FROM comments c
                LEFT JOIN users u ON u.username = c.username
                WHERE c.timestamp > $1 AND c.username = $2
            )
            SELECT * FROM ranked_comments 
            ORDER BY timestamp DESC
        `;
        const comments = await executeQuery(query, [lastTimestamp || new Date().toISOString(), username]);
        res.json(comments);
    } catch (err) {
        next(err);
    }
};

const addComment = async (req, res, next) => {
    try {
        const { username, comment } = req.body;

        if (!username || !comment) {
            return res.status(400).json({ error: 'Username and comment are required' });
        }

        // Check for duplicate comment in the last 5 seconds
        const recentComments = await executeQuery(
            'SELECT id FROM comments WHERE username = $1 AND comment = $2 AND timestamp > NOW() - INTERVAL \'5 seconds\'',
            [username, comment]
        );

        if (recentComments.length > 0) {
            return res.status(400).json({ error: 'Please wait before posting the same comment again' });
        }

        // Insert comment with current timestamp
        const query = 'INSERT INTO comments (username, comment, timestamp) VALUES ($1, $2, NOW())';
        await executeQuery(query, [username, comment]);
        res.status(201).json({ message: 'Comment added successfully' });
    } catch (err) {
        next(err);
    }
};

const getLastThreeComments = async (req, res, next) => {
    try {
        const { username } = req.params;
        const query = `
            WITH ranked_comments AS (
                SELECT 
                    id,
                    username,
                    comment,
                    timestamp,
                    'normal' as type,
                    u.avatar_url
                FROM comments c
                LEFT JOIN users u ON u.username = c.username
                WHERE c.username = $1
                UNION ALL
                SELECT 
                    id,
                    username,
                    comment,
                    timestamp,
                    'simulated' as type,
                    avatar_url
                FROM simulated_comments_1
                WHERE username = $1
                UNION ALL
                SELECT 
                    id,
                    username,
                    comment,
                    timestamp,
                    'simulated' as type,
                    avatar_url
                FROM simulated_comments_2
                WHERE username = $1
            )
            SELECT * FROM ranked_comments 
            ORDER BY timestamp DESC
            LIMIT 3
        `;
        
        const comments = await executeQuery(query, [username]);
        res.json(comments);
    } catch (err) {
        next(err);
    }
};

const getUserData = async (req, res, next) => {
    try {
        const { username } = req.params;
        const result = await executeQuery(
            'SELECT username, test_group, viewer_number, time_left FROM users WHERE username = $1',
            [username]
        );
        
        if (result.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(result[0]);
    } catch (err) {
        next(err);
    }
};

const reportUser = async (req, res, next) => {
    try {
        const { reportedUsername, reportingUsername } = req.body;
        
        if (!reportedUsername || !reportingUsername) {
            return res.status(400).json({ error: 'Both reportedUsername and reportingUsername are required' });
        }

        const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const query = 'INSERT INTO reports (reported_username, reporting_username, timestamp) VALUES ($1, $2, $3)';
        
        await executeQuery(query, [reportedUsername, reportingUsername, timestamp]);
        res.status(201).json({ message: 'User reported successfully' });
    } catch (err) {
        next(err);
    }
};

const getSimulatedComments = async (req, res, next) => {
    try {
        const { username } = req.query;
        const userResult = await pool.query('SELECT test_group FROM users WHERE username = $1', [username]);
        const testGroup = userResult.rows[0]?.test_group || 'a';
        const tableNumber = (testGroup === 'a' || testGroup === 'c') ? 1 : 2;

        const query = `
            SELECT id, username, avatar_url, comment, timestamp, delay
            FROM simulated_comments_${tableNumber}
            ORDER BY timestamp ASC
        `;
        const comments = await executeQuery(query);
        res.json(comments);
    } catch (err) {
        next(err);
    }
};

const addSimulatedComment = async (req, res, next) => {
    try {
        const { username, comment, delay, avatar_url } = req.body;
        
        if (!username || !comment) {
            return res.status(400).json({ error: 'Username and comment are required' });
        }

        const userResult = await pool.query('SELECT test_group FROM users WHERE username = $1', [username]);
        const testGroup = userResult.rows[0]?.test_group || 'a';
        const tableNumber = (testGroup === 'a' || testGroup === 'c') ? 1 : 2;

        const query = `INSERT INTO simulated_comments_${tableNumber} (username, comment, avatar_url, delay) VALUES ($1, $2, $3, $4)`;
        await executeQuery(query, [username, comment, avatar_url, delay]);
        res.status(201).json({ message: 'Simulated comment added successfully' });
    } catch (err) {
        next(err);
    }
};

// Get user's time left
app.get('/api/time-left/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const result = await executeQuery(
            'SELECT time_left, session_ended FROM users WHERE username = $1',
            [username]
        );

        if (result.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { time_left, session_ended } = result[0];

        // If session is ended, return 0 time left
        if (session_ended) {
            return res.json({ timeLeft: 0 });
        }

        return res.json({ timeLeft: time_left });
    } catch (error) {
        console.error('Error getting time:', error);
        res.status(500).json({ error: 'Failed to get time' });
    }
});

// Update user's time left
app.post('/api/update-time', async (req, res) => {
    try {
        const { username, timeLeft } = req.body;

        if (timeLeft < 0) {
            return res.status(400).json({ error: 'Time left cannot be negative' });
        }

        const result = await executeQuery(
            'UPDATE users SET time_left = $1 WHERE username = $2 RETURNING time_left',
            [Math.max(0, timeLeft), username]
        );

        if (result.length > 0) {
            // If the update was successful, return the updated time
            res.json({ timeLeft: result[0].time_left });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error updating time:', error);
        res.status(500).json({ error: 'Failed to update time' });
    }
});

// Update user's time left (beacon endpoint)
app.post('/api/update-time/beacon', async (req, res) => {
    try {
        let data;
        // Handle different types of request bodies
        if (typeof req.body === 'string') {
            try {
                data = JSON.parse(req.body);
            } catch (e) {
                console.error('Error parsing beacon data:', e);
                return res.status(400).end();
            }
        } else {
            data = req.body;
        }

        // Validate the data
        if (!data || typeof data !== 'object') {
            console.error('Invalid beacon data format:', data);
            return res.status(400).end();
        }

        const { username, timeLeft } = data;

        if (!username || timeLeft === undefined) {
            console.error('Missing required beacon data fields:', data);
            return res.status(400).end();
        }

        // Ensure timeLeft is a number and not negative
        const validTimeLeft = Math.max(0, parseInt(timeLeft, 10) || 0);

        await executeQuery(
            'UPDATE users SET time_left = $1 WHERE username = $2',
            [validTimeLeft, username]
        );

        res.status(200).end();
    } catch (error) {
        console.error('Error handling beacon time update:', error);
        res.status(500).end();
    }
});

// Register new user
app.post('/api/register', upload.single('avatar'), async (req, res) => {
    try {
        // Check if avatar was uploaded
        if (!req.file) {
            return res.status(400).json({ error: 'Profile picture is required' });
        }

        const { firstName, lastName, age, gender, termsAccepted } = req.body;
        const userAgent = req.headers['user-agent'];
        
        // Determine device type
        let deviceType = 'unknown';
        if (userAgent) {
            if (/mobile|android|iphone|ipad|ipod/i.test(userAgent)) {
                deviceType = 'mobile';
            } else if (/tablet|ipad/i.test(userAgent)) {
                deviceType = 'tablet';
            } else {
                deviceType = 'desktop';
            }
        }

        // Basic validation
        if (!firstName || !lastName || !age || !gender || !termsAccepted) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Age validation
        if (parseInt(age) < 18) {
            return res.status(400).json({ error: 'You must be at least 18 years old' });
        }

        // Capitalize first letter of each name
        const formattedFirstName = firstName.trim().charAt(0).toUpperCase() + firstName.trim().slice(1).toLowerCase();
        const formattedLastName = lastName.trim().charAt(0).toUpperCase() + lastName.trim().slice(1).toLowerCase();
        const username = `${formattedFirstName} ${formattedLastName}`;

        // Check if user exists
        const existingUser = await executeQuery(
            'SELECT EXISTS(SELECT 1 FROM users WHERE username = $1) as exists',
            [username]
        );

        if (existingUser[0].exists) {
            return res.status(400).json({ error: 'A user with this name already exists' });
        }

        // Get avatar URL
        const avatarUrl = `/uploads/${req.file.filename}`;

        // Insert new user with device type
        const testGroup = await assignTestGroup(username);
        await executeQuery(
            'INSERT INTO users (username, first_name, last_name, age, gender, terms_accepted, avatar_url, time_left, device_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [username, formattedFirstName, formattedLastName, age, gender, termsAccepted === 'true', avatarUrl, 900, deviceType]
        );

        res.json({ 
            username: username,
            timeLeft: 900,
            testGroup: testGroup.group,
            viewerNumber: testGroup.viewerNumber
        });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Check if username exists
app.get('/api/check-username/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const result = await pool.query(
            'SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)',
            [username]
        );
        res.json({ exists: result.rows[0].exists });
    } catch (error) {
        console.error('Error checking username:', error);
        res.status(500).json({ error: 'Failed to check username' });
    }
});

// Get all users with their remaining time
app.get('/api/users-time', async (req, res) => {
    try {
        const result = await executeQuery(
            'SELECT username, time_left FROM users ORDER BY time_left DESC',
            []
        );
        res.json(result);
    } catch (error) {
        console.error('Error getting users time:', error);
        res.status(500).json({ error: 'Failed to get users time' });
    }
});

// Add session status endpoint
app.get('/api/session-status/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const result = await executeQuery(
            'SELECT session_ended FROM users WHERE username = $1',
            [username]
        );

        if (result.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ session_ended: result[0].session_ended });
    } catch (error) {
        console.error('Error checking session status:', error);
        res.status(500).json({ error: 'Failed to check session status' });
    }
});

// Add session termination endpoint
app.post('/api/terminate-session', async (req, res) => {
    try {
        const { username, timeLeft } = req.body;

        // Update the user's time_left and set session_ended to true
        await executeQuery(
            'UPDATE users SET time_left = $1, session_ended = true WHERE username = $2',
            [timeLeft, username]
        );

        res.json({ message: 'Session terminated successfully' });
    } catch (error) {
        console.error('Error terminating session:', error);
        res.status(500).json({ error: 'Failed to terminate session' });
    }
});

// Add feedback endpoint
app.post('/api/feedback', async (req, res) => {
    try {
        const { username, feedback } = req.body;

        // First check if user exists
        const userResult = await executeQuery(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );

        if (userResult.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Add feedback to existing user
        await executeQuery(
            'UPDATE users SET feedback = $1 WHERE username = $2',
            [feedback, username]
        );

        res.json({ message: 'Feedback saved successfully' });
    } catch (error) {
        console.error('Error saving feedback:', error);
        res.status(500).json({ error: 'Failed to save feedback' });
    }
});

// Update session status endpoint
app.post('/api/end-session', async (req, res) => {
    try {
        const { username } = req.body;
        
        await executeQuery(
            'UPDATE users SET session_ended = true WHERE username = $1',
            [username]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error ending session:', error);
        res.status(500).json({ error: 'Failed to end session' });
    }
});

// Get session status endpoint
app.get('/api/session-status/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const result = await executeQuery(
            'SELECT session_ended FROM users WHERE username = $1',
            [username]
        );

        if (result.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ session_ended: result[0].session_ended });
    } catch (error) {
        console.error('Error checking session status:', error);
        res.status(500).json({ error: 'Failed to check session status' });
    }
});

// Get user feedback status
app.get('/api/feedback-status/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const result = await executeQuery(
            'SELECT feedback FROM users WHERE username = $1',
            [username]
        );

        if (result.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ 
            hasFeedback: result[0].feedback !== null,
            feedback: result[0].feedback 
        });
    } catch (error) {
        console.error('Error checking feedback status:', error);
        res.status(500).json({ error: 'Failed to check feedback status' });
    }
});

// Routes
app.get('/api/comments', getComments);
app.get('/api/new-comments', getNewComments);
app.post('/api/comment', addComment);
app.get('/api/user/:username', getUserData);
app.get('/api/user/:username/last-comments', getLastThreeComments);
app.post('/api/report', reportUser);
app.get('/api/simulated_comments', getSimulatedComments);
app.post('/api/simulated_comment', addSimulatedComment);
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware (should be last)
app.use(errorHandler);

// Start server
const startServer = () => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

// Initialize application
connectToDatabase();
initializeDatabase();
startServer();
