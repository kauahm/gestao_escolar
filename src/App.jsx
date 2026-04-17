import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/shared/PrivateRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import Login from './pages/Login';
import { useAuth } from './hooks/useAuth';

// --- PÁGINAS DE ADMIN ---
import AdminDashboard from './pages/admin/Dashboard';
import Escolas from './pages/admin/Escolas';
import AdminManutencoes from './pages/admin/Manutencoes';
import Contas from './pages/admin/Contas';
import Ciclos from './pages/admin/Ciclos';
import Selecao from './pages/admin/Selecao';
import Agenda from './pages/admin/Agenda';
import Usuarios from './pages/admin/Usuarios';

// --- PÁGINAS DE DIRETORA ---
import DiretoraDashboard from './pages/diretora/Dashboard';

function RootRedirect() {
  const { currentUser, userProfile, loading } = useAuth();
  if (loading) return null;
  if (!currentUser) return <Navigate to="/login" replace />;
  
  return userProfile?.perfil === 'admin' 
    ? <Navigate to="/admin/dashboard" replace /> 
    : <Navigate to="/diretora/dashboard" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRedirect />} />

          {/* ROTAS ADMIN */}
          <Route path="/admin" element={<PrivateRoute allowedRole="admin"><DashboardLayout /></PrivateRoute>}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="escolas" element={<Escolas />} />
            <Route path="manutencoes" element={<AdminManutencoes />} />
            <Route path="contas" element={<Contas />} />
            <Route path="ciclos" element={<Ciclos />} />
            <Route path="selecao" element={<Selecao />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="usuarios" element={<Usuarios />} />
          </Route>

          {/* ROTAS DIRETORA */}
          <Route path="/diretora" element={<PrivateRoute allowedRole="diretora"><DashboardLayout /></PrivateRoute>}>
            <Route path="dashboard" element={<DiretoraDashboard />} />
            {/* Se você criar o arquivo Manutencoes.jsx na pasta diretora depois, adicione a rota aqui */}
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}