'use client';

import React from 'react';
import Link from 'next/link';
import { getFileName } from '@/lib/utils';

interface Page {
  name: string;
  path: string;
  type: 'json' | 'html';
}

interface Props {
  pages: Page[];
  currentPage: string | null;
  onSelectPage: (page: Page) => void;
  isLoading: boolean;
}

const activeBtn = (active: boolean) => active ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800';

export default function Sidebar({ pages, currentPage, onSelectPage, isLoading }: Props) {
  const json = pages.filter((p) => p.type === 'json').sort((a, b) => a.name.localeCompare(b.name));
  const html = pages.filter((p) => p.type === 'html').sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="w-64 bg-gray-900 text-white p-4 overflow-y-auto border-r border-gray-800 h-screen sticky top-0">
      <h2 className="text-lg font-bold mb-6">pages</h2>

      {isLoading ? (
        <div className="text-gray-400 text-sm">loading...</div>
      ) : (
        <>
          {json.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">json</h3>
              <ul className="space-y-1">
                {json.map((page) => (
                  <li key={page.path}>
                    <button onClick={() => onSelectPage(page)} className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${activeBtn(currentPage === page.path)}`}>
                      <span className="truncate">{getFileName(page.path)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {html.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">html</h3>
              <ul className="space-y-1">
                {html.map((page) => (
                  <li key={page.path}>
                    <button onClick={() => onSelectPage(page)} className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${activeBtn(currentPage === page.path)}`}>
                      <span className="truncate">{getFileName(page.path)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pages.length === 0 && <div className="text-gray-400 text-sm">no pages</div>}
        </>
      )}
    </div>
  );
}
