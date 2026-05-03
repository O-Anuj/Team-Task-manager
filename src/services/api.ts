import { User, Project, Task, Member, DashboardStats } from '../types';

const API_BASE = '/api';

async function fetcher(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
  if (!res.ok) {
    if (res.status === 401 && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/signup')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    const error = await res.json().catch(() => ({ error: 'An error occurred' }));
    throw new Error(error.error || 'Server error');
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  auth: {
    signup: (data: any) => fetcher('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: any) => fetcher('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    me: () => fetcher('/auth/me'),
  },
  projects: {
    list: (): Promise<Project[]> => fetcher('/projects'),
    create: (data: Partial<Project>): Promise<Project> => fetcher('/projects', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string): Promise<Project> => fetcher(`/projects/${id}`),
    members: (id: string): Promise<Member[]> => fetcher(`/projects/${id}/members`),
    update: (id: string, data: Partial<Project>) => fetcher(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    addMember: (id: string, data: { email: string; role: string }) => fetcher(`/projects/${id}/members`, { method: 'POST', body: JSON.stringify(data) }),
    removeMember: (id: string, userId: number) => fetcher(`/projects/${id}/members/${userId}`, { method: 'DELETE' }),
    delete: (id: string) => fetcher(`/projects/${id}`, { method: 'DELETE' }),
  },
  tasks: {
    list: (projectId: string): Promise<Task[]> => fetcher(`/projects/${projectId}/tasks`),
    create: (projectId: string, data: Partial<Task>): Promise<Task> => fetcher(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Task>) => fetcher(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) => fetcher(`/tasks/${id}`, { method: 'DELETE' }),
  },
  stats: {
    get: (): Promise<DashboardStats> => fetcher('/stats'),
  },
  users: {
    search: (q: string): Promise<User[]> => fetcher(`/users/search?q=${encodeURIComponent(q)}`),
  },
  activities: {
    list: (): Promise<any[]> => fetcher('/activities'),
  }
};
