import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';
import { JSONFilePreset } from 'lowdb/node';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';
const PORT = 3000;

// --- SQL Initialization (Relational Data) ---
const db = new Database('teamflow.db');
db.pragma('journal_mode = WAL');

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Member', -- Global 'Admin' or 'Member'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    creator_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS project_members (
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'Member', -- 'Admin' or 'Member'
    PRIMARY KEY (project_id, user_id),
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATETIME,
    priority TEXT DEFAULT 'Medium', -- 'Low', 'Medium', 'High'
    status TEXT DEFAULT 'To Do', -- 'To Do', 'In Progress', 'Done'
    assignee_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (assignee_id) REFERENCES users (id) ON DELETE SET NULL
  );
`);

// Migration: Add role column to users if it doesn't exist
try {
  const tableInfo = db.prepare("PRAGMA table_info(users)").all();
  const hasRole = (tableInfo as any[]).some((col: any) => col.name === 'role');
  if (!hasRole) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'Member'");
    console.log("Migration: Added 'role' column to users table");
  }
} catch (e) {
  console.error("Migration failed:", e);
}

// --- NoSQL Initialization (Document Data) ---
// Using lowdb for flexible activity logging (Unstructured info)
interface ActivityLog {
  id: string;
  userId: number;
  userName: string;
  projectId: number;
  projectName: string;
  action: string;
  timestamp: string;
}

interface NoSQLData {
  activities: ActivityLog[];
}

let nosql: any;

async function initNoSQL() {
  const defaultData: NoSQLData = { activities: [] };
  nosql = await JSONFilePreset<NoSQLData>('activities.json', defaultData);
}

async function logActivity(userId: number, userName: string, projectId: number, projectName: string, action: string) {
  if (!nosql) await initNoSQL();
  const log: ActivityLog = {
    id: Math.random().toString(36).substring(7),
    userId,
    userName,
    projectId,
    projectName,
    action,
    timestamp: new Date().toISOString()
  };
  await nosql.update((state: any) => state.activities.unshift(log));
  // Keep logs to latest 20
  if (nosql.data.activities.length > 20) {
    await nosql.update((state: any) => state.activities = state.activities.slice(0, 20));
  }
}

async function startServer() {
  await initNoSQL();
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // --- API Routes ---

  // Auth
  app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
      const result = stmt.run(name, email, hashedPassword, role || 'Member');
      const user = { id: result.lastInsertRowid, name, email, role: role || 'Member' };
      const token = jwt.sign(user, JWT_SECRET);
      res.status(201).json({ user, token });
    } catch (err: any) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = jwt.sign(safeUser, JWT_SECRET);
    res.json({ user: safeUser, token });
  });

  app.get('/api/auth/me', authenticateToken, (req: any, res) => {
    res.json(req.user);
  });

  // --- NoSQL Routes ---
  app.get('/api/activities', authenticateToken, (req, res) => {
    res.json(nosql ? nosql.data.activities : []);
  });

  // Projects
  app.get('/api/projects', authenticateToken, (req: any, res) => {
    const projects = db.prepare(`
      SELECT p.*, pm.role 
      FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = ?
    `).all(req.user.id);
    res.json(projects);
  });

  app.post('/api/projects', authenticateToken, async (req: any, res) => {
    const { name, description } = req.body;
    const transaction = db.transaction(() => {
      const projStmt = db.prepare('INSERT INTO projects (name, description, creator_id) VALUES (?, ?, ?)');
      const result = projStmt.run(name, description, req.user.id);
      const projectId = result.lastInsertRowid;
      
      const memberStmt = db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)');
      memberStmt.run(projectId, req.user.id, 'Admin');
      
      return { id: projectId, name, description, creator_id: req.user.id, role: 'Admin' };
    });
    
    try {
      const project = transaction();
      await logActivity(req.user.id, req.user.name, Number(project.id), name, 'Created the project');
      res.status(201).json(project);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create project' });
    }
  });

  app.get('/api/projects/:id', authenticateToken, (req: any, res) => {
    const project = db.prepare(`
      SELECT p.*, pm.role 
      FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE p.id = ? AND pm.user_id = ?
    `).get(req.params.id, req.user.id);
    
    if (!project) return res.sendStatus(404);
    res.json(project);
  });

  app.delete('/api/projects/:id', authenticateToken, (req: any, res) => {
    const projectId = req.params.id;
    
    // Check if user is Admin of the project
    const member: any = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, req.user.id);
    if (!member || member.role !== 'Admin') {
      return res.status(403).json({ error: 'Only project Admins can delete projects' });
    }

    db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
    res.sendStatus(204);
  });

  // Project Members
  app.get('/api/projects/:id/members', authenticateToken, (req: any, res) => {
    const members = db.prepare(`
      SELECT u.id, u.name, u.email, pm.role
      FROM users u
      JOIN project_members pm ON u.id = pm.user_id
      WHERE pm.project_id = ?
    `).all(req.params.id);
    res.json(members);
  });

  app.post('/api/projects/:id/members', authenticateToken, (req: any, res) => {
    const { email, role } = req.body;
    const projectId = req.params.id;

    // Check if requester is Admin
    const member = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, req.user.id);
    if (!member || (member as any).role !== 'Admin') return res.status(403).json({ error: 'Only Admins can manage members' });

    const userToInvite: any = db.prepare('SELECT id, role FROM users WHERE email = ?').get(email);
    if (!userToInvite) return res.status(404).json({ error: 'User not found' });

    let finalRole = role || 'Member';
    if (userToInvite.role === 'Member' && finalRole === 'Admin') {
      return res.status(400).json({ error: 'Global Members cannot be given Admin role in projects' });
    }

    try {
      db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(projectId, userToInvite.id, finalRole);
      res.status(201).json({ success: true });
    } catch (err) {
      res.status(400).json({ error: 'User already in project' });
    }
  });

  app.delete('/api/projects/:id/members/:userId', authenticateToken, (req: any, res) => {
    const projectId = req.params.id;
    const userIdToRemove = req.params.userId;

    // Check if requester is Admin
    const member = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, req.user.id);
    if (!member || (member as any).role !== 'Admin') return res.status(403).json({ error: 'Only Admins can remove members' });

    // Cannot remove the creator/Admin if they are the only Admin (optional safety)
    db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(projectId, userIdToRemove);
    res.sendStatus(204);
  });

  // Tasks
  app.get('/api/projects/:id/tasks', authenticateToken, (req: any, res) => {
    const tasks = db.prepare(`
      SELECT t.*, u.name as assignee_name
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.project_id = ?
    `).all(req.params.id);
    res.json(tasks);
  });

  app.post('/api/projects/:id/tasks', authenticateToken, (req: any, res) => {
    const { title, description, due_date, priority, assignee_id } = req.body;
    const projectId = req.params.id;

    // Only Admin can create tasks
    const member = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, req.user.id);
    if (!member || (member as any).role !== 'Admin') {
        return res.status(403).json({ error: 'Only Admins can create tasks' });
    }

    const stmt = db.prepare('INSERT INTO tasks (project_id, title, description, due_date, priority, assignee_id) VALUES (?, ?, ?, ?, ?, ?)');
    const result = stmt.run(projectId, title, description, due_date, priority || 'Medium', assignee_id);
    res.status(201).json({ id: result.lastInsertRowid, ...req.body, project_id: projectId, status: 'To Do' });
  });

  app.patch('/api/tasks/:id', authenticateToken, async (req: any, res) => {
    const { status, title, description, due_date, priority, assignee_id } = req.body;
    const task: any = db.prepare('SELECT project_id, assignee_id, title FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.sendStatus(404);

    const project: any = db.prepare('SELECT name FROM projects WHERE id = ?').get(task.project_id);

    const member: any = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(task.project_id, req.user.id);
    if (!member) return res.sendStatus(403);

    if (member.role !== 'Admin') {
      if (task.assignee_id !== req.user.id) {
        return res.status(403).json({ error: 'Members can only update tasks assigned to them' });
      }
      const fields = Object.keys(req.body);
      if (fields.length !== 1 || fields[0] !== 'status') {
        return res.status(403).json({ error: 'Members can only update the task status' });
      }
    }

    const updates = Object.keys(req.body).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(req.body), req.params.id];
    
    if (updates.length === 0) return res.json({ success: true });

    db.prepare(`UPDATE tasks SET ${updates} WHERE id = ?`).run(...values);

    if (status) {
        await logActivity(req.user.id, req.user.name, task.project_id, project.name, `Updated task "${task.title}" status to ${status}`);
    }

    res.json({ success: true });
  });

  app.delete('/api/tasks/:id', authenticateToken, async (req: any, res) => {
    const task: any = db.prepare('SELECT project_id, title FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.sendStatus(404);

    const project: any = db.prepare('SELECT name FROM projects WHERE id = ?').get(task.project_id);

    const member: any = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(task.project_id, req.user.id);
    if (!member || member.role !== 'Admin') return res.sendStatus(403);

    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    
    await logActivity(req.user.id, req.user.name, task.project_id, project.name, `Deleted task "${task.title}"`);
    res.sendStatus(204);
  });

  // Dashboard Stats
  app.get('/api/stats', authenticateToken, (req: any, res) => {
    const userId = req.user.id;
    const stats = {
      totalTasks: (db.prepare(`
        SELECT COUNT(*) as count 
        FROM tasks t
        JOIN project_members pm ON t.project_id = pm.project_id
        WHERE pm.user_id = ?
      `).get(userId) as any).count,
      
      byStatus: db.prepare(`
        SELECT status, COUNT(*) as count 
        FROM tasks t
        JOIN project_members pm ON t.project_id = pm.project_id
        WHERE pm.user_id = ?
        GROUP BY status
      `).all(userId),
      
      assignedToMe: (db.prepare('SELECT COUNT(*) as count FROM tasks WHERE assignee_id = ?').get(userId) as any).count,
      
      overdueTasks: db.prepare(`
        SELECT t.*, p.name as project_name, u.name as assignee_name
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        JOIN project_members pm ON t.project_id = pm.project_id
        LEFT JOIN users u ON t.assignee_id = u.id
        WHERE pm.user_id = ? AND t.due_date < ? AND t.status != 'Done'
        ORDER BY t.due_date ASC
      `).all(userId, new Date().toISOString()),

      tasksPerUser: db.prepare(`
        SELECT u.name, COUNT(t.id) as count
        FROM users u
        JOIN project_members pm ON u.id = pm.user_id
        LEFT JOIN tasks t ON u.id = t.assignee_id AND t.project_id = pm.project_id
        WHERE pm.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)
        GROUP BY u.id
      `).all(userId),
      
      overdue: (db.prepare(`
        SELECT COUNT(*) as count 
        FROM tasks t
        JOIN project_members pm ON t.project_id = pm.project_id
        WHERE pm.user_id = ? AND due_date < ? AND status != 'Done'
      `).get(userId, new Date().toISOString()) as any).count
    };
    res.json(stats);
  });

  // User search (for adding members)
  app.get('/api/users/search', authenticateToken, (req: any, res) => {
    const { q } = req.query;
    const users = db.prepare('SELECT id, name, email FROM users WHERE (name LIKE ? OR email LIKE ?) AND id != ? LIMIT 10')
      .all(`%${q}%`, `%${q}%`, req.user.id);
    res.json(users);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
