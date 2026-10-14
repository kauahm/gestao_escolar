import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from "../../hooks/useAuth";
import LoadingSpinner from "../ui/LoadingSpinner";
import FalhaNoPerfil from './FalhaNoPerfil';

// Rota protegida.
// Uso: <PrivateRoute allowedRoles={['admin', 'administrativo']}> ... </PrivateRoute>
// (`allowedRole` no singular continua aceito para não quebrar chamadas antigas)
export default function PrivateRoute({ children, allowedRoles, allowedRole }) {
  const { currentUser, userProfile, loading, erroDoPerfil } = useAuth();

  // Normaliza: aceita array, string ou nada.
  const perfisPermitidos = allowedRoles
    ? (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles])
    : (allowedRole ? [allowedRole] : null);

  const telaDeEspera = (
    <div className="h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );

  if (loading) return telaDeEspera;

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Trava a renderização enquanto o perfil ainda está sendo carregado,
  // para não liberar a tela por engano nem redirecionar para o lugar errado.
  if (perfisPermitidos && !userProfile) return erroDoPerfil ? <FalhaNoPerfil codigo={erroDoPerfil} /> : telaDeEspera;

  // Conta desativada não entra em lugar nenhum.
  if (userProfile && userProfile.situacao && userProfile.situacao !== 'ativa') {
    return <Navigate to="/login" replace />;
  }

  if (perfisPermitidos && !perfisPermitidos.includes(userProfile?.perfil)) {
    return <Navigate to={rotaInicialDoPerfil(userProfile?.perfil)} replace />;
  }

  return children;
}

function rotaInicialDoPerfil(perfil) {
  if (perfil === 'admin') return '/admin/dashboard';
  if (perfil === 'administrativo') return '/admin/funcionarios';
  if (perfil === 'diretora') return '/diretora/dashboard';
  return '/login';
}
