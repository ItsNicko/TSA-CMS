'use client';

import React, { useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';

interface Props {
  content: string;
  onChange: (content: string) => void;
}

const btn = (active: boolean) => (active ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300');

export default function HTMLEditor({ content, onChange }: Props) {
  const ed = useEditor({
    extensions: [StarterKit, Image.configure({ allowBase64: true })],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // TODO: proper image dialog
  const addImg = useCallback(() => {
    const url = window.prompt('url?');
    if (url) ed?.chain().focus().setImage({ src: url }).run();
  }, [ed]);

  if (!ed) return <div>loading...</div>;

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
      <div className="bg-gray-50 border-b border-gray-300 p-3 flex gap-2 flex-wrap">
        <button onClick={() => ed.chain().focus().toggleBold().run()} disabled={!ed.can().chain().focus().toggleBold().run()} className={`px-3 py-1 rounded font-semibold ${btn(ed.isActive('bold'))}`}>
          B
        </button>
        <button onClick={() => ed.chain().focus().toggleItalic().run()} disabled={!ed.can().chain().focus().toggleItalic().run()} className={`px-3 py-1 rounded italic ${btn(ed.isActive('italic'))}`}>
          I
        </button>
        <button onClick={() => ed.chain().focus().toggleStrike().run()} disabled={!ed.can().chain().focus().toggleStrike().run()} className={`px-3 py-1 rounded line-through ${btn(ed.isActive('strike'))}`}>
          S
        </button>
        <div className="w-px bg-gray-300" />
        <button onClick={() => ed.chain().focus().toggleHeading({ level: 1 }).run()} className={`px-3 py-1 rounded font-bold text-lg ${btn(ed.isActive('heading', { level: 1 }))}`}>
          H1
        </button>
        <button onClick={() => ed.chain().focus().toggleHeading({ level: 2 }).run()} className={`px-3 py-1 rounded font-bold ${btn(ed.isActive('heading', { level: 2 }))}`}>
          H2
        </button>
        <button onClick={() => ed.chain().focus().toggleHeading({ level: 3 }).run()} className={`px-3 py-1 rounded font-bold text-sm ${btn(ed.isActive('heading', { level: 3 }))}`}>
          H3
        </button>
        <div className="w-px bg-gray-300" />
        <button onClick={() => ed.chain().focus().toggleBulletList().run()} className={`px-3 py-1 rounded ${btn(ed.isActive('bulletList'))}`}>
          •
        </button>
        <button onClick={() => ed.chain().focus().toggleOrderedList().run()} className={`px-3 py-1 rounded ${btn(ed.isActive('orderedList'))}`}>
          1.
        </button>
        <div className="w-px bg-gray-300" />
        <button onClick={addImg} className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 flex items-center gap-1">
          🖼️ img
        </button>
        <button onClick={() => ed.chain().focus().toggleCodeBlock().run()} className={`px-3 py-1 rounded font-mono text-sm ${btn(ed.isActive('codeBlock'))}`}>
          {'<>'}
        </button>
      </div>
      <EditorContent editor={ed} className="prose prose-sm max-w-none focus:outline-none p-4 min-h-96" />
    </div>
  );
}
