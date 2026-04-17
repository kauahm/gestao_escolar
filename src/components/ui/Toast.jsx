import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: 'bg-green-100 text-green-800 border-green-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-orange-100 text-orange-800 border-orange-200'
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-600" />,
    error: <XCircle className="w-5 h-5 text-red-600" />,
    warning: <AlertCircle className="w-5 h-5 text-orange-600" />
  };

  if (!message) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center p-4 border rounded shadow-lg transition-all duration-300 ${styles[type]}`}>
      <div className="mr-3">{icons[type]}</div>
      <p className="flex-1 font-medium">{message}</p>
      <button onClick={onClose} className="ml-4 text-gray-500 hover:text-gray-700">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}