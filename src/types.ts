export type Priority = 'Low' | 'Medium' | 'High';
export type TaskStatus = 'To Do' | 'In Progress' | 'Done';
export type ProjectRole = 'Admin' | 'Member';

export interface User {
  id: number;
  name: string;
  email: string;
  role: ProjectRole;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  creator_id: number;
  created_at: string;
  role: ProjectRole;
}

export interface Task {
  id: number;
  project_id: number;
  title: string;
  description: string;
  due_date: string | null;
  priority: Priority;
  status: TaskStatus;
  assignee_id: number | null;
  assignee_name?: string;
  created_at: string;
}

export interface Member {
  id: number;
  name: string;
  email: string;
  role: ProjectRole;
}

export interface ActivityLog {
  id: string;
  userId: number;
  userName: string;
  projectId: number;
  projectName: string;
  action: string;
  timestamp: string;
}

export interface DashboardStats {
  totalTasks: number;
  byStatus: { status: TaskStatus; count: number }[];
  assignedToMe: number;
  overdue: number;
  overdueTasks: Task[];
  tasksPerUser: { name: string; count: number }[];
}
