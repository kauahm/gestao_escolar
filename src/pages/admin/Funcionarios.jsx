import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import {
  Plus, Search, Upload, Download, Eye, Edit2, Trash2, X, Users, Accessibility, Stethoscope, HeartPulse,
} from 'lucide-react';

import { db } from '../../services/firebase';
import { ouvir } from '../../services/leitura';
import { addDoc, updateDoc, deleteDoc } from '../../services/db';
import { formatarMoeda, formatarTelefone } from '../../utils/formatters';
import {
  CARGOS, TIPOS_DE_AFASTAMENTO, normalizarCargo, situacaoDoFuncionario, idade, vencimentoSugeridoDoAso,
} from '../../utils/funcionarios';
import { cpf as converterCpf, pis as converterPis, telefone as converterTelefone, chave, cpfValido } from '../../importacao/normalizar';
import { gerarXlsx } from '../../utils/planilhaXlsx';
import { baixarArquivo } from '../../importacao/arquivos';

import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import Badge from '../../components/ui/Badge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { EsqueletoDeLista } from '../../components/ui/Esqueleto';
import ImportarPlanilha from '../../components/shared/ImportarPlanilha';

// Cadastro de funcionários (colaboradores das escolas), com a mesma estrutura
// da planilha "Colaboradores" da AEMC. Ver docs/19-funcionarios.md.

const VAZIO = {
  nome: '', escolaId: '', escolaNome: '', cargo: '', situacao: 'Ativa', pcd: false,
  dataNascimento: '', dataAdmissao: '', salario: '', cpf: '', rg: '', pis: '',
  telefone: '', endereco: '', cidade: '',
  dataUltimoAso: '', dataVencimentoAso: '',
  afastamentoInicio: '', afastamentoRetorno: '', afastamentoTipo: '',
  dataRescisao: '', observacoes: '',
};

const dataBr = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '');
const campo = 'w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary bg-white';
const rotulo = 'block text-sm font-medium text-gray-700 mb-1';

/** Selos da linha: situação, afastamento, PCD e ASO. */
function Selos({ f }) {
  const s = situacaoDoFuncionario(f);
  return (
    <div className="flex flex-wrap gap-1">
      <Badge label={f.situacao === 'Inativa' ? 'Inativa' : 'Ativa'} color={f.situacao === 'Inativa' ? 'gray' : 'green'} />
      {s.afastado && <Badge label="Afastado(a)" color="yellow" />}
      {f.pcd && <Badge label="PCD" color="blue" />}
      {s.asoVencido && <Badge label="ASO vencido" color="red" />}
      {s.asoVencendo && <Badge label={`ASO em ${s.diasParaAso} d`} color="yellow" />}
    </div>
  );
}

export default function Funcionarios() {
  const [funcionarios, setFuncionarios] = useState([]);
  const [escolas, setEscolas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [busca, setBusca] = useState('');
  const [filtroEscola, setFiltroEscola] = useState('Todas');
  const [filtroCargo, setFiltroCargo] = useState('Todos');
  const [filtroSituacao, setFiltroSituacao] = useState('Ativa');
  // ?mostrar=aso (vindo do alerta do painel) abre já filtrado.
  const [parametros] = useSearchParams();
  const [filtroEspecial, setFiltroEspecial] = useState(() => (['pcd', 'afastados', 'aso'].includes(parametros.get('mostrar')) ? parametros.get('mostrar') : ''));

  const [formularioAberto, setFormularioAberto] = useState(false);
  const [dados, setDados] = useState(VAZIO);
  const [erros, setErros] = useState({});
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [importarAberto, setImportarAberto] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const avisar = (message, type = 'success') => setToast({ show: true, message, type });

  useEffect(() => {
    const parar = [
      ouvir(collection(db, 'funcionarios'), (s) => {
        setFuncionarios(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')));
        setCarregando(false);
      }, () => setCarregando(false)),
      ouvir(collection(db, 'escolas'), (s) => {
        setEscolas(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')));
      }),
    ];
    return () => parar.forEach((p) => p());
  }, []);

  // Cargos para o filtro e as sugestões: os da lista + os que já existem no cadastro.
  const cargos = useMemo(() => {
    const todos = new Map(CARGOS.map((c) => [chave(c), c]));
    funcionarios.forEach((f) => { if (f.cargo && !todos.has(chave(f.cargo))) todos.set(chave(f.cargo), f.cargo); });
    return [...todos.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [funcionarios]);

  const filtrados = useMemo(() => {
    const termo = chave(busca);
    const digitos = busca.replace(/\D/g, '');
    return funcionarios.filter((f) => {
      const s = situacaoDoFuncionario(f);
      if (termo && !chave(f.nome).includes(termo) && !(digitos.length >= 3 && String(f.cpf || '').replace(/\D/g, '').includes(digitos))) return false;
      if (filtroEscola !== 'Todas' && f.escolaId !== filtroEscola) return false;
      if (filtroCargo !== 'Todos' && f.cargo !== filtroCargo) return false;
      if (filtroSituacao !== 'Todas' && (f.situacao || 'Ativa') !== filtroSituacao) return false;
      if (filtroEspecial === 'pcd' && !f.pcd) return false;
      if (filtroEspecial === 'afastados' && !s.afastado) return false;
      if (filtroEspecial === 'aso' && !(s.asoVencido || s.asoVencendo)) return false;
      return true;
    });
  }, [funcionarios, busca, filtroEscola, filtroCargo, filtroSituacao, filtroEspecial]);

  const totais = useMemo(() => {
    const ativos = funcionarios.filter((f) => f.situacao !== 'Inativa');
    const sit = ativos.map((f) => situacaoDoFuncionario(f));
    return {
      ativos: ativos.length,
      inativos: funcionarios.length - ativos.length,
      pcd: ativos.filter((f) => f.pcd).length,
      afastados: sit.filter((s) => s.afastado).length,
      aso: sit.filter((s) => s.asoVencido || s.asoVencendo).length,
    };
  }, [funcionarios]);

  const filtrosAtivos = busca || filtroEscola !== 'Todas' || filtroCargo !== 'Todos' || filtroSituacao !== 'Ativa' || filtroEspecial;
  const limparFiltros = () => { setBusca(''); setFiltroEscola('Todas'); setFiltroCargo('Todos'); setFiltroSituacao('Ativa'); setFiltroEspecial(''); };

  // ------------------------------------------------------------ formulário ----

  const abrirFormulario = (f = null) => {
    setDetalhe(null);
    setEditando(f);
    setDados(f ? { ...VAZIO, ...f, salario: f.salario ?? '' } : VAZIO);
    setErros({});
    setFormularioAberto(true);
  };

  const mudar = (e) => {
    const { name, value, type, checked } = e.target;
    setDados((d) => {
      const novo = { ...d, [name]: type === 'checkbox' ? checked : value };
      if (name === 'escolaId') novo.escolaNome = escolas.find((x) => x.id === value)?.nome || '';
      // Último ASO informado e vencimento em branco: sugere um ano depois.
      if (name === 'dataUltimoAso' && value && !d.dataVencimentoAso) novo.dataVencimentoAso = vencimentoSugeridoDoAso(value);
      return novo;
    });
    if (erros[name]) setErros((x) => ({ ...x, [name]: '' }));
  };

  const formatarAoSair = (nome, conversao) => () => {
    const r = conversao(dados[nome]);
    if (!r.erro && r.valor !== undefined) setDados((d) => ({ ...d, [nome]: r.valor }));
  };

  const validar = () => {
    const e = {};
    if (!dados.nome.trim()) e.nome = 'Informe o nome';
    if (!dados.escolaId) e.escolaId = 'Escolha a unidade';
    if (!dados.cargo.trim()) e.cargo = 'Informe o cargo';
    // CPF que já veio errado da planilha não trava a edição de outros campos.
    if (dados.cpf && !cpfValido(dados.cpf) && dados.cpf !== editando?.cpf) e.cpf = 'CPF não confere. Confira os números.';
    const digitos = String(dados.cpf || '').replace(/\D/g, '');
    const repetido = digitos && funcionarios.find((f) => f.id !== editando?.id && String(f.cpf || '').replace(/\D/g, '') === digitos);
    if (repetido) e.cpf = `Este CPF já está no cadastro (${repetido.nome}).`;
    if (dados.afastamentoInicio && dados.afastamentoRetorno && dados.afastamentoRetorno < dados.afastamentoInicio) e.afastamentoRetorno = 'O retorno é antes do início';
    if (dados.situacao === 'Inativa' && !dados.dataRescisao) e.dataRescisao = 'Informe a data de rescisão';
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const salvar = async (ev) => {
    ev.preventDefault();
    if (!validar()) return;
    setSalvando(true);
    try {
      const registro = {
        ...dados,
        nome: dados.nome.trim().replace(/\s+/g, ' '),
        cargo: normalizarCargo(dados.cargo),
        salario: dados.salario === '' || dados.salario === null ? null : Number(dados.salario),
        cpf: dados.cpf ? converterCpf(dados.cpf).valor : '',
        pis: dados.pis ? converterPis(dados.pis).valor : '',
        telefone: dados.telefone ? converterTelefone(dados.telefone).valor : '',
        atualizadoEm: serverTimestamp(),
      };
      if (editando) {
        await updateDoc(doc(db, 'funcionarios', editando.id), registro);
        avisar('Cadastro atualizado.');
      } else {
        await addDoc(collection(db, 'funcionarios'), { ...registro, criadoEm: serverTimestamp() });
        avisar('Funcionário cadastrado.');
      }
      setFormularioAberto(false);
    } catch (erro) {
      console.error(erro);
      avisar('Não foi possível salvar. Tente de novo; o que você digitou continua aqui.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = async () => {
    const f = excluir;
    setExcluir(null);
    setDetalhe(null);
    try {
      await deleteDoc(doc(db, 'funcionarios', f.id));
      avisar(`${f.nome} foi para a lixeira; a administração pode restaurar em Segurança dos dados.`);
    } catch (erro) {
      console.error(erro);
      avisar('Não foi possível excluir.', 'error');
    }
  };

  // ------------------------------------------------------------ exportar ----

  const exportar = () => {
    const colunas = ['Situação', 'Unidade', 'Colaborador', 'Data de nasc.', 'Descrição do cargo', 'PCD', 'Admissão', 'Salário', 'CPF', 'RG', 'PIS', 'Fone', 'Endereço', 'Cidade', 'Data último ASO', 'Data venc. ASO', 'Data início afast.', 'Data retorno afast.', 'Tipo de afastamento', 'Data de rescisão', 'Observações'];
    const linhas = filtrados.map((f) => [
      f.situacao || 'Ativa', f.escolaNome, f.nome, dataBr(f.dataNascimento), f.cargo, f.pcd ? 'Sim' : '', dataBr(f.dataAdmissao),
      typeof f.salario === 'number' ? f.salario : '', f.cpf, f.rg, f.pis, f.telefone, f.endereco, f.cidade,
      dataBr(f.dataUltimoAso), dataBr(f.dataVencimentoAso), dataBr(f.afastamentoInicio), dataBr(f.afastamentoRetorno),
      f.afastamentoTipo, dataBr(f.dataRescisao), f.observacoes,
    ]);
    const hoje = new Date();
    const nome = `funcionarios-${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}.xlsx`;
    baixarArquivo(gerarXlsx([{ nome: 'Colaboradores', colunas, linhas }]), nome);
    avisar(`Planilha com ${linhas.length} ${linhas.length === 1 ? 'funcionário' : 'funcionários'} baixada.`);
  };

  // ------------------------------------------------------------ tela ----

  const chips = [
    ['', `Todos`],
    ['pcd', `PCD (${totais.pcd})`],
    ['afastados', `Afastados (${totais.afastados})`],
    ['aso', `ASO vencido ou vencendo (${totais.aso})`],
  ];

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Funcionários</h1>
          <p className="text-gray-500 text-sm mt-1">
            {totais.ativos} {totais.ativos === 1 ? 'ativo' : 'ativos'} · {totais.inativos} {totais.inativos === 1 ? 'inativo' : 'inativos'}
            {totais.pcd > 0 && ` · ${totais.pcd} PCD`}
            {totais.afastados > 0 && ` · ${totais.afastados} ${totais.afastados === 1 ? 'afastado' : 'afastados'}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportar} disabled={!filtrados.length} className="bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg flex items-center gap-2 font-medium">
            <Download size={18} /> Exportar Excel
          </button>
          <button onClick={() => setImportarAberto(true)} className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg flex items-center gap-2 font-medium">
            <Upload size={18} /> Importar planilha
          </button>
          <button onClick={() => abrirFormulario()} className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm">
            <Plus size={20} /> Novo funcionário
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar por nome ou CPF"
              placeholder="Buscar por nome ou CPF..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md outline-none focus:border-primary"
            />
          </div>
          {filtrosAtivos && (
            <button onClick={limparFiltros} className="flex items-center justify-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md"><X size={16} /> Limpar filtros</button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select aria-label="Filtrar por unidade" value={filtroEscola} onChange={(e) => setFiltroEscola(e.target.value)} className={campo}>
            <option value="Todas">Todas as unidades</option>
            {escolas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          <select aria-label="Filtrar por cargo" value={filtroCargo} onChange={(e) => setFiltroCargo(e.target.value)} className={campo}>
            <option value="Todos">Todos os cargos</option>
            {cargos.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select aria-label="Filtrar por situação" value={filtroSituacao} onChange={(e) => setFiltroSituacao(e.target.value)} className={campo}>
            <option value="Ativa">Ativos</option>
            <option value="Inativa">Inativos</option>
            <option value="Todas">Ativos e inativos</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Mostrar só">
          {chips.map(([id, texto]) => (
            <button
              key={id || 'todos'}
              type="button"
              aria-pressed={filtroEspecial === id}
              onClick={() => setFiltroEspecial(id)}
              className={`px-3 py-1 rounded-full text-sm border ${filtroEspecial === id ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {carregando ? (
        <EsqueletoDeLista linhas={8} />
      ) : filtrados.length === 0 ? (
        funcionarios.length === 0 ? (
          <EmptyState
            icone={Users}
            titulo="Nenhum funcionário cadastrado"
            mensagem="Traga a planilha de colaboradores que você já usa (o sistema reconhece as colunas) ou cadastre um por um."
            acoes={[
              { rotulo: 'Importar planilha', onClick: () => setImportarAberto(true), icone: Upload },
              { rotulo: 'Novo funcionário', onClick: () => abrirFormulario() },
            ]}
          />
        ) : (
          <EmptyState
            titulo="Ninguém com estes filtros"
            mensagem="Mude ou limpe os filtros. Lembre que a lista começa mostrando só os ativos."
            acoes={[{ rotulo: 'Limpar filtros', onClick: limparFiltros }]}
          />
        )
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 sm:px-4 py-3 text-left font-medium">Colaborador</th>
                <th className="px-3 sm:px-4 py-3 text-left font-medium hidden sm:table-cell">Unidade</th>
                <th className="px-3 sm:px-4 py-3 text-left font-medium">Situação</th>
                <th className="px-3 sm:px-4 py-3 text-left font-medium hidden lg:table-cell">Admissão</th>
                <th className="px-3 sm:px-4 py-3 text-left font-medium hidden md:table-cell">Fone</th>
                <th className="px-3 sm:px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-3 sm:px-4 py-3">
                    <button type="button" onClick={() => setDetalhe(f)} className="text-left font-medium text-gray-900 hover:text-primary hover:underline">{f.nome}</button>
                    <p className="text-xs text-gray-500">{f.cargo}<span className="sm:hidden"> · {f.escolaNome}</span></p>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-gray-700 hidden sm:table-cell">{f.escolaNome}</td>
                  <td className="px-3 sm:px-4 py-3"><Selos f={f} /></td>
                  <td className="px-3 sm:px-4 py-3 text-gray-700 hidden lg:table-cell">{dataBr(f.dataAdmissao) || '—'}</td>
                  <td className="px-3 sm:px-4 py-3 text-gray-700 hidden md:table-cell whitespace-nowrap">{f.telefone ? formatarTelefone(f.telefone) : '—'}</td>
                  <td className="px-3 sm:px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setDetalhe(f)} className="p-1.5 text-gray-500 hover:text-primary hidden sm:block" title={`Ver ${f.nome}`} aria-label={`Ver ${f.nome}`}><Eye size={18} /></button>
                      <button onClick={() => abrirFormulario(f)} className="p-1.5 text-gray-500 hover:text-gray-900" title={`Editar ${f.nome}`} aria-label={`Editar ${f.nome}`}><Edit2 size={18} /></button>
                      <button onClick={() => setExcluir(f)} className="p-1.5 text-red-600 hover:text-red-800" title={`Excluir ${f.nome}`} aria-label={`Excluir ${f.nome}`}><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100">
            {filtrados.length} de {funcionarios.length} {funcionarios.length === 1 ? 'funcionário' : 'funcionários'}
          </p>
        </div>
      )}

      {/* Detalhe */}
      {detalhe && (
        <Modal isOpen={!!detalhe} onClose={() => setDetalhe(null)} title={detalhe.nome} size="lg">
          <Detalhe f={detalhe} />
          <div className="flex flex-col-reverse sm:flex-row justify-between gap-2 pt-4 mt-4 border-t">
            <button onClick={() => setExcluir(detalhe)} className="px-4 py-2 text-sm text-red-700 hover:bg-red-50 rounded-md flex items-center gap-1.5"><Trash2 size={15} /> Excluir</button>
            <button onClick={() => abrirFormulario(detalhe)} className="px-4 py-2 text-sm text-white bg-primary hover:bg-primary-dark rounded-md flex items-center justify-center gap-1.5"><Edit2 size={15} /> Editar</button>
          </div>
        </Modal>
      )}

      {/* Formulário */}
      <Modal isOpen={formularioAberto} onClose={() => !salvando && setFormularioAberto(false)} title={editando ? `Editar: ${editando.nome}` : 'Novo funcionário'} size="lg">
        <form onSubmit={salvar} className="space-y-6" noValidate>
          <Secao titulo="Dados principais" nota="Campos com * são obrigatórios.">
            <Campo id="f-nome" rotulo="Nome completo *" erro={erros.nome} largo>
              <input id="f-nome" name="nome" value={dados.nome} onChange={mudar} className={campo} autoComplete="off" />
            </Campo>
            <Campo id="f-escola" rotulo="Unidade *" erro={erros.escolaId}>
              <select id="f-escola" name="escolaId" value={dados.escolaId} onChange={mudar} className={campo}>
                <option value="">Escolha a unidade</option>
                {escolas.filter((e) => e.situacao !== 'Inativa' || e.id === dados.escolaId).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </Campo>
            <Campo id="f-cargo" rotulo="Cargo *" erro={erros.cargo} ajuda="Escolha da lista ou digite outro.">
              <input id="f-cargo" name="cargo" list="lista-cargos" value={dados.cargo} onChange={mudar} className={campo} autoComplete="off" />
              <datalist id="lista-cargos">{cargos.map((c) => <option key={c} value={c} />)}</datalist>
            </Campo>
            <Campo id="f-situacao" rotulo="Situação *">
              <select id="f-situacao" name="situacao" value={dados.situacao} onChange={mudar} className={campo}>
                <option value="Ativa">Ativa</option>
                <option value="Inativa">Inativa (desligado)</option>
              </select>
            </Campo>
            <label className="flex items-center gap-2 text-sm text-gray-700 self-end pb-2">
              <input type="checkbox" name="pcd" checked={!!dados.pcd} onChange={mudar} className="h-4 w-4" /> Pessoa com deficiência (PCD)
            </label>
          </Secao>

          <Secao titulo="Contrato">
            <Campo id="f-adm" rotulo="Admissão"><input id="f-adm" type="date" name="dataAdmissao" value={dados.dataAdmissao} onChange={mudar} className={campo} /></Campo>
            <Campo id="f-sal" rotulo="Salário (R$)"><input id="f-sal" type="number" step="0.01" min="0" name="salario" value={dados.salario} onChange={mudar} className={campo} /></Campo>
            {dados.situacao === 'Inativa' && (
              <Campo id="f-resc" rotulo="Data de rescisão *" erro={erros.dataRescisao}><input id="f-resc" type="date" name="dataRescisao" value={dados.dataRescisao} onChange={mudar} className={campo} /></Campo>
            )}
          </Secao>

          <Secao titulo="Documentos e contato">
            <Campo id="f-cpf" rotulo="CPF" erro={erros.cpf}><input id="f-cpf" name="cpf" inputMode="numeric" value={dados.cpf} onChange={mudar} onBlur={formatarAoSair('cpf', converterCpf)} className={campo} placeholder="000.000.000-00" /></Campo>
            <Campo id="f-rg" rotulo="RG"><input id="f-rg" name="rg" value={dados.rg} onChange={mudar} className={campo} /></Campo>
            <Campo id="f-pis" rotulo="PIS"><input id="f-pis" name="pis" inputMode="numeric" value={dados.pis} onChange={mudar} onBlur={formatarAoSair('pis', converterPis)} className={campo} /></Campo>
            <Campo id="f-nasc" rotulo="Data de nascimento"><input id="f-nasc" type="date" name="dataNascimento" value={dados.dataNascimento} onChange={mudar} className={campo} /></Campo>
            <Campo id="f-fone" rotulo="Fone"><input id="f-fone" name="telefone" inputMode="tel" value={dados.telefone} onChange={mudar} onBlur={formatarAoSair('telefone', converterTelefone)} className={campo} placeholder="(19) 99999-0000" /></Campo>
            <Campo id="f-cidade" rotulo="Cidade"><input id="f-cidade" name="cidade" value={dados.cidade} onChange={mudar} className={campo} /></Campo>
            <Campo id="f-end" rotulo="Endereço" largo><input id="f-end" name="endereco" value={dados.endereco} onChange={mudar} className={campo} /></Campo>
          </Secao>

          <Secao titulo="Saúde ocupacional (ASO)" nota="Ao informar o último ASO, o vencimento é sugerido para um ano depois.">
            <Campo id="f-aso1" rotulo="Último ASO"><input id="f-aso1" type="date" name="dataUltimoAso" value={dados.dataUltimoAso} onChange={mudar} className={campo} /></Campo>
            <Campo id="f-aso2" rotulo="Vencimento do ASO"><input id="f-aso2" type="date" name="dataVencimentoAso" value={dados.dataVencimentoAso} onChange={mudar} className={campo} /></Campo>
          </Secao>

          <Secao titulo="Afastamento">
            <Campo id="f-af1" rotulo="Início"><input id="f-af1" type="date" name="afastamentoInicio" value={dados.afastamentoInicio} onChange={mudar} className={campo} /></Campo>
            <Campo id="f-af2" rotulo="Retorno" erro={erros.afastamentoRetorno}><input id="f-af2" type="date" name="afastamentoRetorno" value={dados.afastamentoRetorno} onChange={mudar} className={campo} /></Campo>
            <Campo id="f-af3" rotulo="Tipo de afastamento" largo>
              <input id="f-af3" name="afastamentoTipo" list="lista-afastamentos" value={dados.afastamentoTipo} onChange={mudar} className={campo} autoComplete="off" />
              <datalist id="lista-afastamentos">{TIPOS_DE_AFASTAMENTO.map((t) => <option key={t} value={t} />)}</datalist>
            </Campo>
          </Secao>

          <Secao titulo="Observações">
            <Campo id="f-obs" rotulo="Observações" largo>
              <textarea id="f-obs" name="observacoes" rows="2" value={dados.observacoes} onChange={mudar} className={`${campo} resize-none`} />
            </Campo>
          </Secao>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setFormularioAberto(false)} disabled={salvando} className="px-4 py-2 text-sm text-gray-700 border rounded-md hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={salvando} className="px-4 py-2 text-sm text-white bg-primary rounded-md hover:bg-primary-dark min-w-32 flex justify-center">
              {salvando ? <LoadingSpinner size="sm" color="text-white" /> : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!excluir}
        title="Excluir funcionário"
        message={`${excluir?.nome || ''} sai da lista e vai para a lixeira, de onde pode ser restaurado. Para quem saiu da escola, prefira marcar como "Inativa".`}
        rotuloConfirmar="Excluir"
        onConfirm={confirmarExclusao}
        onCancel={() => setExcluir(null)}
      />

      <ImportarPlanilha isOpen={importarAberto} onClose={() => setImportarAberto(false)} tipo="funcionarios" escolas={escolas} existentes={funcionarios} />
      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
    </div>
  );
}

function Secao({ titulo, nota, children }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-gray-900">{titulo}</legend>
      {nota && <p className="text-xs text-gray-500 mt-0.5">{nota}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">{children}</div>
    </fieldset>
  );
}

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

function Linha({ rotulo: texto, valor, largo }) {
  return (
    <div className={largo ? 'col-span-2 sm:col-span-3' : ''}>
      <dt className="text-xs text-gray-500 uppercase">{texto}</dt>
      <dd className="text-sm text-gray-900 mt-0.5 break-words">{valor || '—'}</dd>
    </div>
  );
}

function Detalhe({ f }) {
  const s = situacaoDoFuncionario(f);
  const anos = idade(f.dataNascimento);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Selos f={f} />
        <span className="text-sm text-gray-600">{f.cargo} · {f.escolaNome}</span>
      </div>

      {s.afastado && (
        <p className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-3">
          <HeartPulse size={18} className="shrink-0 mt-0.5" />
          Afastado(a) desde {dataBr(f.afastamentoInicio)}{f.afastamentoRetorno ? `, retorno previsto em ${dataBr(f.afastamentoRetorno)}` : ''}{f.afastamentoTipo ? ` · ${f.afastamentoTipo}` : ''}.
        </p>
      )}
      {(s.asoVencido || s.asoVencendo) && (
        <p className={`flex items-start gap-2 text-sm rounded-md p-3 border ${s.asoVencido ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
          <Stethoscope size={18} className="shrink-0 mt-0.5" />
          {s.asoVencido ? `ASO vencido desde ${dataBr(f.dataVencimentoAso)}.` : `ASO vence em ${s.diasParaAso} ${s.diasParaAso === 1 ? 'dia' : 'dias'} (${dataBr(f.dataVencimentoAso)}).`}
        </p>
      )}

      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Linha rotulo="Admissão" valor={dataBr(f.dataAdmissao)} />
        <Linha rotulo="Salário" valor={typeof f.salario === 'number' ? formatarMoeda(f.salario) : ''} />
        <Linha rotulo="Nascimento" valor={f.dataNascimento ? `${dataBr(f.dataNascimento)}${anos !== null ? ` (${anos} anos)` : ''}` : ''} />
        <Linha rotulo="CPF" valor={f.cpf} />
        <Linha rotulo="RG" valor={f.rg} />
        <Linha rotulo="PIS" valor={f.pis} />
        <Linha rotulo="Fone" valor={f.telefone ? formatarTelefone(f.telefone) : ''} />
        <Linha rotulo="Cidade" valor={f.cidade} />
        <Linha rotulo="PCD" valor={f.pcd ? <span className="inline-flex items-center gap-1"><Accessibility size={14} /> Sim</span> : 'Não'} />
        <Linha rotulo="Endereço" valor={f.endereco} largo />
        <Linha rotulo="Último ASO" valor={dataBr(f.dataUltimoAso)} />
        <Linha rotulo="Vencimento do ASO" valor={dataBr(f.dataVencimentoAso)} />
        {f.situacao === 'Inativa' && <Linha rotulo="Rescisão" valor={dataBr(f.dataRescisao)} />}
        {f.observacoes && <Linha rotulo="Observações" valor={f.observacoes} largo />}
      </dl>
    </div>
  );
}
