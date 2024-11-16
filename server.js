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
        // Only get simulated comments
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

const getNewComments = async (req, res, next) => {
    try {
        const { lastTimestamp } = req.query;
        const query = `
            SELECT id, username, avatar_url, comment, timestamp
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
        const { username, comment, avatar_url } = req.body;

        if (!username || !comment) {
            return res.status(400).json({ error: 'Username and comment are required' });
        }

        const query = 'INSERT INTO comments (username, avatar_url, comment) VALUES ($1, $2, $3)';
        await executeQuery(query, [username, avatar_url, comment]);
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

// Database initialization
const initializeDatabase = async () => {
    try {
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                avatar_url VARCHAR(255),
                comment TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
initializeDatabase();
startServer();
