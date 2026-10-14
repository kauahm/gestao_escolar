import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { collection, doc, query, where, serverTimestamp } from 'firebase/firestore';
import {
  ArrowLeft, Edit2, Send, Printer, Trash2, MapPin, Calendar, User, Phone,
  Clock, CheckCircle2, PlayCircle, RotateCcw, History, AlertTriangle,
} from 'lucide-react';

import { db } from '../../services/firebase';
import { ouvir } from '../../services/leitura';
import { updateDoc, deleteDoc } from '../../services/db';
import { formatarDataHora, formatarTelefone } from '../../utils/formatters';
import { diasEmAberto, diasAte } from '../../utils/calcularStatus';
import { prestadorDoChamado, nomeDoResponsavel, responsavelNaoCadastrado } from '../../utils/responsavel';
import { abrirWhatsAppDaOS, imprimirOrdemDeServico } from '../../utils/ordemDeServico';
import { linhaDoTempoDoChamado } from '../../utils/linhaDoTempo';
import { registrarExecucaoDoCicloPorId } from '../../services/acoesDosAlertas';

import Badge from '../../components/ui/Badge';
import Toast from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';

const corDaPrioridade = (p) => (p === 'Alta' || p === 'Urgente' ? 'red' : p === 'Média' ? 'yellow' : 'green');
const corDoStatus = (s) => (s === 'Concluído' ? 'green' : s === 'Em andamento' ? 'blue' : 'gray');

const PROXIMO_STATUS = {
  Pendente: { status: 'Em andamento', rotulo: 'Iniciar atendimento', Icone: PlayCircle },
  'Em andamento': { status: 'Concluído', rotulo: 'Marcar como concluído', Icone: CheckCircle2 },
  Concluído: { status: 'Em andamento', rotulo: 'Reabrir', Icone: RotateCcw },
};

const dataYmd = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '');

export default function ManutencaoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [chamado, setChamado] = useState(undefined); // undefined = carregando; null = não existe
  const [prestadores, setPrestadores] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [nomes, setNomes] = useState({});
  const [mudandoStatus, setMudandoStatus] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const avisar = (message, type = 'success') => setToast({ show: true, message, type });

  useEffect(() => {
    const parar = [
      ouvir(doc(db, 'manutencoes', id), (s) => setChamado(s.exists() ? { id: s.id, ...s.data() } : null), () => setChamado(null)),
      ouvir(collection(db, 'prestadores'), (s) => setPrestadores(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
      ouvir(
        query(collection(db, 'historico'), where('colecao', '==', 'manutencoes'), where('docId', '==', id)),
        (s) => setHistorico(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      ),
      ouvir(collection(db, 'usuarios'), (s) => {
        const mapa = {};
        s.docs.forEach((d) => { mapa[d.id] = d.data().nome; });
        setNomes(mapa);
      }),
    ];
    return () => parar.forEach((p) => p());
  }, [id]);

  const prestador = prestadorDoChamado(chamado, prestadores);
  const eventos = useMemo(
    () => (chamado ? linhaDoTempoDoChamado(chamado, historico, (uid, email) => (uid && nomes[uid]) || email || 'Alguém') : []),
    [chamado, historico, nomes, prestadores],
  );

  if (chamado === undefined) {
    return <div className="h-64 flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
  }
  if (chamado === null) {
    return (
      <EmptyState
        titulo="Chamado não encontrado"
        mensagem="Ele pode ter sido excluído (veja a lixeira em Segurança dos dados) ou o endereço está incompleto."
        acoes={[{ rotulo: 'Voltar para Manutenções', onClick: () => navigate('/admin/manutencoes') }]}
      />
    );
  }

  const aberto = chamado.status !== 'Concluído';
  const dias = diasEmAberto(chamado.criadoEm);
  const diasParaPrazo = chamado.prazo ? diasAte(chamado.prazo) : null;
  const proximo = PROXIMO_STATUS[chamado.status] || PROXIMO_STATUS.Pendente;

  const mudarStatus = async () => {
    setMudandoStatus(true);
    try {
      const novo = proximo.status;
      await updateDoc(doc(db, 'manutencoes', chamado.id), {
        status: novo,
        concluidoEm: novo === 'Concluído' ? serverTimestamp() : null,
        atualizadoEm: serverTimestamp(),
      });
      // Chamado aberto a partir de um ciclo vencido: concluir registra a execução do ciclo.
      if (novo === 'Concluído' && chamado.cicloId) {
        const ciclo = await registrarExecucaoDoCicloPorId(chamado.cicloId);
        if (ciclo) {
          avisar(`Chamado concluído e ciclo atualizado: próximo serviço em ${ciclo.proxima.split('-').reverse().join('/')}.`);
          return;
        }
      }
      avisar(`Status alterado para "${novo}".`);
    } catch (erro) {
      console.error(erro);
      avisar('Não foi possível alterar o status.', 'error');
    } finally {
      setMudandoStatus(false);
    }
  };

  const excluir = async () => {
    setConfirmarExclusao(false);
    try {
      await deleteDoc(doc(db, 'manutencoes', chamado.id));
      navigate('/admin/manutencoes', { state: { aviso: 'Chamado movido para a lixeira.' } });
    } catch (erro) {
      console.error(erro);
      avisar('Não foi possível excluir o chamado.', 'error');
    }
  };

  return (
    <div className="w-full space-y-6">
      <Link to="/admin/manutencoes" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft size={16} /> Manutenções
      </Link>

      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge label={chamado.status} color={corDoStatus(chamado.status)} />
            <Badge label={`Prioridade ${chamado.prioridade || 'Baixa'}`} color={corDaPrioridade(chamado.prioridade)} />
            <span className="text-xs text-gray-500">O.S. {chamado.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 break-words">{chamado.descricao}</h1>
          <p className="text-gray-600 mt-1 flex items-center gap-1.5"><MapPin size={16} className="shrink-0" /> {chamado.escolaNome}{chamado.localDentroEscola ? ` · ${chamado.localDentroEscola}` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button onClick={mudarStatus} disabled={mudandoStatus} className="bg-primary hover:bg-primary-dark disabled:opacity-60 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm">
            {mudandoStatus ? <LoadingSpinner size="sm" color="text-white" /> : <proximo.Icone size={18} />} {proximo.rotulo}
          </button>
          <button onClick={() => navigate(`/admin/manutencoes?editar=${chamado.id}`)} className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg flex items-center gap-2 font-medium">
            <Edit2 size={16} /> Editar
          </button>
        </div>
      </div>

      {aberto && chamado.status === 'Pendente' && dias > 5 && (
        <p className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertTriangle size={16} className="shrink-0" /> Pendente há {dias} dias sem atendimento.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dados */}
        <section className="lg:col-span-1 bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4 text-sm">
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">Responsável</p>
            <p className="font-medium text-gray-900 flex items-center gap-1.5"><User size={15} /> {nomeDoResponsavel(chamado, prestadores)}</p>
            {prestador?.telefone && <p className="text-gray-600 flex items-center gap-1.5 mt-0.5"><Phone size={14} /> {formatarTelefone(prestador.telefone)}</p>}
            {responsavelNaoCadastrado(chamado, prestadores) && (
              <p className="text-amber-700 text-xs mt-1">Este nome não está no cadastro de Prestadores. Em "Editar", escolha um prestador cadastrado para enviar a O.S. por WhatsApp.</p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={() => { if (!abrirWhatsAppDaOS(chamado, prestador)) avisar('O responsável deste chamado não tem WhatsApp cadastrado.', 'error'); }}
                className="flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 px-3 py-1.5 rounded-md text-xs font-bold"
              >
                <Send size={14} /> Enviar O.S. por WhatsApp
              </button>
              <button
                onClick={() => { if (!imprimirOrdemDeServico({ ...chamado, responsavel: nomeDoResponsavel(chamado, prestadores) })) avisar('Permita as janelas pop-up do navegador para gerar a O.S. para impressão.', 'error'); }}
                className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-md text-xs font-bold"
              >
                <Printer size={14} /> Imprimir O.S.
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">Prazo</p>
            {chamado.prazo ? (
              <p className={`flex items-center gap-1.5 ${aberto && diasParaPrazo < 0 ? 'text-red-700 font-medium' : 'text-gray-900'}`}>
                <Calendar size={15} /> {dataYmd(chamado.prazo)}
                {aberto && diasParaPrazo !== null && (
                  <span className="text-xs">
                    {diasParaPrazo < 0 ? `(atrasado há ${Math.abs(diasParaPrazo)} ${Math.abs(diasParaPrazo) === 1 ? 'dia' : 'dias'})` : diasParaPrazo === 0 ? '(vence hoje)' : `(faltam ${diasParaPrazo} ${diasParaPrazo === 1 ? 'dia' : 'dias'})`}
                  </span>
                )}
              </p>
            ) : <p className="text-gray-500">Sem prazo definido</p>}
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">Aberto</p>
            <p className="text-gray-900 flex items-center gap-1.5"><Clock size={15} /> {formatarDataHora(chamado.criadoEm) || 'Data não registrada'}</p>
            {chamado.solicitadaPorNome && <p className="text-gray-600 mt-0.5">por {chamado.solicitadaPorNome}</p>}
            {aberto && <p className="text-gray-600 mt-0.5">{dias === 0 ? 'hoje' : `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`}</p>}
          </div>

          {chamado.concluidoEm && (
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Concluído</p>
              <p className="text-gray-900 flex items-center gap-1.5"><CheckCircle2 size={15} /> {formatarDataHora(chamado.concluidoEm)}</p>
            </div>
          )}

          {chamado.observacoes && (
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Observações internas</p>
              <p className="text-gray-700 bg-yellow-50 p-3 rounded-md border border-yellow-100 whitespace-pre-wrap">{chamado.observacoes}</p>
            </div>
          )}
        </section>

        {/* Linha do tempo */}
        <section className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
            <h2 className="font-bold text-gray-800 flex items-center gap-2"><History size={18} /> Linha do tempo</h2>
          </div>
          <ol className="p-5 space-y-5">
            {eventos.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${e.cor}`} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-900"><strong>{e.titulo}</strong>{e.quem ? <span className="text-gray-600"> · {e.quem}</span> : null}</p>
                  {e.detalhes.map((d) => <p key={d} className="text-sm text-gray-600 break-words">{d}</p>)}
                  {e.quando && <p className="text-xs text-gray-500 mt-0.5">{e.quando}</p>}
                </div>
              </li>
            ))}
          </ol>
          {historico.length === 0 && (
            <p className="px-5 pb-5 text-xs text-gray-500">As mudanças passaram a ser registradas em 13/10/2026; alterações anteriores a isso não aparecem aqui.</p>
          )}
        </section>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <button onClick={() => setConfirmarExclusao(true)} className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1.5">
          <Trash2 size={15} /> Excluir este chamado
        </button>
      </div>

      <ConfirmDialog
        isOpen={confirmarExclusao}
        title="Excluir chamado"
        message="O chamado sai da lista e vai para a lixeira, de onde pode ser restaurado em Segurança dos dados."
        onConfirm={excluir}
        onCancel={() => setConfirmarExclusao(false)}
      />
      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
    </div>
  );
}
