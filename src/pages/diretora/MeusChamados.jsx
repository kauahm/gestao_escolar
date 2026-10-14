import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useSearchParams } from 'react-router-dom';
import { Plus, MapPin, Clock, User, Calendar, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

import { db } from '../../services/firebase';
import { ouvir } from '../../services/leitura';
import { useAuth } from '../../hooks/useAuth';
import { formatarDataHora } from '../../utils/formatters';
import { diasEmAberto } from '../../utils/calcularStatus';

import Badge from '../../components/ui/Badge';
import Toast from '../../components/ui/Toast';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { EsqueletoDeLista } from '../../components/ui/Esqueleto';
import SolicitarManutencao from '../../components/shared/SolicitarManutencao';

// Todos os chamados de manutenção da escola da diretora, com o andamento de
// cada um. (A diretora não lê o histórico completo: as regras reservam isso
// à administração. O andamento vem das datas gravadas no próprio chamado.)

const FILTROS = [
  { id: 'abertos', rotulo: 'Em aberto', teste: (m) => m.status !== 'Concluído' },
  { id: 'concluidos', rotulo: 'Concluídos', teste: (m) => m.status === 'Concluído' },
  { id: 'todos', rotulo: 'Todos', teste: () => true },
];

const corDoStatus = (s) => (s === 'Concluído' ? 'green' : s === 'Em andamento' ? 'blue' : 'gray');
const corDaPrioridade = (p) => (p === 'Alta' || p === 'Urgente' ? 'red' : p === 'Média' ? 'yellow' : 'green');
const emMs = (t) => (t?.toMillis ? t.toMillis() : 0);

const TEXTO_DO_STATUS = {
  Pendente: 'Recebido pela administração, aguardando atendimento.',
  'Em andamento': 'Em atendimento.',
  Concluído: 'Serviço concluído.',
};

export default function MeusChamados() {
  const { userProfile } = useAuth();
  const [chamados, setChamados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('abertos');
  const [aberto, setAberto] = useState(null);
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [parametros, setParametros] = useSearchParams();

  // Botão "Pedir manutenção" da barra inferior: abre o formulário direto.
  useEffect(() => {
    if (parametros.get('nova')) {
      setFormularioAberto(true);
      setParametros({}, { replace: true });
    }
  }, [parametros, setParametros]);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    if (!userProfile?.unidadeId) return undefined;
    return ouvir(
      query(collection(db, 'manutencoes'), where('escolaId', '==', userProfile.unidadeId)),
      (s) => { setChamados(s.docs.map((d) => ({ id: d.id, ...d.data() }))); setCarregando(false); },
      () => setCarregando(false),
    );
  }, [userProfile]);

  const lista = useMemo(() => {
    const teste = FILTROS.find((f) => f.id === filtro).teste;
    return chamados.filter(teste).sort((a, b) => emMs(b.criadoEm) - emMs(a.criadoEm));
  }, [chamados, filtro]);

  const contagem = (id) => chamados.filter(FILTROS.find((f) => f.id === id).teste).length;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meus chamados</h1>
          <p className="text-gray-500 text-sm mt-1 flex items-center gap-1.5"><MapPin size={14} /> {userProfile?.unidadeNome || 'Escola não atribuída'}</p>
        </div>
        <button onClick={() => setFormularioAberto(true)} className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-bold shadow-sm w-full sm:w-auto justify-center">
          <Plus size={20} /> Nova solicitação
        </button>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar chamados">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filtro === f.id}
            onClick={() => setFiltro(f.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border ${filtro === f.id ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            {f.rotulo} ({contagem(f.id)})
          </button>
        ))}
      </div>

      {carregando ? (
        <EsqueletoDeLista linhas={4} compacto />
      ) : lista.length === 0 ? (
        chamados.length === 0 ? (
          <EmptyState
            titulo="Nenhum chamado ainda"
            mensagem="Quando algo quebrar ou precisar de conserto na escola, abra uma solicitação. A administração recebe na hora."
            acoes={[{ rotulo: 'Nova solicitação', onClick: () => setFormularioAberto(true) }]}
          />
        ) : (
          <EmptyState
            titulo={filtro === 'abertos' ? 'Nenhum chamado em aberto' : 'Nenhum chamado concluído ainda'}
            mensagem={filtro === 'abertos' ? 'Tudo o que foi pedido já foi atendido.' : 'Os chamados aparecem aqui depois de concluídos.'}
            acoes={[{ rotulo: 'Ver todos', onClick: () => setFiltro('todos') }]}
          />
        )
      ) : (
        <ul className="space-y-3">
          {lista.map((m) => {
            const expandido = aberto === m.id;
            const dias = diasEmAberto(m.criadoEm);
            return (
              <li key={m.id} className="bg-white border border-gray-200 rounded-lg shadow-sm">
                <button
                  type="button"
                  onClick={() => setAberto(expandido ? null : m.id)}
                  aria-expanded={expandido}
                  className="w-full text-left p-4 flex gap-3 items-start"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge label={m.status} color={corDoStatus(m.status)} />
                      <Badge label={m.prioridade || 'Baixa'} color={corDaPrioridade(m.prioridade)} />
                    </div>
                    <p className="font-semibold text-gray-900 truncate">{m.localDentroEscola || 'Local não informado'}</p>
                    <p className={`text-sm text-gray-600 whitespace-pre-wrap ${expandido ? '' : 'line-clamp-2'}`}>{m.descricao}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Aberto {m.criadoEm ? `em ${formatarDataHora(m.criadoEm)}` : ''}{m.status !== 'Concluído' && m.criadoEm ? (dias === 0 ? ' · hoje' : ` · há ${dias} ${dias === 1 ? 'dia' : 'dias'}`) : ''}
                    </p>
                  </div>
                  {expandido ? <ChevronUp size={20} className="text-gray-500 shrink-0" /> : <ChevronDown size={20} className="text-gray-500 shrink-0" />}
                </button>

                {expandido && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 text-sm space-y-2">
                    <p className="text-gray-800">{TEXTO_DO_STATUS[m.status] || ''}</p>
                    <p className="flex items-center gap-1.5 text-gray-700"><User size={15} /> Responsável: {m.responsavel && m.responsavel !== 'A definir' ? m.responsavel : 'ainda não definido'}</p>
                    {m.prazo && <p className="flex items-center gap-1.5 text-gray-700"><Calendar size={15} /> Prazo previsto: {m.prazo.split('-').reverse().join('/')}</p>}
                    <p className="flex items-center gap-1.5 text-gray-700"><Clock size={15} /> Aberto por {m.solicitadaPorNome || 'administração'}{m.criadoEm ? ` em ${formatarDataHora(m.criadoEm)}` : ''}</p>
                    {m.concluidoEm && <p className="flex items-center gap-1.5 text-green-700"><CheckCircle2 size={15} /> Concluído em {formatarDataHora(m.concluidoEm)}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <SolicitarManutencao
        isOpen={formularioAberto}
        onClose={() => setFormularioAberto(false)}
        onEnviado={(msg) => { setFiltro('abertos'); setToast({ show: true, message: msg, type: 'success' }); }}
      />
      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
    </div>
  );
}
