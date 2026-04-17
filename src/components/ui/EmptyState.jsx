import React from 'react';
import { FolderOpen } from 'lucide-react';

export default function EmptyState({ message, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-lg border border-dashed border-gray-300">
      <FolderOpen className="w-12 h-12 text-gray-400 mb-4" />
      <p className="text-gray-600 mb-4 font-medium">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 text-sm font-medium text-white bg-primary rounded hover:bg-primary-dark transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}