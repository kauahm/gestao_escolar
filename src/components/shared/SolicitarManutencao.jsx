import React, { useState } from 'react';
import { collection, serverTimestamp } from 'firebase/firestore';
import { MapPin } from 'lucide-react';

import Modal from '../ui/Modal';
import LoadingSpinner from '../ui/LoadingSpinner';
import { addDoc } from '../../services/db';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';

// Formulário com que a diretora abre um chamado de manutenção para a própria
// escola. Usado no Início e em Meus chamados. Os campos seguem exatamente o
// que as regras do Firestore aceitam da diretora (ver firestore.rules).

const VAZIO = { descricao: '', localDentroEscola: '', prioridade: 'Média', observacoes: '' };

export default function SolicitarManutencao({ isOpen, onClose, onEnviado }) {
  const { userProfile, currentUser } = useAuth();
  const [dados, setDados] = useState(VAZIO);
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState('');

  const mudar = (e) => {
    const { name, value } = e.target;
    setDados((d) => ({ ...d, [name]: value }));
    if (erros[name]) setErros((x) => ({ ...x, [name]: '' }));
  };

  const fechar = () => {
    if (enviando) return;
    setErros({});
    setFalha('');
    onClose();
  };

  const enviar = async (e) => {
    e.preventDefault();
    const novosErros = {};
    if (!dados.localDentroEscola.trim()) novosErros.localDentroEscola = 'Informe o local exato na escola';
    if (!dados.descricao.trim()) novosErros.descricao = 'Descreva o problema';
    setErros(novosErros);
    if (Object.keys(novosErros).length) return;

    setEnviando(true);
    setFalha('');
    try {
      await addDoc(collection(db, 'manutencoes'), {
        ...dados,
        descricao: dados.descricao.trim(),
        localDentroEscola: dados.localDentroEscola.trim(),
        escolaId: userProfile.unidadeId,
        escolaNome: userProfile.unidadeNome,
        responsavel: 'A definir',
        status: 'Pendente',
        solicitadaPor: currentUser.uid,
        solicitadaPorNome: userProfile.nome,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      });
      setDados(VAZIO);
      setEnviando(false);
      onClose();
      onEnviado?.('Solicitação enviada! A administração já pode ver o seu chamado.');
    } catch (erro) {
      console.error('Erro ao enviar solicitação:', erro);
      setFalha('Não foi possível enviar a solicitação. Confira a internet e tente de novo; o que você escreveu continua aqui.');
      setEnviando(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={fechar} title="Nova solicitação de manutenção" size="md">
      <form onSubmit={enviar} className="space-y-4">
        <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
          <p className="text-sm text-blue-800 flex items-center gap-2">
            <MapPin size={16} /> Solicitando para: <strong>{userProfile?.unidadeNome}</strong>
          </p>
        </div>

        {falha && <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-md p-3">{falha}</p>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="sm-local">Local exato na escola *</label>
          <input
            id="sm-local"
            type="text"
            name="localDentroEscola"
            maxLength={300}
            value={dados.localDentroEscola}
            onChange={mudar}
            placeholder="Ex.: banheiro das crianças, cozinha, sala 4..."
            className={`w-full px-3 py-2 border rounded-md outline-none focus:border-primary ${erros.localDentroEscola ? 'border-red-500' : 'border-gray-300'}`}
          />
          {erros.localDentroEscola && <p className="text-red-500 text-xs mt-1">{erros.localDentroEscola}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="sm-descricao">O que aconteceu? *</label>
          <textarea
            id="sm-descricao"
            name="descricao"
            maxLength={2000}
            value={dados.descricao}
            onChange={mudar}
            rows="4"
            placeholder="Descreva o que quebrou, parou de funcionar ou precisa de conserto..."
            className={`w-full px-3 py-2 border rounded-md outline-none resize-none focus:border-primary ${erros.descricao ? 'border-red-500' : 'border-gray-300'}`}
          />
          {erros.descricao && <p className="text-red-500 text-xs mt-1">{erros.descricao}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="sm-prioridade">Prioridade sugerida *</label>
          <select id="sm-prioridade" name="prioridade" value={dados.prioridade} onChange={mudar} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Baixa">Baixa: pode aguardar</option>
            <option value="Média">Média: precisa de atenção em breve</option>
            <option value="Alta">Alta: urgente, atrapalha as atividades</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="sm-obs">Observações (opcional)</label>
          <textarea
            id="sm-obs"
            name="observacoes"
            maxLength={2000}
            value={dados.observacoes}
            onChange={mudar}
            rows="2"
            placeholder="Melhor horário para o atendimento, aviso sobre crianças na sala..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none resize-none focus:border-primary"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={fechar} className="px-4 py-2 text-sm text-gray-700 border rounded-md hover:bg-gray-50">Cancelar</button>
          <button type="submit" disabled={enviando} className="px-4 py-2 text-sm text-white bg-primary rounded-md hover:bg-primary-dark min-w-40 flex justify-center">
            {enviando ? <LoadingSpinner size="sm" color="text-white" /> : 'Enviar solicitação'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
