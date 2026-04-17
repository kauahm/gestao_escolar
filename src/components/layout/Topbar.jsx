import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UserCircle } from 'lucide-react';

export default function TopBar() {
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
    return 'Sistema de Gestão';
  };

  return (
    <header className="bg-white shadow-sm h-16 flex items-center justify-between px-6 md:ml-64 w-full md:w-[calc(100%-16rem)] fixed top-0 z-10">
      <h2 className="text-xl font-semibold text-gray-800">{getPageTitle()}</h2>
      
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