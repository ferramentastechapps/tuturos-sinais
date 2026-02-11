// API Client — Centralized Axios instance for Backend API communication

import axios from 'axios';

// Default to localhost:3001 if env var is not set (legacy mode or local dev)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000,
});

// Response interceptor for global error handling
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
    }
);

// Type definitions for API responses
export interface ApiResponse<T> {
    data: T;
    error?: string;
    success?: boolean;
}
