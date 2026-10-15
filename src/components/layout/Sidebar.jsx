import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import logoImg from '../../assets/logo-topo.png';
import { TELAS, ROTULO_DO_PERFIL } from '../../config/telas';
import { useAlertas } from '../../contexts/AlertasContext';
import {
  LayoutDashboard, School, Wrench, Receipt, RefreshCcw,
  Users, Calendar, UserCog, LogOut, FileText, X, Briefcase, ShieldCheck, Contact, Wallet, Landmark,
  ChevronDown, Building2, Banknote, UsersRound, Settings,
} from 'lucide-react';

// Menu da administração em grupos de telas parecidas. Um grupo abre ao
// clicar; o grupo da tela aberta já vem aberto; quais grupos ficam abertos é
// lembrado neste navegador. Item avulso (Painel, Agenda) é um link direto.
const link = (to, Icone) => ({ to, icon: <Icone size={18} />, label: TELAS[to] });

const MENU_ADMIN = [
  link('/admin/dashboard', LayoutDashboard),
  {
    id: 'escolas', label: 'Unidades', icon: <Building2 size={20} />,
    itens: [link('/admin/escolas', School), link('/admin/manutencoes', Wrench), link('/admin/ciclos', RefreshCcw), link('/admin/prestadores', Briefcase)],
  },
  {
    id: 'financeiro', label: 'Financeiro', icon: <Banknote size={20} />,
    itens: [link('/admin/contas', Receipt), link('/admin/saldo', Wallet)],
  },
  {
    id: 'pessoas', label: 'Pessoas', icon: <UsersRound size={20} />,
    itens: [link('/admin/funcionarios', Contact), link('/admin/talentos', FileText), link('/admin/selecao', Users)],
  },
  link('/admin/agenda', Calendar),
  {
    id: 'sistema', label: 'Sistema', icon: <Settings size={20} />,
    itens: [link('/admin/usuarios', UserCog), link('/admin/seguranca', ShieldCheck)],
  },
];

// RH e diretora têm poucas telas: menu direto, sem grupos.
const MENU_RH = [link('/admin/funcionarios', Contact), link('/admin/talentos', FileText), link('/admin/selecao', Users)];
const MENU_DIRETORA = [link('/diretora/dashboard', LayoutDashboard), link('/diretora/manutencoes', Wrench)];
const MENU_SEDE = [link('/admin/sede', Landmark)];

const CHAVE_GRUPOS = 'gestaoEscolar.menuAberto';
const lerAbertos = () => {
  try { return JSON.parse(localStorage.getItem(CHAVE_GRUPOS)) || {}; } catch { return {}; }
};

const estiloDoLink = (sub) => ({ isActive }) =>
  `flex items-center gap-3 ${sub ? 'pl-11 pr-4 py-2 text-sm' : 'px-4 py-2.5'} rounded-lg transition-colors ${
    isActive ? 'bg-primary-dark text-white font-semibold' : 'text-blue-100 hover:bg-primary-light'
  }`;

export default function Sidebar({ isMobileMenuOpen, setIsMobileMenuOpen }) {
  const { userProfile, logout, ehSede, municipioAtivo, municipio } = useAuth();
  const { pendencias } = useAlertas();
  const { pathname } = useLocation();
  const [abertos, setAbertos] = useState(lerAbertos);

  const perfil = userProfile?.perfil;
  // Dentro de um município, a sede tem o mesmo menu da administração; para voltar
  // à lista de municípios usa o botão "Trocar" no topo.
  let menu = MENU_DIRETORA;
  if (ehSede) menu = municipioAtivo ? MENU_ADMIN : MENU_SEDE;
  else if (perfil === 'admin') menu = MENU_ADMIN;
  else if (perfil === 'administrativo') menu = MENU_RH;

  const contem = (grupo) => grupo.itens.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`));

  // Ao chegar numa tela, o grupo dela abre (sem fechar os outros).
  useEffect(() => {
    const grupo = menu.find((g) => g.itens && contem(g));
    if (grupo && !abertos[grupo.id]) setAbertos((a) => ({ ...a, [grupo.id]: true }));
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try { localStorage.setItem(CHAVE_GRUPOS, JSON.stringify(abertos)); } catch { /* sem armazenamento: só não lembra */ }
  }, [abertos]);

  const alternar = (id) => setAbertos((a) => ({ ...a, [id]: !a[id] }));
  const fecharNoCelular = () => setIsMobileMenuOpen(false);

  const Item = ({ item, sub }) => (
    <NavLink to={item.to} onClick={fecharNoCelular} className={estiloDoLink(sub)}>
      {sub ? item.icon : React.cloneElement(item.icon, { size: 20 })}
      <span className="truncate">{item.label}</span>
      {item.to === '/admin/dashboard' && pendencias > 0 && (
        <span className="ml-auto min-w-6 h-6 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center" aria-label={`${pendencias} pendências`}>
          {pendencias}
        </span>
      )}
    </NavLink>
  );

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
          {menu.map((entrada) => {
            if (!entrada.itens) return <Item key={entrada.to} item={entrada} />;
            const aberto = !!abertos[entrada.id];
            const ativo = contem(entrada);
            const idLista = `menu-${entrada.id}`;
            return (
              <div key={entrada.id}>
                <button
                  type="button"
                  onClick={() => alternar(entrada.id)}
                  aria-expanded={aberto}
                  aria-controls={idLista}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-left ${
                    ativo && !aberto ? 'bg-primary-dark text-white font-semibold' : 'text-blue-100 hover:bg-primary-light'
                  }`}
                >
                  {entrada.icon}
                  <span className="flex-1 leading-tight">{entrada.label}</span>
                  <ChevronDown size={16} aria-hidden="true" className={`shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                </button>
                <div id={idLista} hidden={!aberto} className="mt-1 space-y-0.5">
                  {entrada.itens.map((item) => <Item key={item.to} item={item} sub />)}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-primary-light shrink-0 bg-primary-dark/30">
          <div className="mb-4 px-4">
            <p className="text-sm font-medium">{userProfile?.nome}</p>
            <p className="text-[10px] text-blue-200 uppercase tracking-widest">{ROTULO_DO_PERFIL[userProfile?.perfil] || ''}</p>
            {municipio?.nome && <p className="text-xs text-blue-100 mt-0.5">{municipio.nome}{municipio.uf ? ` · ${municipio.uf}` : ''}</p>}
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
