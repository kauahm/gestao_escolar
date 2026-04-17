import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Toast from '../components/ui/Toast';
// Importe a sua logo aqui (ajuste o nome se necessário)
import logoImg from '../assets/logo-topo.png'; 

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !senha) {
      setError('Por favor, preencha e-mail e senha.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      const userCredential = await login(email, senha);
      // O AuthContext vai capturar o usuário, buscar o perfil e o PrivateRoute lidará com o redirecionamento.
      // Forçamos um reload seguro via navigate para a raiz que distribui a rota.
      navigate('/');
    } catch (err) {
      setError('E-mail ou senha incorretos.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      {error && <Toast message={error} type="error" onClose={() => setError('')} />}
      
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <div className="flex flex-col items-center justify-center text-center">
          
          {/* LOGO INTEIRA AQUI - Sem bordas redondas, mantendo a proporção */}
          <img 
            src={logoImg} 
            alt="Logo Associação" 
            className="h-24 w-auto object-contain mb-2" 
          />
          
          <h2 className="mt-2 text-3xl font-extrabold text-gray-900">
            Gestão Escolar
          </h2>
          
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email-address" className="sr-only">Endereço de E-mail</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                placeholder="Seu E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Senha</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                placeholder="Sua Senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
            >
              {loading ? <LoadingSpinner size="sm" color="text-white" /> : 'Entrar no Sistema'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}