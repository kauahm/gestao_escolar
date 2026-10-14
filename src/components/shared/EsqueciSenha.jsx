import React, { useEffect, useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { MailCheck } from 'lucide-react';

import Modal from '../ui/Modal';
import LoadingSpinner from '../ui/LoadingSpinner';
import { auth } from '../../services/firebase';

// "Esqueci minha senha": o Firebase envia um e-mail com o link para criar uma
// senha nova (gratuito no plano atual). A resposta é sempre a mesma, exista ou
// não a conta, para ninguém usar esta tela para descobrir quais e-mails têm acesso.

const MENSAGENS = {
  'auth/invalid-email': 'Este e-mail não parece válido. Confira se digitou certo.',
  'auth/missing-email': 'Digite o seu e-mail.',
  'auth/network-request-failed': 'Sem conexão com a internet. Tente de novo quando a conexão voltar.',
  'auth/too-many-requests': 'Muitos pedidos seguidos. Espere alguns minutos e tente de novo.',
};

export default function EsqueciSenha({ isOpen, onClose, emailInicial = '' }) {
  const [email, setEmail] = useState(emailInicial);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (isOpen) { setEmail(emailInicial); setEnviado(false); setErro(''); }
  }, [isOpen, emailInicial]);

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      auth.languageCode = 'pt-BR'; // e-mail de redefinição em português
      await sendPasswordResetEmail(auth, email.trim());
      setEnviado(true);
    } catch (falha) {
      if (falha?.code === 'auth/user-not-found') setEnviado(true); // mesma resposta, exista ou não a conta
      else setErro(MENSAGENS[falha?.code] || 'Não foi possível enviar agora. Tente de novo em alguns minutos.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Esqueci minha senha" size="sm">
      {enviado ? (
        <div className="text-center space-y-3 py-2">
          <MailCheck className="w-12 h-12 text-green-600 mx-auto" aria-hidden="true" />
          <p className="text-gray-900 font-medium">Pedido recebido</p>
          <p className="text-sm text-gray-600">
            Se <strong>{email.trim()}</strong> estiver cadastrado, você vai receber em alguns minutos um e-mail com o link para criar uma senha nova.
            Confira também a caixa de spam.
          </p>
          <p className="text-xs text-gray-500">Não chegou? Fale com a administração do sistema.</p>
          <button type="button" onClick={onClose} className="mt-2 px-5 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium">Voltar ao login</button>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <p className="text-sm text-gray-600">Digite o e-mail que você usa para entrar. Vamos enviar um link para você criar uma senha nova.</p>
          <input
            type="email"
            required
            autoFocus
            aria-label="E-mail"
            placeholder="seu.email@exemplo.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary"
          />
          {erro && <p className="text-sm text-red-700">{erro}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border rounded-md hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={enviando} className="px-4 py-2 text-sm text-white bg-primary rounded-md hover:bg-primary-dark min-w-36 flex justify-center">
              {enviando ? <LoadingSpinner size="sm" color="text-white" /> : 'Enviar link'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
