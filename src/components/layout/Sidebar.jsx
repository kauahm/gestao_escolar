import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
// Importe a imagem do logo aqui
import logoImg from '../../assets/logo-topo.png'; 
import { 
  LayoutDashboard, 
  School, 
  Wrench, 
  Receipt, 
  RefreshCcw, 
  Users, 
  Calendar, 
  UserCog, 
  LogOut 
} from 'lucide-react';

export default function Sidebar() {
  const { userProfile, logout } = useAuth();
  const isAdmin = userProfile?.perfil === 'admin';

  const adminLinks = [
    { to: '/admin/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { to: '/admin/escolas', icon: <School size={20} />, label: 'Escolas' },
    { to: '/admin/manutencoes', icon: <Wrench size={20} />, label: 'Manutenções' },
    { to: '/admin/contas', icon: <Receipt size={20} />, label: 'Contas a Pagar' },
    { to: '/admin/ciclos', icon: <RefreshCcw size={20} />, label: 'Ciclos' },
    { to: '/admin/selecao', icon: <Users size={20} />, label: 'Processo Seletivo' },
    { to: '/admin/agenda', icon: <Calendar size={20} />, label: 'Agenda' },
    { to: '/admin/usuarios', icon: <UserCog size={20} />, label: 'Usuários' },
  ];

  const diretoraLinks = [
    { to: '/diretora/dashboard', icon: <LayoutDashboard size={20} />, label: 'Início' },
    { to: '/diretora/manutencoes', icon: <Wrench size={20} />, label: 'Solicitar Manutenção' },
  ];

  const links = isAdmin ? adminLinks : diretoraLinks;

  return (
    <aside className="hidden md:flex flex-col w-64 bg-primary text-white h-screen fixed">
      
      {/* SEÇÃO DO LOGO ATUALIZADA - Sem bordas redondas */}
      <div className="p-6 flex flex-col items-center border-b border-primary-light">
        <img 
          src={logoImg} 
          alt="Logo Associação" 
          className="h-16 w-auto object-contain mb-3" 
        />
        
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive ? 'bg-primary-dark text-white font-semibold' : 'text-blue-100 hover:bg-primary-light'
              }`
            }
          >
            {link.icon}
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-primary-light">
        <div className="mb-4 px-4">
          <p className="text-sm font-medium">{userProfile?.nome}</p>
          <p className="text-xs text-blue-200 capitalize">{userProfile?.perfil}</p>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-2 w-full text-left text-blue-100 hover:bg-primary-light rounded-lg transition-colors"
        >
          <LogOut size={20} />
          Sair
        </button>
      </div>
    </aside>
  );
}