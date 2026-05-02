# TeamFlow - Team Task Management

TeamFlow is a high-performance, full-stack collaborative task management application. It allows teams to create projects, manage roles, and track task progress in real-time.

## Features

- **Robust Authentication**: Secure signup and login using JWT and Bcrypt.
- **Project Management**: Create projects, appoint admins, and collaborate with members.
- **Kanban Task Board**: Visualize task flow with To Do, In Progress, and Done columns.
- **Resource Management**: 
  - Admins can manage team members (add/remove) and create tasks.
  - Members can update statuses of tasks assigned to them.
- **Advanced Dashboard**:
  - Global stats overview.
  - Team load visualization (tasks per user).
  - Urgent/Overdue tasks alert system.
- **Autocomplete Search**: Smart user search for inviting members.
- **Due Dates & Priorities**: Keep track of deadlines and importance levels.
- **Modern UI**: Built with React, Tailwind CSS, Lucide icons, and Framer Motion for smooth transitions.

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite.
- **Backend**: Node.js, Express.
- **Database**: SQLite (built-in performance with `better-sqlite3`).
- **Authentication**: JSON Web Tokens (JWT).
- **Icons & Motion**: Lucide React, Motion (Framer Motion).

## Getting Started

1. **Setup Environment**:
   Ensure you have `JWT_SECRET` in your environment (automatically handled in development).
   
2. **Installation**:
   ```bash
   npm install
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```

4. **Build for Production**:
   ```bash
   npm run build
   npm start
   ```

## Folder Structure

- `server.ts`: Full-stack entry point and REST API.
- `src/App.tsx`: Routing and Auth initialization.
- `src/pages/`: Main application views (Dashboard, Projects, ProjectDetail, Auth).
- `src/components/`: Reusable UI components and Layout.
- `src/services/api.ts`: Centralized API client.
- `src/context/AuthContext.tsx`: Authentication state management.
- `src/types.ts`: Shared TypeScript interfaces.
