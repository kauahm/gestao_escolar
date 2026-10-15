import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import {
  Plus, Search, Upload, Download, Edit2, Trash2, X, Wallet, AlertTriangle, Settings2, Save,
} from 'lucide-react';

import { db } from '../../services/firebase';
import { ouvir } from '../../services/leitura';
import { addDoc, updateDoc, deleteDoc, setDoc } from '../../services/db';
import { formatarMoeda } from '../../utils/formatters';
import {
  RUBRICAS_SUGERIDAS, SITUACAO, calcularSaldo, comoFicou, mesAtualNoPeriodo, mesDe, mesesDoPeriodo,
  parcelasDoGasto, rotuloCurto, rotuloDoMes, somarMeses,
} from '../../utils/saldo';
import { chave } from '../../importacao/normalizar';
import { gerarXlsx } from '../../utils/planilhaXlsx';
import { baixarArquivo } from '../../importacao/arquivos';

import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { EsqueletoDeLista } from '../../components/ui/Esqueleto';
import ImportarPlanilha from '../../components/shared/ImportarPlanilha';

// Controle de saldo das verbas: cada área (rubrica) tem uma verba mensal; os
// gastos lançados descontam do mês em que caem (parcelados, um pedaço por mês)
// e o sistema calcula quanto ainda pode ser gasto. Mesma regra da planilha
// "Controle de Saldo" da AEMC. Ver docs/20-controle-de-saldo.md.

const ABAS = [
  { id: 'painel', rotulo: 'Painel' },
  { id: 'lancamentos', rotulo: 'Lançamentos' },
  { id: 'mes-a-mes', rotulo: 'Mês a mês' },
  { id: 'areas', rotulo: 'Áreas e verbas' },
];

const campo = 'w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary bg-white';
const rotulo = 'block text-sm font-medium text-gray-700 mb-1';
const botaoPrincipal = 'bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm';
const botaoSecundario = 'bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg flex items-center gap-2 font-medium';

const dataBr = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '');
const pct = (v) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const hojeYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const COR_DA_SITUACAO = {
  [SITUACAO.SEM_VERBA]: 'bg-gray-100 text-gray-700',
  [SITUACAO.ESTOURADA]: 'bg-red-100 text-red-800',
  [SITUACAO.PASSOU]: 'bg-red-100 text-red-800',
  [SITUACAO.PERTO]: 'bg-yellow-100 text-yellow-800',
  [SITUACAO.DENTRO]: 'bg-green-100 text-green-800',
};

function SeloDaSituacao({ situacao }) {
  return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${COR_DA_SITUACAO[situacao]}`}>{situacao}</span>;
}

function BarraDeUso({ usado }) {
  const largura = Math.min(100, Math.max(0, usado * 100));
  const cor = usado > 1 ? 'bg-red-500' : usado >= 0.8 ? 'bg-amber-500' : 'bg-primary';
  return (
    <div className="flex items-center gap-2 min-w-24">
      <div className="h-2 flex-1 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
        <div className={`h-full ${cor}`} style={{ width: `${largura}%` }} />
      </div>
      <span className="text-xs text-gray-600 tabular-nums w-12 text-right">{pct(usado)}</span>
    </div>
  );
}

export default function ControleDeSaldo() {
  const [parametros, setParametros] = useSearchParams();
  const aba = ABAS.some((a) => a.id === parametros.get('aba')) ? parametros.get('aba') : 'painel';
  const irPara = (id, extra = {}) => setParametros({ aba: id, ...extra });

  const [rubricas, setRubricas] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [periodo, setPeriodo] = useState(null);
  const [carregando, setCarregando] = useState({ rubricas: true, gastos: true, periodo: true });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const avisar = (message, type = 'success') => setToast({ show: true, message, type });

  const [gastoAberto, setGastoAberto] = useState(null); // null | {} (novo) | gasto
  const [areaAberta, setAreaAberta] = useState(null);
  const [excluir, setExcluir] = useState(null); // { tipo: 'gasto'|'area', item }
  const [importar, setImportar] = useState(null); // 'gastos' | 'rubricas'

  useEffect(() => {
    const pronto = (k) => setCarregando((c) => ({ ...c, [k]: false }));
    const parar = [
      ouvir(collection(db, 'rubricas'), (s) => {
        setRubricas(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')));
        pronto('rubricas');
      }, () => pronto('rubricas')),
      ouvir(collection(db, 'gastos'), (s) => {
        setGastos(s.docs.map((d) => ({ id: d.id, ...d.data() })));
        pronto('gastos');
      }, () => pronto('gastos')),
      ouvir(doc(db, 'config', 'saldo'), (s) => {
        setPeriodo(s.exists() ? s.data() : null);
        pronto('periodo');
      }, () => pronto('periodo')),
    ];
    return () => parar.forEach((p) => p());
  }, []);

  const meses = useMemo(() => mesesDoPeriodo(periodo), [periodo]);
  const [mesEscolhido, setMesEscolhido] = useState('');
  const mes = meses.includes(mesEscolhido) ? mesEscolhido : mesAtualNoPeriodo(periodo);
  const saldo = useMemo(() => calcularSaldo({ rubricas, gastos, periodo, mes }), [rubricas, gastos, periodo, mes]);

  const estaCarregando = carregando.rubricas || carregando.gastos || carregando.periodo;
  const configurado = meses.length > 0 && rubricas.length > 0;

  const confirmarExclusao = async () => {
    const { tipo, item } = excluir;
    setExcluir(null);
    try {
      await deleteDoc(doc(db, tipo === 'gasto' ? 'gastos' : 'rubricas', item.id));
      avisar(tipo === 'gasto' ? 'Lançamento enviado para a lixeira.' : `A área "${item.nome}" foi para a lixeira.`);
    } catch (erro) {
      console.error(erro);
      avisar('Não foi possível excluir.', 'error');
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Controle de saldo</h1>
          <p className="text-gray-500 text-sm mt-1">
            {meses.length
              ? `Período: ${rotuloDoMes(meses[0])} a ${rotuloDoMes(meses[meses.length - 1])} (${meses.length} ${meses.length === 1 ? 'mês' : 'meses'})${periodo?.nome ? ` · ${periodo.nome}` : ''}`
              : 'Verba de cada área, o que já foi gasto e quanto ainda pode gastar em cada mês.'}
          </p>
        </div>
        {configurado && (
          <button onClick={() => setGastoAberto({})} className={botaoPrincipal}><Plus size={20} /> Lançar gasto</button>
        )}
      </div>

      <div role="tablist" aria-label="Partes do controle de saldo" className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {ABAS.map((a) => (
          <button
            key={a.id}
            role="tab"
            type="button"
            aria-selected={aba === a.id}
            onClick={() => irPara(a.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${aba === a.id ? 'border-primary text-primary' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {estaCarregando ? (
        <EsqueletoDeLista linhas={6} />
      ) : aba === 'areas' ? (
        <AreasEVerbas
          rubricas={rubricas} gastos={gastos} periodo={periodo} meses={meses} avisar={avisar}
          novaArea={() => setAreaAberta({})} editarArea={setAreaAberta}
          excluirArea={(r) => setExcluir({ tipo: 'area', item: r })} importar={() => setImportar('rubricas')}
        />
      ) : !configurado ? (
        <EmptyState
          icone={Wallet}
          titulo={meses.length ? 'Cadastre as áreas de gasto' : 'Comece pelo período e pelas áreas'}
          mensagem="Em Áreas e verbas, informe o mês inicial e quantos meses vale a verba, e cadastre as áreas (Manutenção, Brinquedos...) com a verba mensal de cada uma. Dá para trazer tudo da planilha de controle de saldo."
          acoes={[{ rotulo: 'Ir para Áreas e verbas', onClick: () => irPara('areas'), icone: Settings2 }]}
        />
      ) : aba === 'lancamentos' ? (
        <Lancamentos
          gastos={gastos} rubricas={rubricas} meses={meses} parametros={parametros} irPara={irPara}
          novo={() => setGastoAberto({})} editar={setGastoAberto} excluir={(g) => setExcluir({ tipo: 'gasto', item: g })}
          importar={() => setImportar('gastos')} avisar={avisar}
        />
      ) : aba === 'mes-a-mes' ? (
        <MesAMes saldo={saldo} meses={meses} mesAtual={mesAtualNoPeriodo(periodo)} />
      ) : (
        <Painel saldo={saldo} meses={meses} mes={mes} setMes={setMesEscolhido} irPara={irPara} />
      )}

      {gastoAberto && (
        <FormularioDeGasto
          gasto={gastoAberto} rubricas={rubricas} gastos={gastos} periodo={periodo} mesSugerido={mes}
          fechar={() => setGastoAberto(null)} avisar={avisar}
        />
      )}
      {areaAberta && (
        <FormularioDeArea area={areaAberta} rubricas={rubricas} meses={meses} fechar={() => setAreaAberta(null)} avisar={avisar} />
      )}

      <ConfirmDialog
        isOpen={!!excluir}
        title={excluir?.tipo === 'area' ? 'Excluir área' : 'Excluir lançamento'}
        message={excluir?.tipo === 'area'
          ? `A área "${excluir?.item.nome}" vai para a lixeira, de onde pode ser restaurada.`
          : `O lançamento de ${formatarMoeda(excluir?.item.valorTotal || 0)}${excluir?.item.fornecedor ? ` (${excluir.item.fornecedor})` : ''} vai para a lixeira e o saldo é recalculado.`}
        rotuloConfirmar="Excluir"
        onConfirm={confirmarExclusao}
        onCancel={() => setExcluir(null)}
      />

      <ImportarPlanilha
        isOpen={!!importar}
        onClose={() => setImportar(null)}
        tipo={importar || 'gastos'}
        rubricas={rubricas}
        existentes={importar === 'rubricas' ? rubricas : gastos}
      />
      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
    </div>
  );
}

// ================================================================ Painel ====

function Cartao({ titulo, valor, detalhe, tom = 'normal' }) {
  const cor = tom === 'perigo' ? 'text-red-700' : tom === 'destaque' ? 'text-primary' : 'text-gray-900';
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <p className="text-xs font-medium uppercase text-gray-500">{titulo}</p>
      <p className={`text-xl font-bold mt-1 tabular-nums ${cor}`}>{valor}</p>
      {detalhe && <div className="mt-2">{detalhe}</div>}
    </div>
  );
}

function Painel({ saldo, meses, mes, setMes, irPara }) {
  const { totais, linhas } = saldo;
  const verExtrato = (r) => irPara('lancamentos', { area: r.id });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="mes-em-analise" className="text-sm font-medium text-gray-700">Mês em análise</label>
        <select id="mes-em-analise" value={mes} onChange={(e) => setMes(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md bg-white">
          {meses.map((m) => <option key={m} value={m}>{rotuloDoMes(m)}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Cartao titulo="Verba do período" valor={formatarMoeda(totais.verba)} />
        <Cartao titulo="Já lançado" valor={formatarMoeda(totais.lancado)} />
        <Cartao titulo="Saldo disponível" valor={formatarMoeda(totais.saldo)} tom={totais.saldo < 0 ? 'perigo' : 'normal'} />
        <Cartao titulo="Verba usada" valor={pct(totais.usado)} detalhe={<BarraDeUso usado={totais.usado} />} />
        <Cartao titulo={`Pode gastar em ${rotuloDoMes(mes)}`} valor={formatarMoeda(totais.aindaPode)} tom="destaque" />
      </div>

      {totais.foraDoPeriodo > 0 && (
        <p className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-3">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          {formatarMoeda(totais.foraDoPeriodo)} em parcelas caem fora do período e não entram nesta conta. Quando abrir o próximo período, elas passam a contar.
        </p>
      )}
      {saldo.semRubrica > 0 && (
        <p className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-3">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          {formatarMoeda(saldo.semRubrica)} em lançamentos de uma área que foi excluída. Edite esses lançamentos em Lançamentos para escolher outra área.
        </p>
      )}

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Situação por área · {rotuloDoMes(mes)}</h2>

        {/* Celular: um cartão por área */}
        <ul className="md:hidden space-y-3">
          {linhas.map((l) => (
            <li key={l.rubrica.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <button type="button" onClick={() => verExtrato(l.rubrica)} className="text-left font-medium text-gray-900 hover:text-primary">{l.rubrica.nome}</button>
                <SeloDaSituacao situacao={l.situacao} />
              </div>
              <p className="text-sm text-gray-600">Ainda pode gastar no mês: <strong className={l.aindaPode < 0 ? 'text-red-700' : 'text-gray-900'}>{formatarMoeda(l.aindaPode)}</strong></p>
              <p className="text-xs text-gray-500">Teto do mês {formatarMoeda(l.teto)} · gasto no mês {formatarMoeda(l.gastoNoMes)} · saldo {formatarMoeda(l.saldo)}</p>
              <BarraDeUso usado={l.usado} />
            </li>
          ))}
        </ul>

        {/* Computador: tabela como a da planilha */}
        <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-x-auto shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-3 text-left font-medium">Área</th>
                <th className="px-3 py-3 text-right font-medium">Verba do período</th>
                <th className="px-3 py-3 text-right font-medium hidden 2xl:table-cell">Gasto até o mês</th>
                <th className="px-3 py-3 text-right font-medium hidden 2xl:table-cell">Já assumido depois</th>
                <th className="px-3 py-3 text-right font-medium">Saldo</th>
                <th className="px-3 py-3 text-left font-medium">Usado</th>
                <th className="px-3 py-3 text-right font-medium">Teto do mês</th>
                <th className="px-3 py-3 text-right font-medium">Gasto no mês</th>
                <th className="px-3 py-3 text-right font-medium">Ainda pode gastar</th>
                <th className="px-3 py-3 text-left font-medium">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 tabular-nums">
              {linhas.map((l) => (
                <tr key={l.rubrica.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <button type="button" onClick={() => verExtrato(l.rubrica)} className="text-left font-medium text-gray-900 hover:text-primary hover:underline" title="Ver os lançamentos desta área">{l.rubrica.nome}</button>
                  </td>
                  <td className="px-3 py-3 text-right">{formatarMoeda(l.verba)}</td>
                  <td className="px-3 py-3 text-right hidden 2xl:table-cell">{formatarMoeda(l.ateOMes)}</td>
                  <td className="px-3 py-3 text-right hidden 2xl:table-cell">{formatarMoeda(l.depois)}</td>
                  <td className={`px-3 py-3 text-right ${l.saldo < 0 ? 'text-red-700 font-semibold' : ''}`}>{formatarMoeda(l.saldo)}</td>
                  <td className="px-3 py-3"><BarraDeUso usado={l.usado} /></td>
                  <td className="px-3 py-3 text-right">{formatarMoeda(l.teto)}</td>
                  <td className="px-3 py-3 text-right">{formatarMoeda(l.gastoNoMes)}</td>
                  <td className={`px-3 py-3 text-right font-semibold ${l.aindaPode < 0 ? 'text-red-700' : 'text-gray-900'}`}>{formatarMoeda(l.aindaPode)}</td>
                  <td className="px-3 py-3"><SeloDaSituacao situacao={l.situacao} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold tabular-nums">
              <tr>
                <td className="px-3 py-3">Total</td>
                <td className="px-3 py-3 text-right">{formatarMoeda(totais.verba)}</td>
                <td className="px-3 py-3 text-right hidden 2xl:table-cell">{formatarMoeda(linhas.reduce((s, l) => s + l.ateOMes, 0))}</td>
                <td className="px-3 py-3 text-right hidden 2xl:table-cell">{formatarMoeda(linhas.reduce((s, l) => s + l.depois, 0))}</td>
                <td className="px-3 py-3 text-right">{formatarMoeda(totais.saldo)}</td>
                <td className="px-3 py-3"><BarraDeUso usado={totais.usado} /></td>
                <td className="px-3 py-3 text-right">{formatarMoeda(totais.teto)}</td>
                <td className="px-3 py-3 text-right">{formatarMoeda(totais.gastoNoMes)}</td>
                <td className="px-3 py-3 text-right">{formatarMoeda(totais.aindaPode)}</td>
                <td className="px-3 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Teto do mês = (verba do período − o que já caiu nos outros meses, inclusive parcelas futuras) ÷ meses que faltam, contando este.
          Se um mês passar do teto, o teto dos meses seguintes diminui sozinho; se sobrar, aumenta.
        </p>
      </section>
    </div>
  );
}

// =========================================================== Lançamentos ====

function Lancamentos({ gastos, rubricas, meses, parametros, irPara, novo, editar, excluir, importar, avisar }) {
  const [busca, setBusca] = useState('');
  const area = parametros.get('area') || '';
  const mesFiltro = parametros.get('mes') || '';
  const filtrar = (k, v) => {
    const p = { aba: 'lancamentos', area, mes: mesFiltro, [k]: v };
    Object.keys(p).forEach((x) => { if (!p[x]) delete p[x]; });
    irPara('lancamentos', p);
  };
  const nomeDaArea = useMemo(() => new Map(rubricas.map((r) => [r.id, r.nome])), [rubricas]);

  const filtrados = useMemo(() => {
    const termo = chave(busca);
    return gastos
      .filter((g) => {
        if (area && g.rubricaId !== area) return false;
        if (mesFiltro && !parcelasDoGasto(g).some((p) => p.mes === mesFiltro)) return false;
        if (termo && ![g.fornecedor, g.descricao, g.notaFiscal, g.observacao].some((t) => chave(t).includes(termo))) return false;
        return true;
      })
      .sort((a, b) => String(b.data || b.primeiraParcela).localeCompare(String(a.data || a.primeiraParcela)));
  }, [gastos, area, mesFiltro, busca]);

  const total = filtrados.reduce((s, g) => s + (Number(g.valorTotal) || 0), 0);
  const noMes = mesFiltro ? filtrados.reduce((s, g) => s + parcelasDoGasto(g).filter((p) => p.mes === mesFiltro).reduce((x, p) => x + p.valor, 0), 0) : null;
  const temFiltro = busca || area || mesFiltro;

  const exportar = () => {
    const colunas = ['Data do gasto', 'Fornecedor', 'Nota fiscal', 'Descrição do gasto', 'Rubrica', 'Valor total', 'Parcelado', 'Parcelas', 'Primeira parcela em', 'Observação', 'Como ficou'];
    const linhas = filtrados.map((g) => [
      dataBr(g.data), g.fornecedor, g.notaFiscal, g.descricao, nomeDaArea.get(g.rubricaId) || g.rubricaNome,
      Number(g.valorTotal) || 0, g.parcelas > 1 ? 'Sim' : 'Não', g.parcelas || 1,
      g.primeiraParcela ? rotuloDoMes(g.primeiraParcela) : '', g.observacao, comoFicou(g, formatarMoeda),
    ]);
    const d = new Date();
    baixarArquivo(gerarXlsx([{ nome: 'Lançamentos', colunas, linhas }]), `controle-de-saldo-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.xlsx`);
    avisar(`Planilha com ${linhas.length} ${linhas.length === 1 ? 'lançamento' : 'lançamentos'} baixada.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-end">
        <button onClick={exportar} disabled={!filtrados.length} className={botaoSecundario}><Download size={18} /> Exportar Excel</button>
        <button onClick={importar} className={botaoSecundario}><Upload size={18} /> Importar planilha</button>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} aria-hidden="true" />
          <input type="search" aria-label="Buscar por fornecedor, nota ou descrição" placeholder="Fornecedor, nota ou descrição..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md outline-none focus:border-primary" />
        </div>
        <select aria-label="Filtrar por área" value={area} onChange={(e) => filtrar('area', e.target.value)} className={campo}>
          <option value="">Todas as áreas</option>
          {rubricas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
        <select aria-label="Filtrar por mês" value={mesFiltro} onChange={(e) => filtrar('mes', e.target.value)} className={campo}>
          <option value="">Todos os meses</option>
          {meses.map((m) => <option key={m} value={m}>{rotuloDoMes(m)}</option>)}
        </select>
      </div>

      {filtrados.length === 0 ? (
        gastos.length === 0 ? (
          <EmptyState
            titulo="Nenhum gasto lançado"
            mensagem="Lance o primeiro gasto ou traga a aba Lançamentos da planilha de controle de saldo."
            acoes={[{ rotulo: 'Lançar gasto', onClick: novo }, { rotulo: 'Importar planilha', onClick: importar, icone: Upload }]}
          />
        ) : (
          <EmptyState
            titulo="Nenhum lançamento com estes filtros"
            mensagem="Mude ou limpe os filtros."
            acoes={[{ rotulo: 'Limpar filtros', onClick: () => { setBusca(''); irPara('lancamentos'); } }]}
          />
        )
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-3 text-left font-medium hidden sm:table-cell">Data</th>
                <th className="px-3 py-3 text-left font-medium">Gasto</th>
                <th className="px-3 py-3 text-left font-medium hidden lg:table-cell">Área</th>
                <th className="px-3 py-3 text-right font-medium">Valor</th>
                <th className="px-3 py-3 text-left font-medium hidden md:table-cell">Como ficou</th>
                <th className="px-3 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map((g) => {
                const titulo = g.descricao || g.fornecedor || 'Gasto';
                return (
                  <tr key={g.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-gray-700 whitespace-nowrap hidden sm:table-cell">{dataBr(g.data) || '—'}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-900">{titulo}</p>
                      <p className="text-xs text-gray-500">
                        {[g.descricao && g.fornecedor, g.notaFiscal && `NF ${g.notaFiscal}`].filter(Boolean).join(' · ')}
                        <span className="lg:hidden">{(g.descricao && g.fornecedor) || g.notaFiscal ? ' · ' : ''}{nomeDaArea.get(g.rubricaId) || g.rubricaNome}</span>
                      </p>
                      <p className="text-xs text-gray-500 md:hidden">{comoFicou(g, formatarMoeda)}</p>
                    </td>
                    <td className="px-3 py-3 text-gray-700 hidden lg:table-cell">{nomeDaArea.get(g.rubricaId) || <span className="text-amber-700">{g.rubricaNome} (excluída)</span>}</td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums whitespace-nowrap">{formatarMoeda(Number(g.valorTotal) || 0)}</td>
                    <td className="px-3 py-3 text-gray-700 hidden md:table-cell">{comoFicou(g, formatarMoeda)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => editar(g)} className="p-1.5 text-gray-500 hover:text-gray-900" title={`Editar ${titulo}`} aria-label={`Editar ${titulo}`}><Edit2 size={18} /></button>
                        <button onClick={() => excluir(g)} className="p-1.5 text-red-600 hover:text-red-800" title={`Excluir ${titulo}`} aria-label={`Excluir ${titulo}`}><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs text-gray-600 border-t border-gray-100">
            {filtrados.length} {filtrados.length === 1 ? 'lançamento' : 'lançamentos'} · total {formatarMoeda(total)}
            {noMes !== null && ` · caindo em ${rotuloDoMes(mesFiltro)}: ${formatarMoeda(noMes)}`}
            {temFiltro && <button type="button" onClick={() => { setBusca(''); irPara('lancamentos'); }} className="ml-3 text-primary hover:underline inline-flex items-center gap-1"><X size={12} /> limpar filtros</button>}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================ Mês a mês ====

function MesAMes({ saldo, meses, mesAtual }) {
  const { linhas } = saldo;
  const totalNoMes = (m) => linhas.reduce((s, l) => s + l.porMes[m], 0);
  const tetoNoMes = (m) => linhas.reduce((s, l) => s + l.tetos[m], 0);
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-600">Quanto caiu em cada mês (compras à vista e parcelas) e, embaixo, o teto daquele mês. Em vermelho, o mês que passou do teto.</p>
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto shadow-sm" tabIndex={0} role="region" aria-label="Gastos e tetos de cada mês, por área">
        <table className="min-w-full divide-y divide-gray-200 text-sm tabular-nums">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th scope="col" className="px-3 py-3 text-left font-medium sticky left-0 bg-gray-50">Área</th>
              {meses.map((m) => (
                <th key={m} scope="col" className={`px-3 py-3 text-right font-medium whitespace-nowrap ${m === mesAtual ? 'text-primary' : ''}`}>{rotuloCurto(m)}{m === mesAtual ? ' (atual)' : ''}</th>
              ))}
              <th scope="col" className="px-3 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {linhas.map((l) => (
              <tr key={l.rubrica.id}>
                <th scope="row" className="px-3 py-2 text-left font-medium text-gray-900 sticky left-0 bg-white min-w-48">{l.rubrica.nome}</th>
                {meses.map((m) => {
                  const passou = l.porMes[m] > l.tetos[m] + 0.005;
                  return (
                    <td key={m} className={`px-3 py-2 text-right whitespace-nowrap ${passou ? 'bg-red-50' : ''}`}>
                      <span className={passou ? 'text-red-700 font-semibold' : l.porMes[m] ? 'text-gray-900' : 'text-gray-500'}>{formatarMoeda(l.porMes[m])}</span>
                      <span className="block text-xs text-gray-500">teto {formatarMoeda(l.tetos[m])}</span>
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{formatarMoeda(l.lancado)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-semibold">
            <tr>
              <th scope="row" className="px-3 py-2 text-left sticky left-0 bg-gray-50">Total</th>
              {meses.map((m) => (
                <td key={m} className="px-3 py-2 text-right whitespace-nowrap">
                  {formatarMoeda(totalNoMes(m))}
                  <span className="block text-xs font-normal text-gray-500">teto {formatarMoeda(tetoNoMes(m))}</span>
                </td>
              ))}
              <td className="px-3 py-2 text-right whitespace-nowrap">{formatarMoeda(saldo.totais.lancado)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ======================================================= Áreas e verbas ====

function AreasEVerbas({ rubricas, gastos, periodo, meses, avisar, novaArea, editarArea, excluirArea, importar }) {
  const [inicio, setInicio] = useState(periodo?.inicio || mesDe(new Date()));
  const [quantos, setQuantos] = useState(String(periodo?.meses || 12));
  const [nome, setNome] = useState(periodo?.nome || '');
  const [salvando, setSalvando] = useState(false);
  const mudou = !periodo || inicio !== periodo.inicio || Number(quantos) !== Number(periodo.meses) || nome !== (periodo.nome || '');
  const valido = /^\d{4}-\d{2}$/.test(inicio);

  const salvarPeriodo = async (e) => {
    e.preventDefault();
    if (!valido) return;
    setSalvando(true);
    try {
      await setDoc(doc(db, 'config', 'saldo'), { inicio, meses: Number(quantos), nome: nome.trim(), atualizadoEm: serverTimestamp() });
      avisar('Período salvo. As contas foram refeitas.');
    } catch (erro) {
      console.error(erro);
      avisar('Não foi possível salvar o período.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const qtdDeGastos = (r) => gastos.filter((g) => g.rubricaId === r.id).length;
  const totalMensal = rubricas.reduce((s, r) => s + (Number(r.verbaMensal) || 0), 0);

  return (
    <div className="space-y-6">
      <form onSubmit={salvarPeriodo} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-3">
        <h2 className="font-semibold text-gray-900">Período da verba</h2>
        <p className="text-sm text-gray-600">A verba do período de cada área é a verba mensal vezes o número de meses. Para um ano inteiro, use 12 meses.</p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label htmlFor="p-inicio" className={rotulo}>Mês inicial</label>
            <input id="p-inicio" type="month" value={inicio} onChange={(e) => setInicio(e.target.value)} className={campo} required />
          </div>
          <div>
            <label htmlFor="p-meses" className={rotulo}>Número de meses</label>
            <select id="p-meses" value={quantos} onChange={(e) => setQuantos(e.target.value)} className={campo}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} {n === 1 ? 'mês' : 'meses'}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="p-nome" className={rotulo}>Nome (opcional)</label>
            <input id="p-nome" value={nome} onChange={(e) => setNome(e.target.value)} className={campo} placeholder="Ex.: Creche Hortolândia 2026" />
          </div>
          <button type="submit" disabled={!mudou || !valido || salvando} className={`${botaoPrincipal} justify-center disabled:opacity-50`}>
            {salvando ? <LoadingSpinner size="sm" color="text-white" /> : <><Save size={18} /> Salvar período</>}
          </button>
        </div>
        {valido && (
          <p className="text-sm text-gray-700">De <strong>{rotuloDoMes(inicio)}</strong> a <strong>{rotuloDoMes(somarMeses(inicio, Number(quantos) - 1))}</strong>.</p>
        )}
      </form>

      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">Áreas de gasto ({rubricas.length})</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={importar} className={botaoSecundario}><Upload size={18} /> Importar planilha</button>
            <button onClick={novaArea} className={botaoPrincipal}><Plus size={20} /> Nova área</button>
          </div>
        </div>

        {rubricas.length === 0 ? (
          <EmptyState
            icone={Wallet}
            titulo="Nenhuma área cadastrada"
            mensagem='Cadastre as áreas (Manutenção, Brinquedos, Enxoval...) com a verba mensal, ou traga a aba "Orçamento" da planilha de controle de saldo: o sistema reconhece as colunas Rubrica e Verba mensal.'
            acoes={[{ rotulo: 'Nova área', onClick: novaArea }, { rotulo: 'Importar planilha', onClick: importar, icone: Upload }]}
          />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-2 sm:px-3 py-3 text-left font-medium">Área</th>
                  <th className="px-2 sm:px-3 py-3 text-right font-medium">Verba mensal</th>
                  <th className="px-2 sm:px-3 py-3 text-right font-medium hidden sm:table-cell">Verba do período</th>
                  <th className="px-2 sm:px-3 py-3 text-left font-medium hidden md:table-cell">Lançamentos</th>
                  <th className="px-2 sm:px-3 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 tabular-nums">
                {rubricas.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-2 sm:px-3 py-3">
                      <p className="font-medium text-gray-900">{r.nome}</p>
                      {r.observacao && <p className="text-xs text-gray-500">{r.observacao}</p>}
                    </td>
                    <td className="px-2 sm:px-3 py-3 text-right">{formatarMoeda(Number(r.verbaMensal) || 0)}</td>
                    <td className="px-2 sm:px-3 py-3 text-right hidden sm:table-cell">{formatarMoeda((Number(r.verbaMensal) || 0) * meses.length)}</td>
                    <td className="px-2 sm:px-3 py-3 text-gray-700 hidden md:table-cell">{qtdDeGastos(r)}</td>
                    <td className="px-2 sm:px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => editarArea(r)} className="p-1.5 text-gray-500 hover:text-gray-900" title={`Editar ${r.nome}`} aria-label={`Editar ${r.nome}`}><Edit2 size={18} /></button>
                        <button
                          onClick={() => (qtdDeGastos(r) ? avisar(`"${r.nome}" tem ${qtdDeGastos(r)} lançamento(s). Mude a área desses lançamentos ou exclua-os antes.`, 'error') : excluirArea(r))}
                          className="p-1.5 text-red-600 hover:text-red-800" title={`Excluir ${r.nome}`} aria-label={`Excluir ${r.nome}`}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold tabular-nums">
                <tr>
                  <td className="px-2 sm:px-3 py-3">Total</td>
                  <td className="px-2 sm:px-3 py-3 text-right">{formatarMoeda(totalMensal)}</td>
                  <td className="px-2 sm:px-3 py-3 text-right hidden sm:table-cell">{formatarMoeda(totalMensal * meses.length)}</td>
                  <td className="hidden md:table-cell" />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
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

function FormularioDeGasto({ gasto, rubricas, gastos, periodo, mesSugerido, fechar, avisar }) {
  const editando = !!gasto.id;
  const [dados, setDados] = useState(() => ({
    rubricaId: gasto.rubricaId || '',
    valorTotal: gasto.valorTotal ?? '',
    data: gasto.data || hojeYmd(),
    fornecedor: gasto.fornecedor || '',
    notaFiscal: gasto.notaFiscal || '',
    descricao: gasto.descricao || '',
    parcelado: (gasto.parcelas || 1) > 1,
    parcelas: String(gasto.parcelas > 1 ? gasto.parcelas : 2),
    primeiraParcela: gasto.primeiraParcela || mesDe(gasto.data || hojeYmd()) || mesSugerido,
    observacao: gasto.observacao || '',
  }));
  // Enquanto ninguém mexer no mês, ele acompanha a data do gasto.
  const [mesManual, setMesManual] = useState(editando);
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);

  const mudar = (e) => {
    const { name, value, type, checked } = e.target;
    setDados((d) => {
      const novo = { ...d, [name]: type === 'checkbox' ? checked : value };
      if (name === 'data' && !mesManual && mesDe(value)) novo.primeiraParcela = mesDe(value);
      return novo;
    });
    if (name === 'primeiraParcela') setMesManual(true);
    if (erros[name]) setErros((x) => ({ ...x, [name]: '' }));
  };

  const registro = {
    rubricaId: dados.rubricaId,
    valorTotal: Math.round((Number(dados.valorTotal) || 0) * 100) / 100,
    parcelas: dados.parcelado ? Math.max(2, Math.min(60, Math.floor(Number(dados.parcelas) || 2))) : 1,
    primeiraParcela: dados.primeiraParcela,
    data: dados.data,
  };

  // Como fica o saldo da área depois deste lançamento, no mês da (1ª) parcela.
  const previa = useMemo(() => {
    if (!registro.rubricaId || !registro.valorTotal || !/^\d{4}-\d{2}$/.test(registro.primeiraParcela)) return null;
    const outros = gastos.filter((g) => g.id !== gasto.id);
    const meses = mesesDoPeriodo(periodo);
    const parcelas = parcelasDoGasto(registro);
    const fora = parcelas.filter((p) => !meses.includes(p.mes));
    const mesAlvo = meses.includes(registro.primeiraParcela) ? registro.primeiraParcela : null;
    const linha = mesAlvo
      ? calcularSaldo({ rubricas, gastos: [...outros, registro], periodo, mes: mesAlvo }).linhas.find((l) => l.rubrica.id === registro.rubricaId)
      : null;
    return { comoFica: comoFicou(registro, formatarMoeda), fora, linha, mesAlvo };
  }, [registro.rubricaId, registro.valorTotal, registro.parcelas, registro.primeiraParcela, gastos, rubricas, periodo, gasto.id]);

  const validar = () => {
    const e = {};
    if (!dados.rubricaId) e.rubricaId = 'Escolha a área';
    if (!(Number(dados.valorTotal) > 0)) e.valorTotal = 'Informe um valor maior que zero';
    if (!dados.data) e.data = 'Informe a data do gasto';
    if (!/^\d{4}-\d{2}$/.test(dados.primeiraParcela)) e.primeiraParcela = 'Informe o mês';
    if (dados.parcelado && !(Number(dados.parcelas) >= 2)) e.parcelas = 'Mínimo de 2 parcelas';
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const salvar = async (ev) => {
    ev.preventDefault();
    if (!validar()) return;
    setSalvando(true);
    try {
      const area = rubricas.find((r) => r.id === dados.rubricaId);
      const final = {
        ...registro,
        rubricaNome: area?.nome || '',
        fornecedor: dados.fornecedor.trim(),
        notaFiscal: dados.notaFiscal.trim(),
        descricao: dados.descricao.trim(),
        observacao: dados.observacao.trim(),
        atualizadoEm: serverTimestamp(),
      };
      if (editando) await updateDoc(doc(db, 'gastos', gasto.id), final);
      else await addDoc(collection(db, 'gastos'), { ...final, criadoEm: serverTimestamp() });
      avisar(editando ? 'Lançamento atualizado. O saldo foi recalculado.' : 'Gasto lançado. O saldo foi recalculado.');
      fechar();
    } catch (erro) {
      console.error(erro);
      avisar('Não foi possível salvar. Tente de novo; o que você digitou continua aqui.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !salvando && fechar()} title={editando ? 'Editar lançamento' : 'Lançar gasto'} size="lg">
      <form onSubmit={salvar} className="space-y-5" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo id="g-area" rotulo="Área *" erro={erros.rubricaId}>
            <select id="g-area" name="rubricaId" value={dados.rubricaId} onChange={mudar} className={campo}>
              <option value="">Escolha a área</option>
              {rubricas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </Campo>
          <Campo id="g-valor" rotulo="Valor total (R$) *" erro={erros.valorTotal} ajuda={dados.parcelado ? 'O valor da compra inteira; o sistema divide pelas parcelas.' : ''}>
            <input id="g-valor" name="valorTotal" type="number" step="0.01" min="0" inputMode="decimal" value={dados.valorTotal} onChange={mudar} className={campo} />
          </Campo>
          <Campo id="g-data" rotulo="Data do gasto *" erro={erros.data}>
            <input id="g-data" name="data" type="date" value={dados.data} onChange={mudar} className={campo} />
          </Campo>
          <Campo id="g-mes" rotulo={dados.parcelado ? '1ª parcela em *' : 'Conta no mês *'} erro={erros.primeiraParcela} ajuda="Normalmente o mês da data do gasto (ou do vencimento).">
            <input id="g-mes" name="primeiraParcela" type="month" value={dados.primeiraParcela} onChange={mudar} className={campo} />
          </Campo>
          <Campo id="g-forn" rotulo="Fornecedor">
            <input id="g-forn" name="fornecedor" value={dados.fornecedor} onChange={mudar} className={campo} autoComplete="off" />
          </Campo>
          <Campo id="g-nf" rotulo="Nota fiscal">
            <input id="g-nf" name="notaFiscal" value={dados.notaFiscal} onChange={mudar} className={campo} autoComplete="off" />
          </Campo>
          <Campo id="g-desc" rotulo="Descrição do gasto" largo>
            <input id="g-desc" name="descricao" value={dados.descricao} onChange={mudar} className={campo} placeholder="Ex.: Troca do portão" autoComplete="off" />
          </Campo>
          <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
            <input type="checkbox" name="parcelado" checked={dados.parcelado} onChange={mudar} className="h-4 w-4" /> Compra parcelada
          </label>
          {dados.parcelado && (
            <Campo id="g-parc" rotulo="Número de parcelas *" erro={erros.parcelas}>
              <input id="g-parc" name="parcelas" type="number" min="2" max="60" value={dados.parcelas} onChange={mudar} className={campo} />
            </Campo>
          )}
          <Campo id="g-obs" rotulo="Observação" largo>
            <textarea id="g-obs" name="observacao" rows="2" value={dados.observacao} onChange={mudar} className={`${campo} resize-none`} />
          </Campo>
        </div>

        {previa && (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm space-y-1" aria-live="polite">
            <p className="font-medium text-gray-900">{previa.comoFica}</p>
            {previa.linha && (
              <p className={previa.linha.aindaPode < 0 ? 'text-red-700' : 'text-gray-700'}>
                {previa.linha.aindaPode < 0
                  ? `Com este gasto, ${previa.linha.rubrica.nome} passa ${formatarMoeda(-previa.linha.aindaPode)} do teto de ${rotuloDoMes(previa.mesAlvo)} (${formatarMoeda(previa.linha.teto)}). Os meses seguintes terão teto menor.`
                  : `Depois deste gasto, ${previa.linha.rubrica.nome} ainda pode gastar ${formatarMoeda(previa.linha.aindaPode)} em ${rotuloDoMes(previa.mesAlvo)}.`}
                {previa.linha.saldo < 0 && ` A verba do período fica estourada em ${formatarMoeda(-previa.linha.saldo)}.`}
              </p>
            )}
            {previa.fora.length > 0 && (
              <p className="text-amber-800">{previa.fora.length === 1 ? '1 parcela cai' : `${previa.fora.length} parcelas caem`} fora do período ({formatarMoeda(previa.fora.reduce((s, p) => s + p.valor, 0))}) e não entra{previa.fora.length === 1 ? '' : 'm'} na conta deste período.</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={fechar} disabled={salvando} className="px-4 py-2 text-sm text-gray-700 border rounded-md hover:bg-gray-50">Cancelar</button>
          <button type="submit" disabled={salvando} className="px-4 py-2 text-sm text-white bg-primary rounded-md hover:bg-primary-dark min-w-32 flex justify-center">
            {salvando ? <LoadingSpinner size="sm" color="text-white" /> : editando ? 'Salvar' : 'Lançar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FormularioDeArea({ area, rubricas, meses, fechar, avisar }) {
  const editando = !!area.id;
  const n = meses.length || 12;
  const [nome, setNome] = useState(area.nome || '');
  const [mensal, setMensal] = useState(area.verbaMensal ?? '');
  const [doPeriodo, setDoPeriodo] = useState(area.verbaMensal != null ? String(Math.round(area.verbaMensal * n * 100) / 100) : '');
  const [observacao, setObservacao] = useState(area.observacao || '');
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);

  const mudarMensal = (v) => { setMensal(v); setDoPeriodo(v === '' ? '' : String(Math.round(Number(v) * n * 100) / 100)); };
  const mudarPeriodo = (v) => { setDoPeriodo(v); setMensal(v === '' ? '' : String(Math.round((Number(v) / n) * 100) / 100)); };

  const salvar = async (ev) => {
    ev.preventDefault();
    const e = {};
    const limpo = nome.trim().replace(/\s+/g, ' ');
    if (!limpo) e.nome = 'Informe o nome da área';
    else if (rubricas.some((r) => r.id !== area.id && chave(r.nome) === chave(limpo))) e.nome = 'Já existe uma área com este nome';
    if (mensal === '' || Number(mensal) < 0) e.mensal = 'Informe a verba (pode ser zero)';
    setErros(e);
    if (Object.keys(e).length) return;
    setSalvando(true);
    try {
      const registro = { nome: limpo, verbaMensal: Math.round(Number(mensal) * 100) / 100, observacao: observacao.trim(), atualizadoEm: serverTimestamp() };
      if (editando) await updateDoc(doc(db, 'rubricas', area.id), registro);
      else await addDoc(collection(db, 'rubricas'), { ...registro, criadoEm: serverTimestamp() });
      avisar(editando ? 'Área atualizada. As contas foram refeitas.' : 'Área cadastrada.');
      fechar();
    } catch (erro) {
      console.error(erro);
      avisar('Não foi possível salvar a área.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const sugestoes = RUBRICAS_SUGERIDAS.filter((s) => !rubricas.some((r) => chave(r.nome) === chave(s)));

  return (
    <Modal isOpen onClose={() => !salvando && fechar()} title={editando ? `Editar: ${area.nome}` : 'Nova área'}>
      <form onSubmit={salvar} className="space-y-4" noValidate>
        <Campo id="a-nome" rotulo="Nome da área *" erro={erros.nome} ajuda="Escolha da lista ou digite outra.">
          <input id="a-nome" list="areas-sugeridas" value={nome} onChange={(e) => setNome(e.target.value)} className={campo} autoComplete="off" />
          <datalist id="areas-sugeridas">{sugestoes.map((s) => <option key={s} value={s} />)}</datalist>
        </Campo>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo id="a-mensal" rotulo="Verba mensal (R$) *" erro={erros.mensal}>
            <input id="a-mensal" type="number" step="0.01" min="0" inputMode="decimal" value={mensal} onChange={(e) => mudarMensal(e.target.value)} className={campo} />
          </Campo>
          <Campo id="a-periodo" rotulo={`Verba do período (${n} ${n === 1 ? 'mês' : 'meses'})`} ajuda="Preencha um dos dois; o outro é calculado.">
            <input id="a-periodo" type="number" step="0.01" min="0" inputMode="decimal" value={doPeriodo} onChange={(e) => mudarPeriodo(e.target.value)} className={campo} />
          </Campo>
        </div>
        <Campo id="a-obs" rotulo="Observação">
          <input id="a-obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} className={campo} />
        </Campo>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={fechar} disabled={salvando} className="px-4 py-2 text-sm text-gray-700 border rounded-md hover:bg-gray-50">Cancelar</button>
          <button type="submit" disabled={salvando} className="px-4 py-2 text-sm text-white bg-primary rounded-md hover:bg-primary-dark min-w-32 flex justify-center">
            {salvando ? <LoadingSpinner size="sm" color="text-white" /> : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
