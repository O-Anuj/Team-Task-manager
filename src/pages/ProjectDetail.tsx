import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Project, Task, Member, TaskStatus, Priority, User } from '../types';
import { Plus, Users, Loader2, Calendar, MoreVertical, CheckCircle2, Circle, Clock, Trash2, UserPlus, X, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const STATUS_COLUMNS: TaskStatus[] = ['To Do', 'In Progress', 'Done'];

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isMembersListViewOpen, setIsMembersListViewOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'Medium' as Priority, assignee_id: '', due_date: '' });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newMember, setNewMember] = useState({ email: '', role: 'Member' });
  const [userSuggestions, setUserSuggestions] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyMyTasks, setShowOnlyMyTasks] = useState(false);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  useEffect(() => {
    const searchUsers = async () => {
      if (newMember.email.length >= 2) {
        try {
          const users = await api.users.search(newMember.email);
          setUserSuggestions(users);
        } catch (err) {
          console.error('Search failed', err);
        }
      } else {
        setUserSuggestions([]);
      }
    };

    const timer = setTimeout(searchUsers, 300);
    return () => clearTimeout(timer);
  }, [newMember.email]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projData, taskData, memberData] = await Promise.all([
        api.projects.get(id!),
        api.tasks.list(id!),
        api.projects.members(id!)
      ]);
      setProject(projData);
      setTasks(taskData);
      setMembers(memberData);
    } catch (err) {
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.tasks.create(id!, {
        ...newTask,
        assignee_id: newTask.assignee_id ? parseInt(newTask.assignee_id) : null,
        due_date: newTask.due_date || null
      } as any);
      await loadData(); // Reload to get assignee names correctly
      setIsTaskModalOpen(false);
      setNewTask({ title: '', description: '', priority: 'Medium', assignee_id: '', due_date: '' });
      toast.success('Task created successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    setIsSubmitting(true);
    try {
      await api.tasks.update(editingTask.id, {
        title: editingTask.title,
        description: editingTask.description,
        priority: editingTask.priority,
        assignee_id: editingTask.assignee_id,
        due_date: editingTask.due_date
      });
      await loadData();
      setIsEditModalOpen(false);
      setEditingTask(null);
      toast.success('Task updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (taskId: number, newStatus: TaskStatus) => {
    try {
      await api.tasks.update(taskId, { status: newStatus });
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      toast.success('Status updated');
    } catch (err: any) {
        toast.error(err.message || 'Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.tasks.delete(taskId);
      setTasks(tasks.filter(t => t.id !== taskId));
      toast.success('Task deleted');
    } catch (err: any) {
        toast.error(err.message || 'Failed to delete task');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMember.email === currentUser?.email) {
      toast.error('You are already in the project!');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.projects.addMember(id!, newMember);
      await loadData();
      setIsMemberModalOpen(false);
      setNewMember({ email: '', role: 'Member' });
      toast.success('Member invited');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      await api.projects.removeMember(id!, userId);
      setMembers(members.filter(m => m.id !== userId));
      toast.success('Member removed');
      if (userId === currentUser?.id) navigate('/projects');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member');
    }
  };

  const handleProjectDelete = async () => {
    if (!confirm('CRITICAL: Are you sure you want to delete this entire project? This action cannot be undone.')) return;
    try {
      await api.projects.delete(id!);
      toast.success('Project deleted');
      navigate('/projects');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete project');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="space-y-6" id="project-detail">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-slate-900">{project.name}</h2>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
              project.role === 'Admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
            }`}>
              {project.role}
            </span>
          </div>
          <p className="text-slate-500 max-w-2xl">{project.description}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-4">
              <div className="flex -space-x-2">
                {members.slice(0, 5).map(m => (
                  <div key={m.id} title={m.name} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 uppercase transition-transform hover:scale-110">
                    {m.name.charAt(0)}
                  </div>
                ))}
                {members.length > 5 && (
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-500">
                    +{members.length - 5}
                  </div>
                )}
              </div>
              <button 
                onClick={() => setIsMembersListViewOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200"
              >
                <Users size={14} />
                <span>Manage Team</span>
              </button>
          </div>
          {project.role === 'Admin' && (
            <button
              onClick={() => setIsMemberModalOpen(true)}
              className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg flex items-center gap-2 font-bold hover:bg-indigo-100 transition-all border border-indigo-100 shadow-sm"
              title="Add Team Member"
            >
              <UserPlus size={18} />
              <span>Invite</span>
            </button>
          )}
          {project.role === 'Admin' && (
            <button
              onClick={() => setIsTaskModalOpen(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
            >
              <Plus size={20} />
              Add Task
            </button>
          )}
          {project.role === 'Admin' && (
            <button
              onClick={handleProjectDelete}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
              title="Delete Project"
            >
              <Trash2 size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md w-full">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks by title or description..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all"
              onChange={(e) => setSearchQuery(e.target.value)}
            />
        </div>
        <button
          onClick={() => setShowOnlyMyTasks(!showOnlyMyTasks)}
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
            showOnlyMyTasks 
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100' 
              : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
          }`}
        >
          <Users size={14} />
          {showOnlyMyTasks ? 'Showing My Tasks' : 'Showing All Tasks'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {STATUS_COLUMNS.map(status => (
          <div key={status} className="flex flex-col h-full bg-slate-100/50 rounded-2xl p-4 min-h-[500px]">
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                {status === 'To Do' && <Circle size={14} className="text-slate-400" />}
                {status === 'In Progress' && <Clock size={14} className="text-amber-500" />}
                {status === 'Done' && <CheckCircle2 size={14} className="text-emerald-500" />}
                {status}
                <span className="ml-2 px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full text-[10px] font-bold">
                  {tasks.filter(t => t.status === status).length}
                </span>
              </h3>
            </div>

            <div className="space-y-3 flex-1">
              {tasks
                .filter(t => t.status === status)
                .filter(t => !showOnlyMyTasks || t.assignee_id === currentUser?.id)
                .filter(t => (
                  t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  t.description?.toLowerCase().includes(searchQuery.toLowerCase())
                ))
                .map(task => (
                <div key={task.id} className={`bg-white p-4 rounded-xl shadow-sm border transition-all group ${
                    (project.role === 'Admin' || task.assignee_id === currentUser?.id) ? 'border-slate-200 hover:border-indigo-300' : 'border-slate-100 opacity-80'
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      task.priority === 'High' ? 'bg-red-50 text-red-600' :
                      task.priority === 'Medium' ? 'bg-amber-50 text-amber-600' :
                      'bg-emerald-50 text-emerald-600'
                    }`}>
                      {task.priority}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(project.role === 'Admin' || task.assignee_id === currentUser?.id) && (
                            <button 
                                onClick={() => {
                                    setEditingTask(task);
                                    setIsEditModalOpen(true);
                                }} 
                                className="p-1 text-slate-400 hover:text-indigo-600"
                                title="Edit Task"
                            >
                                <MoreVertical size={14} />
                            </button>
                        )}
                        {project.role === 'Admin' && (
                            <button onClick={() => handleDeleteTask(task.id)} className="p-1 text-slate-400 hover:text-red-600">
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                  </div>
                  <h4 className="font-semibold text-slate-900 mb-2">{task.title}</h4>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-3">{task.description}</p>
                  
                  {task.due_date && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-4">
                        <Calendar size={12} />
                        <span className={new Date(task.due_date) < new Date() && task.status !== 'Done' ? 'text-red-500 font-medium' : ''}>
                            {new Date(task.due_date).toLocaleDateString()}
                        </span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold uppercase flex-shrink-0 ${
                            task.assignee_id === currentUser?.id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`} title={task.assignee_name || 'Unassigned'}>
                        {task.assignee_name ? task.assignee_name.charAt(0) : '?'}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold text-slate-900 truncate">
                            {task.assignee_id === currentUser?.id ? 'Assigned to You' : (task.assignee_name || 'Unassigned')}
                        </span>
                      </div>
                    </div>
                    <select
                        value={task.status}
                        disabled={project.role !== 'Admin' && task.assignee_id !== currentUser?.id}
                        onChange={(e) => handleUpdateStatus(task.id, e.target.value as TaskStatus)}
                        className="text-[10px] font-bold bg-slate-50 border-none rounded px-1.5 py-0.5 outline-none cursor-pointer hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {STATUS_COLUMNS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              ))}
              {tasks.filter(t => t.status === status).length === 0 && (
                  <div className="h-24 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-300 text-xs italic">
                      No tasks in {status}
                  </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-8 shadow-2xl relative">
            <button onClick={() => setIsTaskModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-slate-900 mb-6">Add New Task</h3>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  autoFocus
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                    <select
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={newTask.priority}
                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as Priority })}
                    >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Assignee</label>
                    <select
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={newTask.assignee_id}
                        onChange={(e) => setNewTask({ ...newTask, assignee_id: e.target.value })}
                    >
                        <option value="">Unassigned</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                <div className="relative">
                    <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                        type="date"
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={newTask.due_date}
                        onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                    />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {isEditModalOpen && editingTask && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-8 shadow-2xl relative">
            <button onClick={() => { setIsEditModalOpen(false); setEditingTask(null); }} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-slate-900 mb-6">Edit Task</h3>
            <form onSubmit={handleUpdateTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                  disabled={project.role !== 'Admin'}
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                  disabled={project.role !== 'Admin'}
                  value={editingTask.description || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                    <select
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                        disabled={project.role !== 'Admin'}
                        value={editingTask.priority}
                        onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value as Priority })}
                    >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Assignee</label>
                    <select
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                        disabled={project.role !== 'Admin'}
                        value={editingTask.assignee_id || ''}
                        onChange={(e) => setEditingTask({ ...editingTask, assignee_id: e.target.value ? parseInt(e.target.value) : null })}
                    >
                        <option value="">Unassigned</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                <div className="relative">
                    <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                        type="date"
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                        disabled={project.role !== 'Admin'}
                        value={editingTask.due_date ? editingTask.due_date.split('T')[0] : ''}
                        onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value })}
                    />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setIsEditModalOpen(false); setEditingTask(null); }}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Modal */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl relative">
            <button onClick={() => setIsMemberModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
            </button>
            <div className="text-center mb-8">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UserPlus size={24} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Invite Team Member</h3>
                <p className="text-sm text-slate-500 mt-1">Add colleagues to collaborate on this project.</p>
            </div>

            <form onSubmit={handleAddMember} className="space-y-5">
              <div className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Member Email</label>
                <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="email"
                        required
                        autoFocus
                        placeholder="colleague@company.com"
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        value={newMember.email}
                        onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                    />
                </div>
                {userSuggestions.length > 0 && (
                  <div className="absolute z-[70] left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto overflow-x-hidden">
                    <div className="p-2 border-b border-slate-50 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Suggested Users
                    </div>
                    {userSuggestions
                      .filter(user => !members.some(m => m.id === user.id))
                      .map(user => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setNewMember({ ...newMember, email: user.email });
                          setUserSuggestions([]);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors flex items-center gap-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 uppercase">
                            {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 leading-none mb-1">{user.name}</p>
                          <p className="text-xs text-slate-400">{user.email}</p>
                        </div>
                      </button>
                    ))}
                    {userSuggestions.filter(user => !members.some(m => m.id === user.id)).length === 0 && (
                        <div className="p-4 text-center text-xs text-slate-400 italic">
                            All matching users are already members.
                        </div>
                    )}
                  </div>
                )}
                <div className="mt-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                    <p className="text-[10px] text-indigo-700 leading-relaxed">
                        <span className="font-bold">Pro Tip:</span> Only registered TeamFlow users can be invited. Ask your colleague to sign up first if you can't find them!
                    </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Assign Project Role</label>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => setNewMember({ ...newMember, role: 'Member' })}
                        className={`p-3 rounded-xl border-2 transition-all text-left ${
                            newMember.role === 'Member' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'
                        }`}
                    >
                        <div className="font-bold text-sm text-slate-900">Member</div>
                        <div className="text-[10px] text-slate-500">Can view & update tasks</div>
                    </button>
                    <button
                        type="button"
                        onClick={() => setNewMember({ ...newMember, role: 'Admin' })}
                        className={`p-3 rounded-xl border-2 transition-all text-left ${
                            newMember.role === 'Admin' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'
                        }`}
                    >
                        <div className="font-bold text-sm text-slate-900">Admin</div>
                        <div className="text-[10px] text-slate-500">Full project control</div>
                    </button>
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Members List Modal */}
      {isMembersListViewOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-8 shadow-2xl relative">
            <button onClick={() => setIsMembersListViewOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-slate-900 mb-6">Team Members</h3>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold uppercase">
                      {m.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{m.name} {m.id === currentUser?.id && '(You)'}</p>
                      <p className="text-xs text-slate-500">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                      m.role === 'Admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {m.role}
                    </span>
                    {project.role === 'Admin' && m.id !== currentUser?.id && (
                      <button 
                        onClick={() => handleRemoveMember(m.id)}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                        title="Remove Member"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
