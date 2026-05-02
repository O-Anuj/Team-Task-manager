import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Project } from '../types';
import { Plus, FolderKanban, Users, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Projects() {
  const { currentUser } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const data = await api.projects.list();
      setProjects(data);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const project = await api.projects.create(newProject);
      setProjects([...projects, project]);
      setIsModalOpen(false);
      setNewProject({ name: '', description: '' });
      toast.success('Project created successfully');
    } catch (err) {
      toast.error('Failed to create project');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8" id="projects-page">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Projects</h2>
          <p className="text-slate-500">Manage your team's initiatives and collaborations.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={20} />
          New Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.length === 0 ? (
            <div className="col-span-full py-12 flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-slate-300">
                <FolderKanban size={48} className="text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 text-center">No projects found for your account</h3>
                <p className="text-slate-500 mb-6 text-center max-w-xs">
                  Start by creating your first project to organize your team, or wait for an invitation.
                </p>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="text-indigo-600 font-semibold hover:underline"
                >
                    Create Project
                </button>
            </div>
        ) : projects.map((project) => (
          <Link
            key={project.id}
            to={`/projects/${project.id}`}
            className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all flex flex-col h-full"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <FolderKanban size={20} />
              </div>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                project.role === 'Admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {project.role}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{project.name}</h3>
            <p className="text-slate-500 text-sm mb-6 flex-1 line-clamp-2">{project.description || 'No description provided.'}</p>
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-slate-400">
              <div className="flex items-center gap-1 text-xs">
                <Users size={14} />
                <span>Team Members</span>
              </div>
              <span className="text-xs">{new Date(project.created_at).toLocaleDateString()}</span>
            </div>
          </Link>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl relative">
            <h3 className="text-xl font-bold text-slate-900 mb-6">Create New Project</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Website Redesign"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="What is this project about?"
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
