import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Mail, Lock, CheckCircle2 } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Toast from '../components/ui/Toast';
import EsqueciSenha from '../components/shared/EsqueciSenha';

// Importe a sua logo
import logoImg from '../assets/logo-topo.png'; 

export default function Login() {
  // No celular quem entra é quase sempre a diretora: abre direto na área da escola.
  const [isDirectorLogin, setIsDirectorLogin] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [esqueciAberto, setEsqueciAberto] = useState(false);
  
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
      await login(email, senha);
      navigate('/');
    } catch (err) {
      const mensagens = {
        'auth/network-request-failed': 'Sem conexão com a internet. Confira a conexão e tente de novo.',
        'auth/too-many-requests': 'Muitas tentativas seguidas. Espere alguns minutos ou use "Esqueci minha senha".',
        'auth/user-disabled': 'Esta conta está desativada. Fale com a administração.',
      };
      setError(mensagens[err?.code] || 'E-mail ou senha incorretos.');
      setLoading(false);
    }
  };

  return (
    // Container Principal: Agora ocupa 100% da tela (h-screen w-full) sem margens
    <div className="h-screen w-full relative overflow-hidden bg-white font-sans flex flex-col md:block">
      {error && <Toast message={error} type="error" onClose={() => setError('')} />}
      <EsqueciSenha isOpen={esqueciAberto} onClose={() => setEsqueciAberto(false)} emailInicial={email} />
      
      {/* === MODO MOBILE: Botão no topo === */}
      <div className="md:hidden absolute top-0 left-0 w-full z-30 bg-primary px-4 pt-4 pb-3 shadow-md">
        <div role="tablist" aria-label="Tipo de acesso" className="grid grid-cols-2 gap-1 bg-white/15 rounded-full p-1 max-w-sm mx-auto">
          {[[true, 'Escola'], [false, 'Administração']].map(([diretora, rotulo]) => (
            <button
              key={rotulo}
              type="button"
              role="tab"
              aria-selected={isDirectorLogin === diretora}
              onClick={() => setIsDirectorLogin(diretora)}
              className={`py-2 rounded-full text-sm font-semibold transition-colors ${isDirectorLogin === diretora ? 'bg-white text-primary' : 'text-white'}`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {/* === PAINEL DESLIZANTE AZUL === */}
      <div 
        className={`hidden md:flex absolute top-0 left-0 w-1/2 h-full bg-primary text-white z-20 transition-transform duration-700 ease-in-out flex-col items-center justify-center px-12 text-center shadow-2xl ${
          isDirectorLogin ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {!isDirectorLogin ? (
          <>
            {/* Se o painel está na direita (Cobrindo Diretora), ele convida para ir para Diretora */}
            <h2 className="text-3xl font-bold mb-4">Portal da Escola</h2>
            <p className="mb-6 font-light leading-relaxed">
              Acesso das diretoras, pelo computador ou pelo celular.
            </p>
            <ul className="mb-8 space-y-2 text-left text-sm text-blue-50">
              {['Peça uma manutenção em segundos', 'Acompanhe cada chamado até a conclusão', 'Veja o que vence na sua escola'].map((t) => (
                <li key={t} className="flex items-center gap-2"><CheckCircle2 size={18} className="shrink-0 text-blue-200" aria-hidden="true" /> {t}</li>
              ))}
            </ul>
            <button 
              onClick={() => setIsDirectorLogin(true)} 
              className="border-2 border-white px-10 py-3 rounded-full font-semibold text-sm hover:bg-white hover:text-primary transition-colors"
            >
              Sou Diretora
            </button>
          </>
        ) : (
          <>
            {/* Se o painel está na esquerda (Cobrindo Admin), ele convida para ir para Admin */}
            <h2 className="text-3xl font-bold mb-4">Área Administrativa</h2>
            <p className="mb-8 font-light leading-relaxed">
              Acesso restrito para a gestão central da associação. Configure escolas, contas e manutenções.
            </p>
            <button 
              onClick={() => setIsDirectorLogin(false)} 
              className="border-2 border-white px-10 py-3 rounded-full font-semibold text-sm hover:bg-white hover:text-primary transition-colors"
            >
              Sou Administrador
            </button>
          </>
        )}
      </div>

      {/* === LADO ESQUERDO: LOGIN ADMINISTRADOR === */}
      <div 
        className={`absolute top-0 left-0 w-full md:w-1/2 h-full pt-20 md:pt-0 p-8 flex flex-col justify-center items-center transition-all duration-700 ease-in-out bg-white ${
          isDirectorLogin ? 'hidden md:flex opacity-0 -translate-x-20 pointer-events-none' : 'flex opacity-100 translate-x-0 pointer-events-auto z-10'
        }`}
      >
        <img src={logoImg} alt="Associação Educacional Maria do Carmo" className="h-24 w-auto object-contain mb-6" />
        <h2 className="text-3xl font-bold text-primary mb-2 text-center">Administração</h2>
        <p className="text-gray-500 text-sm mb-8 text-center">Insira suas credenciais de gestão</p>
        
        <form className="w-full max-w-sm space-y-5" onSubmit={handleLogin}>
          <div className="relative flex items-center bg-gray-100 rounded-lg p-3">
            <Mail className="text-gray-500 mr-3" size={20} />
            <input
              type="email"
              required
              autoComplete="username"
              aria-label="E-mail"
              className="w-full bg-transparent outline-none text-sm text-gray-700"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="relative flex items-center bg-gray-100 rounded-lg p-3">
            <Lock className="text-gray-500 mr-3" size={20} />
            <input
              type="password"
              required
              autoComplete="current-password"
              aria-label="Senha"
              className="w-full bg-transparent outline-none text-sm text-gray-700"
              placeholder="Senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-semibold py-3 rounded-full hover:bg-primary-dark transition-colors text-sm mt-4"
          >
            {loading ? <LoadingSpinner size="sm" color="text-white" /> : 'Entrar'}
          </button>
          <button
            type="button"
            onClick={() => setEsqueciAberto(true)}
            className="w-full text-center text-sm text-primary hover:underline"
          >
            Esqueci minha senha
          </button>
        </form>
      </div>

      {/* === LADO DIREITO: LOGIN DIRETORA === */}
      <div 
        className={`absolute top-0 right-0 w-full md:w-1/2 h-full pt-20 md:pt-0 p-8 flex flex-col justify-center items-center transition-all duration-700 ease-in-out bg-white ${
          isDirectorLogin ? 'flex opacity-100 translate-x-0 pointer-events-auto z-10' : 'hidden md:flex opacity-0 translate-x-20 pointer-events-none'
        }`}
      >
        <img src={logoImg} alt="Associação Educacional Maria do Carmo" className="h-24 w-auto object-contain mb-6" />
        <h2 className="text-3xl font-bold text-primary mb-2 text-center">Área da Escola</h2>
        <p className="text-gray-500 text-sm mb-8 text-center">Insira as credenciais da sua unidade</p>
        
        <form className="w-full max-w-sm space-y-5" onSubmit={handleLogin}>
          <div className="relative flex items-center bg-gray-100 rounded-lg p-3">
            <Mail className="text-gray-500 mr-3" size={20} />
            <input
              type="email"
              required
              autoComplete="username"
              aria-label="E-mail"
              className="w-full bg-transparent outline-none text-sm text-gray-700"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="relative flex items-center bg-gray-100 rounded-lg p-3">
            <Lock className="text-gray-500 mr-3" size={20} />
            <input
              type="password"
              required
              autoComplete="current-password"
              aria-label="Senha"
              className="w-full bg-transparent outline-none text-sm text-gray-700"
              placeholder="Senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-semibold py-3 rounded-full hover:bg-primary-dark transition-colors text-sm mt-4"
          >
            {loading ? <LoadingSpinner size="sm" color="text-white" /> : 'Entrar'}
          </button>
          <button
            type="button"
            onClick={() => setEsqueciAberto(true)}
            className="w-full text-center text-sm text-primary hover:underline"
          >
            Esqueci minha senha
          </button>
        </form>
      </div>

    </div>
  );
}