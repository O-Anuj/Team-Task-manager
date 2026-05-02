import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { DashboardStats, ActivityLog } from '../types';
import { CheckCircle2, Clock, ListTodo, AlertCircle, Loader2, ArrowRight, FolderKanban, Users, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.stats.get(),
      api.activities.list()
    ]).then(([statsData, activityData]) => {
      setStats(statsData);
      setActivities(activityData);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  const cards = [
    { name: 'Total Tasks', value: stats?.totalTasks || 0, icon: ListTodo, color: 'text-blue-600', bg: 'bg-blue-50' },
    { name: 'In Progress', value: stats?.byStatus.find(s => s.status === 'In Progress')?.count || 0, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { name: 'Completed', value: stats?.byStatus.find(s => s.status === 'Done')?.count || 0, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { name: 'Overdue', value: stats?.overdue || 0, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  return (
    <div className="space-y-8" id="dashboard">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome Back, {currentUser?.name}!</h2>
        <p className="text-slate-500">
          {currentUser?.role === 'Admin' 
            ? 'Monitor your projects and manage team performance from your dashboard.' 
            : 'Track your assigned tasks and keep up with your project deadlines.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <div key={card.name} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className={`w-12 h-12 ${card.bg} ${card.color} rounded-xl flex items-center justify-center mb-4`}>
              <card.icon size={24} />
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1">{card.name}</p>
            <p className="text-3xl font-bold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Users size={18} className="text-indigo-600" />
                Team Load
              </h3>
              <div className="space-y-4">
                {stats?.tasksPerUser.map((user) => (
                  <div key={user.name} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 uppercase">
                      {user.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                       <div className="flex justify-between items-center mb-1">
                          <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
                          <span className="text-xs font-bold text-slate-500">{user.count} Tasks</span>
                       </div>
                       <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(100, (user.count / (stats.totalTasks || 1)) * 100)}%` }}
                          />
                       </div>
                    </div>
                  </div>
                ))}
                {stats?.tasksPerUser.length === 0 && (
                    <p className="text-sm text-slate-400 italic">No users currently active.</p>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <AlertCircle size={18} className="text-red-600" />
                Urgent Attention
              </h3>
              <div className="space-y-3">
                 {stats?.overdueTasks.slice(0, 5).map(task => (
                   <Link 
                    key={task.id} 
                    to={`/projects/${task.project_id}`}
                    className="flex items-center justify-between p-3 bg-red-50/50 border border-red-100 rounded-xl hover:bg-red-50 transition-colors"
                   >
                     <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{task.title}</p>
                        <p className="text-[10px] text-red-600 font-medium uppercase tracking-wider">Overdue • {new Date(task.due_date!).toLocaleDateString()}</p>
                     </div>
                     <ArrowRight size={14} className="text-red-400" />
                   </Link>
                 ))}
                 {stats?.overdueTasks.length === 0 && (
                     <div className="py-8 text-center text-slate-400 text-sm">
                        <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500 opacity-20" />
                        Everything on track!
                     </div>
                 )}
              </div>
            </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <History size={18} className="text-indigo-600" />
              Recent Activity
              <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100 uppercase tracking-tighter">
                NoSQL Store
              </span>
            </h3>
            <div className="flex-1 space-y-6 relative before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
               {activities.map((log) => (
                 <div key={log.id} className="relative pl-10">
                    <div className="absolute left-0 top-1 w-8 h-8 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center z-10 shadow-sm group-hover:border-indigo-100 group-hover:bg-indigo-50 transition-colors">
                      <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    </div>
                    <div className="mb-0.5">
                       <span className="text-sm font-bold text-slate-900">{log.userName}</span>
                       <span className="text-sm text-slate-500"> {log.action}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-medium">
                       <span className="text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-md truncate max-w-[120px]">{log.projectName}</span>
                       <span className="text-slate-400">• {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                 </div>
               ))}
               {activities.length === 0 && (
                 <div className="py-12 text-center text-slate-400">
                   <p className="text-sm italic">No activity logs recorded yet.</p>
                 </div>
               )}
            </div>
        </div>
      </div>
    </div>
  );
}
