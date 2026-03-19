// src/utils/response.util.js

/**
 * Generates a standardized JSON success response.
 * @param {any} data - The payload to return
 * @param {string} message - Optional success message
 * @returns {Object} Standardized success format
 */
export const successResponse = (data, message = '') => {
    return {
        status: 'success',
        message,
        data
    };
};

/**
 * Generates a standardized JSON error response.
 * @param {string} message - The error message to return
 * @param {number} statusCode - HTTP Status code (default 500)
 * @param {any} errors - Additional error details (default null)
 * @returns {Object} Standardized error format
 */
export const errorResponse = (message, statusCode = 500, errors = null) => {
    return {
        status: `${statusCode}`.startsWith('4') ? 'fail' : 'error',
        message,
        statusCode,
        errors
    };
};
