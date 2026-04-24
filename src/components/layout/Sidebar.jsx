import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import logoImg from '../../assets/logo-topo.png'; 
import { 
  LayoutDashboard, School, Wrench, Receipt, RefreshCcw, 
  Users, Calendar, UserCog, LogOut, FileText, X
} from 'lucide-react';

export default function Sidebar({ isMobileMenuOpen, setIsMobileMenuOpen }) {
  const { userProfile, logout } = useAuth();
  
  const isAdmin = userProfile?.perfil === 'admin';
  const isAdministrativo = userProfile?.perfil === 'administrativo';

  const adminLinks = [
    { to: '/admin/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { to: '/admin/escolas', icon: <School size={20} />, label: 'Escolas' },
    { to: '/admin/manutencoes', icon: <Wrench size={20} />, label: 'Manutenções' },
    { to: '/admin/contas', icon: <Receipt size={20} />, label: 'Contas a Pagar' },
    { to: '/admin/ciclos', icon: <RefreshCcw size={20} />, label: 'Ciclos' },
    { to: '/admin/talentos', icon: <FileText size={20} />, label: 'Banco de Talentos' },
    { to: '/admin/selecao', icon: <Users size={20} />, label: 'Processo Seletivo' },
    { to: '/admin/agenda', icon: <Calendar size={20} />, label: 'Agenda' },
    { to: '/admin/usuarios', icon: <UserCog size={20} />, label: 'Usuários' },
  ];

  const administrativoLinks = [
    { to: '/admin/talentos', icon: <FileText size={20} />, label: 'Banco de Talentos' },
    { to: '/admin/selecao', icon: <Users size={20} />, label: 'Processo Seletivo' },
  ];

  const diretoraLinks = [
    { to: '/diretora/dashboard', icon: <LayoutDashboard size={20} />, label: 'Início' },
    { to: '/diretora/manutencoes', icon: <Wrench size={20} />, label: 'Solicitar Manutenção' },
  ];

  let links = [];
  if (isAdmin) links = adminLinks;
  else if (isAdministrativo) links = administrativoLinks;
  else links = diretoraLinks;

  return (
    <>
      {/* OVERLAY ESCURO (Apenas Mobile): Fica atrás do menu e fecha se clicar fora */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed top-0 left-0 h-screen w-64 bg-primary text-white z-50 flex flex-col transition-transform duration-300 ease-in-out
        md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        
        {/* Botão de Fechar (Apenas Mobile) */}
        <div className="absolute top-4 right-4 md:hidden">
          <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-md">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center border-b border-primary-light">
          <img src={logoImg} alt="Logo Associação" className="h-16 w-auto object-contain mb-3" />
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto pb-4">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setIsMobileMenuOpen(false)} // Fecha o menu se clicar num link
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

        <div className="p-4 border-t border-primary-light shrink-0">
          <div className="mb-4 px-4">
            <p className="text-sm font-medium">{userProfile?.nome}</p>
            <p className="text-xs text-blue-200 capitalize">{userProfile?.perfil}</p>
          </div>
          <button onClick={logout} className="flex items-center gap-3 px-4 py-2 w-full text-left text-blue-100 hover:bg-primary-light rounded-lg transition-colors">
            <LogOut size={20} /> Sair
          </button>
        </div>
      </aside>
    </>
  );
}