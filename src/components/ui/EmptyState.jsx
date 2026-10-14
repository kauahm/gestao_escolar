import React from 'react';
import { FolderOpen, CloudOff } from 'lucide-react';
import { useEstadoDasLeituras } from '../../hooks/useEstadoDasLeituras';

/**
 * Lista vazia que explica o próximo passo.
 *
 * Uso:
 *   <EmptyState
 *     titulo="Nenhuma escola cadastrada"
 *     mensagem="Cadastre a primeira escola ou traga a lista do Excel."
 *     acoes={[{ rotulo: 'Nova escola', onClick: abrir }, { rotulo: 'Importar planilha', onClick: importar }]}
 *   />
 *
 * A primeira ação é a principal (botão cheio); as outras ficam em contorno.
 * Para "nenhum resultado com estes filtros", passe uma ação "Limpar filtros".
 * (message/actionLabel/onAction continuam aceitos, do jeito antigo.)
 */
export default function EmptyState({
  titulo, mensagem, acoes, icone: Icone = FolderOpen, compacto = false,
  message, actionLabel, onAction,
}) {
  const leituras = useEstadoDasLeituras();

  // Lista vazia porque os dados não chegaram NÃO é "nada cadastrado".
  if (leituras.falha || leituras.semServidor) {
    return (
      <div className={`flex flex-col items-center justify-center text-center bg-white rounded-lg border border-dashed border-gray-300 ${compacto ? 'p-8' : 'p-12'}`}>
        <CloudOff className="w-12 h-12 text-gray-500 mb-4" aria-hidden="true" />
        <p className="text-gray-900 font-semibold">Os dados não carregaram</p>
        <p className="text-gray-600 max-w-md mt-1 text-sm">Por isso esta lista está vazia. Nada foi apagado: veja o aviso no alto da tela.</p>
      </div>
    );
  }

  const lista = acoes || (actionLabel && onAction ? [{ rotulo: actionLabel, onClick: onAction }] : []);
  const texto = mensagem ?? (titulo ? null : message);

  return (
    <div className={`flex flex-col items-center justify-center text-center bg-white rounded-lg border border-dashed border-gray-300 ${compacto ? 'p-8' : 'p-12'}`}>
      <Icone className="w-12 h-12 text-gray-500 mb-4" aria-hidden="true" />
      {titulo && <p className="text-gray-900 font-semibold">{titulo}</p>}
      {texto && <p className={`text-gray-600 max-w-md ${titulo ? 'mt-1 text-sm' : 'font-medium'}`}>{texto}</p>}
      {lista.length > 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {lista.map(({ rotulo, onClick, icone: IconeDoBotao }, i) => (
            <button
              key={rotulo}
              type="button"
              onClick={onClick}
              className={i === 0
                ? 'px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2'
                : 'px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2'}
            >
              {IconeDoBotao && <IconeDoBotao size={16} />}
              {rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
