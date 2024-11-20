// Required dependencies
const { Pool } = require('pg');

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

// Database query helper
const executeQuery = async (query, params = []) => {
    const client = await pool.connect();
    try {
        const result = await client.query(query, params);
        return result.rows;
    } finally {
        client.release();
    }
};

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

        // Create comments table
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                comment TEXT NOT NULL,
                timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create simulated comments table
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

        // Create reports table
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

// Run initialization
const init = async () => {
    try {
        await initializeDatabaseTables();
        console.log('Database setup completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Database setup failed:', error);
        process.exit(1);
    }
};

// Run if this file is executed directly
if (require.main === module) {
    init();
}
