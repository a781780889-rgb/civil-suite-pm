'use client';

import { useEffect, useState } from 'react';
import { FolderKanban, Plus } from 'lucide-react';
import { fetchProjects, createProjectApi } from '@/lib/api.js';

const STORAGE_KEY = 'civil-suite:boq:last-project-id';

export function useSelectedProject() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects().then((res) => {
      if (res.success) {
        setProjects(res.projects);
        let stored = '';
        try { stored = window.localStorage.getItem(STORAGE_KEY) || ''; } catch { /* بيئة بلا localStorage */ }
        const valid = res.projects.some((p) => String(p.id) === stored);
        setProjectId(valid ? stored : '');
      }
      setLoading(false);
    });
  }, []);

  const select = (id) => {
    setProjectId(id);
    try { window.localStorage.setItem(STORAGE_KEY, id || ''); } catch { /* تجاهل */ }
  };

  const addProject = async (name) => {
    const res = await createProjectApi({ name });
    if (res.success) {
      setProjects((prev) => [res.project, ...prev]);
      select(String(res.project.id));
    }
    return res;
  };

  return { projects, projectId, select, addProject, loading };
}

export default function ProjectPicker({ projects, projectId, onSelect, onCreate }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  return (
    <div className="flex items-center gap-2">
      <FolderKanban size={16} className="text-navy-500 shrink-0" />
      <select
        value={projectId}
        onChange={(e) => onSelect(e.target.value)}
        className="text-sm border border-line rounded-md px-2.5 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-navy-300 min-w-[180px]"
      >
        <option value="">كل المشاريع</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      {creating ? (
        <form
          onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; await onCreate(name.trim()); setName(''); setCreating(false); }}
          className="flex items-center gap-1.5"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم المشروع الجديد"
            className="text-sm border border-line rounded-md px-2.5 py-1.5 w-40"
          />
          <button type="submit" className="text-xs font-bold px-2.5 py-1.5 rounded-md bg-navy-600 text-white">إنشاء</button>
          <button type="button" onClick={() => setCreating(false)} className="text-xs px-2 py-1.5 text-ink-soft">إلغاء</button>
        </form>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1 text-xs font-bold text-navy-600 hover:text-navy-700 border border-dashed border-navy-300 rounded-md px-2.5 py-1.5"
        >
          <Plus size={13} /> مشروع جديد
        </button>
      )}
    </div>
  );
}
