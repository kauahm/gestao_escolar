import React from 'react';

// Esqueleto de carregamento: mostra o formato da lista enquanto os dados chegam,
// em vez de um círculo girando no meio da tela. Parece mais rápido e não "pula".

export function EsqueletoDeLista({ linhas = 6, compacto = false }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden" role="status" aria-live="polite">
      <span className="sr-only">Carregando...</span>
      <div className="h-11 bg-gray-50 border-b border-gray-200" />
      <ul className="divide-y divide-gray-100">
        {Array.from({ length: linhas }).map((_, i) => (
          <li key={i} className={`flex items-center gap-4 px-6 ${compacto ? 'py-3' : 'py-4'}`}>
            <div className="h-3.5 rounded bg-gray-200 animate-pulse" style={{ width: `${28 + ((i * 17) % 22)}%` }} />
            <div className="h-3.5 rounded bg-gray-100 animate-pulse flex-1" />
            <div className="h-6 w-20 rounded-full bg-gray-100 animate-pulse hidden sm:block" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EsqueletoDeCartoes({ quantidade = 6 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" role="status" aria-live="polite">
      <span className="sr-only">Carregando...</span>
      {Array.from({ length: quantidade }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
          <div className="h-4 w-2/3 rounded bg-gray-200 animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-gray-100 animate-pulse" />
          <div className="h-3 w-3/4 rounded bg-gray-100 animate-pulse" />
        </div>
      ))}
    </div>
  );
}
