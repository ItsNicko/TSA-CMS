'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline';

interface TopBarProps {
  isDirty: boolean;
  onSave: () => Promise<void>;
  currentPage: string | null;
  isSaving: boolean;
}

export default function TopBar({ isDirty, onSave, currentPage, isSaving }: TopBarProps) {
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="bg-gray-800 text-white px-6 py-4 border-b border-gray-700 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold">TSA CMS</h1>
        {currentPage && (
          <div className="text-sm text-gray-400">
            Editing: <span className="text-gray-200">{currentPage}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {isDirty && (
          <div className="text-xs text-yellow-400 bg-yellow-900 px-3 py-1 rounded">
            Unsaved changes
          </div>
        )}

        <button
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
        >
          {isSaving ? 'Saving...' : isDirty ? 'Save Changes' : 'Saved'}
        </button>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
        >
          <ArrowLeftOnRectangleIcon className="w-5 h-5" />
          Logout
        </button>
      </div>
    </div>
  );
}
