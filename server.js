// Required dependencies
const { Pool } = require('pg');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

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

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './')));
app.use('/css', express.static(path.join(__dirname, 'css')));

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
        console.log('Connected to PostgreSQL database');
    } catch (err) {
        console.error('Database connection error:', err.stack);
        process.exit(1);
    }
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
        const query = `
            SELECT id, username, comment, timestamp
            FROM comments
            ORDER BY timestamp DESC
            LIMIT 50
        `;
        const comments = await executeQuery(query);
        res.json(comments);
    } catch (err) {
        next(err);
    }
};

const getNewComments = async (req, res, next) => {
    try {
        const { lastTimestamp } = req.query;
        const query = `
            SELECT id, username, comment, timestamp
            FROM comments
            WHERE timestamp > $1
            ORDER BY timestamp DESC
        `;
        const comments = await executeQuery(query, [lastTimestamp || new Date().toISOString()]);
        res.json(comments);
    } catch (err) {
        next(err);
    }
};

const getLastThreeComments = async (req, res, next) => {
    try {
        const { username } = req.params;
        const query = `
            (SELECT id, username, avatar_url, comment, timestamp, 'normal' as type
            FROM comments
            WHERE username = $1)
            UNION ALL
            (SELECT id, username, avatar_url, comment, timestamp, 'simulated' as type
            FROM simulated_comments
            WHERE username = $1)
            ORDER BY timestamp DESC
            LIMIT 3
        `;
        
        const comments = await executeQuery(query, [username]);
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

        const query = 'INSERT INTO comments (username, comment, timestamp) VALUES ($1, $2, CURRENT_TIMESTAMP)';
        await executeQuery(query, [username, comment]);
        res.status(201).json({ message: 'Comment added successfully' });
    } catch (err) {
        next(err);
    }
};

const getUserData = async (req, res, next) => {
    try {
        const { username } = req.params;
        const query = `
            SELECT DISTINCT username, avatar_url
            FROM (
                SELECT username, avatar_url FROM comments
                UNION
                SELECT username, avatar_url FROM simulated_comments
            ) combined
            WHERE username = $1
            LIMIT 1
        `;
        
        const userData = await executeQuery(query, [username]);
        res.json(userData[0] || { username });
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
        const query = `
            SELECT id, username, avatar_url, comment, timestamp, delay
            FROM simulated_comments
            ORDER BY timestamp DESC
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

        const query = 'INSERT INTO simulated_comments (username, comment, avatar_url, delay) VALUES ($1, $2, $3, $4)';
        await executeQuery(query, [username, comment, avatar_url, delay]);
        res.status(201).json({ message: 'Simulated comment added successfully' });
    } catch (err) {
        next(err);
    }
};

// Initialize database tables
async function initializeDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                first_name VARCHAR(255) NOT NULL,
                last_name VARCHAR(255) NOT NULL,
                age INTEGER NOT NULL CHECK (age >= 13),
                gender VARCHAR(50) NOT NULL,
                terms_accepted BOOLEAN NOT NULL DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Database tables initialized');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// Register new user
app.post('/api/register', async (req, res) => {
    try {
        const { firstName, lastName, age, gender, termsAccepted } = req.body;
        
        // Capitalize first letter of each name and make the rest lowercase
        const formattedFirstName = firstName.trim().charAt(0).toUpperCase() + firstName.trim().slice(1).toLowerCase();
        const formattedLastName = lastName.trim().charAt(0).toUpperCase() + lastName.trim().slice(1).toLowerCase();
        
        // Generate username (FirstName LastName)
        const username = `${formattedFirstName} ${formattedLastName}`;
            
        // Check if username exists
        const checkResult = await pool.query(
            'SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)',
            [username]
        );
        
        if (checkResult.rows[0].exists) {
            return res.status(400).json({ error: 'This name is already registered' });
        }

        // Insert new user
        await pool.query(
            `INSERT INTO users (username, first_name, last_name, age, gender, terms_accepted)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [username, formattedFirstName, formattedLastName, age, gender, termsAccepted]
        );

        res.json({ username });
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

// Database initialization
const initializeDatabaseTables = async () => {
    try {
        // Create users table
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                first_name VARCHAR(255) NOT NULL,
                last_name VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL UNIQUE,
                age INTEGER NOT NULL,
                gender VARCHAR(50) NOT NULL,
                terms_accepted BOOLEAN NOT NULL DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Existing tables
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                comment TEXT NOT NULL,
                timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS simulated_comments (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                avatar_url VARCHAR(255),
                comment TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                delay INTEGER
            )
        `);
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS reports (
                id SERIAL PRIMARY KEY,
                reported_username VARCHAR(255) NOT NULL,
                reporting_username VARCHAR(255) NOT NULL,
                timestamp TIMESTAMP NOT NULL
            )
        `);
        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Database initialization error:', err.stack);
        process.exit(1);
    }
};

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
migrateDatabase();
initializeDatabase();
initializeDatabaseTables();
startServer();
