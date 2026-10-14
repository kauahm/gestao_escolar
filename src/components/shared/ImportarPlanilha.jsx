import React, { useMemo, useRef, useState } from 'react';
import {
  Upload, FileSpreadsheet, Download, CheckCircle2, AlertTriangle, XCircle,
  ArrowLeft, RotateCcw, Columns3,
} from 'lucide-react';

import Modal from '../ui/Modal';
import LoadingSpinner from '../ui/LoadingSpinner';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { lerPlanilha, ErroDePlanilha } from '../../utils/lerPlanilha';
import { ESQUEMAS } from '../../importacao/esquemas';
import {
  encontrarCabecalho, camposObrigatoriosFaltando, validarLinhas, resumir, MAXIMO_DE_LINHAS,
} from '../../importacao/processar';
import { importarRegistros, desfazerImportacao } from '../../importacao/gravar';
import { baixarModelo, baixarRelatorio } from '../../importacao/arquivos';

const LIMITE_NA_TELA = 300;
const NENHUM = [];

const SITUACOES = {
  ok: { rotulo: 'Pronta', cor: 'bg-green-100 text-green-800', Icone: CheckCircle2 },
  aviso: { rotulo: 'Com aviso', cor: 'bg-amber-100 text-amber-800', Icone: AlertTriangle },
  erro: { rotulo: 'Com erro', cor: 'bg-red-100 text-red-800', Icone: XCircle },
};

const textoDaCelula = (v) => {
  if (v instanceof Date) return v.toLocaleDateString('pt-BR');
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  return String(v ?? '');
};

/**
 * Importar planilha (Excel ou CSV) para um módulo.
 * @param {'escolas'|'contas'|'ciclos'|'curriculos'} tipo
 * @param escolas  escolas cadastradas (para achar a escola de cada linha)
 * @param existentes  registros que já existem (para não duplicar)
 */
export default function ImportarPlanilha({ isOpen, onClose, tipo, escolas = NENHUM, existentes = NENHUM }) {
  const esquema = ESQUEMAS[tipo];
  const { currentUser } = useAuth();
  const entrada = useRef(null);

  const [etapa, setEtapa] = useState('arquivo'); // arquivo | colunas | previa | concluido
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const [arquivo, setArquivo] = useState('');
  const [abas, setAbas] = useState([]);
  const [indiceAba, setIndiceAba] = useState(0);
  const [indiceCabecalho, setIndiceCabecalho] = useState(-1);
  const [mapeamento, setMapeamento] = useState({});
  const [soProblemas, setSoProblemas] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [final, setFinal] = useState(null); // { importacaoId, importados }
  const [desfazendo, setDesfazendo] = useState(false);
  const [confirmarDesfazer, setConfirmarDesfazer] = useState(false);

  const reiniciar = () => {
    setEtapa('arquivo'); setErro(''); setArquivo(''); setAbas([]); setIndiceAba(0);
    setIndiceCabecalho(-1); setMapeamento({}); setSoProblemas(false); setFinal(null);
    setConfirmarDesfazer(false);
    if (entrada.current) entrada.current.value = '';
  };

  const fechar = () => {
    if (gravando || desfazendo) return;
    reiniciar();
    onClose();
  };

  const linhas = abas[indiceAba]?.linhas || [];
  const titulos = indiceCabecalho >= 0 ? (linhas[indiceCabecalho] || []) : [];
  const faltando = useMemo(() => camposObrigatoriosFaltando(mapeamento, esquema), [mapeamento, esquema]);

  const validacao = useMemo(() => {
    // Só na pré-visualização: depois de importar, os registros novos passam a
    // existir e a mesma planilha apareceria inteira como "repetida".
    if (etapa !== 'previa') return null;
    return validarLinhas(linhas, indiceCabecalho, mapeamento, esquema, { escolas, existentes });
  }, [etapa, linhas, indiceCabecalho, mapeamento, esquema, escolas, existentes]);

  const totais = validacao ? resumir(validacao.registros) : null;

  const prepararAba = (listaDeAbas, indice) => {
    const { indice: cab, mapeamento: mapa } = encontrarCabecalho(listaDeAbas[indice].linhas, esquema);
    setIndiceAba(indice);
    setIndiceCabecalho(cab >= 0 ? cab : 0);
    setMapeamento(mapa);
    return camposObrigatoriosFaltando(mapa, esquema).length === 0 && cab >= 0;
  };

  const aoEscolherArquivo = async (e) => {
    const escolhido = e.target.files?.[0];
    if (!escolhido) return;
    setErro('');
    setLendo(true);
    try {
      const { abas: lidas } = await lerPlanilha(escolhido);
      const comDados = lidas.filter((a) => a.linhas.some((l) => l.some((v) => String(v ?? '').trim() !== '')));
      if (!comDados.length) throw new ErroDePlanilha('A planilha está vazia.');
      // Começa pela aba que mais se parece com o modelo.
      let melhor = 0;
      let acertos = -1;
      comDados.forEach((a, i) => {
        const r = encontrarCabecalho(a.linhas, esquema);
        if (r.acertos > acertos) { melhor = i; acertos = r.acertos; }
      });
      setArquivo(escolhido.name);
      setAbas(comDados);
      const completo = prepararAba(comDados, melhor);
      setEtapa(completo ? 'previa' : 'colunas');
    } catch (erroLeitura) {
      console.error(erroLeitura);
      setErro(erroLeitura instanceof ErroDePlanilha ? erroLeitura.message : 'Não foi possível ler este arquivo. Confira se é uma planilha Excel (.xlsx) ou CSV.');
    } finally {
      setLendo(false);
      if (entrada.current) entrada.current.value = '';
    }
  };

  const trocarCampo = (coluna, campo) => {
    setMapeamento((atual) => {
      const novo = { ...atual };
      Object.keys(novo).forEach((k) => { if (novo[k] === campo) delete novo[k]; }); // cada campo em uma coluna só
      if (campo) novo[coluna] = campo; else delete novo[coluna];
      return novo;
    });
  };

  const importar = async () => {
    const validos = validacao.registros.filter((r) => r.situacao !== 'erro');
    setGravando(true);
    setErro('');
    try {
      const r = await importarRegistros({
        db, esquema, registros: validos, arquivo,
        usuario: { uid: currentUser.uid, email: currentUser.email },
      });
      setFinal({ ...r, totais, registros: validacao.registros });
      setEtapa('concluido');
    } catch (erroGravacao) {
      console.error(erroGravacao.causa || erroGravacao);
      setErro(erroGravacao.message || 'Não foi possível importar.');
      if (erroGravacao.importacaoId) {
        setFinal({ importacaoId: erroGravacao.importacaoId, importados: 0, incompleta: true, totais, registros: validacao.registros });
        setEtapa('concluido');
      }
    } finally {
      setGravando(false);
    }
  };

  const desfazer = async () => {
    setDesfazendo(true);
    setErro('');
    try {
      const { removidos } = await desfazerImportacao({
        db, importacao: { id: final.importacaoId, colecao: esquema.colecao },
        usuario: { uid: currentUser.uid, email: currentUser.email },
      });
      setFinal((f) => ({ ...f, desfeita: true, removidos }));
    } catch (erroDesfazer) {
      console.error(erroDesfazer);
      setErro('Não foi possível desfazer. Tente de novo; nada foi perdido.');
    } finally {
      setDesfazendo(false);
      setConfirmarDesfazer(false);
    }
  };

  if (!esquema) return null;

  const registrosNaTela = validacao
    ? validacao.registros.filter((r) => !soProblemas || r.situacao !== 'ok')
    : [];

  return (
    <Modal isOpen={isOpen} onClose={fechar} title={`Importar planilha · ${esquema.titulo}`} size="lg">
      {erro && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex gap-2">
          <XCircle size={18} className="shrink-0 mt-0.5" /> <span>{erro}</span>
        </div>
      )}

      {/* 1. Arquivo */}
      {etapa === 'arquivo' && (
        <div className="space-y-5">
          <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
            <li>Baixe o modelo (ou use a sua planilha: os títulos das colunas podem ter nomes parecidos).</li>
            <li>Uma linha por {esquema.nomeDoRegistro}. Colunas obrigatórias: {esquema.campos.filter((c) => c.obrigatorio).map((c) => c.rotulo).join(', ')}.</li>
            <li>Envie o arquivo. Nada é gravado antes de você conferir a pré-visualização.</li>
          </ol>

          <button
            type="button"
            onClick={() => baixarModelo(esquema, escolas)}
            className="text-primary hover:underline text-sm font-medium flex items-center gap-1.5"
          >
            <Download size={16} /> Baixar modelo em Excel
          </button>

          <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${lendo ? 'border-gray-200 bg-gray-50' : 'border-gray-300 hover:border-primary hover:bg-blue-50/40'}`}>
            {lendo ? <LoadingSpinner /> : <Upload size={28} className="text-gray-500" />}
            <span className="font-medium text-gray-800">{lendo ? 'Lendo a planilha...' : 'Escolher arquivo'}</span>
            <span className="text-xs text-gray-500">Excel (.xlsx) ou CSV · até {MAXIMO_DE_LINHAS.toLocaleString('pt-BR')} linhas por vez</span>
            <input ref={entrada} type="file" accept=".xlsx,.xlsm,.csv,.txt" className="sr-only" onChange={aoEscolherArquivo} disabled={lendo} />
          </label>
        </div>
      )}

      {/* 2. Colunas */}
      {etapa === 'colunas' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 text-sm text-gray-700">
            <Columns3 size={18} className="shrink-0 mt-0.5 text-primary" />
            <p>Confira a qual informação corresponde cada coluna de <strong>{arquivo}</strong>. O que não for reconhecido fica como "Não importar".</p>
          </div>

          {abas.length > 1 && (
            <label className="block text-sm">
              <span className="text-gray-600">Aba da planilha</span>
              <select
                className="mt-1 w-full sm:w-72 px-3 py-2 border border-gray-300 rounded-md bg-white"
                value={indiceAba}
                onChange={(e) => prepararAba(abas, Number(e.target.value))}
              >
                {abas.map((a, i) => <option key={a.nome + i} value={i}>{a.nome}</option>)}
              </select>
            </label>
          )}

          <label className="block text-sm">
            <span className="text-gray-600">Linha dos títulos</span>
            <select
              className="mt-1 w-full sm:w-72 px-3 py-2 border border-gray-300 rounded-md bg-white"
              value={indiceCabecalho}
              onChange={(e) => {
                const i = Number(e.target.value);
                setIndiceCabecalho(i);
                setMapeamento(encontrarCabecalho([linhas[i] || []], esquema).mapeamento);
              }}
            >
              {linhas.slice(0, 15).map((l, i) => (
                <option key={i} value={i}>Linha {i + 1}: {(l || []).map(textoDaCelula).filter(Boolean).join(' | ').slice(0, 60) || '(vazia)'}</option>
              ))}
            </select>
          </label>

          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {titulos.map((titulo, coluna) => (
              textoDaCelula(titulo).trim() === '' ? null : (
                <div key={coluna} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3">
                  <div className="sm:w-1/2 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{textoDaCelula(titulo)}</p>
                    <p className="text-xs text-gray-500 truncate">
                      Ex.: {linhas.slice(indiceCabecalho + 1, indiceCabecalho + 4).map((l) => textoDaCelula(l?.[coluna])).filter(Boolean).join(' · ') || '(vazia)'}
                    </p>
                  </div>
                  <select
                    className="sm:w-1/2 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
                    value={mapeamento[coluna] || ''}
                    onChange={(e) => trocarCampo(coluna, e.target.value)}
                  >
                    <option value="">Não importar</option>
                    {esquema.campos.map((c) => <option key={c.chave} value={c.chave}>{c.rotulo}{c.obrigatorio ? ' *' : ''}</option>)}
                  </select>
                </div>
              )
            ))}
          </div>

          {faltando.length > 0 && (
            <p className="text-sm text-red-700 flex gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              Falta indicar a coluna de: {faltando.map((c) => c.rotulo).join(', ')}.
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-between gap-2 pt-2">
            <button type="button" onClick={reiniciar} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg flex items-center justify-center gap-1.5">
              <ArrowLeft size={16} /> Escolher outro arquivo
            </button>
            <button
              type="button"
              disabled={faltando.length > 0}
              onClick={() => setEtapa('previa')}
              className="bg-primary hover:bg-primary-dark disabled:opacity-50 text-white px-5 py-2 rounded-lg font-medium"
            >
              Ver pré-visualização
            </button>
          </div>
        </div>
      )}

      {/* 3. Pré-visualização */}
      {etapa === 'previa' && validacao && (
        <div className="space-y-4">
          <p className="text-sm text-gray-700 flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-primary shrink-0" />
            <span><strong>{arquivo}</strong>{abas.length > 1 ? ` · aba "${abas[indiceAba].nome}"` : ''}</span>
          </p>

          <div className="grid grid-cols-3 gap-2">
            {['ok', 'aviso', 'erro'].map((s) => {
              const { rotulo, cor, Icone } = SITUACOES[s];
              return (
                <div key={s} className={`rounded-lg p-3 ${cor}`}>
                  <p className="text-2xl font-bold flex items-center gap-1.5"><Icone size={20} /> {totais[s]}</p>
                  <p className="text-xs font-medium">{s === 'ok' ? 'Prontas' : s === 'aviso' ? 'Com aviso (entram)' : 'Com erro (não entram)'}</p>
                  <span className="sr-only">{rotulo}</span>
                </div>
              );
            })}
          </div>

          {validacao.excedeuLimite && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              A planilha tem mais de {MAXIMO_DE_LINHAS.toLocaleString('pt-BR')} linhas. Só as primeiras {MAXIMO_DE_LINHAS.toLocaleString('pt-BR')} foram consideradas; importe o restante em outro arquivo.
            </p>
          )}

          {totais.total === 0 ? (
            <p className="text-sm text-gray-600 p-6 text-center border border-dashed rounded-lg">Nenhuma linha com dados abaixo dos títulos.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm text-gray-700 flex items-center gap-2">
                  <input type="checkbox" checked={soProblemas} onChange={(e) => setSoProblemas(e.target.checked)} />
                  Mostrar só as linhas com aviso ou erro
                </label>
                {(totais.erro > 0 || totais.aviso > 0) && (
                  <button type="button" onClick={() => baixarRelatorio(esquema, validacao.registros, arquivo)} className="text-sm text-primary hover:underline flex items-center gap-1.5">
                    <Download size={15} /> Baixar relatório para corrigir
                  </button>
                )}
              </div>

              <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-80">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 sticky top-0">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Linha</th>
                      <th className="text-left font-medium px-3 py-2">Situação</th>
                      <th className="text-left font-medium px-3 py-2">Registro</th>
                      <th className="text-left font-medium px-3 py-2">Mensagens</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {registrosNaTela.slice(0, LIMITE_NA_TELA).map((r) => {
                      const { rotulo, cor } = SITUACOES[r.situacao];
                      const resumo = esquema.resumo(r.dados) || Object.values(r.original).map(textoDaCelula).filter(Boolean).join(' · ');
                      return (
                        <tr key={r.linha} className="align-top">
                          <td className="px-3 py-2 text-gray-500">{r.linha}</td>
                          <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cor}`}>{rotulo}</span></td>
                          <td className="px-3 py-2 text-gray-900">{resumo}</td>
                          <td className="px-3 py-2 text-xs">
                            {r.erros.map((m) => <p key={m} className="text-red-700">{m}</p>)}
                            {r.avisos.map((m) => <p key={m} className="text-amber-700">{m}</p>)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {registrosNaTela.length > LIMITE_NA_TELA && (
                <p className="text-xs text-gray-500">Mostrando {LIMITE_NA_TELA} de {registrosNaTela.length} linhas. O relatório para baixar traz todas as que têm aviso ou erro.</p>
              )}
            </>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-between gap-2 pt-2">
            <div className="flex gap-2">
              <button type="button" onClick={reiniciar} disabled={gravando} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-1.5">
                <ArrowLeft size={16} /> Outro arquivo
              </button>
              <button type="button" onClick={() => setEtapa('colunas')} disabled={gravando} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-1.5">
                <Columns3 size={16} /> Conferir colunas
              </button>
            </div>
            <button
              type="button"
              onClick={importar}
              disabled={gravando || totais.importaveis === 0}
              className="bg-primary hover:bg-primary-dark disabled:opacity-50 text-white px-5 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
            >
              {gravando && <LoadingSpinner size="sm" color="text-white" />}
              {gravando
                ? 'Importando...'
                : totais.importaveis === 0
                  ? 'Nada para importar'
                  : `Importar ${totais.importaveis} ${totais.importaveis === 1 ? esquema.nomeDoRegistro : `${esquema.nomeDoRegistro}s`}`}
            </button>
          </div>
        </div>
      )}

      {/* 4. Resultado */}
      {etapa === 'concluido' && final && (
        <div className="space-y-5 text-center py-2">
          {final.desfeita ? (
            <>
              <RotateCcw size={40} className="mx-auto text-amber-600" />
              <p className="text-lg font-semibold text-gray-900">Importação desfeita</p>
              <p className="text-sm text-gray-600">{final.removidos} {final.removidos === 1 ? 'registro foi movido' : 'registros foram movidos'} para a lixeira (em Segurança dos dados).</p>
            </>
          ) : final.incompleta ? (
            <>
              <AlertTriangle size={40} className="mx-auto text-amber-600" />
              <p className="text-lg font-semibold text-gray-900">A importação não terminou</p>
              <p className="text-sm text-gray-600">Desfaça o que foi gravado e tente de novo.</p>
            </>
          ) : (
            <>
              <CheckCircle2 size={40} className="mx-auto text-green-600" />
              <p className="text-lg font-semibold text-gray-900">{final.importados} {final.importados === 1 ? 'registro importado' : 'registros importados'}</p>
              {final.totais?.erro > 0 && (
                <p className="text-sm text-gray-600">
                  {final.totais.erro} {final.totais.erro === 1 ? 'linha ficou de fora' : 'linhas ficaram de fora'} por erro.{' '}
                  <button type="button" onClick={() => baixarRelatorio(esquema, final.registros, arquivo)} className="text-primary hover:underline">Baixar relatório</button>
                </p>
              )}
              <p className="text-xs text-gray-500">Errou alguma coisa? Dá para desfazer a importação inteira: os registros vão para a lixeira.</p>
            </>
          )}

          <div className="flex flex-col sm:flex-row justify-center gap-2">
            {!final.desfeita && (
              confirmarDesfazer ? (
                <button type="button" onClick={desfazer} disabled={desfazendo} className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium flex items-center justify-center gap-2">
                  {desfazendo && <LoadingSpinner size="sm" color="text-white" />}
                  {desfazendo ? 'Desfazendo...' : 'Confirmar: mover tudo para a lixeira'}
                </button>
              ) : (
                <button type="button" onClick={() => setConfirmarDesfazer(true)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium flex items-center justify-center gap-2">
                  <RotateCcw size={16} /> Desfazer esta importação
                </button>
              )
            )}
            <button type="button" onClick={fechar} disabled={desfazendo} className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white font-medium">
              Fechar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
