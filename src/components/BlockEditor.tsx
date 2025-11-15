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

interface BlockEditorProps {
  data: any;
  onChange: (data: any) => void;
}

const SortableBlock: React.FC<{
  id: string;
  data: any;
  onUpdate: (updatedData: any) => void;
  onDelete: () => void;
}> = ({ id, data, onUpdate, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-gray-200 rounded-lg p-4 mb-4 hover:border-gray-300 transition-colors"
    >
      <div className="flex items-start gap-3">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing mt-1 text-gray-400 hover:text-gray-600"
        >
          <span className="text-xl">⋮</span>
        </button>

        <div className="flex-1">
          <FieldEditor data={data} onChange={onUpdate} />
        </div>

        <button
          onClick={onDelete}
          className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

const FieldEditor: React.FC<{
  data: any;
  onChange: (data: any) => void;
}> = ({ data, onChange }) => {
  const entries = Object.entries(data);

  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => (
        <div key={key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {key}
          </label>
          <FieldInput
            value={value}
            onChange={(newValue) => {
              onChange({ ...data, [key]: newValue });
            }}
          />
        </div>
      ))}
    </div>
  );
};

const FieldInput: React.FC<{
  value: any;
  onChange: (value: any) => void;
}> = ({ value, onChange }) => {
  if (typeof value === 'string') {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
      />
    );
  }

  if (typeof value === 'number') {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
      />
    );
  }

  if (typeof value === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded"
      />
    );
  }

  if (Array.isArray(value)) {
    return (
      <div className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded">
        Array with {value.length} items
      </div>
    );
  }

  if (typeof value === 'object' && value !== null) {
    return (
      <details className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
        <summary className="cursor-pointer font-medium">View nested object</summary>
        <pre className="mt-2 p-2 bg-white border border-gray-200 rounded text-xs overflow-auto">
          {JSON.stringify(value, null, 2)}
        </pre>
      </details>
    );
  }

  return (
    <input
      type="text"
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
    />
  );
};

export default function BlockEditor({ data, onChange }: BlockEditorProps) {
  const [blocks, setBlocks] = useState<any[]>(Array.isArray(data) ? data : [data]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newBlocks = [...blocks];
        [newBlocks[oldIndex], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[oldIndex]];
        setBlocks(newBlocks);
        onChange(newBlocks);
      }
    }
  };

  const addBlock = () => {
    const sampleBlock = blocks[0] ? JSON.parse(JSON.stringify(blocks[0])) : {};
    Object.keys(sampleBlock).forEach((key) => {
      if (typeof sampleBlock[key] === 'string') {
        sampleBlock[key] = '';
      } else if (typeof sampleBlock[key] === 'number') {
        sampleBlock[key] = 0;
      } else if (typeof sampleBlock[key] === 'boolean') {
        sampleBlock[key] = false;
      }
    });
    sampleBlock.id = Math.random().toString(36).substr(2, 9);
    const newBlocks = [...blocks, sampleBlock];
    setBlocks(newBlocks);
    onChange(newBlocks);
  };

  const deleteBlock = (index: number) => {
    const newBlocks = blocks.filter((_, i) => i !== index);
    setBlocks(newBlocks);
    onChange(newBlocks);
  };

  const updateBlock = (index: number, updatedBlock: any) => {
    const newBlocks = [...blocks];
    newBlocks[index] = updatedBlock;
    setBlocks(newBlocks);
    onChange(newBlocks);
  };

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={blocks.map((_, i) => `block-${i}`)}
          strategy={verticalListSortingStrategy}
        >
          {blocks.map((block, index) => (
            <SortableBlock
              key={`block-${index}`}
              id={`block-${index}`}
              data={block}
              onUpdate={(updated) => updateBlock(index, updated)}
              onDelete={() => deleteBlock(index)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        onClick={addBlock}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
      >
        <PlusIcon className="w-5 h-5" />
        Add Block
      </button>
    </div>
  );
}
