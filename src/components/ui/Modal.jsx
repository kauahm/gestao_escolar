import React from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl'
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black bg-opacity-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`bg-white rounded-lg shadow-xl w-full ${sizeClasses[size]} overflow-hidden flex flex-col max-h-[90vh]`}>
        <div className="flex justify-between items-center p-4 border-b shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}