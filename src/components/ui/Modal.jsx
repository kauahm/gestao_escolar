import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl'
  };

  return createPortal(
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} className={`bg-white rounded-lg shadow-xl w-full ${sizeClasses[size]} overflow-hidden flex flex-col max-h-[90vh]`}>
        <div className="flex justify-between items-center p-4 border-b shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}