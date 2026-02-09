import { API_CONFIG } from './api-config';
import {
  refreshAccessToken as centralRefresh,
  clearTokens,
  getAccessToken,
  redirectToLogin,
  setTokens,
} from './auth';

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

export const getToken = getAccessToken;
export const setToken = (token: string) => setTokens(token);
export const removeToken = clearTokens;
export const setRefreshToken = (token: string) => {
  if (typeof window !== 'undefined') localStorage.setItem('refreshToken', token);
};

const getNetworkErrorMessage = (error: unknown): string => {
  if (error instanceof TypeError) {
    if (error.message === 'Failed to fetch')
      return 'Unable to connect to server. The server may be down or there may be a connection issue.';
    if (error.message.includes('NetworkError'))
      return 'Network connection failed. Please check if you have internet access.';
    if (error.message.includes('CORS'))
      return 'Server configuration error (CORS). Please try again later.';
  }
  const code = (error as Record<string, string>)?.code;
  if (code === 'ECONNREFUSED') return 'Server is not responding. Please try again later.';
  if (code === 'ENOTFOUND') return 'Server not found. Please check your internet connection.';
  if (code === 'ETIMEDOUT') return 'Connection timed out. Please try again.';
  return 'Connection error. Please check your internet and try again.';
};

class ApiClient {
  private baseURL: string;
  private timeout: number;

  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.timeout = API_CONFIG.TIMEOUT;
  }

  private getHeaders(isMultipart = false): HeadersInit {
    const headers: HeadersInit = {};
    if (!isMultipart) headers['Content-Type'] = 'application/json';
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  private async handleResponse<T>(
    response: Response,
    retryFetch?: () => Promise<Response>
  ): Promise<ApiResponse<T>> {
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      if (response.status === 401 && data.message === 'jwt expired') {
        const newToken = await centralRefresh();
        if (newToken && retryFetch) {
          const retryResponse = await retryFetch();
          return this.handleResponse<T>(retryResponse);
        }
        redirectToLogin();
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

  private async request<T>(
    method: string,
    endpoint: string,
    options: {
      body?: unknown;
      isMultipart?: boolean;
      params?: Record<string, unknown>;
      timeoutMs?: number;
    } = {}
  ): Promise<ApiResponse<T>> {
    const { body, isMultipart = false, params, timeoutMs = this.timeout } = options;

    let url = `${this.baseURL}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) searchParams.append(k, String(v));
      });
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const buildInit = (): RequestInit => ({
      method,
      headers: this.getHeaders(isMultipart),
      credentials: 'include',
      body:
        body === undefined ? undefined : isMultipart ? (body as BodyInit) : JSON.stringify(body),
      signal: controller.signal,
    });

    try {
      const response = await fetch(url, buildInit());
      clearTimeout(timeoutId);
      return this.handleResponse<T>(response, () => {
        const retryInit = buildInit();
        delete (retryInit as Record<string, unknown>).signal;
        return fetch(url, retryInit);
      });
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        throw {
          success: false,
          statusCode: 408,
          message:
            timeoutMs > this.timeout
              ? 'Upload is taking too long. Please try with a smaller file or check your connection.'
              : 'Request timeout',
          error: 'Request timeout',
          errors: [],
        } as ApiError;
      }
      throw {
        success: false,
        statusCode: 0,
        message: getNetworkErrorMessage(error),
        error: 'Network error',
        errors: [],
      } as ApiError;
    }
  }

  async get<T = any>(endpoint: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint, { params });
  }

  async post<T = any>(
    endpoint: string,
    data?: unknown,
    isMultipart = false
  ): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, { body: data, isMultipart });
  }

  async put<T = any>(
    endpoint: string,
    data?: unknown,
    isMultipart = false
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', endpoint, { body: data, isMultipart });
  }

  async delete<T = any>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint, { body: data });
  }

  async upload<T = any>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, {
      body: formData,
      isMultipart: true,
      timeoutMs: 120000,
    });
  }
}

export const apiClient = new ApiClient();

export const api = {
  get: <T = any>(endpoint: string, params?: Record<string, unknown>) =>
    apiClient.get<T>(endpoint, params),
  post: <T = any>(endpoint: string, data?: unknown) => apiClient.post<T>(endpoint, data),
  put: <T = any>(endpoint: string, data?: unknown, isMultipart?: boolean) =>
    apiClient.put<T>(endpoint, data, isMultipart),
  delete: <T = any>(endpoint: string, data?: unknown) => apiClient.delete<T>(endpoint, data),
  upload: <T = any>(endpoint: string, formData: FormData) =>
    apiClient.upload<T>(endpoint, formData),
};
