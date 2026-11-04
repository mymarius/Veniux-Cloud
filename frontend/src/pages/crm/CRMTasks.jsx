import { Dropdown } from '../../components/ui';
﻿import React, { useState } from 'react';
import {
  CheckSquare,
  Square,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  Building2,
  Trash2,
  List,
  Kanban,
  Calendar as CalendarIcon,
  Tag,
  AlertCircle
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';

export default function CRMTasks() {
  const { tasks, addTask, toggleTaskStatus, deleteTask, setIsQuickCreateOpen, setQuickCreateType } = useCRM();

  const [viewMode, setViewMode] = useState('list'); // 'list' | 'board'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      !searchQuery ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.assignee.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.relatedCompany?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = filterPriority === 'all' || t.priority === filterPriority;
    const matchesStatus = filterStatus === 'all' || (filterStatus === 'completed' ? t.status === 'completed' : t.status !== 'completed');
    return matchesSearch && matchesPriority && matchesStatus;
  });

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'urgent':
        return <span className="badge-danger uppercase font-mono text-[9.5px] font-bold">URGENT</span>;
      case 'high':
        return <span className="badge-warning uppercase font-mono text-[9.5px] font-bold">HIGH</span>;
      case 'medium':
        return <span className="badge-info uppercase font-mono text-[9.5px] font-bold">MEDIUM</span>;
      default:
        return <span className="badge-neutral uppercase font-mono text-[9.5px] font-bold">LOW</span>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-200/50 border-gray-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 text-gray-900">
              Task Management & Deliverables
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-brand-500/10 bg-brand-500/10 text-brand-500 dark:text-brand-500 text-xs font-bold font-mono border border-brand-500/20 border-brand-500/20">
              {tasks.filter((t) => t.status !== 'completed').length} Pending
            </span>
          </div>
          <p className="text-xs text-gray-500 text-gray-500 mt-1">
            Track customer follow-ups, legal MSA redlines, executive demos, and closing actions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center p-0.5 rounded-lg bg-gray-100 dark:bg-white border border-gray-200/50 border-gray-200 text-xs font-semibold">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-100 text-gray-900 text-gray-900 shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" /> List
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                viewMode === 'board'
                  ? 'bg-white dark:bg-gray-100 text-gray-900 text-gray-900 shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" /> Board
            </button>
          </div>

          <button
            onClick={() => {
              setQuickCreateType('task');
              setIsQuickCreateOpen(true);
            }}
            className="btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg crm-card text-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tasks, assignee, company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 crm-input"
            />
          </div>

          <Dropdown
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="crm-input min-w-[130px]"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Dropdown>

          <Dropdown
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="crm-input min-w-[130px]"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </Dropdown>
        </div>

        <span className="text-gray-500 font-mono text-[11px]">
          {filteredTasks.length} tasks shown
        </span>
      </div>

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <div className="crm-card overflow-hidden divide-y divide-border/40 dark:divide-slate-800">
          {filteredTasks.map((task) => {
            const isDone = task.status === 'completed';
            return (
              <div
                key={task.id}
                className={`p-4 flex items-center justify-between gap-4 transition ${
                  isDone ? 'bg-gray-100/60 dark:bg-gray-100/20 opacity-70' : 'hover:bg-gray-100 dark:hover:bg-white/40'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => toggleTaskStatus(task.id)}
                    className="text-gray-500 hover:text-brand-500 transition shrink-0"
                  >
                    {isDone ? (
                      <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-green-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-500 text-gray-500" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <div
                      className={`font-bold text-xs ${
                        isDone ? 'line-through text-gray-500' : 'text-gray-900 text-gray-900'
                      }`}
                    >
                      {task.title}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500 mt-1 font-mono">
                      {task.relatedCompany && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-gray-500" /> {task.relatedCompany}
                        </span>
                      )}
                      {task.relatedDeal && (
                        <span>• Deal: {task.relatedDeal.slice(0, 30)}...</span>
                      )}
                      <span className="flex items-center gap-1 text-gray-500">
                        <Calendar className="w-3 h-3" /> Due {task.dueDate}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {getPriorityBadge(task.priority)}

                  <div className="flex items-center gap-1.5 text-xs text-gray-500 text-gray-500 font-medium">
                    <img
                      src={task.assigneeAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80'}
                      alt={task.assignee}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                    <span className="hidden sm:inline">{task.assignee}</span>
                  </div>

                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-1 text-gray-500 hover:text-rose-500 transition"
                    title="Delete task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BOARD VIEW */}
      {viewMode === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {[
            { id: 'todo', name: 'To Do', badge: 'bg-gray-100 text-gray-900' },
            { id: 'in_progress', name: 'In Progress', badge: 'bg-brand-500/10 text-brand-500' },
            { id: 'completed', name: 'Completed', badge: 'bg-emerald-50 text-emerald-700' }
          ].map((col) => {
            const colTasks = filteredTasks.filter((t) => (col.id === 'completed' ? t.status === 'completed' : col.id === 'in_progress' ? t.status === 'in_progress' : t.status === 'todo'));
            return (
              <div key={col.id} className="crm-card p-3 space-y-3 bg-gray-100/50 dark:bg-gray-100/30">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200/50 border-gray-200">
                  <span className="font-bold text-xs text-gray-900 text-gray-900">{col.name}</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-white text-gray-500">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-2.5 min-h-[200px]">
                  {colTasks.map((task) => (
                    <div key={task.id} className="p-3 bg-white dark:bg-gray-100 border border-gray-200/50 border-gray-200 rounded-lg space-y-2 text-xs shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-gray-900">{task.title}</span>
                        <button onClick={() => toggleTaskStatus(task.id)}>
                          {task.status === 'completed' ? (
                            <CheckSquare className="w-4 h-4 text-green-600" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-gray-200/50 border-gray-200 text-[10.5px] text-gray-500 font-mono">
                        <span>Due: {task.dueDate}</span>
                        {getPriorityBadge(task.priority)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}



