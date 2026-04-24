import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function DashboardLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar fixa na lateral - NÃO MEXER NA ESTRUTURA DELA */}
      <Sidebar isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      
      {/* Área de conteúdo que precisa respeitar a Sidebar e a Topbar */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setIsMobileMenuOpen(true)} />
        
        {/* pt-16 (64px) é a altura exata da Topbar. Isso impede a sobreposição */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-20 md:pt-24 md:ml-64">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}