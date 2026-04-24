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
import Prestadores from './pages/admin/Prestadores';

import DiretoraDashboard from './pages/diretora/Dashboard';

function RootRedirect() {
  const { currentUser, userProfile, loading } = useAuth();
  
  if (loading) return <div className="h-screen flex items-center justify-center">Verificando...</div>;
  if (!currentUser) return <Navigate to="/login" replace />;
  
  if (!userProfile) {
    return (
      <div className="h-screen flex items-center justify-center flex-col">
        <p>A carregar o seu perfil...</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-blue-500 underline">
          Recarregar página
        </button>
      </div>
    );
  }
  
  if (userProfile.perfil === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (userProfile.perfil === 'administrativo') return <Navigate to="/admin/talentos" replace />;
  
  return <Navigate to="/diretora/dashboard" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRedirect />} />

          <Route path="/admin" element={<PrivateRoute allowedRoles={['admin', 'administrativo']}><DashboardLayout /></PrivateRoute>}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="escolas" element={<Escolas />} />
            <Route path="manutencoes" element={<AdminManutencoes />} />
            <Route path="prestadores" element={<Prestadores />} />
            <Route path="contas" element={<Contas />} />
            <Route path="ciclos" element={<Ciclos />} />
            <Route path="selecao" element={<Selecao />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="usuarios" element={<Usuarios />} />
            <Route path="talentos" element={<BancoTalentos />} />
          </Route>

          <Route path="/diretora" element={<PrivateRoute allowedRoles={['diretora']}><DashboardLayout /></PrivateRoute>}>
            <Route path="dashboard" element={<DiretoraDashboard />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}