import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AvisoDeConexao from '../shared/AvisoDeConexao';
import { AlertasProvider, useAlertas } from '../../contexts/AlertasContext';
import { NOME_DO_SISTEMA, nomeDaTela } from '../../config/telas';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileNav from './MobileNav';
import { useAuth } from '../../hooks/useAuth';

export default function DashboardLayout() {
  return (
    <AlertasProvider>
      <Estrutura />
    </AlertasProvider>
  );
}

function Estrutura() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const { userProfile } = useAuth();
  const ehDiretora = userProfile?.perfil === 'diretora';

  // Título da aba do navegador com o nome da tela (ex.: "Escolas · Gestão Escolar").
  // Com pendências, o número aparece antes: "(7) Painel · Gestão Escolar".
  const { pendencias } = useAlertas();
  useEffect(() => {
    const tela = nomeDaTela(pathname);
    const base = tela ? `${tela} · ${NOME_DO_SISTEMA}` : NOME_DO_SISTEMA;
    document.title = pendencias > 0 ? `(${pendencias}) ${base}` : base;
  }, [pathname, pendencias]);
  // Ao sair (logout), a aba volta ao nome do sistema, sem o contador.
  useEffect(() => () => { document.title = NOME_DO_SISTEMA; }, []);

  return (
    <div className="flex h-screen bg-gray-50 overflow-clip">
      {/* Sidebar fixa na lateral - NÃO MEXER NA ESTRUTURA DELA */}
      <Sidebar isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      
      {/* Área de conteúdo que precisa respeitar a Sidebar e a Topbar */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setIsMobileMenuOpen(true)} />
        
        {/* pt-16 (64px) é a altura exata da Topbar. Isso impede a sobreposição */}
        <main className={`flex-1 overflow-y-auto p-4 md:p-8 pt-20 md:pt-24 md:ml-64 ${ehDiretora ? 'pb-28 md:pb-8' : ''}`}>
          <div className="max-w-7xl mx-auto">
            <AvisoDeConexao />
            <Outlet />
          </div>
        </main>
      </div>
      {ehDiretora && <MobileNav />}
    </div>
  );
}