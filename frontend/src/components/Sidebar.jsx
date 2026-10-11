'use client';

import React from 'react';
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  Briefcase,
  CalendarCheck,
  FileSpreadsheet,
  Receipt,
  ShieldCheck,
} from 'lucide-react';

export default function Sidebar({ currentTab, onTabChange, role, studentCount, teacherCount }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard Hub', icon: LayoutDashboard },
    { id: 'students', label: 'Students Directory', icon: Users, badge: studentCount },
    { id: 'teachers', label: 'Faculty & Teachers', icon: Briefcase, badge: teacherCount },
    { id: 'attendance', label: 'Attendance Tracker', icon: CalendarCheck, pill: '95%' },
    { id: 'exams', label: 'Exams & Gradebook', icon: FileSpreadsheet },
    { id: 'fees', label: 'Fee Ledger & Invoices', icon: Receipt },
  ];

  return (
    <aside className="w-72 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between transition-all duration-300 z-30 shrink-0">
      <div>
        {/* Brand Header */}
        <div className="h-20 flex items-center px-6 gap-3 border-b border-slate-100 dark:border-slate-800/60">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#7C3AED] via-[#6D28D9] to-[#06B6D4] p-0.5 shadow-lg shadow-purple-500/30 flex items-center justify-center text-white">
            <svg className="w-7 h-7" viewBox="0 0 120 120" fill="none">
              <path d="M 60 21 L 45 21 L 22 96 L 39 96 L 48 68 L 60 68 Z" fill="#A78BFA"/>
              <path d="M 60 21 L 75 21 L 98 96 L 81 96 L 72 68 L 60 68 Z" fill="#22D3EE"/>
              <polygon points="60,17 68,28 60,38 52,28" fill="#FFFFFF"/>
              <path d="M 39 63 L 81 63 L 74 74 L 46 74 Z" fill="#7C3AED"/>
              <circle cx="60" cy="68.5" r="4.5" fill="#FFFFFF"/>
            </svg>
          </div>
          <div>
            <div className="font-display font-extrabold text-xl tracking-wider text-slate-900 dark:text-white flex items-center">
              <span>ACADI</span><span className="bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] bg-clip-text text-transparent">VEX</span>
            </div>
            <div className="text-[10px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              Smarter Campus. Stronger Futures.
            </div>
          </div>
        </div>

        {/* Role Pill */}
        <div className="mx-4 mt-5 p-3 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50/50 dark:from-slate-800/80 dark:to-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center text-xs shadow-sm">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <div>
              <div className="text-[11px] font-medium text-slate-400">Current Role</div>
              <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300 capitalize">
                {role}
              </div>
            </div>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 animate-pulse">
            Active
          </span>
        </div>

        {/* Navigation */}
        <nav className="px-3 mt-5 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all group ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25'
                    : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                    {item.badge}
                  </span>
                )}
                {item.pill && (
                  <span className="ml-auto text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                    {item.pill}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800/60">
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3">
          <img
            src="https://images.unsplash.com/photo-1562774053-701939374585?w=100&auto=format&fit=crop&q=80"
            alt="Campus"
            className="w-10 h-10 rounded-xl object-cover ring-2 ring-indigo-500/20"
          />
          <div className="overflow-hidden">
            <div className="text-xs font-bold truncate text-slate-800 dark:text-slate-200">
              St. Xavier Academy
            </div>
            <div className="text-[10px] text-slate-400 font-medium truncate">
              Academic Year 2026-27
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
