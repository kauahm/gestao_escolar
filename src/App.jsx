import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/shared/PrivateRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import Login from './pages/Login';
import { useAuth } from './hooks/useAuth';

import AdminDashboard from './pages/admin/Dashboard';
import Escolas from './pages/admin/Escolas';
import AdminManutencoes from './pages/admin/Manutencoes';
import Contas from './pages/admin/Contas';
import Ciclos from './pages/admin/Ciclos';
import Selecao from './pages/admin/Selecao';
import Agenda from './pages/admin/Agenda';
import Usuarios from './pages/admin/Usuarios';
import BancoTalentos from './pages/admin/BancoTalentos';
import Funcionarios from './pages/admin/Funcionarios';
import ControleDeSaldo from './pages/admin/ControleDeSaldo';
import VisaoDaSede from './pages/admin/VisaoDaSede';
import Prestadores from './pages/admin/Prestadores';
import Seguranca from './pages/admin/Seguranca';
import ManutencaoDetalhe from './pages/admin/ManutencaoDetalhe';

import DiretoraDashboard from './pages/diretora/Dashboard';
import MeusChamados from './pages/diretora/MeusChamados';
import { EH_DEMO, DEMO_MAL_CONFIGURADA } from './services/ambiente';
import FalhaNoPerfil from './components/shared/FalhaNoPerfil';

function RootRedirect() {
  const { currentUser, userProfile, loading, logout, erroDoPerfil, municipioAtivo } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center">Verificando...</div>;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!userProfile && erroDoPerfil) return <FalhaNoPerfil codigo={erroDoPerfil} />;

  if (!userProfile) {
    return (
      <div className="h-screen flex items-center justify-center flex-col px-6 text-center">
        <p className="font-medium">Não encontramos o perfil desta conta.</p>
        <p className="mt-2 text-sm text-slate-600">
          A conta existe, mas não tem o cadastro correspondente em <code>usuarios</code>.
          Peça ao administrador para conferir se o ID do documento é igual ao UID abaixo.
        </p>
        <code className="mt-3 text-xs break-all bg-slate-100 rounded px-2 py-1">{currentUser.uid}</code>
        <div className="mt-4 flex gap-4">
          <button onClick={() => window.location.reload()} className="text-blue-500 underline">
            Recarregar página
          </button>
          <button onClick={() => logout()} className="text-blue-500 underline">
            Sair
          </button>
        </div>
      </div>
    );
  }
  
  // A sede começa na lista de municípios; depois de escolher um, no painel dele.
  if (userProfile.perfil === 'sede') return <Navigate to={municipioAtivo ? '/admin/dashboard' : '/admin/sede'} replace />;
  if (userProfile.perfil === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (userProfile.perfil === 'administrativo') return <Navigate to="/admin/funcionarios" replace />;
  
  return <Navigate to="/diretora/dashboard" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      {/* Selo fixo: quem está no ambiente de demonstração sempre sabe disso. */}
      {EH_DEMO && (
        <div className="selo-demo fixed bottom-3 left-1/2 -translate-x-1/2 z-[60] pointer-events-none bg-purple-700 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap print:hidden">
          Ambiente de demonstração · dados fictícios
        </div>
      )}
      {DEMO_MAL_CONFIGURADA && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[60] bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg max-w-[92vw] text-center">
          Atenção: o modo demonstração foi pedido, mas a configuração aponta para o sistema real. Confira o arquivo .env.demo.
        </div>
      )}
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRedirect />} />

          <Route path="/admin" element={<PrivateRoute allowedRoles={['admin', 'sede', 'administrativo']}><DashboardLayout /></PrivateRoute>}>
            {/* O perfil 'administrativo' (RH) entra em /admin, mas só em Funcionários,
                Banco de Talentos e Processo Seletivo. As demais telas são do admin.
                A sede usa as telas do admin dentro do município que escolheu; a
                Visão da sede (todos os municípios) é só dela. */}
            <Route path="dashboard" element={<PrivateRoute allowedRoles={['admin', 'sede']}><AdminDashboard /></PrivateRoute>} />
            <Route path="sede" element={<PrivateRoute allowedRoles={['sede']}><VisaoDaSede /></PrivateRoute>} />
            <Route path="escolas" element={<PrivateRoute allowedRoles={['admin', 'sede']}><Escolas /></PrivateRoute>} />
            <Route path="manutencoes" element={<PrivateRoute allowedRoles={['admin', 'sede']}><AdminManutencoes /></PrivateRoute>} />
            <Route path="manutencoes/:id" element={<PrivateRoute allowedRoles={['admin', 'sede']}><ManutencaoDetalhe /></PrivateRoute>} />
            <Route path="prestadores" element={<PrivateRoute allowedRoles={['admin', 'sede']}><Prestadores /></PrivateRoute>} />
            <Route path="contas" element={<PrivateRoute allowedRoles={['admin', 'sede']}><Contas /></PrivateRoute>} />
            <Route path="saldo" element={<PrivateRoute allowedRoles={['admin', 'sede']}><ControleDeSaldo /></PrivateRoute>} />
            <Route path="ciclos" element={<PrivateRoute allowedRoles={['admin', 'sede']}><Ciclos /></PrivateRoute>} />
            <Route path="agenda" element={<PrivateRoute allowedRoles={['admin', 'sede']}><Agenda /></PrivateRoute>} />
            <Route path="usuarios" element={<PrivateRoute allowedRoles={['admin', 'sede']}><Usuarios /></PrivateRoute>} />
            <Route path="seguranca" element={<PrivateRoute allowedRoles={['admin', 'sede']}><Seguranca /></PrivateRoute>} />
            <Route path="selecao" element={<PrivateRoute allowedRoles={['admin', 'sede', 'administrativo']}><Selecao /></PrivateRoute>} />
            <Route path="talentos" element={<PrivateRoute allowedRoles={['admin', 'sede', 'administrativo']}><BancoTalentos /></PrivateRoute>} />
            <Route path="funcionarios" element={<PrivateRoute allowedRoles={['admin', 'sede', 'administrativo']}><Funcionarios /></PrivateRoute>} />
          </Route>

          <Route path="/diretora" element={<PrivateRoute allowedRoles={['diretora']}><DashboardLayout /></PrivateRoute>}>
            <Route path="dashboard" element={<DiretoraDashboard />} />
            <Route path="manutencoes" element={<MeusChamados />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}