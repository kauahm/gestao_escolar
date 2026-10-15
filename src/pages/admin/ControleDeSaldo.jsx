import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import {
  Plus, Search, Upload, Download, Edit2, Trash2, X, Wallet, AlertTriangle, Settings2, Save,
  ChevronLeft, ChevronRight, ArrowLeft, List,
} from 'lucide-react';

import { db } from '../../services/firebase';
import { ouvir } from '../../services/leitura';
import { doMunicipio, docDoMunicipio } from '../../services/consulta';
import { addDoc, updateDoc, deleteDoc, setDoc } from '../../services/db';
import { formatarMoeda } from '../../utils/formatters';
import {
  NOMES_DOS_MESES, RUBRICAS_SUGERIDAS, SITUACAO, calcularSaldo, comoFicou, mesAtualNoPeriodo, mesDe, mesesDoPeriodo,
  parcelasDoGasto, rotuloDoMes, somarMeses,
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
//
// A tela foi pensada para quem não é do financeiro: a entrada mostra só um
// cartão por área com "quanto ainda pode gastar neste mês". O resto (lista de
// todos os gastos, importar, período e verbas) fica atrás de botões.

const VISOES = ['inicio', 'area', 'gastos', 'configurar'];

const campo = 'w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary bg-white';
const rotulo = 'block text-sm font-medium text-gray-700 mb-1';
const botaoPrincipal = 'bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm';
const botaoSecundario = 'bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg flex items-center gap-2 font-medium';

const dataBr = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '');
const hojeYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** "outubro" a partir de "2026-10" (para frases como "pode gastar em outubro"). */
const nomeDoMes = (m) => (m ? NOMES_DOS_MESES[Number(m.slice(5, 7)) - 1].toLowerCase() : '');
/** "outubro de 2026" */
const porExtenso = (m) => (m ? `${nomeDoMes(m)} de ${m.slice(0, 4)}` : '');
/** "Outubro de 2026" */
const tituloDoMes = (m) => porExtenso(m).replace(/^./, (c) => c.toUpperCase());

// A situação em palavras do dia a dia (os nomes técnicos ficam em utils/saldo.js).
const SITUACAO_SIMPLES = {
  [SITUACAO.SEM_VERBA]: { texto: 'Sem verba', cor: 'bg-gray-100 text-gray-700' },
  [SITUACAO.ESTOURADA]: { texto: 'A verba acabou', cor: 'bg-red-100 text-red-800' },
  [SITUACAO.PASSOU]: { texto: 'Passou do limite do mês', cor: 'bg-red-100 text-red-800' },
  [SITUACAO.PERTO]: { texto: 'Quase no limite', cor: 'bg-yellow-100 text-yellow-800' },
  [SITUACAO.DENTRO]: { texto: 'Tudo certo', cor: 'bg-green-100 text-green-800' },
};

function Selo({ situacao }) {
  const s = SITUACAO_SIMPLES[situacao];
  return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-sm font-medium whitespace-nowrap ${s.cor}`}>{s.texto}</span>;
}

/** Barra "gastou X de Y". */
function Barra({ gasto, limite }) {
  const fracao = limite > 0 ? gasto / limite : gasto > 0 ? 2 : 0;
  const largura = Math.min(100, Math.max(0, fracao * 100));
  const cor = fracao > 1 ? 'bg-red-500' : fracao >= 0.8 ? 'bg-amber-500' : 'bg-green-600';
  return (
    <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
      <div className={`h-full ${cor}`} style={{ width: `${largura}%` }} />
    </div>
  );
}

export default function ControleDeSaldo() {
  const [parametros, setParametros] = useSearchParams();
  const visao = VISOES.includes(parametros.get('ver')) ? parametros.get('ver') : 'inicio';
  const irPara = (ver, extra = {}) => {
    const p = ver === 'inicio' ? {} : { ver, ...extra };
    Object.keys(p).forEach((k) => { if (!p[k]) delete p[k]; });
    setParametros(p);
  };

  const [rubricas, setRubricas] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [periodo, setPeriodo] = useState(null);
  const [carregando, setCarregando] = useState({ rubricas: true, gastos: true, periodo: true });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const avisar = (message, type = 'success') => setToast({ show: true, message, type });

  const [gastoAberto, setGastoAberto] = useState(null); // null | {} (novo) | { rubricaId } | gasto
  const [areaAberta, setAreaAberta] = useState(null);
  const [excluir, setExcluir] = useState(null); // { tipo: 'gasto'|'area', item }
  const [importar, setImportar] = useState(null); // 'gastos' | 'rubricas'

  useEffect(() => {
    const pronto = (k) => setCarregando((c) => ({ ...c, [k]: false }));
    const parar = [
      ouvir(doMunicipio('rubricas'), (s) => {
        setRubricas(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')));
        pronto('rubricas');
      }, () => pronto('rubricas')),
      ouvir(doMunicipio('gastos'), (s) => {
        setGastos(s.docs.map((d) => ({ id: d.id, ...d.data() })));
        pronto('gastos');
      }, () => pronto('gastos')),
      ouvir(docDoMunicipio('config', 'saldo'), (s) => {
        setPeriodo(s.exists() ? s.data() : null);
        pronto('periodo');
      }, () => pronto('periodo')),
    ];
    return () => parar.forEach((p) => p());
  }, []);

  // Ao trocar de parte da tela, volta para o alto.
  useEffect(() => { window.scrollTo?.(0, 0); }, [visao, parametros.get('area')]);

  const meses = useMemo(() => mesesDoPeriodo(periodo), [periodo]);
  const [mesEscolhido, setMesEscolhido] = useState('');
  const mes = meses.includes(mesEscolhido) ? mesEscolhido : mesAtualNoPeriodo(periodo);
  const saldo = useMemo(() => calcularSaldo({ rubricas, gastos, periodo, mes }), [rubricas, gastos, periodo, mes]);

  const estaCarregando = carregando.rubricas || carregando.gastos || carregando.periodo;
  const configurado = meses.length > 0 && rubricas.length > 0;
  const areaId = parametros.get('area') || '';
  const linhaDaArea = visao === 'area' ? saldo.linhas.find((l) => l.rubrica.id === areaId) : null;

  const confirmarExclusao = async () => {
    const { tipo, item } = excluir;
    setExcluir(null);
    try {
      await deleteDoc(doc(db, tipo === 'gasto' ? 'gastos' : 'rubricas', item.id));
      avisar(tipo === 'gasto' ? 'Gasto excluído. Se precisar, dá para recuperar na lixeira.' : `A área "${item.nome}" foi para a lixeira.`);
    } catch (erro) {
      console.error(erro);
      avisar('Não foi possível excluir.', 'error');
    }
  };

  const acoesDoGasto = { editar: setGastoAberto, excluir: (g) => setExcluir({ tipo: 'gasto', item: g }) };

  let conteudo;
  if (estaCarregando) {
    conteudo = <EsqueletoDeLista linhas={6} />;
  } else if (visao === 'configurar') {
    conteudo = (
      <AreasEVerbas
        rubricas={rubricas} gastos={gastos} periodo={periodo} meses={meses} avisar={avisar}
        novaArea={() => setAreaAberta({})} editarArea={setAreaAberta}
        excluirArea={(r) => setExcluir({ tipo: 'area', item: r })} importar={() => setImportar('rubricas')}
      />
    );
  } else if (!configurado) {
    conteudo = (
      <EmptyState
        icone={Wallet}
        titulo="Falta configurar o controle de saldo"
        mensagem="Informe o mês em que a verba começa, quantos meses ela vale e as áreas (Manutenção, Brinquedos...) com a verba de cada uma. Isso é feito uma vez só."
        acoes={[{ rotulo: 'Configurar agora', onClick: () => irPara('configurar'), icone: Settings2 }]}
      />
    );
  } else if (visao === 'gastos') {
    conteudo = (
      <TodosOsGastos
        gastos={gastos} rubricas={rubricas} meses={meses} {...acoesDoGasto}
        importar={() => setImportar('gastos')} avisar={avisar}
      />
    );
  } else if (visao === 'area' && linhaDaArea) {
    conteudo = (
      <DetalheDaArea
        linha={linhaDaArea} gastos={gastos} meses={meses} mes={mes} setMes={setMesEscolhido}
        lancar={() => setGastoAberto({ rubricaId: linhaDaArea.rubrica.id })} {...acoesDoGasto}
      />
    );
  } else {
    conteudo = (
      <Inicio
        saldo={saldo} meses={meses} mes={mes} setMes={setMesEscolhido}
        lancar={(rubricaId) => setGastoAberto(rubricaId ? { rubricaId } : {})}
        abrirArea={(r) => irPara('area', { area: r.id })}
        configurar={() => irPara('configurar')}
      />
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          {visao !== 'inicio' && (
            <button type="button" onClick={() => irPara('inicio')} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              <ArrowLeft size={16} aria-hidden="true" /> Voltar ao resumo
            </button>
          )}
          <h1 className="text-2xl font-bold text-gray-900">
            {visao === 'configurar' ? 'Configurar o controle de saldo'
              : visao === 'gastos' ? 'Todos os gastos'
                : visao === 'area' && linhaDaArea ? linhaDaArea.rubrica.nome
                  : 'Controle de saldo'}
          </h1>
          {visao === 'inicio' && meses.length > 0 && (
            <p className="text-gray-500 text-sm mt-1">
              Verba de {porExtenso(meses[0])} a {porExtenso(meses[meses.length - 1])}{periodo?.nome ? ` · ${periodo.nome}` : ''}
            </p>
          )}
        </div>
        {configurado && visao === 'inicio' && (
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={() => setGastoAberto({})} className={`${botaoPrincipal} justify-center`}><Plus size={20} /> Lançar gasto</button>
            <button onClick={() => irPara('gastos')} className={`${botaoSecundario} justify-center`}><List size={18} /> Todos os gastos</button>
          </div>
        )}
        {configurado && visao === 'gastos' && (
          <button onClick={() => setGastoAberto({})} className={`${botaoPrincipal} self-start`}><Plus size={20} /> Lançar gasto</button>
        )}
      </div>

      {conteudo}

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
        title={excluir?.tipo === 'area' ? 'Excluir área' : 'Excluir gasto'}
        message={excluir?.tipo === 'area'
          ? `A área "${excluir?.item.nome}" vai para a lixeira, de onde pode ser restaurada.`
          : `O gasto de ${formatarMoeda(excluir?.item.valorTotal || 0)}${excluir?.item.descricao || excluir?.item.fornecedor ? ` (${excluir.item.descricao || excluir.item.fornecedor})` : ''} vai para a lixeira e o saldo é refeito.`}
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

// ======================================================= Escolher o mês ====

function SeletorDeMes({ meses, mes, setMes }) {
  const i = meses.indexOf(mes);
  const seta = 'p-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white';
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => setMes(meses[i - 1])} disabled={i <= 0} className={seta} aria-label="Mês anterior">
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <p className="min-w-40 text-center text-lg font-semibold text-gray-900" aria-live="polite">{tituloDoMes(mes)}</p>
      <button type="button" onClick={() => setMes(meses[i + 1])} disabled={i < 0 || i >= meses.length - 1} className={seta} aria-label="Próximo mês">
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </div>
  );
}

// ================================================================ Início ====

/** O número principal de uma área: quanto ainda pode gastar no mês (ou quanto passou). */
function PodeGastar({ linha, mes, grande }) {
  const passou = linha.aindaPode < 0;
  const cor = passou ? 'text-red-700' : linha.situacao === SITUACAO.PERTO ? 'text-amber-700' : 'text-green-700';
  return (
    <div>
      <p className="text-base text-gray-600">{passou ? `Passou do limite de ${nomeDoMes(mes)} em` : `Ainda pode gastar em ${nomeDoMes(mes)}`}</p>
      <p className={`${grande ? 'text-3xl' : 'text-2xl'} font-bold tabular-nums ${cor}`}>{formatarMoeda(Math.abs(linha.aindaPode))}</p>
    </div>
  );
}

function Inicio({ saldo, meses, mes, setMes, lancar, abrirArea, configurar }) {
  const { totais, linhas } = saldo;
  const ultimo = meses[meses.length - 1];
  return (
    <div className="space-y-6">
      <SeletorDeMes meses={meses} mes={mes} setMes={setMes} />

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 space-y-1">
        <p className="text-base text-gray-700">Somando todas as áreas, ainda dá para gastar em {nomeDoMes(mes)}</p>
        <p className="text-4xl font-bold text-primary tabular-nums">{formatarMoeda(totais.aindaPode)}</p>
        <p className="text-sm text-gray-600 pt-1">
          Sobra da verba até {porExtenso(ultimo)}: <strong className={`tabular-nums ${totais.saldo < 0 ? 'text-red-700' : 'text-gray-900'}`}>{formatarMoeda(totais.saldo)}</strong>
        </p>
      </div>

      {totais.foraDoPeriodo > 0 && (
        <p className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-3">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
          Há {formatarMoeda(totais.foraDoPeriodo)} em parcelas para depois de {porExtenso(ultimo)}. Elas só entram na conta da próxima verba.
        </p>
      )}
      {saldo.semRubrica > 0 && (
        <p className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-3">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
          Há {formatarMoeda(saldo.semRubrica)} em gastos de uma área que foi excluída. Em "Todos os gastos", edite esses gastos e escolha outra área.
        </p>
      )}

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {linhas.map((l) => (
          <li key={l.rubrica.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold text-gray-900 leading-snug">{l.rubrica.nome}</h2>
              <Selo situacao={l.situacao} />
            </div>
            <PodeGastar linha={l} mes={mes} />
            <div className="space-y-1">
              <Barra gasto={l.gastoNoMes} limite={l.teto} />
              <p className="text-base text-gray-600">Gastou <strong className="text-gray-900 tabular-nums">{formatarMoeda(l.gastoNoMes)}</strong> de {formatarMoeda(l.teto)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-auto pt-1">
              <button type="button" onClick={() => lancar(l.rubrica.id)} className={botaoPrincipal} aria-label={`Lançar gasto em ${l.rubrica.nome}`}>
                <Plus size={18} aria-hidden="true" /> Lançar gasto
              </button>
              <button type="button" onClick={() => abrirArea(l.rubrica)} className="text-base font-medium text-primary hover:underline" aria-label={`Ver os gastos de ${l.rubrica.nome}`}>
                Ver gastos
              </button>
            </div>
          </li>
        ))}
      </ul>

      <details className="bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-700">
        <summary className="cursor-pointer font-medium text-gray-900">Como o sistema calcula o limite de cada mês?</summary>
        <div className="mt-3 space-y-2">
          <p>A verba que ainda sobra é dividida pelos meses que faltam, contando o mês escolhido. Esse é o limite do mês.</p>
          <p>Se num mês você gastar mais que o limite, os meses seguintes ficam com um limite um pouco menor. Se gastar menos, o que sobrou passa para os meses seguintes. Você não precisa fazer conta nenhuma.</p>
          <p>Compra parcelada conta um pedaço em cada mês.</p>
        </div>
      </details>

      <p className="text-sm text-gray-600">
        Mudar o período ou a verba de cada área?{' '}
        <button type="button" onClick={configurar} className="font-medium text-primary hover:underline">Configurar o controle de saldo</button>
      </p>
    </div>
  );
}

// ======================================================= Uma área só ====

function DetalheDaArea({ linha, gastos, meses, mes, setMes, lancar, editar, excluir }) {
  const daArea = useMemo(
    () => gastos.filter((g) => g.rubricaId === linha.rubrica.id).sort(maisRecentePrimeiro),
    [gastos, linha.rubrica.id],
  );
  const ultimo = meses[meses.length - 1];
  return (
    <div className="space-y-6">
      <SeletorDeMes meses={meses} mes={mes} setMes={setMes} />

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PodeGastar linha={linha} mes={mes} grande />
          <Selo situacao={linha.situacao} />
        </div>
        <div className="space-y-1">
          <Barra gasto={linha.gastoNoMes} limite={linha.teto} />
          <p className="text-base text-gray-600">Gastou em {nomeDoMes(mes)} <strong className="text-gray-900 tabular-nums">{formatarMoeda(linha.gastoNoMes)}</strong> de {formatarMoeda(linha.teto)}</p>
        </div>
        <dl className="grid grid-cols-3 gap-3 border-t border-gray-100 pt-4 text-sm text-gray-600">
          <div><dt>Verba até {nomeDoMes(ultimo)}</dt><dd className="text-base font-semibold text-gray-900 tabular-nums">{formatarMoeda(linha.verba)}</dd></div>
          <div><dt>Já gasto</dt><dd className="text-base font-semibold text-gray-900 tabular-nums">{formatarMoeda(linha.lancado)}</dd></div>
          <div><dt>Sobra</dt><dd className={`text-base font-semibold tabular-nums ${linha.saldo < 0 ? 'text-red-700' : 'text-gray-900'}`}>{formatarMoeda(linha.saldo)}</dd></div>
        </dl>
        <button type="button" onClick={lancar} className={botaoPrincipal}><Plus size={20} aria-hidden="true" /> Lançar gasto aqui</button>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Gastos desta área ({daArea.length})</h2>
        {daArea.length === 0
          ? <p className="text-sm text-gray-600 bg-white rounded-lg border border-dashed border-gray-300 p-6 text-center">Nenhum gasto lançado nesta área ainda.</p>
          : <ListaDeGastos gastos={daArea} editar={editar} excluir={excluir} />}
      </section>

      <details className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <summary className="cursor-pointer text-base font-medium text-gray-900">Ver mês a mês</summary>
        <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-medium">Mês</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Gasto</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Limite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {meses.map((m) => {
                const passou = linha.porMes[m] > linha.tetos[m] + 0.005;
                return (
                  <tr key={m} className={m === mes ? 'bg-blue-50' : ''}>
                    <th scope="row" className="px-4 py-2 text-left font-normal text-gray-900">{tituloDoMes(m)}</th>
                    <td className={`px-4 py-2 text-right ${passou ? 'text-red-700 font-semibold' : 'text-gray-900'}`}>
                      {formatarMoeda(linha.porMes[m])}{passou && <span className="sr-only"> (passou do limite)</span>}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">{formatarMoeda(linha.tetos[m])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-600 mt-2">Em vermelho, o mês em que o gasto passou do limite.</p>
      </details>
    </div>
  );
}

// ================================================ Lista de gastos ====

const maisRecentePrimeiro = (a, b) => String(b.data || b.primeiraParcela).localeCompare(String(a.data || a.primeiraParcela));

function ListaDeGastos({ gastos, nomeDaArea, editar, excluir }) {
  return (
    <ul className="bg-white rounded-lg border border-gray-200 shadow-sm divide-y divide-gray-100">
      {gastos.map((g) => {
        const titulo = g.descricao || g.fornecedor || 'Gasto sem descrição';
        const area = nomeDaArea ? (nomeDaArea.get(g.rubricaId) || `${g.rubricaNome || 'Área'} (excluída)`) : '';
        const detalhes = [dataBr(g.data), area, g.descricao && g.fornecedor, g.notaFiscal && `NF ${g.notaFiscal}`].filter(Boolean).join(' · ');
        return (
          <li key={g.id} className="flex items-start gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900">{titulo}</p>
              {detalhes && <p className="text-sm text-gray-600">{detalhes}</p>}
              {(g.parcelas || 1) > 1 && <p className="text-sm text-gray-600">{comoFicou(g, formatarMoeda)}</p>}
            </div>
            <p className="font-semibold text-gray-900 tabular-nums whitespace-nowrap">{formatarMoeda(Number(g.valorTotal) || 0)}</p>
            <div className="flex items-center gap-1 -mr-1.5">
              <button onClick={() => editar(g)} className="p-1.5 text-gray-500 hover:text-gray-900" title={`Editar ${titulo}`} aria-label={`Editar ${titulo}`}><Edit2 size={18} /></button>
              <button onClick={() => excluir(g)} className="p-1.5 text-red-600 hover:text-red-800" title={`Excluir ${titulo}`} aria-label={`Excluir ${titulo}`}><Trash2 size={18} /></button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function TodosOsGastos({ gastos, rubricas, meses, editar, excluir, importar, avisar }) {
  const [busca, setBusca] = useState('');
  const [area, setArea] = useState('');
  const [mesFiltro, setMesFiltro] = useState('');
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
      .sort(maisRecentePrimeiro);
  }, [gastos, area, mesFiltro, busca]);

  const total = filtrados.reduce((s, g) => s + (Number(g.valorTotal) || 0), 0);
  const temFiltro = busca || area || mesFiltro;
  const limpar = () => { setBusca(''); setArea(''); setMesFiltro(''); };

  const exportar = () => {
    const colunas = ['Data do gasto', 'Fornecedor', 'Nota fiscal', 'Descrição do gasto', 'Rubrica', 'Valor total', 'Parcelado', 'Parcelas', 'Primeira parcela em', 'Observação', 'Como ficou'];
    const linhas = filtrados.map((g) => [
      dataBr(g.data), g.fornecedor, g.notaFiscal, g.descricao, nomeDaArea.get(g.rubricaId) || g.rubricaNome,
      Number(g.valorTotal) || 0, g.parcelas > 1 ? 'Sim' : 'Não', g.parcelas || 1,
      g.primeiraParcela ? rotuloDoMes(g.primeiraParcela) : '', g.observacao, comoFicou(g, formatarMoeda),
    ]);
    const d = new Date();
    baixarArquivo(gerarXlsx([{ nome: 'Lançamentos', colunas, linhas }]), `controle-de-saldo-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.xlsx`);
    avisar(`Planilha com ${linhas.length} ${linhas.length === 1 ? 'gasto' : 'gastos'} baixada.`);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} aria-hidden="true" />
          <input type="search" aria-label="Procurar gasto" placeholder="Procurar gasto..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md outline-none focus:border-primary" />
        </div>
        <select aria-label="Filtrar por área" value={area} onChange={(e) => setArea(e.target.value)} className={campo}>
          <option value="">Todas as áreas</option>
          {rubricas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
        <select aria-label="Filtrar por mês" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} className={campo}>
          <option value="">Todos os meses</option>
          {meses.map((m) => <option key={m} value={m}>{rotuloDoMes(m)}</option>)}
        </select>
      </div>

      {filtrados.length === 0 ? (
        gastos.length === 0 ? (
          <EmptyState
            titulo="Nenhum gasto lançado"
            mensagem="Lance o primeiro gasto pelo botão acima ou traga a planilha de controle de saldo."
            acoes={[{ rotulo: 'Importar planilha', onClick: importar, icone: Upload }]}
          />
        ) : (
          <EmptyState titulo="Nenhum gasto encontrado" mensagem="Mude ou limpe a procura." acoes={[{ rotulo: 'Limpar', onClick: limpar }]} />
        )
      ) : (
        <>
          <ListaDeGastos gastos={filtrados} nomeDaArea={nomeDaArea} editar={editar} excluir={excluir} />
          <p className="text-sm text-gray-600">
            {filtrados.length} {filtrados.length === 1 ? 'gasto' : 'gastos'} · total {formatarMoeda(total)}
            {temFiltro && <button type="button" onClick={limpar} className="ml-3 text-primary hover:underline inline-flex items-center gap-1"><X size={14} aria-hidden="true" /> limpar procura</button>}
          </p>
        </>
      )}

      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
        <button onClick={exportar} disabled={!filtrados.length} className={botaoSecundario}><Download size={18} /> Baixar em Excel</button>
        <button onClick={importar} className={botaoSecundario}><Upload size={18} /> Trazer de uma planilha</button>
      </div>
    </div>
  );
}

// ============================================== Configurar (período e áreas) ====

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
      await setDoc(docDoMunicipio('config', 'saldo'), { inicio, meses: Number(quantos), nome: nome.trim(), atualizadoEm: serverTimestamp() });
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
        <h2 className="font-semibold text-gray-900">1. Quando a verba começa e quantos meses ela vale</h2>
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
          <p className="text-sm text-gray-700">De <strong>{porExtenso(inicio)}</strong> a <strong>{porExtenso(somarMeses(inicio, Number(quantos) - 1))}</strong>.</p>
        )}
      </form>

      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">2. Áreas e a verba de cada uma ({rubricas.length})</h2>
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
                  <th className="px-2 sm:px-3 py-3 text-left font-medium hidden md:table-cell">Gastos lançados</th>
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
                          onClick={() => (qtdDeGastos(r) ? avisar(`"${r.nome}" tem ${qtdDeGastos(r)} gasto(s) lançado(s). Mude a área desses gastos ou exclua-os antes.`, 'error') : excluirArea(r))}
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

// Na frente só o essencial (área, o que foi, valor, data e parcelas); o resto
// fica em "Mais detalhes", que já vem aberto se o gasto tiver algo ali.
function FormularioDeGasto({ gasto, rubricas, gastos, periodo, mesSugerido, fechar, avisar }) {
  const editando = !!gasto.id;
  const [dados, setDados] = useState(() => ({
    rubricaId: gasto.rubricaId || (rubricas.length === 1 ? rubricas[0].id : ''),
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
  const mesDiferenteDaData = editando && gasto.primeiraParcela && gasto.primeiraParcela !== mesDe(gasto.data);
  const [maisAberto, setMaisAberto] = useState(!!(gasto.fornecedor || gasto.notaFiscal || gasto.observacao || mesDiferenteDaData));

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

  // Como fica o saldo da área depois deste gasto, no mês da (1ª) parcela.
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
    return { comoFica: registro.parcelas > 1 ? comoFicou(registro, formatarMoeda) : '', fora, linha, mesAlvo };
  }, [registro.rubricaId, registro.valorTotal, registro.parcelas, registro.primeiraParcela, gastos, rubricas, periodo, gasto.id]);

  const validar = () => {
    const e = {};
    if (!dados.rubricaId) e.rubricaId = 'Escolha a área';
    if (!(Number(dados.valorTotal) > 0)) e.valorTotal = 'Informe o valor';
    if (!dados.data) e.data = 'Informe a data';
    if (!/^\d{4}-\d{2}$/.test(dados.primeiraParcela)) { e.primeiraParcela = 'Informe o mês'; setMaisAberto(true); }
    if (dados.parcelado && !(Number(dados.parcelas) >= 2)) e.parcelas = 'Pelo menos 2 parcelas';
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
      avisar(editando ? 'Gasto atualizado.' : 'Gasto lançado. O saldo já foi atualizado.');
      fechar();
    } catch (erro) {
      console.error(erro);
      avisar('Não foi possível salvar. Tente de novo; o que você digitou continua aqui.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const l = previa?.linha;
  return (
    <Modal isOpen onClose={() => !salvando && fechar()} title={editando ? 'Editar gasto' : 'Lançar gasto'}>
      <form onSubmit={salvar} className="space-y-4" noValidate>
        <Campo id="g-area" rotulo="Área" erro={erros.rubricaId}>
          <select id="g-area" name="rubricaId" value={dados.rubricaId} onChange={mudar} className={campo}>
            <option value="">Escolha a área</option>
            {rubricas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </Campo>
        <Campo id="g-desc" rotulo="O que foi comprado ou feito (opcional)">
          <input id="g-desc" name="descricao" value={dados.descricao} onChange={mudar} className={campo} placeholder="Ex.: Troca do portão" autoComplete="off" />
        </Campo>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo id="g-valor" rotulo={dados.parcelado ? 'Valor total da compra (R$)' : 'Valor (R$)'} erro={erros.valorTotal}>
            <input id="g-valor" name="valorTotal" type="number" step="0.01" min="0" inputMode="decimal" value={dados.valorTotal} onChange={mudar} className={campo} />
          </Campo>
          <Campo id="g-data" rotulo="Data" erro={erros.data}>
            <input id="g-data" name="data" type="date" value={dados.data} onChange={mudar} className={campo} />
          </Campo>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="parcelado" checked={dados.parcelado} onChange={mudar} className="h-4 w-4" /> Foi parcelado
          </label>
          {dados.parcelado && (
            <div className="flex items-center gap-2">
              <label htmlFor="g-parc" className="text-sm text-gray-700">em</label>
              <input id="g-parc" name="parcelas" type="number" min="2" max="60" value={dados.parcelas} onChange={mudar} className={`${campo} w-20`} aria-describedby={erros.parcelas ? 'g-parc-erro' : undefined} />
              <span className="text-sm text-gray-700">vezes</span>
              {erros.parcelas && <span id="g-parc-erro" className="text-xs text-red-600">{erros.parcelas}</span>}
            </div>
          )}
        </div>

        <details open={maisAberto} onToggle={(e) => setMaisAberto(e.currentTarget.open)} className="rounded-md border border-gray-200">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-700">Mais detalhes (opcional)</summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 pt-1">
            <Campo id="g-forn" rotulo="Loja ou fornecedor">
              <input id="g-forn" name="fornecedor" value={dados.fornecedor} onChange={mudar} className={campo} autoComplete="off" />
            </Campo>
            <Campo id="g-nf" rotulo="Nota fiscal">
              <input id="g-nf" name="notaFiscal" value={dados.notaFiscal} onChange={mudar} className={campo} autoComplete="off" />
            </Campo>
            <Campo id="g-mes" rotulo={dados.parcelado ? 'Mês da 1ª parcela' : 'Mês em que o gasto conta'} erro={erros.primeiraParcela} ajuda="Já vem com o mês da data. Mude só se a conta vencer em outro mês." largo>
              <input id="g-mes" name="primeiraParcela" type="month" value={dados.primeiraParcela} onChange={mudar} className={campo} />
            </Campo>
            <Campo id="g-obs" rotulo="Observação" largo>
              <textarea id="g-obs" name="observacao" rows="2" value={dados.observacao} onChange={mudar} className={`${campo} resize-none`} />
            </Campo>
          </div>
        </details>

        {previa && (previa.comoFica || l || previa.fora.length > 0) && (
          <div className={`rounded-md border p-3 text-sm space-y-1 ${l && l.aindaPode < 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`} aria-live="polite">
            {previa.comoFica && <p className="font-medium text-gray-900">{previa.comoFica}</p>}
            {l && (
              <p className={l.aindaPode < 0 ? 'text-red-800' : 'text-green-900'}>
                {l.aindaPode < 0
                  ? `Atenção: com este gasto, ${l.rubrica.nome} passa ${formatarMoeda(-l.aindaPode)} do limite de ${nomeDoMes(previa.mesAlvo)}. Pode lançar mesmo assim; os próximos meses ficam com um limite menor.`
                  : `Depois deste gasto, ${l.rubrica.nome} ainda pode gastar ${formatarMoeda(l.aindaPode)} em ${nomeDoMes(previa.mesAlvo)}.`}
                {l.saldo < 0 && ` A verba desta área acaba e fica faltando ${formatarMoeda(-l.saldo)}.`}
              </p>
            )}
            {previa.fora.length > 0 && (
              <p className="text-amber-800">{previa.fora.length === 1 ? '1 parcela fica' : `${previa.fora.length} parcelas ficam`} para depois do fim desta verba e só {previa.fora.length === 1 ? 'conta' : 'contam'} na próxima.</p>
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
