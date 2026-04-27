import React from 'react';
import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({ isOpen, onConfirm, onCancel, title, message }) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Confirmação" size="sm">
      <div className="flex flex-col items-center text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h4 className="text-lg font-semibold text-gray-900 mb-2">{title}</h4>
        <p className="text-gray-600 mb-6">{message}</p>
        
        <div className="flex w-full gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none"
          >
            Confirmar
          </button>
        </div>
      </div>
    </Modal>
  );
}