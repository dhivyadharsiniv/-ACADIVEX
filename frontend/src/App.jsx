'use client';

import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import api from './services/api';

export default function App() {
  const [role, setRole] = useState('admin');
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [theme, setTheme] = useState('light');
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const stdRes = await api.getStudents();
        const tchRes = await api.getTeachers();
        if (stdRes.success) setStudents(stdRes.data);
        if (tchRes.success) setTeachers(tchRes.data);
      } catch (err) {
        console.warn('API error, using fallback state:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  return (
    <div className={`flex h-screen overflow-hidden ${theme === 'dark' ? 'dark bg-slate-950 text-white' : 'bg-slate-50 text-slate-800'}`}>
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        role={role}
        studentCount={students.length || 8}
        teacherCount={teachers.length || 4}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          role={role}
          onRoleChange={setRole}
          theme={theme}
          onToggleTheme={toggleTheme}
          onSearchClick={() => {}}
        />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h1 className="text-2xl font-bold font-display capitalize">{currentTab} Module</h1>
            <p className="text-xs text-slate-400 mt-1">
              Active Role: <span className="font-bold text-indigo-500 uppercase">{role}</span> • Open{' '}
              <a href="http://localhost:5000" className="text-indigo-600 underline font-semibold">
                http://localhost:5000 (ACADIVEX Full Portal)
              </a>{' '}
              for the complete interactive multi-tenant application.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
