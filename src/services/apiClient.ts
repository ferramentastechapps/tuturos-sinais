// API Client — Centralized Axios instance for Backend API communication

import axios from 'axios';

// Only connect to backend when VITE_API_URL is explicitly configured
const API_URL = import.meta.env.VITE_API_URL || '';

// Flag to check if backend is available
export const isBackendAvailable = !!API_URL;

export const apiClient = axios.create({
    baseURL: API_URL || 'http://localhost:3001/api',
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000,
});

// Request interceptor — block requests when no backend is configured
apiClient.interceptors.request.use(
    (config) => {
        if (!isBackendAvailable) {
            return Promise.reject(new axios.Cancel('No backend configured'));
        }
        return config;
    }
);

// Response interceptor for global error handling
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (!axios.isCancel(error)) {
            console.error('API Error:', error.response?.data || error.message);
        }
        return Promise.reject(error);
    }
);

// Type definitions for API responses
export interface ApiResponse<T> {
    data: T;
    error?: string;
    success?: boolean;
}
