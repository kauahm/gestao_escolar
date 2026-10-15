import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import {
  Plus, Edit2, Trash2, Landmark, School, Users, Wrench, Receipt, RefreshCcw, Baby, ChevronRight, Link2,
} from 'lucide-react';

import { db } from '../../services/firebase';
import { addDoc, updateDoc, deleteDoc } from '../../services/db';
import { useAlertas } from '../../contexts/AlertasContext';
import { formatarMoeda } from '../../utils/formatters';
import {
  MUNICIPIOS_SUGERIDOS, OBJETOS_DE_CONTRATO, ROTULO_DO_SEMAFORO, SEMAFORO, montarVisaoDaSede, situacaoDoContrato,
} from '../../utils/sede';
import { chave } from '../../importacao/normalizar';

import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { EsqueletoDeCartoes } from '../../components/ui/Esqueleto';

// Visão da sede: um cartão por município com semáforo (crítico, atenção, em
// dia), contratos (termos de colaboração) e a visão por escola. O semáforo
// usa as mesmas regras do quadro "Precisa de atenção hoje", escola por escola.
// Ver docs/21-visao-da-sede.md.

const ABAS = [
  { id: 'painel', rotulo: 'Painel por município' },
  { id: 'contratos', rotulo: 'Municípios e contratos' },
];
const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

const campo = 'w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary bg-white';
const rotulo = 'block text-sm font-medium text-gray-700 mb-1';
const botaoPrincipal = 'bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm';
const botaoSecundario = 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg flex items-center gap-2 font-medium';

const dataBr = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '');
const numero = (n) => Number(n || 0).toLocaleString('pt-BR');

const COR = {
  [SEMAFORO.CRITICO]: { ponto: 'bg-red-500', selo: 'bg-red-100 text-red-800', borda: 'border-red-200' },
  [SEMAFORO.ATENCAO]: { ponto: 'bg-amber-500', selo: 'bg-yellow-100 text-yellow-800', borda: 'border-amber-200' },
  [SEMAFORO.EM_DIA]: { ponto: 'bg-green-500', selo: 'bg-green-100 text-green-800', borda: 'border-gray-200' },
  [SEMAFORO.SEM_DADOS]: { ponto: 'bg-gray-400', selo: 'bg-gray-100 text-gray-700', borda: 'border-gray-200' },
};

function Semaforo({ valor }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${COR[valor].selo}`}>
      <span className={`h-2 w-2 rounded-full ${COR[valor].ponto}`} aria-hidden="true" />
      {ROTULO_DO_SEMAFORO[valor]}
    </span>
  );
}

function SeloDoContrato({ contrato }) {
  const s = situacaoDoContrato(contrato);
  const cor = s.encerrado ? 'bg-gray-100 text-gray-700' : s.aviso === 'urgente' ? 'bg-red-100 text-red-800' : s.aviso ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cor}`}>{s.rotulo}</span>;
}

export default function VisaoDaSede() {
  const [parametros, setParametros] = useSearchParams();
  const aba = ABAS.some((a) => a.id === parametros.get('aba')) ? parametros.get('aba') : 'painel';
  const dados = useAlertas();
  const { municipios, contratos, escolas } = dados;

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const avisar = (message, type = 'success') => setToast({ show: true, message, type });
  const [municipioAberto, setMunicipioAberto] = useState(null);
  const [contratoAberto, setContratoAberto] = useState(null);
  const [grupoAberto, setGrupoAberto] = useState(null);
  const [excluir, setExcluir] = useState(null);

  const visao = useMemo(() => montarVisaoDaSede(dados), [dados]);
  const carregando = dados.carregando || dados.carregandoSede;

  const confirmarExclusao = async () => {
    const { tipo, item } = excluir;
    setExcluir(null);
    try {
      await deleteDoc(doc(db, tipo === 'municipio' ? 'municipios' : 'contratos', item.id));
      avisar(`${tipo === 'municipio' ? item.nome : item.numero} foi para a lixeira.`);
    } catch (erro) {
      console.error(erro);
      avisar('Não foi possível excluir.', 'error');
    }
  };

  const pedirExclusaoDoMunicipio = (m) => {
    const n = contratos.filter((c) => c.municipioId === m.id).length;
    if (n) avisar(`${m.nome} tem ${n} ${n === 1 ? 'contrato' : 'contratos'}. Exclua ou mude os contratos antes.`, 'error');
    else setExcluir({ tipo: 'municipio', item: m });
  };
  const pedirExclusaoDoContrato = (c) => {
    const n = escolas.filter((e) => e.contratoId === c.id).length;
    if (n) avisar(`O contrato tem ${n} ${n === 1 ? 'escola ligada' : 'escolas ligadas'}. Desmarque as escolas no contrato antes de excluir.`, 'error');
    else setExcluir({ tipo: 'contrato', item: c });
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visão da sede</h1>
          <p className="text-gray-500 text-sm mt-1">Todos os municípios numa tela: o que está em dia, o que pede atenção e o que é crítico.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setMunicipioAberto({})} className={botaoSecundario}><Plus size={18} /> Novo município</button>
          <button onClick={() => (municipios.length ? setContratoAberto({}) : setMunicipioAberto({}))} className={botaoPrincipal}><Plus size={20} /> Novo contrato</button>
        </div>
      </div>

      <div role="tablist" aria-label="Partes da visão da sede" className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {ABAS.map((a) => (
          <button key={a.id} role="tab" type="button" aria-selected={aba === a.id} onClick={() => setParametros({ aba: a.id })}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${aba === a.id ? 'border-primary text-primary' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
            {a.rotulo}
          </button>
        ))}
      </div>

      {carregando ? (
        <EsqueletoDeCartoes quantidade={6} />
      ) : aba === 'contratos' ? (
        <MunicipiosEContratos
          municipios={municipios} contratos={contratos} escolas={escolas}
          novoMunicipio={() => setMunicipioAberto({})} editarMunicipio={setMunicipioAberto} excluirMunicipio={pedirExclusaoDoMunicipio}
          novoContrato={(m) => setContratoAberto(m ? { municipioId: m.id } : {})} editarContrato={setContratoAberto} excluirContrato={pedirExclusaoDoContrato}
        />
      ) : municipios.length === 0 ? (
        <EmptyState
          icone={Landmark}
          titulo="Cadastre os municípios e os contratos"
          mensagem="Cada município tem um ou mais contratos (termos de colaboração), e cada contrato atende algumas escolas. Com isso, esta tela mostra a situação de cada município de uma vez."
          acoes={[{ rotulo: 'Novo município', onClick: () => setMunicipioAberto({}) }]}
        />
      ) : (
        <Painel visao={visao} abrirGrupo={setGrupoAberto} irParaContratos={() => setParametros({ aba: 'contratos' })} />
      )}

      {grupoAberto && <DetalheDoMunicipio grupo={grupoAberto} fechar={() => setGrupoAberto(null)} />}
      {municipioAberto && <FormularioDeMunicipio municipio={municipioAberto} municipios={municipios} fechar={() => setMunicipioAberto(null)} avisar={avisar} />}
      {contratoAberto && (
        <FormularioDeContrato contrato={contratoAberto} municipios={municipios} contratos={contratos} escolas={escolas} fechar={() => setContratoAberto(null)} avisar={avisar} />
      )}

      <ConfirmDialog
        isOpen={!!excluir}
        title={excluir?.tipo === 'municipio' ? 'Excluir município' : 'Excluir contrato'}
        message={`${excluir?.tipo === 'municipio' ? excluir?.item.nome : excluir?.item.numero} vai para a lixeira, de onde pode ser restaurado.`}
        rotuloConfirmar="Excluir"
        onConfirm={confirmarExclusao}
        onCancel={() => setExcluir(null)}
      />
      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
    </div>
  );
}

// ================================================================ Painel ====

function Numero({ titulo, valor }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <p className="text-xs font-medium uppercase text-gray-500">{titulo}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{valor}</p>
    </div>
  );
}

function Indicador({ icone: Icone, rotulo: texto, valor, alerta }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icone size={16} className={alerta ? 'text-red-600 shrink-0' : 'text-gray-500 shrink-0'} aria-hidden="true" />
      <span className="text-sm text-gray-600 leading-tight">{texto}</span>
      <span className={`ml-auto text-sm font-semibold tabular-nums whitespace-nowrap ${alerta ? 'text-red-700' : 'text-gray-900'}`}>{valor}</span>
    </div>
  );
}

function CartaoDoMunicipio({ grupo, abrir }) {
  const { municipio, totais, contratos, semaforo } = grupo;
  return (
    <article className={`bg-white rounded-xl border ${COR[semaforo].borda} shadow-sm p-5 flex flex-col gap-4`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-gray-900 truncate">{municipio ? municipio.nome : 'Escolas sem contrato'}</h3>
          <p className="text-xs text-gray-500">{municipio ? `${municipio.uf} · ${contratos.length} ${contratos.length === 1 ? 'contrato' : 'contratos'}` : 'Ligue cada escola ao contrato do município'}</p>
        </div>
        <Semaforo valor={semaforo} />
      </header>

      {contratos.length > 0 && (
        <ul className="space-y-1">
          {contratos.map(({ contrato }) => (
            <li key={contrato.id} className="flex items-start justify-between gap-2 text-xs">
              <span className="text-gray-700 min-w-0">{contrato.numero}</span>
              <SeloDoContrato contrato={contrato} />
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
        <Indicador icone={School} rotulo="Escolas" valor={numero(totais.escolas)} />
        <Indicador icone={Baby} rotulo="Alunos" valor={numero(totais.alunos)} />
        <Indicador icone={Users} rotulo="Funcionários" valor={numero(totais.funcionariosAtivos)} />
        <Indicador icone={Wrench} rotulo="Chamados abertos" valor={numero(totais.chamadosAbertos)} />
        <Indicador icone={Receipt} rotulo="Contas vencidas" valor={totais.contasVencidas ? formatarMoeda(totais.valorVencido) : '0'} alerta={totais.contasVencidas > 0} />
        <Indicador icone={RefreshCcw} rotulo="Ciclos vencidos" valor={numero(totais.ciclosVencidos)} alerta={totais.ciclosVencidos > 0} />
      </div>

      <footer className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100 mt-auto">
        <span className="text-xs text-gray-600">
          {totais.criticos || totais.atencao
            ? [totais.criticos && `${totais.criticos} ${totais.criticos === 1 ? 'pendência crítica' : 'pendências críticas'}`, totais.atencao && `${totais.atencao} de atenção`].filter(Boolean).join(' · ')
            : 'Nenhuma pendência'}
        </span>
        <button type="button" onClick={abrir} className="text-sm font-medium text-primary hover:underline flex items-center gap-1 shrink-0">
          Ver escolas <ChevronRight size={16} aria-hidden="true" />
        </button>
      </footer>
    </article>
  );
}

function Painel({ visao, abrirGrupo, irParaContratos }) {
  const { totais, grupos, semMunicipio } = visao;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Numero titulo="Municípios atendidos" valor={numero(totais.municipios)} />
        <Numero titulo="Contratos vigentes" valor={numero(totais.contratosVigentes)} />
        <Numero titulo="Escolas ativas" valor={numero(totais.escolas)} />
        <Numero titulo="Alunos" valor={numero(totais.alunos)} />
        <Numero titulo="Funcionários" valor={numero(totais.funcionariosAtivos)} />
      </div>

      <p className="text-sm text-gray-600 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>Semáforo:</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" /> Crítico: prazo estourado, conta ou ciclo vencido</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" /> Atenção: chamado parado, ASO vencido, contrato no fim</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" /> Em dia</span>
      </p>

      {semMunicipio && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-3 text-sm">
          <span className="flex items-start gap-2"><Link2 size={18} className="shrink-0 mt-0.5" aria-hidden="true" /> {semMunicipio.escolas.length} {semMunicipio.escolas.length === 1 ? 'escola ainda não está ligada' : 'escolas ainda não estão ligadas'} a um contrato e ficam fora da conta por município.</span>
          <button type="button" onClick={irParaContratos} className="font-medium underline shrink-0">Ligar a um contrato</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
        {grupos.map((g) => <CartaoDoMunicipio key={g.municipio.id} grupo={g} abrir={() => abrirGrupo(g)} />)}
        {semMunicipio && <CartaoDoMunicipio grupo={semMunicipio} abrir={() => abrirGrupo(semMunicipio)} />}
      </div>
    </div>
  );
}

function DetalheDoMunicipio({ grupo, fechar }) {
  const titulo = grupo.municipio ? `${grupo.municipio.nome} · escolas` : 'Escolas sem contrato';
  const itens = [...grupo.escolas].sort((a, b) => Number(b.ativa) - Number(a.ativa) || String(a.escola.nome).localeCompare(String(b.escola.nome), 'pt-BR'));
  return (
    <Modal isOpen onClose={fechar} title={titulo} size="lg">
      {itens.length === 0 ? (
        <p className="text-sm text-gray-600">Nenhuma escola ligada aos contratos deste município. Edite um contrato e marque as escolas que ele atende.</p>
      ) : (
        <div className="overflow-x-auto -mx-2" tabIndex={0} role="region" aria-label={`Situação das escolas: ${titulo}`}>
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="px-2 py-2 text-left font-medium">Escola</th>
                <th className="px-2 py-2 text-left font-medium">Situação</th>
                <th className="px-2 py-2 text-right font-medium">Alunos</th>
                <th className="px-2 py-2 text-right font-medium">Chamados</th>
                <th className="px-2 py-2 text-right font-medium">Contas vencidas</th>
                <th className="px-2 py-2 text-right font-medium">Ciclos vencidos</th>
                <th className="px-2 py-2 text-right font-medium">Funcionários</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 tabular-nums">
              {itens.map((i) => (
                <tr key={i.escola.id} className={i.ativa ? '' : 'text-gray-500'}>
                  <td className="px-2 py-2 font-medium text-gray-900">{i.escola.nome}{!i.ativa && <span className="text-xs font-normal text-gray-500"> (inativa)</span>}</td>
                  <td className="px-2 py-2">{i.ativa ? <Semaforo valor={i.semaforo} /> : '—'}</td>
                  <td className="px-2 py-2 text-right">{numero(i.alunos)}</td>
                  <td className="px-2 py-2 text-right">{numero(i.chamadosAbertos)}</td>
                  <td className={`px-2 py-2 text-right whitespace-nowrap ${i.contasVencidas ? 'text-red-700 font-semibold' : ''}`}>{i.contasVencidas ? `${i.contasVencidas} · ${formatarMoeda(i.valorVencido)}` : '0'}</td>
                  <td className={`px-2 py-2 text-right ${i.ciclosVencidos ? 'text-red-700 font-semibold' : ''}`}>{numero(i.ciclosVencidos)}</td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">{numero(i.funcionariosAtivos)}{i.afastados ? <span className="text-xs text-gray-500"> ({i.afastados} afast.)</span> : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500 mt-4">O detalhe de cada pendência fica no Painel (quadro "Precisa de atenção hoje") e nas telas de Manutenções, Contas a pagar e Ciclos.</p>
    </Modal>
  );
}

// ============================================= Municípios e contratos ====

function MunicipiosEContratos({ municipios, contratos, escolas, novoMunicipio, editarMunicipio, excluirMunicipio, novoContrato, editarContrato, excluirContrato }) {
  const ordenados = [...municipios].sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  const idsDeContrato = new Set(contratos.map((c) => c.id));
  const semContrato = escolas.filter((e) => !idsDeContrato.has(e.contratoId) && e.situacao !== 'Inativa');

  if (!municipios.length) {
    return (
      <EmptyState
        icone={Landmark}
        titulo="Nenhum município cadastrado"
        mensagem="Comece pelo município (os 16 com contrato ativo da AEMC aparecem como sugestão) e depois cadastre o contrato, marcando as escolas que ele atende."
        acoes={[{ rotulo: 'Novo município', onClick: novoMunicipio }]}
      />
    );
  }

  return (
    <div className="space-y-4">
      {semContrato.length > 0 && (
        <p className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-3">
          Escolas ativas sem contrato: {semContrato.map((e) => e.nome).join(', ')}. Edite o contrato do município e marque essas escolas.
        </p>
      )}
      {ordenados.map((m) => {
        const doMunicipio = contratos.filter((c) => c.municipioId === m.id).sort((a, b) => String(b.fim || '').localeCompare(String(a.fim || '')));
        return (
          <section key={m.id} className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{m.nome} <span className="text-sm font-normal text-gray-500">· {m.uf}</span></h2>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => novoContrato(m)} className="text-sm text-primary hover:underline px-2 py-1 flex items-center gap-1"><Plus size={14} /> Contrato</button>
                <button onClick={() => editarMunicipio(m)} className="p-1.5 text-gray-500 hover:text-gray-900" title={`Editar ${m.nome}`} aria-label={`Editar ${m.nome}`}><Edit2 size={18} /></button>
                <button onClick={() => excluirMunicipio(m)} className="p-1.5 text-red-600 hover:text-red-800" title={`Excluir ${m.nome}`} aria-label={`Excluir ${m.nome}`}><Trash2 size={18} /></button>
              </div>
            </header>
            {doMunicipio.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-600">Nenhum contrato. <button type="button" onClick={() => novoContrato(m)} className="text-primary hover:underline">Cadastrar o contrato</button></p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {doMunicipio.map((c) => {
                  const ligadas = escolas.filter((e) => e.contratoId === c.id);
                  return (
                    <li key={c.id} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 flex flex-wrap items-center gap-2">{c.numero} <SeloDoContrato contrato={c} /></p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {[c.objeto, (c.inicio || c.fim) && `vigência ${dataBr(c.inicio) || '?'} a ${dataBr(c.fim) || 'sem data'}`, c.valorGlobal ? `valor global ${formatarMoeda(c.valorGlobal)}` : ''].filter(Boolean).join(' · ')}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{ligadas.length ? `${ligadas.length} ${ligadas.length === 1 ? 'escola' : 'escolas'}: ${ligadas.map((e) => e.nome).join(', ')}` : 'Nenhuma escola ligada'}</p>
                      </div>
                      <div className="flex items-center gap-1 self-end md:self-auto">
                        <button onClick={() => editarContrato(c)} className="p-1.5 text-gray-500 hover:text-gray-900" title={`Editar ${c.numero}`} aria-label={`Editar ${c.numero}`}><Edit2 size={18} /></button>
                        <button onClick={() => excluirContrato(c)} className="p-1.5 text-red-600 hover:text-red-800" title={`Excluir ${c.numero}`} aria-label={`Excluir ${c.numero}`}><Trash2 size={18} /></button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ========================================================== Formulários ====

function Campo({ id, rotulo: texto, erro, ajuda, largo, children }) {
  return (
    <div className={largo ? 'sm:col-span-2' : ''}>
      <label htmlFor={id} className={rotulo}>{texto}</label>
      {children}
      {ajuda && !erro && <p className="text-xs text-gray-500 mt-1">{ajuda}</p>}
      {erro && <p className="text-xs text-red-600 mt-1">{erro}</p>}
    </div>
  );
}

function Rodape({ salvando, fechar }) {
  return (
    <div className="flex justify-end gap-3 pt-4 border-t">
      <button type="button" onClick={fechar} disabled={salvando} className="px-4 py-2 text-sm text-gray-700 border rounded-md hover:bg-gray-50">Cancelar</button>
      <button type="submit" disabled={salvando} className="px-4 py-2 text-sm text-white bg-primary rounded-md hover:bg-primary-dark min-w-32 flex justify-center">
        {salvando ? <LoadingSpinner size="sm" color="text-white" /> : 'Salvar'}
      </button>
    </div>
  );
}

function FormularioDeMunicipio({ municipio, municipios, fechar, avisar }) {
  const editando = !!municipio.id;
  const [nome, setNome] = useState(municipio.nome || '');
  const [uf, setUf] = useState(municipio.uf || 'SP');
  const [observacao, setObservacao] = useState(municipio.observacao || '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const sugestoes = MUNICIPIOS_SUGERIDOS.filter(([n]) => !municipios.some((m) => chave(m.nome) === chave(n)));

  const mudarNome = (v) => {
    setNome(v);
    const sugerido = MUNICIPIOS_SUGERIDOS.find(([n]) => chave(n) === chave(v));
    if (sugerido) setUf(sugerido[1]);
    setErro('');
  };

  const salvar = async (e) => {
    e.preventDefault();
    const limpo = nome.trim().replace(/\s+/g, ' ');
    if (!limpo) { setErro('Informe o nome do município'); return; }
    if (municipios.some((m) => m.id !== municipio.id && chave(m.nome) === chave(limpo) && m.uf === uf)) { setErro('Este município já está cadastrado'); return; }
    setSalvando(true);
    try {
      const registro = { nome: limpo, uf, observacao: observacao.trim(), atualizadoEm: serverTimestamp() };
      if (editando) await updateDoc(doc(db, 'municipios', municipio.id), registro);
      else await addDoc(collection(db, 'municipios'), { ...registro, criadoEm: serverTimestamp() });
      avisar(editando ? 'Município atualizado.' : `${limpo} cadastrado. Agora cadastre o contrato.`);
      fechar();
    } catch (falha) {
      console.error(falha);
      avisar('Não foi possível salvar o município.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !salvando && fechar()} title={editando ? `Editar: ${municipio.nome}` : 'Novo município'}>
      <form onSubmit={salvar} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="sm:col-span-3">
            <Campo id="m-nome" rotulo="Município *" erro={erro} ajuda="Os municípios com contrato ativo da AEMC aparecem como sugestão.">
              <input id="m-nome" list="municipios-sugeridos" value={nome} onChange={(e) => mudarNome(e.target.value)} className={campo} autoComplete="off" />
              <datalist id="municipios-sugeridos">{sugestoes.map(([n, u]) => <option key={n} value={n}>{u}</option>)}</datalist>
            </Campo>
          </div>
          <Campo id="m-uf" rotulo="UF *">
            <select id="m-uf" value={uf} onChange={(e) => setUf(e.target.value)} className={campo}>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </Campo>
        </div>
        <Campo id="m-obs" rotulo="Observação">
          <input id="m-obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} className={campo} placeholder="Ex.: escritório regional, contato da Secretaria" />
        </Campo>
        <Rodape salvando={salvando} fechar={fechar} />
      </form>
    </Modal>
  );
}

function FormularioDeContrato({ contrato, municipios, contratos, escolas, fechar, avisar }) {
  const editando = !!contrato.id;
  const [dados, setDados] = useState({
    municipioId: contrato.municipioId || (municipios.length === 1 ? municipios[0].id : ''),
    numero: contrato.numero || '',
    objeto: contrato.objeto || '',
    inicio: contrato.inicio || '',
    fim: contrato.fim || '',
    valorGlobal: contrato.valorGlobal ?? '',
    observacao: contrato.observacao || '',
  });
  const [marcadas, setMarcadas] = useState(() => new Set(editando ? escolas.filter((e) => e.contratoId === contrato.id).map((e) => e.id) : []));
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);

  const mudar = (e) => {
    const { name, value } = e.target;
    setDados((d) => ({ ...d, [name]: value }));
    if (erros[name]) setErros((x) => ({ ...x, [name]: '' }));
  };
  const alternar = (id) => setMarcadas((m) => {
    const novo = new Set(m);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    return novo;
  });

  const contratoPorId = new Map(contratos.map((c) => [c.id, c]));
  const nomeDoMunicipio = new Map(municipios.map((m) => [m.id, m.nome]));
  const ordenadas = [...escolas].sort((a, b) => Number(a.situacao === 'Inativa') - Number(b.situacao === 'Inativa') || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));

  const salvar = async (ev) => {
    ev.preventDefault();
    const e = {};
    if (!dados.municipioId) e.municipioId = 'Escolha o município';
    if (!dados.numero.trim()) e.numero = 'Informe o número do contrato';
    if (dados.inicio && dados.fim && dados.fim < dados.inicio) e.fim = 'O fim é antes do início';
    if (dados.valorGlobal !== '' && Number(dados.valorGlobal) < 0) e.valorGlobal = 'Valor inválido';
    setErros(e);
    if (Object.keys(e).length) return;
    setSalvando(true);
    try {
      const registro = {
        municipioId: dados.municipioId,
        numero: dados.numero.trim().replace(/\s+/g, ' '),
        objeto: dados.objeto.trim(),
        inicio: dados.inicio,
        fim: dados.fim,
        valorGlobal: dados.valorGlobal === '' ? null : Math.round(Number(dados.valorGlobal) * 100) / 100,
        observacao: dados.observacao.trim(),
        atualizadoEm: serverTimestamp(),
      };
      let id = contrato.id;
      if (editando) await updateDoc(doc(db, 'contratos', id), registro);
      else id = (await addDoc(collection(db, 'contratos'), { ...registro, criadoEm: serverTimestamp() })).id;

      // Liga e desliga escolas (cada mudança entra no histórico da escola).
      const mudancas = escolas.filter((es) => marcadas.has(es.id) !== (es.contratoId === id));
      for (const es of mudancas) {
        await updateDoc(doc(db, 'escolas', es.id), { contratoId: marcadas.has(es.id) ? id : '' });
      }
      avisar(`Contrato salvo${mudancas.length ? `; ${mudancas.length} ${mudancas.length === 1 ? 'escola atualizada' : 'escolas atualizadas'}` : ''}.`);
      fechar();
    } catch (falha) {
      console.error(falha);
      avisar('Não foi possível salvar o contrato. Confira e tente de novo.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !salvando && fechar()} title={editando ? 'Editar contrato' : 'Novo contrato'} size="lg">
      <form onSubmit={salvar} className="space-y-5" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo id="c-mun" rotulo="Município *" erro={erros.municipioId}>
            <select id="c-mun" name="municipioId" value={dados.municipioId} onChange={mudar} className={campo}>
              <option value="">Escolha o município</option>
              {[...municipios].sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')).map((m) => <option key={m.id} value={m.id}>{m.nome} ({m.uf})</option>)}
            </select>
          </Campo>
          <Campo id="c-num" rotulo="Número *" erro={erros.numero}>
            <input id="c-num" name="numero" value={dados.numero} onChange={mudar} className={campo} placeholder="Ex.: Termo de Colaboração nº 001/2021" autoComplete="off" />
          </Campo>
          <Campo id="c-obj" rotulo="Objeto" largo ajuda="Escolha da lista ou digite outro.">
            <input id="c-obj" name="objeto" list="objetos-de-contrato" value={dados.objeto} onChange={mudar} className={campo} autoComplete="off" />
            <datalist id="objetos-de-contrato">{OBJETOS_DE_CONTRATO.map((o) => <option key={o} value={o} />)}</datalist>
          </Campo>
          <Campo id="c-ini" rotulo="Início da vigência">
            <input id="c-ini" name="inicio" type="date" value={dados.inicio} onChange={mudar} className={campo} />
          </Campo>
          <Campo id="c-fim" rotulo="Fim da vigência" erro={erros.fim} ajuda="O sistema avisa 90 dias antes.">
            <input id="c-fim" name="fim" type="date" value={dados.fim} onChange={mudar} className={campo} />
          </Campo>
          <Campo id="c-valor" rotulo="Valor global (R$)" erro={erros.valorGlobal}>
            <input id="c-valor" name="valorGlobal" type="number" step="0.01" min="0" inputMode="decimal" value={dados.valorGlobal} onChange={mudar} className={campo} />
          </Campo>
          <Campo id="c-obs" rotulo="Observação">
            <input id="c-obs" name="observacao" value={dados.observacao} onChange={mudar} className={campo} />
          </Campo>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-gray-900">Escolas atendidas por este contrato</legend>
          <p className="text-xs text-gray-500 mt-0.5">Cada escola fica em um contrato só: marcar aqui tira a escola do contrato anterior.</p>
          {escolas.length === 0 ? (
            <p className="text-sm text-gray-600 mt-2">Nenhuma escola cadastrada ainda.</p>
          ) : (
            <ul className="mt-2 max-h-60 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
              {ordenadas.map((es) => {
                const outro = es.contratoId && es.contratoId !== contrato.id ? contratoPorId.get(es.contratoId) : null;
                return (
                  <li key={es.id}>
                    <label className="flex items-start gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" checked={marcadas.has(es.id)} onChange={() => alternar(es.id)} className="h-4 w-4 mt-0.5" />
                      <span>
                        {es.nome}{es.situacao === 'Inativa' && <span className="text-gray-500"> (inativa)</span>}
                        {outro && <span className="block text-xs text-amber-700">hoje em: {nomeDoMunicipio.get(outro.municipioId) || '?'} · {outro.numero}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>

        <Rodape salvando={salvando} fechar={fechar} />
      </form>
    </Modal>
  );
}
