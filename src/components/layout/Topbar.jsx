import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UserCircle, Menu, ChevronRight, ArrowLeftRight } from 'lucide-react';
import { NOME_DO_SISTEMA, nomeDaTela, ROTULO_DO_PERFIL } from '../../config/telas';

export default function Topbar({ onMenuClick }) {
  const location = useLocation();
  const { userProfile, ehSede, municipio, escolherMunicipio } = useAuth();
  const navigate = useNavigate();
  const trocarDeMunicipio = () => {
    escolherMunicipio(null);
    navigate('/admin/sede');
  };

  // A barra mostra onde a pessoa está ("Gestão Escolar › Escolas"); o título
  // grande fica só dentro da página, para não repetir com outro nome.
  const tela = nomeDaTela(location.pathname);

  return (
    <header className="bg-white shadow-sm h-16 flex items-center justify-between px-6 md:ml-64 w-full md:w-[calc(100%-16rem)] fixed top-0 z-10 border-b border-gray-100">
      <div className="flex items-center gap-3">
        {/* Botão de Menu visível apenas no mobile */}
        <button 
          onClick={onMenuClick} 
          aria-label="Abrir o menu"
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg md:hidden transition-colors"
        >
          <Menu size={24} />
        </button>

        <nav aria-label="Você está em" className="flex items-center gap-1.5 text-sm text-gray-500 min-w-0">
          {/* Dentro de um município, ele aparece no lugar do nome do sistema. */}
          <span className="hidden sm:inline">{municipio?.nome || NOME_DO_SISTEMA}</span>
          {tela && <ChevronRight size={16} className="hidden sm:inline shrink-0" />}
          {tela && <span className="font-medium text-gray-800 truncate" aria-current="page">{tela}</span>}
        </nav>
      </div>
      
      <div className="flex items-center gap-3">
        {ehSede && municipio && (
          <button type="button" onClick={trocarDeMunicipio} className="flex items-center gap-1.5 text-sm font-medium text-primary border border-primary/30 hover:bg-primary/5 rounded-lg px-3 py-1.5" title="Voltar à lista de municípios">
            <ArrowLeftRight size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{municipio.nome} ·</span> Trocar
          </button>
        )}
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-gray-900">{userProfile?.nome}</p>
          <p className="text-xs text-gray-500">{ROTULO_DO_PERFIL[userProfile?.perfil] || ''}</p>
        </div>
        <UserCircle className="w-8 h-8 text-gray-500" />
      </div>
    </header>
  );
}