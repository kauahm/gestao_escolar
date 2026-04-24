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
    // Removido o fixed daqui para o Layout controlar o fluxo, 
    // ou mantido com as larguras dinâmicas corrigidas:
    <header className="bg-white shadow-sm h-16 flex items-center justify-between px-4 md:px-8 border-b border-gray-200 z-20">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick} 
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg md:hidden transition-colors"
        >
          <Menu size={24} />
        </button>

        <h2 className="text-lg md:text-xl font-bold text-gray-800">
          {getPageTitle()}
        </h2>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-bold text-gray-900">{userProfile?.nome}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">{userProfile?.perfil}</p>
        </div>
        <UserCircle className="w-9 h-9 text-gray-400" />
      </div>
    </header>
  );
}