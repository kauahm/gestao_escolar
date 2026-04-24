import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from "../../hooks/useAuth";
import LoadingSpinner from "../ui/LoadingSpinner";

export default function PrivateRoute({ children, allowedRole }) {
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) {
    return <div className="h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // A MÁGICA ESTÁ AQUI: Trava a renderização se o perfil ainda estiver a ser descarregado
  if (allowedRole && !userProfile) {
    return <div className="h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
  }

  if (allowedRole && userProfile?.perfil !== allowedRole) {
    return <Navigate to={userProfile?.perfil === 'admin' ? '/admin/dashboard' : '/diretora/dashboard'} replace />;
  }

  return children;
}