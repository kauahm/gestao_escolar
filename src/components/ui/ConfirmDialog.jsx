import React from 'react';
import Modal from './Modal';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

// tom="normal" para confirmações que não apagam nada (botão azul, ícone de confirmação).
export default function ConfirmDialog({ isOpen, onConfirm, onCancel, title, message, tom = 'perigo', rotuloConfirmar = 'Confirmar' }) {
  const perigo = tom === 'perigo';
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Confirmação" size="sm">
      <div className="flex flex-col items-center text-center">
        {perigo ? <AlertTriangle className="w-12 h-12 text-red-500 mb-4" /> : <CheckCircle2 className="w-12 h-12 text-primary mb-4" />}
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
            className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none ${perigo ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary-dark'}`}
          >
            {rotuloConfirmar}
          </button>
        </div>
      </div>
    </Modal>
  );
}