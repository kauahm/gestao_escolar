import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, X, AlertCircle } from 'lucide-react';

export default function CurriculoUpload({ 
  onFileSelect, 
  onRemove, 
  arquivoAtualNome, 
  arquivoAtualUrl,
  uploadProgress 
}) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateAndSelectFile = (file) => {
    setError('');
    
    if (!file) return;

    // Validação de tipo
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setError('Formato inválido. Aceitamos apenas PDF, JPG ou PNG.');
      return;
    }

    // Validação de tamanho (5MB max)
    const maxSize = 5 * 1024 * 1024; 
    if (file.size > maxSize) {
      setError('O arquivo é muito grande. O limite máximo é de 5MB.');
      return;
    }

    setSelectedFileName(file.name);
    onFileSelect(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSelectFile(e.target.files[0]);
    }
  };

  const handleRemoveClick = () => {
    setSelectedFileName('');
    setError('');
    if (inputRef.current) inputRef.current.value = '';
    onRemove();
  };

  // Estado 1: Fazendo Upload (Progresso)
  if (uploadProgress !== null && uploadProgress !== undefined && uploadProgress >= 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <UploadCloud size={18} className="text-primary" /> 
            Enviando arquivo...
          </span>
          <span className="text-sm font-bold text-primary">{Math.round(uploadProgress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
        </div>
      </div>
    );
  }

  // Estado 2: Arquivo já existe no Firestore ou acabou de ser selecionado
  if (arquivoAtualNome || selectedFileName) {
    const isNovo = !!selectedFileName;
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-blue-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="bg-blue-100 p-2 rounded-lg text-blue-600 shrink-0">
            <FileText size={20} />
          </div>
          <div className="truncate">
            <p className="text-sm font-medium text-gray-900 truncate" title={selectedFileName || arquivoAtualNome}>
              {selectedFileName || arquivoAtualNome}
            </p>
            <p className="text-xs text-gray-500">
              {isNovo ? 'Pronto para envio' : 'Salvo no sistema'}
              {!isNovo && arquivoAtualUrl && (
                <span> · <a href={arquivoAtualUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Ver arquivo</a></span>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRemoveClick}
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
          title="Remover arquivo"
        >
          <X size={20} />
        </button>
      </div>
    );
  }

  // Estado 3: Aguardando seleção (Drag & Drop)
  return (
    <div>
      <div 
        className={`relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer
          ${dragActive ? 'border-primary bg-blue-50' : 'border-gray-300 hover:bg-gray-50 bg-white'}
          ${error ? 'border-red-300 bg-red-50' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input 
          ref={inputRef}
          type="file" 
          className="hidden" 
          accept=".pdf, .jpg, .jpeg, .png" 
          onChange={handleChange} 
        />
        <UploadCloud className={`w-10 h-10 mb-3 ${error ? 'text-red-400' : 'text-gray-400'}`} />
        <p className="text-sm font-medium text-gray-900 mb-1">
          Clique ou arraste um arquivo
        </p>
        <p className="text-xs text-gray-500">
          PDF, PNG, JPG (Max. 5MB)
        </p>
      </div>
      {error && (
        <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
          <AlertCircle size={14} /> {error}
        </p>
      )}
    </div>
  );
}