'use client';

import React, { useState } from 'react';
import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';

interface Props {
  data: any;
  onChange: (data: any) => void;
}

// TODO: extract this somewhere
const BlockItem: React.FC<{
  id: string;
  item: any;
  onUpdate: (data: any) => void;
  onRemove: () => void;
}> = ({ id, item, onUpdate, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-gray-200 rounded-lg p-4 mb-4 hover:border-gray-300 transition-colors"
    >
      <div className="flex items-start gap-3">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing mt-1 text-gray-400 hover:text-gray-600">
          <span className="text-xl">⋮</span>
        </button>
        <div className="flex-1">
          <Fields data={item} onChange={onUpdate} />
        </div>
        <button onClick={onRemove} className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50">
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// renders fields based on type
const Fields: React.FC<{ data: any; onChange: (d: any) => void }> = ({ data, onChange }) => {
  return (
    <div className="space-y-3">
      {Object.entries(data).map(([key, val]) => (
        <div key={key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{key}</label>
          <Input value={val} onChange={(v) => onChange({ ...data, [key]: v })} />
        </div>
      ))}
    </div>
  );
};

// lol this is kinda messy but it works
const Input: React.FC<{ value: any; onChange: (v: any) => void }> = ({ value, onChange }) => {
  if (typeof value === 'string')
    return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm" />;

  if (typeof value === 'number')
    return <input type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm" />;

  if (typeof value === 'boolean')
    return <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="rounded" />;

  if (Array.isArray(value))
    return <div className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded">arr: {value.length} items</div>;

  if (typeof value === 'object' && value !== null)
    return (
      <details className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
        <summary className="cursor-pointer font-medium">view</summary>
        <pre className="mt-2 p-2 bg-white border border-gray-200 rounded text-xs overflow-auto">{JSON.stringify(value, null, 2)}</pre>
      </details>
    );

  return <input type="text" value={String(value)} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm" />;
};

export default function BlockEditor({ data, onChange }: BlockEditorProps) {
  const [items, setItems] = useState<any[]>(Array.isArray(data) ? data : [data]);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const i1 = items.findIndex((b) => b.id === active.id);
    const i2 = items.findIndex((b) => b.id === over.id);

    if (i1 !== -1 && i2 !== -1) {
      const next = [...items];
      [next[i1], next[i2]] = [next[i2], next[i1]];
      setItems(next);
      onChange(next);
    }
  };

  const addBlock = () => {
    const tpl = items[0] ? JSON.parse(JSON.stringify(items[0])) : {};
    Object.keys(tpl).forEach((k) => {
      if (typeof tpl[k] === 'string') tpl[k] = '';
      if (typeof tpl[k] === 'number') tpl[k] = 0;
      if (typeof tpl[k] === 'boolean') tpl[k] = false;
    });
    tpl.id = Math.random().toString(36).substr(2, 9);
    const next = [...items, tpl];
    setItems(next);
    onChange(next);
  };

  const removeBlock = (i: number) => {
    const next = items.filter((_, idx) => idx !== i);
    setItems(next);
    onChange(next);
  };

  const updateBlock = (i: number, val: any) => {
    const next = [...items];
    next[i] = val;
    setItems(next);
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((_, i) => `b-${i}`)} strategy={verticalListSortingStrategy}>
          {items.map((item, i) => (
            <BlockItem key={`b-${i}`} id={`b-${i}`} item={item} onUpdate={(v) => updateBlock(i, v)} onRemove={() => removeBlock(i)} />
          ))}
        </SortableContext>
      </DndContext>

      <button onClick={addBlock} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
        <PlusIcon className="w-5 h-5" />
        add block
      </button>
    </div>
  );
}
