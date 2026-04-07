/**
 * API Client for SlimPDV Backend
 * Replaces Supabase client with local API calls
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:5000/auth';

export interface ApiError {
  message: string;
  status?: number;
  error?: string;
}

class ApiClient {
  private apiUrl: string;
  private authUrl: string;
  private token: string | null = null;

  constructor() {
    this.apiUrl = API_URL;
    this.authUrl = AUTH_URL;
    this.loadToken();
  }

  private loadToken() {
    this.token = localStorage.getItem('auth_token');
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
  }

  private async handleResponse(response: Response) {
    const data = await response.json();

    if (!response.ok) {
      const error: ApiError = {
        message: data.error || 'Unknown error',
        status: response.status,
      };
      throw error;
    }

    return data;
  }

  async post<T = any>(endpoint: string, body?: any): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.apiUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    return this.handleResponse(response);
  }

  async get<T = any>(endpoint: string): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.apiUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  async put<T = any>(endpoint: string, body?: any): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.apiUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    return this.handleResponse(response);
  }

  async delete<T = any>(endpoint: string, body?: any): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.apiUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    return this.handleResponse(response);
  }

  async patch<T = any>(endpoint: string, body?: any): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.apiUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    return this.handleResponse(response);
  }
}

// Auth specific methods
export const authApi = {
  async login(email: string, password: string) {
    const response = await fetch(`${AUTH_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw { message: data.error || 'Login failed', status: response.status };
    }

    client.setToken(data.token);
    localStorage.setItem('refresh_token', data.refreshToken);

    return data;
  },

  async register(email: string, password: string, name?: string) {
    const response = await fetch(`${AUTH_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw { message: data.error || 'Registration failed', status: response.status };
    }

    client.setToken(data.token);

    return data;
  },

  async refreshToken() {
    const refreshToken = localStorage.getItem('refresh_token');

    if (!refreshToken) {
      throw { message: 'No refresh token available' };
    }

    const response = await fetch(`${AUTH_URL}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw { message: data.error || 'Token refresh failed', status: response.status };
    }

    client.setToken(data.token);

    return data;
  },

  async getCurrentUser() {
    try {
      return await client.get(`${AUTH_URL}/me`);
    } catch (error) {
      client.clearToken();
      throw error;
    }
  },

  logout() {
    client.clearToken();
  },
};

export const client = new ApiClient();

export default client;
