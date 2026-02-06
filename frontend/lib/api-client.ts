import { API_CONFIG } from './api-config';

// Types
export interface ApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  error?: string;
  errors?: any[];
}

export interface ApiError {
  success: false;
  statusCode: number;
  message: string;
  error: string;
  errors: any[];
}

// Get token from localStorage
export const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('accessToken');
  }
  return null;
};

// Set token to localStorage
export const setToken = (token: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', token);
  }
};

// Remove token from localStorage
export const removeToken = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
};

// Get refresh token
const getRefreshToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('refreshToken');
  }
  return null;
};

// Set refresh token
export const setRefreshToken = (token: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('refreshToken', token);
  }
};

// Helper function to get specific error message based on error type
const getNetworkErrorMessage = (error: any): string => {
  // Check for specific error types
  if (error instanceof TypeError) {
    if (error.message === 'Failed to fetch') {
      // This could be CORS, server down, or network issue
      return 'Unable to connect to server. The server may be down or there may be a connection issue.';
    }
    if (error.message.includes('NetworkError')) {
      return 'Network connection failed. Please check if you have internet access.';
    }
    if (error.message.includes('CORS')) {
      return 'Server configuration error (CORS). Please try again later.';
    }
  }

  // Check for specific error properties
  if (error.code === 'ECONNREFUSED') {
    return 'Server is not responding. Please try again later.';
  }
  if (error.code === 'ENOTFOUND') {
    return 'Server not found. Please check your internet connection.';
  }
  if (error.code === 'ETIMEDOUT') {
    return 'Connection timed out. Please try again.';
  }

  // Default message with more context
  return 'Connection error. Please check your internet and try again.';
};

// API Client class
class ApiClient {
  private baseURL: string;
  private timeout: number;

  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.timeout = API_CONFIG.TIMEOUT;
  }

  // Build headers
  private getHeaders(isMultipart: boolean = false): HeadersInit {
    const headers: HeadersInit = {};

    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }

    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  // Handle API response
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    let data: any;
    if (isJson) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      // Handle 401 Unauthorized - try to refresh token
      if (response.status === 401 && data.message === 'jwt expired') {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry the original request
          return this.handleResponse(response);
        } else {
          // Redirect to login
          removeToken();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
      }

      throw {
        success: false,
        statusCode: response.status,
        message: data.message || 'An error occurred',
        error: data.error || 'Unknown error',
        errors: data.errors || [],
      } as ApiError;
    }

    return data as ApiResponse<T>;
  }

  // Refresh access token
  private async refreshAccessToken(): Promise<boolean> {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;

      const response = await fetch(`${this.baseURL}/users/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.data.accessToken);
        setRefreshToken(data.data.refreshToken);
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  // GET request
  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const url = new URL(`${this.baseURL}${endpoint}`);

    if (params) {
      Object.keys(params).forEach((key) => {
        if (params[key] !== undefined && params[key] !== null) {
          url.searchParams.append(key, params[key]);
        }
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return this.handleResponse<T>(response);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw {
          success: false,
          statusCode: 408,
          message: 'Request timeout',
          error: 'Request timeout',
          errors: [],
        } as ApiError;
      }
      // Handle network errors (Failed to fetch, connection refused, etc.)
      console.error('[API GET] Network error:', error);
      throw {
        success: false,
        statusCode: 0,
        message: getNetworkErrorMessage(error),
        error: 'Network error',
        errors: [],
      } as ApiError;
    }
  }

  // POST request
  async post<T = any>(
    endpoint: string,
    data?: any,
    isMultipart: boolean = false
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const body = isMultipart ? data : JSON.stringify(data);

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(isMultipart),
        credentials: 'include',
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return this.handleResponse<T>(response);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw {
          success: false,
          statusCode: 408,
          message: 'Request timeout',
          error: 'Request timeout',
          errors: [],
        } as ApiError;
      }
      // Handle network errors (Failed to fetch, connection refused, etc.)
      console.error('[API POST] Network error:', error);
      throw {
        success: false,
        statusCode: 0,
        message: getNetworkErrorMessage(error),
        error: 'Network error',
        errors: [],
      } as ApiError;
    }
  }

  // PUT request
  async put<T = any>(
    endpoint: string,
    data?: any,
    isMultipart: boolean = false
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const body = isMultipart ? data : JSON.stringify(data);

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'PUT',
        headers: this.getHeaders(isMultipart),
        credentials: 'include',
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return this.handleResponse<T>(response);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw {
          success: false,
          statusCode: 408,
          message: 'Request timeout',
          error: 'Request timeout',
          errors: [],
        } as ApiError;
      }
      // Handle network errors (Failed to fetch, connection refused, etc.)
      console.error('[API PUT] Network error:', error);
      throw {
        success: false,
        statusCode: 0,
        message: getNetworkErrorMessage(error),
        error: 'Network error',
        errors: [],
      } as ApiError;
    }
  }

  // DELETE request
  async delete<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
        credentials: 'include',
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return this.handleResponse<T>(response);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw {
          success: false,
          statusCode: 408,
          message: 'Request timeout',
          error: 'Request timeout',
          errors: [],
        } as ApiError;
      }
      // Handle network errors (Failed to fetch, connection refused, etc.)
      console.error('[API DELETE] Network error:', error);
      throw {
        success: false,
        statusCode: 0,
        message: getNetworkErrorMessage(error),
        error: 'Network error',
        errors: [],
      } as ApiError;
    }
  }

  // Upload file (multipart/form-data)
  async upload<T = any>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 seconds for file uploads (2 minutes for mobile networks)

    try {
      const token = getToken();

      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return this.handleResponse<T>(response);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw {
          success: false,
          statusCode: 408,
          message:
            'Upload is taking too long. Please try with a smaller file or check your connection.',
          error: 'Upload timeout',
          errors: [],
        } as ApiError;
      }
      // Handle network errors (Failed to fetch, connection refused, etc.)
      console.error('[API UPLOAD] Network error:', error);
      throw {
        success: false,
        statusCode: 0,
        message: getNetworkErrorMessage(error),
        error: 'Network error',
        errors: [],
      } as ApiError;
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export convenience methods
export const api = {
  get: <T = any>(endpoint: string, params?: Record<string, any>) =>
    apiClient.get<T>(endpoint, params),

  post: <T = any>(endpoint: string, data?: any) => apiClient.post<T>(endpoint, data),

  put: <T = any>(endpoint: string, data?: any, isMultipart?: boolean) =>
    apiClient.put<T>(endpoint, data, isMultipart),

  delete: <T = any>(endpoint: string, data?: any) => apiClient.delete<T>(endpoint, data),

  upload: <T = any>(endpoint: string, formData: FormData) =>
    apiClient.upload<T>(endpoint, formData),
};
