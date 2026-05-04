import React, { useState, useEffect } from 'react';
import { Search, Plus, Calendar, FileText, UserCheck, X, Clock, Edit, Trash2, MessageCircle } from 'lucide-react';
import { db } from '../../services/firebase'; 
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import Toast from '../../components/ui/Toast';

export default function BancoTalentos() {
  const [searchTerm, setSearchTerm] = useState('');
  const [curriculos, setCurriculos] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Controle de Edição
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState(null);

  // Estados para o Agendamento
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
  const [curriculoSelecionado, setCurriculoSelecionado] = useState(null);
  const [dataEntrevista, setDataEntrevista] = useState('');
  const [horaEntrevista, setHoraEntrevista] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 1. Estado Inicial atualizado com Observações
  const estadoInicialForm = { nome: '', telefone: '', email: '', vaga: '', exp: 'Não', indicacao: '', observacoes: '' };
  const [formData, setFormData] = useState(estadoInicialForm);

  // 2. Buscar os dados no Firebase
  useEffect(() => {
    const q = query(collection(db, 'curriculos'), orderBy('dataCadastro', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const curriculosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCurriculos(curriculosData);
    });
    return () => unsubscribe();
  }, []);

  // 3. Salvar ou Editar currículo
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEditMode) {
        await updateDoc(doc(db, 'curriculos', editId), formData);
        setSuccess('Currículo atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'curriculos'), {
          ...formData,
          status: 'Disponível',
          dataCadastro: serverTimestamp()
        });
        setSuccess('Currículo cadastrado com sucesso!');
      }
      setIsModalOpen(false);
      setFormData(estadoInicialForm);
    } catch (err) {
      setError(isEditMode ? 'Erro ao atualizar.' : 'Erro ao salvar o currículo.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Abrir modal para NOVO
  const abrirModalNovo = () => {
    setIsEditMode(false);
    setEditId(null);
    setFormData(estadoInicialForm);
    setIsModalOpen(true);
  };

  // 5. Abrir modal para EDITAR (Carregando as observações)
  const abrirModalEditar = (curriculo) => {
    setIsEditMode(true);
    setEditId(curriculo.id);
    setFormData({
      nome: curriculo.nome, 
      telefone: curriculo.telefone, 
      email: curriculo.email || '',
      vaga: curriculo.vaga, 
      exp: curriculo.exp, 
      indicacao: curriculo.indicacao || '',
      observacoes: curriculo.observacoes || '' // Puxando as observações salvas
    });
    setIsModalOpen(true);
  };

  // 6. Excluir Currículo
  const handleExcluir = async (id, nome) => {
    if (window.confirm(`Tem certeza que deseja excluir permanentemente o currículo de ${nome}?`)) {
      try {
        await deleteDoc(doc(db, 'curriculos', id));
        setSuccess('Currículo excluído com sucesso!');
      } catch (err) {
        setError('Erro ao excluir currículo.');
      }
    }
  };

  // 7. Abrir modal de Agendamento
  const abrirModalAgenda = (curriculo) => {
    setCurriculoSelecionado(curriculo);
    setIsAgendaModalOpen(true);
  };

  // 8. Salvar Agendamento
  const handleAgendarEntrevista = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateDoc(doc(db, 'curriculos', curriculoSelecionado.id), {
        status: 'Entrevista Agendada',
        dataEntrevista: dataEntrevista,
        horaEntrevista: horaEntrevista
      });
      setSuccess(`Entrevista de ${curriculoSelecionado.nome} marcada!`);
      setIsAgendaModalOpen(false);
      setDataEntrevista(''); setHoraEntrevista('');
    } catch (err) {
      setError('Erro ao agendar entrevista.');
    } finally {
      setLoading(false);
    }
  };

  const curriculosFiltrados = curriculos.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.vaga.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openWhatsApp = (telefone) => {
  
  const num = telefone.replace(/\D/g, '');
  if (num) {
    
    window.open(`https://wa.me/55${num}`, '_blank');
  } else {
    alert("Número de telefone inválido ou não informado.");
  }
};

  return (
    <div className="space-y-6 mt-4 relative">
      {error && <Toast message={error} type="error" onClose={() => setError('')} />}
      {success && <Toast message={success} type="success" onClose={() => setSuccess('')} />}

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banco de Talentos</h1>
          <p className="text-sm text-gray-500">Gerencie currículos e inicie processos seletivos.</p>
        </div>
        <button onClick={abrirModalNovo} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors font-medium">
          <Plus size={20} /> Novo Currículo
        </button>
      </div>

      {/* Filtro e Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Buscar por nome ou vaga..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Candidato</th>
                <th className="px-6 py-4">Vaga Pretendida</th>
                <th className="px-6 py-4">Contato</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {curriculosFiltrados.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-8 text-gray-500">Nenhum currículo encontrado.</td></tr>
              ) : (
                curriculosFiltrados.map((curriculo) => (
                  <tr key={curriculo.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-full text-primary"><FileText size={18} /></div>
                        {curriculo.nome}
                      </div>
                    </td>
                    <td className="px-6 py-4"><span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-xs font-medium">{curriculo.vaga}</span></td>
                    <td className="px-6 py-4 text-gray-500"><div>{curriculo.telefone}</div><div className="text-xs">{curriculo.email}</div></td>
                    <td className="px-6 py-4 text-gray-500">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${curriculo.status === 'Disponível' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{curriculo.status}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {curriculo.status === 'Disponível' && (
                          <button onClick={() => abrirModalAgenda(curriculo)} className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors" title="Agendar Entrevista">
                            <Calendar size={16} /> <span className="hidden sm:inline">Agendar</span>
                          </button>
                        )}
                        <button 
                            onClick={() => openWhatsApp(curriculo.telefone)} 
                            className="inline-flex items-center gap-1.5 bg-green-50 text-green-600 hover:bg-green-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                            title="Conversar no WhatsApp"
                          >
                            <MessageCircle size={16} />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </button>

                          {curriculo.status === 'Disponível' && (
                            <button onClick={() => abrirModalAgenda(curriculo)} className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors" title="Agendar Entrevista">
                              <Calendar size={16} /> <span className="hidden sm:inline">Agendar</span>
                            </button>)}
                        <button onClick={() => abrirModalEditar(curriculo)} className="p-1.5 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Editar / Ver Observações">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => handleExcluir(curriculo.id, curriculo.nome)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                    

                    
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE AGENDAMENTO */}
      {isAgendaModalOpen && curriculoSelecionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Agendar Entrevista</h2>
              <button onClick={() => setIsAgendaModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleAgendarEntrevista} className="p-4 space-y-4">
              <p className="text-sm text-gray-600">Escolha o horário para entrevistar <strong>{curriculoSelecionado.nome}</strong>:</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2"><Calendar size={16} /> Data</label>
                <input type="date" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={dataEntrevista} onChange={(e) => setDataEntrevista(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2"><Clock size={16} /> Horário</label>
                <input type="time" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={horaEntrevista} onChange={(e) => setHoraEntrevista(e.target.value)} />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsAgendaModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">{loading ? 'Salvando...' : 'Confirmar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO / EDIÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-bold text-gray-900">{isEditMode ? 'Editar Currículo' : 'Cadastrar Currículo'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                <input type="text" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={formData.nome} onChange={(e) => setFormData({...formData, nome: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone *</label>
                  <input type="text" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={formData.telefone} onChange={(e) => setFormData({...formData, telefone: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                  <input type="email" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vaga Pretendida *</label>
                  <input type="text" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={formData.vaga} onChange={(e) => setFormData({...formData, vaga: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Experiência?</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={formData.exp} onChange={(e) => setFormData({...formData, exp: e.target.value})}>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Indicação (Opcional)</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={formData.indicacao} onChange={(e) => setFormData({...formData, indicacao: e.target.value})} />
              </div>

              {/* CAMPO DE OBSERVAÇÕES ADICIONADO AQUI */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações Internas</label>
                <textarea 
                  name="observacoes" 
                  value={formData.observacoes} 
                  onChange={(e) => setFormData({...formData, observacoes: e.target.value})} 
                  rows="3" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  placeholder="Notas sobre a entrevista, perfil do candidato, etc..."
                ></textarea>
              </div>

              <div className="pt-4 flex gap-3 border-t border-gray-100 mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium">{loading ? 'Salvando...' : (isEditMode ? 'Atualizar' : 'Salvar')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Estilo para a barra de rolagem do modal se a tela for pequena */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
      `}} />
    </div>
  );
}