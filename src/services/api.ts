import { Thought, User } from '../types';

let accessToken: string | null = null;
let refreshPromise: Promise<void> | null = null;

const TOKEN_KEY = 'accessToken';

function parseJwt(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = parseJwt(token);
  if (!payload?.exp) return true;
  return (payload.exp as number) * 1000 < Date.now();
}

function userFromToken(token: string, usernameOverride?: string): User {
  const payload = parseJwt(token);
  const email = (payload?.sub as string) || '';
  return {
    id: email,
    username: usernameOverride ?? email.split('@')[0],
    email,
    role: (payload?.role as 'ADMIN' | 'USER') ?? 'USER',
  };
}

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

class ApiService {
  setToken(token: string | null) {
    accessToken = token;
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  private async fetchJson<T>(endpoint: string, options?: RequestInit, allowRetry = true): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    const response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers, credentials: 'include' });
    if (response.status === 401 && allowRetry) {
      try {
        await this.refresh();
        return this.fetchJson<T>(endpoint, options, false);
      } catch {
        this.setToken(null);
        throw new Error('Session expired. Please log in again.');
      }
    }
    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorMessage = response.statusText;
      if (contentType?.includes('application/json')) {
        const error = await response.json().catch(() => ({}));
        errorMessage = (error as { message?: string }).message ?? errorMessage;
      }
      throw new Error(errorMessage);
    }
    if (response.status === 204) return undefined as T;
    return response.json();
  }

  async getPosts(params?: { authorId?: string; status?: string; categoryName?: string; page?: number; size?: number }): Promise<Thought[]> {
    const query = new URLSearchParams();
    if (params?.authorId) query.set('authorId', params.authorId);
    if (params?.status) query.set('status', params.status);
    if (params?.categoryName) query.set('categoryName', params.categoryName);
    if (params?.page !== undefined) query.set('page', String(params.page));
    if (params?.size !== undefined) query.set('size', String(params.size));
    const qs = query.toString();
    return this.fetchJson<Thought[]>(`/api/posts${qs ? `?${qs}` : ''}`);
  }

  async getPost(id: string): Promise<Thought> {
    return this.fetchJson<Thought>(`/api/posts/${id}`);
  }

  async createPost(post: { title: string; content: string; status: 'PUBLISHED' | 'DRAFT'; category: { name: string }; tags: { name: string }[] }): Promise<Thought> {
    return this.fetchJson<Thought>('/api/posts', { method: 'POST', body: JSON.stringify(post) });
  }

  async updatePost(id: string, post: { title: string; content: string; status: 'PUBLISHED' | 'DRAFT'; category: { name: string }; tags: { name: string }[] }): Promise<Thought> {
    return this.fetchJson<Thought>(`/api/posts/${id}`, { method: 'PUT', body: JSON.stringify(post) });
  }

  async deletePost(id: string): Promise<void> {
    return this.fetchJson<void>(`/api/posts/${id}`, { method: 'DELETE' });
  }

  async getCategories(): Promise<{ name: string; postCount: number }[]> {
    return this.fetchJson('/api/categories');
  }

  async createCategory(name: string): Promise<{ name: string; postCount: number }> {
    return this.fetchJson('/api/categories', { method: 'POST', body: JSON.stringify({ name }) });
  }

  async getTags(): Promise<{ name: string; postCount: number }[]> {
    return this.fetchJson('/api/tags');
  }

  async createTag(name: string): Promise<{ name: string; postCount: number }> {
    return this.fetchJson('/api/tags', { method: 'POST', body: JSON.stringify({ name }) });
  }

  async login(credentials: { email: string; password: string }): Promise<{ user: User }> {
    const data = await this.fetchJson<{ token: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
    this.setToken(data.token);
    return { user: userFromToken(data.token) };
  }

  async register(data: { username: string; email: string; password: string }): Promise<{ user: User }> {
    await this.fetchJson('/api/registration', { method: 'POST', body: JSON.stringify(data) });
    const result = await this.login({ email: data.email, password: data.password });
    return { user: { ...result.user, username: data.username } };
  }

  async refresh(): Promise<void> {
    if (refreshPromise) return refreshPromise;
    refreshPromise = this.fetchJson<{ token: string }>('/api/auth/refresh', { method: 'POST' }, false)
        .then(data => { this.setToken(data.token); })
        .finally(() => { refreshPromise = null; });
    return refreshPromise;
  }

  async logout(): Promise<void> {
    try {
      await this.fetchJson('/api/auth/logout', { method: 'POST' }, false);
    } finally {
      this.setToken(null);
    }
  }

  async restoreSession(): Promise<User | null> {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return null;
    if (!isTokenExpired(stored)) {
      accessToken = stored;
      return userFromToken(stored);
    }
    try {
      await this.refresh();
      if (!accessToken) return null;
      return userFromToken(accessToken);
    } catch {
      return null;
    }
  }
}

export const api = new ApiService();
