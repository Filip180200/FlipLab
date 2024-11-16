// Required dependencies
const mysql = require('mysql');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Constants
const PORT = 3001;

// Database configuration
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'FilipNet',
    database: 'twitch_comments'
};

// Express app initialization
const app = express();

// Middleware setup
app.use(cors());
app.use(bodyParser.json());

// Database connection
const db = mysql.createConnection(dbConfig);

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
};

// Database connection handler
const connectToDatabase = () => {
    db.connect((err) => {
        if (err) {
            console.error('Database connection error:', err.stack);
            setTimeout(connectToDatabase, 5000); // Retry connection after 5 seconds
            return;
        }
        console.log('Connected to database as ID:', db.threadId);
    });

    db.on('error', (err) => {
        console.error('Database error:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            connectToDatabase();
        } else {
            throw err;
        }
    });
};

// Database query helper
const executeQuery = (query, params) => {
    return new Promise((resolve, reject) => {
        db.query(query, params, (err, results) => {
            if (err) reject(err);
            resolve(results);
        });
    });
};

// Route handlers
const getComments = async (req, res, next) => {
    try {
        const query = `
            SELECT id, username, avatar_url, comment, timestamp
            FROM comments
            ORDER BY timestamp DESC
        `;
        const results = await executeQuery(query);
        res.json(results);
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
            WHERE username = ?)
            UNION ALL
            (SELECT id, username, avatar_url, comment, timestamp, 'simulated' as type
            FROM simulated_comments
            WHERE username = ?)
            ORDER BY timestamp DESC
            LIMIT 3
        `;
        
        const results = await executeQuery(query, [username, username]);
        res.json(results);
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

        const query = 'INSERT INTO comments (username, avatar_url, comment) VALUES (?, ?, ?)';
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
            WHERE username = ?
            LIMIT 1
        `;
        
        const results = await executeQuery(query, [username]);
        res.json(results[0] || { username });
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
        const query = 'INSERT INTO reports (reported_username, reporting_username, timestamp) VALUES (?, ?, ?)';
        
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
        const results = await executeQuery(query);
        res.json(results);
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

        const query = 'INSERT INTO simulated_comments (username, comment, avatar_url, delay) VALUES (?, ?, ?, ?)';
        await executeQuery(query, [username, comment, avatar_url, delay]);
        res.status(201).json({ message: 'Simulated comment added successfully' });
    } catch (err) {
        next(err);
    }
};

// Database initialization
const initializeDatabase = async () => {
    const createReportsTable = `
        CREATE TABLE IF NOT EXISTS reports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            reported_username VARCHAR(255) NOT NULL,
            reporting_username VARCHAR(255) NOT NULL,
            timestamp DATETIME NOT NULL,
            INDEX (reported_username),
            INDEX (reporting_username)
        )
    `;
    
    try {
        await executeQuery(createReportsTable);
        console.log('Reports table initialized successfully');
    } catch (err) {
        console.error('Error initializing reports table:', err);
    }
};

// Routes
app.get('/api/comments', getComments);
app.post('/api/comment', addComment);
app.get('/api/user/:username', getUserData);
app.get('/api/user/:username/last-comments', getLastThreeComments);
app.post('/api/report', reportUser);
app.get('/api/reports', reportUser); // Added the missing report endpoint route
app.get('/api/simulated_comments', getSimulatedComments);
app.post('/api/simulated_comment', addSimulatedComment);

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
