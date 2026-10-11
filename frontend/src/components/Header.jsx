'use client';

import React from 'react';
import { Search, Bell, Moon, Sun, ShieldAlert, Award, UserCheck } from 'lucide-react';

export default function Header({ role, onRoleChange, theme, onToggleTheme, onSearchClick }) {
  return (
    <header className="h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 px-8 flex items-center justify-between gap-4 z-20 shrink-0">
      
      {/* Search Input Bar */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <button
          onClick={onSearchClick}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 text-sm transition-all group"
        >
          <Search className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
          <span className="flex-1 text-left">Quick search students, exams, fees...</span>
          <kbd className="hidden md:inline-flex px-2 py-0.5 text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded shadow-xs text-slate-500">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Role Switcher Pill & Actions */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 shadow-inner">
          <button
            onClick={() => onRoleChange('admin')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              role === 'admin'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            <span>Admin</span>
          </button>
          <button
            onClick={() => onRoleChange('teacher')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              role === 'teacher'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-cyan-500" />
            <span>Teacher</span>
          </button>
          <button
            onClick={() => onRoleChange('student')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              role === 'student'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-pink-500" />
            <span>Student</span>
          </button>
        </div>

        {/* Theme Button */}
        <button
          onClick={onToggleTheme}
          className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications */}
        <button className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 flex items-center justify-center relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-pink-500 ring-2 ring-white dark:ring-slate-900"></span>
        </button>

        {/* Profile */}
        <div className="flex items-center gap-3 pl-2 border-l border-slate-200 dark:border-slate-800">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
            alt="Profile"
            className="w-10 h-10 rounded-xl object-cover ring-2 ring-indigo-500 shadow-sm"
          />
          <div className="hidden lg:block">
            <div className="text-xs font-bold leading-tight">Dr. Eleanor Vance</div>
            <div className="text-[11px] text-slate-400 font-medium">Head Administrator</div>
          </div>
        </div>
      </div>
    </header>
  );
}
