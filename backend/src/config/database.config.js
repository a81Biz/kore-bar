// src/config/database.config.js
import dotenv from 'dotenv';

// Load environment variables from .env if present
// In D1/Cloudflare Workers context, this might not do anything,
// which is fine since we rely on `c.env.DB` bindings there.
dotenv.config();

/**
 * Centralized Configuration Manager
 * Acts to normalize environment variables similar to appsettings.json
 */
export const dbConfig = {
    // Determine the environment
    environment: process.env.NODE_ENV || 'development',

    // Connection string for local PostgreSQL via Docker
    // This will be used as a fallback if Cloudflare D1 is not available in the context
    url: process.env.DATABASE_URL || 'postgres://admin:admin@localhost:5432/kore_local_db',

    // Helper to check if we are in local development
    isDevelopment: function () {
        return this.environment === 'development';
    }
};

export default dbConfig;
