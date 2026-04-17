import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from "../../hooks/useAuth";
import LoadingSpinner from "../ui/LoadingSpinner";

export default function PrivateRoute({ children, allowedRole }) {
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) {
    return <div className="h-screen flex items-center"><LoadingSpinner size="lg" /></div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && userProfile?.perfil !== allowedRole) {
    return <Navigate to={userProfile?.perfil === 'admin' ? '/admin/dashboard' : '/diretora/dashboard'} replace />;
  }

  return children;
}