'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getFileName } from '@/lib/utils';

interface Page {
  name: string;
  path: string;
  type: 'json' | 'html';
}

interface SidebarProps {
  pages: Page[];
  currentPage: string | null;
  onSelectPage: (page: Page) => void;
  isLoading: boolean;
}

export default function Sidebar({ pages, currentPage, onSelectPage, isLoading }: SidebarProps) {
  const jsonPages = pages.filter((p) => p.type === 'json').sort((a, b) => a.name.localeCompare(b.name));
  const htmlPages = pages.filter((p) => p.type === 'html').sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="w-64 bg-gray-900 text-white p-4 overflow-y-auto border-r border-gray-800 h-screen sticky top-0">
      <h2 className="text-lg font-bold mb-6">Pages</h2>

      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading pages...</div>
      ) : (
        <>
          {jsonPages.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                JSON Pages
              </h3>
              <ul className="space-y-1">
                {jsonPages.map((page) => (
                  <li key={page.path}>
                    <button
                      onClick={() => onSelectPage(page)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${
                        currentPage === page.path
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <span className="truncate">{getFileName(page.path)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {htmlPages.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                HTML Pages
              </h3>
              <ul className="space-y-1">
                {htmlPages.map((page) => (
                  <li key={page.path}>
                    <button
                      onClick={() => onSelectPage(page)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${
                        currentPage === page.path
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <span className="truncate">{getFileName(page.path)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pages.length === 0 && (
            <div className="text-gray-400 text-sm">No pages found in repository</div>
          )}
        </>
      )}
    </div>
  );
}
