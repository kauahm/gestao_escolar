import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileNav from './MobileNav';

export default function DashboardLayout() {
  // Estado que controla se o menu mobile está aberto ou fechado
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Passamos o controle para a Sidebar saber a hora de aparecer */}
      <Sidebar isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      
      {/* Passamos a função de abrir para a Topbar usar no botão de 3 riscos */}
      <Topbar onMenuClick={() => setIsMobileMenuOpen(true)} />
      
      <main className="flex-1 md:ml-64 pt-20 pb-20 md:pb-6 overflow-y-auto p-4 md:p-8">
        <Outlet />
      </main>
      
      <MobileNav />
    </div>
  );
}