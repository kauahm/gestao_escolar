import React, { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, ListChecks, Plus } from 'lucide-react';

// Barra de navegação inferior no celular, para a diretora: Início, o botão
// grande de pedir manutenção e Meus chamados. Fica ao alcance do polegar.

const item = ({ isActive }) =>
  `flex flex-col items-center justify-center gap-1 min-w-[4.5rem] py-1 rounded-lg ${isActive ? 'text-primary font-semibold' : 'text-gray-500'}`;

export default function MobileNav() {
  const navigate = useNavigate();

  // Avisa o resto da tela (ex.: o selo de demonstração) que há uma barra embaixo.
  useEffect(() => {
    document.body.classList.add('com-barra-inferior');
    return () => document.body.classList.remove('com-barra-inferior');
  }, []);

  return (
    <nav
      aria-label="Navegação principal"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 flex items-end justify-around px-4 pt-2 pb-safe print:hidden"
    >
      <NavLink to="/diretora/dashboard" className={item}>
        <Home size={22} aria-hidden="true" />
        <span className="text-[11px]">Início</span>
      </NavLink>

      <button
        type="button"
        onClick={() => navigate('/diretora/manutencoes?nova=1')}
        className="-mt-6 flex flex-col items-center gap-1 text-primary"
      >
        <span className="h-14 w-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center ring-4 ring-white">
          <Plus size={28} aria-hidden="true" />
        </span>
        <span className="text-[11px] font-semibold">Pedir manutenção</span>
      </button>

      <NavLink to="/diretora/manutencoes" className={item}>
        <ListChecks size={22} aria-hidden="true" />
        <span className="text-[11px]">Meus chamados</span>
      </NavLink>
    </nav>
  );
}
