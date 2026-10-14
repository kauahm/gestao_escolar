import React from 'react';
import { CloudOff, RotateCw, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

// Tela de quando o login funcionou, mas o perfil (coleção usuarios) não pôde
// ser lido: sem internet, servidor fora do ar ou sem permissão. Não confundir
// com "perfil não existe", que tem outra tela (App.jsx).

export default function FalhaNoPerfil({ codigo }) {
  const { logout } = useAuth();
  const semPermissao = codigo === 'permission-denied';

  return (
    <div className="h-screen flex items-center justify-center flex-col px-6 text-center">
      <CloudOff className="w-12 h-12 text-gray-400 mb-4" aria-hidden="true" />
      <p className="font-semibold text-gray-900">Não foi possível carregar o seu perfil</p>
      <p className="mt-2 text-sm text-gray-600 max-w-md">
        {semPermissao
          ? 'Sua conta está sem permissão para entrar. Fale com a administração do sistema.'
          : 'Parece que a internet caiu ou o servidor não respondeu. Seus dados continuam guardados; verifique a conexão e tente de novo.'}
      </p>
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium flex items-center gap-2"
        >
          <RotateCw size={16} /> Tentar de novo
        </button>
        <button
          type="button"
          onClick={() => logout()}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium flex items-center gap-2"
        >
          <LogOut size={16} /> Sair
        </button>
      </div>
    </div>
  );
}
