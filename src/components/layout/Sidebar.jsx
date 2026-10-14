import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import logoImg from '../../assets/logo-topo.png'; 
import { TELAS, ROTULO_DO_PERFIL } from '../../config/telas';
import { useAlertas } from '../../contexts/AlertasContext';
import { 
  LayoutDashboard, School, Wrench, Receipt, RefreshCcw, 
  Users, Calendar, UserCog, LogOut, FileText, X, Briefcase, ShieldCheck, Contact 
} from 'lucide-react';

export default function Sidebar({ isMobileMenuOpen, setIsMobileMenuOpen }) {
  const { userProfile, logout } = useAuth();
  const { pendencias } = useAlertas();
  
  const isAdmin = userProfile?.perfil === 'admin';
  const isAdministrativo = userProfile?.perfil === 'administrativo';

  const adminLinks = [
    { to: '/admin/dashboard', icon: <LayoutDashboard size={20} />, label: TELAS['/admin/dashboard'] },
    { to: '/admin/escolas', icon: <School size={20} />, label: TELAS['/admin/escolas'] },
    { to: '/admin/manutencoes', icon: <Wrench size={20} />, label: TELAS['/admin/manutencoes'] },
    { to: '/admin/prestadores', icon: <Briefcase size={20} />, label: TELAS['/admin/prestadores'] },
    { to: '/admin/contas', icon: <Receipt size={20} />, label: TELAS['/admin/contas'] },
    { to: '/admin/ciclos', icon: <RefreshCcw size={20} />, label: TELAS['/admin/ciclos'] },
    { to: '/admin/funcionarios', icon: <Contact size={20} />, label: TELAS['/admin/funcionarios'] },
    { to: '/admin/talentos', icon: <FileText size={20} />, label: TELAS['/admin/talentos'] },
    { to: '/admin/selecao', icon: <Users size={20} />, label: TELAS['/admin/selecao'] },
    { to: '/admin/agenda', icon: <Calendar size={20} />, label: TELAS['/admin/agenda'] },
    { to: '/admin/usuarios', icon: <UserCog size={20} />, label: TELAS['/admin/usuarios'] },
    { to: '/admin/seguranca', icon: <ShieldCheck size={20} />, label: TELAS['/admin/seguranca'] },
  ];

  const administrativoLinks = [
    { to: '/admin/funcionarios', icon: <Contact size={20} />, label: TELAS['/admin/funcionarios'] },
    { to: '/admin/talentos', icon: <FileText size={20} />, label: TELAS['/admin/talentos'] },
    { to: '/admin/selecao', icon: <Users size={20} />, label: TELAS['/admin/selecao'] },
  ];

  const diretoraLinks = [
    { to: '/diretora/dashboard', icon: <LayoutDashboard size={20} />, label: TELAS['/diretora/dashboard'] },
    { to: '/diretora/manutencoes', icon: <Wrench size={20} />, label: TELAS['/diretora/manutencoes'] },
  ];

  let links = [];
  if (isAdmin) links = adminLinks;
  else if (isAdministrativo) links = administrativoLinks;
  else links = diretoraLinks;

  return (
    <>
      {/* OVERLAY ESCURO (Mobile) */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[60] md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR - Ajustada com Z-index alto para ficar sempre visível */}
      <aside className={`
        fixed top-0 left-0 h-screen w-64 bg-primary text-white z-[70] flex flex-col transition-transform duration-300 ease-in-out
        md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        
        {/* Botão de Fechar (Mobile) */}
        <div className="absolute top-4 right-4 md:hidden">
          <button onClick={() => setIsMobileMenuOpen(false)} aria-label="Fechar o menu" className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-md">
            <X size={24} />
          </button>
        </div>

        {/* CONTAINER DA LOGO - Com padding e fundo garantido */}
        <div className="p-6 flex flex-col items-center border-b border-primary-light bg-primary">
          <img 
            src={logoImg} 
            alt="Associação Educacional Maria do Carmo" 
            className="h-16 w-auto object-contain mb-3 brightness-110" 
          />
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto pb-4 custom-scrollbar" aria-label="Menu principal">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                  isActive ? 'bg-primary-dark text-white font-semibold' : 'text-blue-100 hover:bg-primary-light'
                }`
              }
            >
              {link.icon}
              {link.label}
              {link.to === '/admin/dashboard' && pendencias > 0 && (
                <span className="ml-auto min-w-6 h-6 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center" aria-label={`${pendencias} pendências`}>
                  {pendencias}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-primary-light shrink-0 bg-primary-dark/30">
          <div className="mb-4 px-4">
            <p className="text-sm font-medium">{userProfile?.nome}</p>
            <p className="text-[10px] text-blue-200 uppercase tracking-widest">{ROTULO_DO_PERFIL[userProfile?.perfil] || ''}</p>
          </div>
          <button onClick={logout} className="flex items-center gap-3 px-4 py-2 w-full text-left text-blue-100 hover:bg-primary-light rounded-lg transition-colors">
            <LogOut size={20} /> Sair
          </button>
        </div>
      </aside>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}} />
    </>
  );
}