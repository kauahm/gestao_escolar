import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LayoutDashboard, Wrench, Menu } from 'lucide-react';

export default function MobileNav() {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.perfil === 'admin';

  return (
    <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around p-3 z-50 pb-safe">
      <NavLink
        to={isAdmin ? '/admin/dashboard' : '/diretora/dashboard'}
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 ${isActive ? 'text-primary' : 'text-gray-500'}`
        }
      >
        <LayoutDashboard size={24} />
        <span className="text-[10px]">Início</span>
      </NavLink>

      <NavLink
        to={isAdmin ? '/admin/manutencoes' : '/diretora/manutencoes'}
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 ${isActive ? 'text-primary' : 'text-gray-500'}`
        }
      >
        <Wrench size={24} />
        <span className="text-[10px]">Manutenção</span>
      </NavLink>

      {/* Menu simplificado para mobile, idealmente abriria um drawer lateral com mais opções */}
      <button className="flex flex-col items-center gap-1 text-gray-500">
        <Menu size={24} />
        <span className="text-[10px]">Mais</span>
      </button>
    </nav>
  );
}