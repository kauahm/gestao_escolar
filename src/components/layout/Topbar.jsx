import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UserCircle, Menu } from 'lucide-react'; 

export default function Topbar({ onMenuClick }) {
  const location = useLocation();
  const { userProfile } = useAuth();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('dashboard')) return 'Dashboard';
    if (path.includes('escolas')) return 'Gestão de Escolas';
    if (path.includes('manutencoes')) return 'Manutenções';
    if (path.includes('contas')) return 'Contas a Pagar';
    if (path.includes('ciclos')) return 'Ciclos Periódicos';
    if (path.includes('selecao')) return 'Processo Seletivo';
    if (path.includes('agenda')) return 'Agenda Escolar';
    if (path.includes('usuarios')) return 'Gestão de Usuários';
    if (path.includes('talentos')) return 'Banco de Talentos';
    return 'Sistema de Gestão';
  };

  return (
    <header className="bg-white shadow-sm h-16 flex items-center justify-between px-4 md:px-6 md:ml-64 w-full md:w-[calc(100%-16rem)] fixed top-0 z-10">
      
      <div className="flex items-center gap-3">
        {/* BOTÃO DOS 3 RISCOS (SÓ APARECE NO CELULAR) */}
        <button 
          onClick={onMenuClick} 
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg md:hidden transition-colors"
          aria-label="Abrir menu"
        >
          <Menu size={24} />
        </button>

        <h2 className="text-lg md:text-xl font-semibold text-gray-800 truncate">
          {getPageTitle()}
        </h2>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-gray-900">{userProfile?.nome}</p>
          <p className="text-xs text-gray-500 capitalize">{userProfile?.perfil}</p>
        </div>
        <UserCircle className="w-8 h-8 text-gray-400" />
      </div>
    </header>
  );
}