import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, orderBy, query, limit } from 'firebase/firestore';
import { ouvir } from '../../services/leitura';
import { db } from '../../services/firebase';
import { restaurarDaLixeira, COLECAO_LIXEIRA, COLECAO_HISTORICO } from '../../services/db';
import { baixarExcel, baixarJson, rotuloDaColecao } from '../../utils/exportarDados';
import { EH_DEMO } from '../../services/ambiente';

import Toast from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

import {
  ShieldCheck, Download, FileSpreadsheet, FileJson, Trash2, RotateCcw,
  History, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, FlaskConical,
} from 'lucide-react';

const ACOES = {
  criar: { rotulo: 'Criou', cor: 'bg-green-100 text-green-800' },
  alterar: { rotulo: 'Alterou', cor: 'bg-blue-100 text-blue-800' },
  excluir: { rotulo: 'Excluiu', cor: 'bg-red-100 text-red-800' },
  restaurar: { rotulo: 'Restaurou', cor: 'bg-amber-100 text-amber-800' },
};

const pad = (n) => String(n).padStart(2, '0');

const quando = (ts) => {
  if (!ts?.toDate) return 'agora';
  const d = ts.toDate();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const diasDesde = (ts) => {
  if (!ts?.toDate) return null;
  return Math.floor((Date.now() - ts.toDate().getTime()) / 86400000);
};

const textoDoValor = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (v?.toDate) return quando(v);
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  return s.length > 140 ? `${s.slice(0, 140)}…` : s;
};

export default function Seguranca() {
  const [backup, setBackup] = useState(null);
  const [lixeira, setLixeira] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [usuarios, setUsuarios] = useState({});
  const [carregando, setCarregando] = useState(true);

  const [baixando, setBaixando] = useState(null); // 'xlsx' | 'json' | null
  const [paraRestaurar, setParaRestaurar] = useState(null);
  const [filtroColecao, setFiltroColecao] = useState('Todas');
  const [aberto, setAberto] = useState(null);
  const [confirmarDemo, setConfirmarDemo] = useState(false);
  const [restaurandoDemo, setRestaurandoDemo] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const avisar = (message, type = 'success') => setToast({ show: true, message, type });

  useEffect(() => {
    const parar = [];

    parar.push(ouvir(doc(db, 'config', 'backup'),
      (s) => setBackup(s.exists() ? s.data() : null),
      () => setBackup(null)));

    parar.push(ouvir(query(collection(db, COLECAO_LIXEIRA), orderBy('excluidoEm', 'desc')),
      (s) => { setLixeira(s.docs.map((d) => ({ id: d.id, ...d.data() }))); setCarregando(false); },
      (e) => { console.warn('[lixeira]', e?.code); setCarregando(false); }));

    parar.push(ouvir(query(collection(db, COLECAO_HISTORICO), orderBy('em', 'desc'), limit(150)),
      (s) => setHistorico(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.warn('[historico]', e?.code)));

    // Para mostrar o nome de quem fez, em vez do e-mail.
    parar.push(ouvir(collection(db, 'usuarios'), (s) => {
      const mapa = {};
      s.docs.forEach((d) => { mapa[d.id] = d.data().nome; });
      setUsuarios(mapa);
    }, () => {}));

    return () => parar.forEach((p) => p());
  }, []);

  const nomeDe = (uid, email) => (uid && usuarios[uid]) || email || 'Usuário desconhecido';

  const historicoFiltrado = useMemo(
    () => historico.filter((h) => filtroColecao === 'Todas' || h.colecao === filtroColecao),
    [historico, filtroColecao]
  );

  const colecoesNoHistorico = useMemo(
    () => [...new Set(historico.map((h) => h.colecao))].sort(),
    [historico]
  );

  const baixar = async (formato) => {
    setBaixando(formato);
    try {
      const { totais, falhas } = formato === 'xlsx' ? await baixarExcel() : await baixarJson();
      const total = Object.values(totais).reduce((a, b) => a + b, 0);
      if (falhas.length) {
        avisar(`Cópia baixada com ${total} registros, mas não foi possível ler: ${falhas.join(', ')}.`, 'error');
      } else {
        avisar(`Cópia baixada com ${total} registros. Guarde o arquivo no Drive.`);
      }
    } catch (erro) {
      console.error(erro);
      avisar('Não foi possível gerar a cópia. Tente novamente.', 'error');
    } finally {
      setBaixando(null);
    }
  };

  const restaurar = async () => {
    const item = paraRestaurar;
    setParaRestaurar(null);
    if (!item) return;
    try {
      await restaurarDaLixeira(item);
      avisar(`"${item.titulo || 'Registro'}" voltou para ${rotuloDaColecao(item.colecao)}.`);
    } catch (erro) {
      console.error(erro);
      avisar(erro?.message?.startsWith('Já existe') ? erro.message : 'Não foi possível restaurar. Tente novamente.', 'error');
    }
  };

  // Só existe no ambiente de demonstração. O código é carregado sob demanda,
  // então nem chega ao navegador de quem usa o sistema real.
  const restaurarDemo = async () => {
    setConfirmarDemo(false);
    if (!EH_DEMO) return;
    setRestaurandoDemo(true);
    try {
      const { resetarDemo } = await import('../../demo/resetarDemo.js');
      const { criados } = await resetarDemo(db);
      avisar(`Dados de demonstração restaurados: ${criados} registros fictícios.`);
    } catch (erro) {
      console.error(erro);
      avisar(erro?.message?.startsWith('Recusado') ? erro.message : 'Não foi possível restaurar os dados de demonstração.', 'error');
    } finally {
      setRestaurandoDemo(false);
    }
  };

  const dias = diasDesde(backup?.ultimoEm);
  const copiaEmDia = dias !== null && dias <= 7;

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="text-primary" size={28} /> Segurança dos dados
        </h1>
        <p className="text-gray-600 mt-2 max-w-3xl">
          Aqui nada se perde. O que for excluído vai para a <strong>lixeira</strong> e volta com um clique.
          Toda alteração fica <strong>registrada</strong> com quem fez e quando. E você pode <strong>baixar
          uma cópia completa</strong> de tudo a qualquer momento.
        </p>
      </div>

      {EH_DEMO && (
        <section className="bg-purple-50 rounded-xl border border-purple-200 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-purple-100 text-purple-700"><FlaskConical size={24} /></div>
            <div>
              <h2 className="font-bold text-purple-900">Ambiente de demonstração</h2>
              <p className="text-sm text-purple-900/80 mt-0.5">
                Todos os dados aqui são fictícios. Depois de uma apresentação, restaure para voltar ao ponto de partida:
                tudo é apagado (inclusive lixeira e histórico) e os dados de exemplo são gravados de novo. As contas de usuário são mantidas.
              </p>
            </div>
          </div>
          <button
            onClick={() => setConfirmarDemo(true)}
            disabled={restaurandoDemo}
            className="shrink-0 bg-purple-700 hover:bg-purple-800 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium shadow-sm transition-colors"
          >
            {restaurandoDemo ? <LoadingSpinner size="sm" color="text-white" /> : <RotateCcw size={18} />}
            Restaurar dados de demonstração
          </button>
        </section>
      )}

      {/* Cópia de segurança */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-lg ${copiaEmDia ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
              {copiaEmDia ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Cópia de segurança</h2>
              <p className="text-sm text-gray-600 mt-0.5">
                {backup?.ultimoEm
                  ? <>Última cópia: <strong>{quando(backup.ultimoEm)}</strong>{dias > 0 ? ` (há ${dias} ${dias === 1 ? 'dia' : 'dias'})` : ' (hoje)'}, por {nomeDe(backup.porUid, backup.porEmail)}.</>
                  : 'Nenhuma cópia baixada ainda.'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Recomendado: uma vez por semana, salvando o arquivo numa pasta do Google Drive.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <button
              onClick={() => baixar('xlsx')}
              disabled={!!baixando}
              className="bg-primary hover:bg-primary-dark disabled:opacity-60 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium shadow-sm transition-colors"
            >
              {baixando === 'xlsx' ? <LoadingSpinner size="sm" color="text-white" /> : <FileSpreadsheet size={18} />}
              Baixar em Excel
            </button>
            <button
              onClick={() => baixar('json')}
              disabled={!!baixando}
              title="Cópia fiel, que permite reconstruir os dados se for preciso"
              className="bg-white hover:bg-gray-50 disabled:opacity-60 text-gray-700 border border-gray-300 px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
            >
              {baixando === 'json' ? <LoadingSpinner size="sm" /> : <FileJson size={18} />}
              Cópia completa (JSON)
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-4 flex items-center gap-1.5">
          <Download size={14} />
          O Excel tem uma aba por módulo, para ler e conferir. O JSON é a cópia fiel (inclui lixeira e histórico) para reconstruir o sistema se um dia for preciso.
        </p>
      </section>

      {/* Lixeira */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-gray-800 flex items-center gap-2"><Trash2 size={18} /> Lixeira</h2>
          <span className="text-sm text-gray-500">{lixeira.length} {lixeira.length === 1 ? 'item' : 'itens'}</span>
        </div>
        {carregando ? (
          <div className="p-8 flex justify-center"><LoadingSpinner /></div>
        ) : lixeira.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">A lixeira está vazia. Quando algo for excluído, aparece aqui e pode ser restaurado.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {lixeira.map((item) => (
              <li key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{item.titulo || '(sem título)'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {rotuloDaColecao(item.colecao)} · excluído em {quando(item.excluidoEm)} por {nomeDe(item.excluidoPor, item.excluidoPorEmail)}
                  </p>
                </div>
                <button
                  onClick={() => setParaRestaurar(item)}
                  className="shrink-0 flex items-center gap-1.5 text-sm font-medium text-primary hover:bg-blue-50 px-3 py-1.5 rounded-md border border-blue-200 transition-colors"
                >
                  <RotateCcw size={16} /> Restaurar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Histórico */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-bold text-gray-800 flex items-center gap-2"><History size={18} /> Histórico de alterações</h2>
          <select
            value={filtroColecao}
            onChange={(e) => setFiltroColecao(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm outline-none focus:border-primary bg-white"
          >
            <option value="Todas">Todos os módulos</option>
            {colecoesNoHistorico.map((c) => <option key={c} value={c}>{rotuloDaColecao(c)}</option>)}
          </select>
        </div>
        {historicoFiltrado.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">Nenhuma alteração registrada ainda. A partir de agora, tudo que for criado, alterado ou excluído aparece aqui.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {historicoFiltrado.map((h) => {
              const acao = ACOES[h.acao] || { rotulo: h.acao, cor: 'bg-gray-100 text-gray-800' };
              const campos = h.acao === 'alterar' ? Object.keys(h.depois || {}) : [];
              const expandido = aberto === h.id;
              return (
                <li key={h.id} className="p-4">
                  <button
                    onClick={() => setAberto(expandido ? null : h.id)}
                    className="w-full text-left flex items-start gap-3"
                    disabled={campos.length === 0}
                  >
                    <span className="mt-0.5 text-gray-400 w-4 shrink-0">
                      {campos.length > 0 && (expandido ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
                    </span>
                    <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded ${acao.cor}`}>{acao.rotulo}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-gray-900 truncate">
                        <strong>{rotuloDaColecao(h.colecao)}</strong>{h.titulo ? ` · ${h.titulo}` : ''}
                      </span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        {nomeDe(h.porUid, h.porEmail)} · {quando(h.em)}
                        {campos.length > 0 && ` · ${campos.length} ${campos.length === 1 ? 'campo' : 'campos'}`}
                      </span>
                    </span>
                  </button>
                  {expandido && campos.length > 0 && (
                    <div className="mt-3 ml-7 overflow-x-auto">
                      <table className="text-xs w-full">
                        <thead className="text-gray-500">
                          <tr><th className="text-left font-medium pb-1 pr-4">Campo</th><th className="text-left font-medium pb-1 pr-4">Era</th><th className="text-left font-medium pb-1">Ficou</th></tr>
                        </thead>
                        <tbody>
                          {campos.map((c) => (
                            <tr key={c} className="align-top">
                              <td className="pr-4 py-1 text-gray-600 whitespace-nowrap">{c}</td>
                              <td className="pr-4 py-1 text-red-700 line-through decoration-red-300">{textoDoValor(h.antes?.[c])}</td>
                              <td className="py-1 text-green-800">{textoDoValor(h.depois?.[c])}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        isOpen={!!paraRestaurar}
        title="Restaurar registro"
        message={`"${paraRestaurar?.titulo || 'Registro'}" volta para ${rotuloDaColecao(paraRestaurar?.colecao)} exatamente como estava quando foi excluído.`}
        onConfirm={restaurar}
        onCancel={() => setParaRestaurar(null)}
      />

      <ConfirmDialog
        isOpen={confirmarDemo}
        title="Restaurar dados de demonstração"
        message="Tudo o que foi lançado neste ambiente de demonstração será apagado e os dados de exemplo voltam ao início. As contas de usuário são mantidas."
        onConfirm={restaurarDemo}
        onCancel={() => setConfirmarDemo(false)}
      />

      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
    </div>
  );
}
