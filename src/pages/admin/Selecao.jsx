import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, onSnapshot, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Calendar, Clock, User, Phone, CheckCircle, XCircle, ChevronRight, Edit, Trash2, X } from 'lucide-react';
import Toast from '../../components/ui/Toast';

export default function Selecao() {
  const [entrevistas, setEntrevistas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
const [feedbackText, setFeedbackText] = useState('');
const [statusAlvo, setStatusAlvo] = useState(''); // 'Aprovado' ou 'Reprovado'
const [candidatoAlvo, setCandidatoAlvo] = useState(null);

  // Estados de Edição
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [candidatoEditando, setCandidatoEditando] = useState(null);
  const [formData, setFormData] = useState({ dataEntrevista: '', horaEntrevista: '', nome: '', telefone: '' });
  const [saving, setSaving] = useState(false);

  // 1. Busca apenas quem tem entrevista marcada
  useEffect(() => {
    const q = query(collection(db, 'curriculos'), where('status', '==', 'Entrevista Agendada'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEntrevistas(data.sort((a, b) => new Date(a.dataEntrevista) - new Date(b.dataEntrevista)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Abrir modal para coletar feedback antes de finalizar
const prepararFinalizacao = (item, novoStatus) => {
  setCandidatoAlvo(item);
  setStatusAlvo(novoStatus);
  setFeedbackText(''); // Limpa o campo para o novo feedback
  setIsFeedbackModalOpen(true);
};

// 3. Salvar a decisão com o feedback no Firebase
const confirmarDecisao = async (e) => {
  e.preventDefault();
  if (!feedbackText.trim()) return alert("Por favor, insira um feedback.");

  try {
    await updateDoc(doc(db, 'curriculos', candidatoAlvo.id), { 
      status: statusAlvo,
      feedback: feedbackText, // NOVO CAMPO
      dataDecisao: new Date().toISOString()
    });
    setSuccess(`${candidatoAlvo.nome} foi ${statusAlvo === 'Aprovado' ? 'aprovado(a)' : 'reprovado(a)'} com sucesso!`);
    setIsFeedbackModalOpen(false);
  } catch (err) {
    setError('Erro ao atualizar status.');
  }
};
  // 3. Excluir Candidato
  const handleExcluir = async (id, nome) => {
    if (window.confirm(`Tem certeza que deseja excluir o currículo de ${nome} e cancelar esta entrevista?`)) {
      try {
        await deleteDoc(doc(db, 'curriculos', id));
        setSuccess('Candidato excluído com sucesso.');
      } catch (err) {
        setError('Erro ao excluir candidato.');
      }
    }
  };

  // 4. Abrir Modal de Edição
  const abrirEdicao = (candidato) => {
    setCandidatoEditando(candidato.id);
    setFormData({
      nome: candidato.nome,
      telefone: candidato.telefone,
      dataEntrevista: candidato.dataEntrevista,
      horaEntrevista: candidato.horaEntrevista
    });
    setIsEditModalOpen(true);
  };

  // 5. Salvar Edição
  const handleSalvarEdicao = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, 'curriculos', candidatoEditando), {
        nome: formData.nome,
        telefone: formData.telefone,
        dataEntrevista: formData.dataEntrevista,
        horaEntrevista: formData.horaEntrevista
      });
      setSuccess('Dados da entrevista atualizados!');
      setIsEditModalOpen(false);
    } catch (err) {
      setError('Erro ao atualizar dados.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 mt-4 relative">
      {success && <Toast message={success} type="success" onClose={() => setSuccess('')} />}
      {error && <Toast message={error} type="error" onClose={() => setError('')} />}
      
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Processo Seletivo</h1>
        <p className="text-sm text-gray-500">Acompanhe as entrevistas agendadas e tome decisões.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {entrevistas.length === 0 && !loading ? (
          <div className="col-span-full bg-white p-12 text-center rounded-xl border border-dashed border-gray-300">
            <p className="text-gray-500">Nenhuma entrevista agendada para os próximos dias.</p>
          </div>
        ) : (
          entrevistas.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow relative">
              
              {/* Botões de Ação no Canto Superior Direito */}
              <div className="absolute top-3 right-3 flex gap-1">
                <button onClick={() => abrirEdicao(item)} className="p-1.5 bg-gray-50 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-md transition-colors" title="Editar">
                  <Edit size={14} />
                </button>
                <button onClick={() => handleExcluir(item.id, item.nome)} className="p-1.5 bg-gray-50 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Excluir">
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="flex gap-2">
                    <button 
                      onClick={() => prepararFinalizacao(item, 'Aprovado')} 
                      className="flex-1 flex items-center justify-center gap-1 bg-green-50 text-green-600 py-2 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors"
                    >
                      <CheckCircle size={14} /> Aprovar
                    </button>
                    <button 
                      onClick={() => prepararFinalizacao(item, 'Reprovado')} 
                      className="flex-1 flex items-center justify-center gap-1 bg-red-50 text-red-600 py-2 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                    >
                      <XCircle size={14} /> Reprovar
                    </button>
          </div>

              <div className="p-5">
                <div className="flex justify-between items-start mb-4 pr-16">
                  <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                    <User size={24} />
                  </div>
                  <span className="bg-blue-100 text-blue-700 text-[10px] uppercase font-bold px-2 py-1 rounded">
                    {item.vaga}
                  </span>
                </div>

                <h3 className="font-bold text-gray-900 text-lg mb-1">{item.nome}</h3>
                <p className="text-gray-500 text-sm flex items-center gap-1 mb-4">
                  <Phone size={14} /> {item.telefone}
                </p>

                <div className="space-y-2 py-4 border-t border-b border-gray-50 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Calendar size={16} className="text-primary" />
                    <span>{new Date(item.dataEntrevista).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Clock size={16} className="text-primary" />
                    <span>{item.horaEntrevista}h</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => finalizarProcesso(item.id, 'Aprovado', item.nome)} className="flex-1 flex items-center justify-center gap-1 bg-green-50 text-green-600 py-2 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors">
                    <CheckCircle size={14} /> Aprovar
                  </button>
                  <button onClick={() => finalizarProcesso(item.id, 'Reprovado', item.nome)} className="flex-1 flex items-center justify-center gap-1 bg-red-50 text-red-600 py-2 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors">
                    <XCircle size={14} /> Reprovar
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 p-3 flex justify-center">
                 <button className="text-[10px] text-gray-400 uppercase tracking-widest font-bold flex items-center gap-1">
                   Ver Currículo completo <ChevronRight size={10}/>
                 </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL DE EDIÇÃO */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Editar Entrevista</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSalvarEdicao} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Candidato</label>
                <input type="text" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={formData.nome} onChange={(e) => setFormData({...formData, nome: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input type="text" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={formData.telefone} onChange={(e) => setFormData({...formData, telefone: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <input type="date" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={formData.dataEntrevista} onChange={(e) => setFormData({...formData, dataEntrevista: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horário</label>
                  <input type="time" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={formData.horaEntrevista} onChange={(e) => setFormData({...formData, horaEntrevista: e.target.value})} />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">{saving ? 'Salvando...' : 'Atualizar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE FEEDBACK */}
{isFeedbackModalOpen && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
      <div className={`p-4 border-b text-white flex justify-between items-center ${statusAlvo === 'Aprovado' ? 'bg-green-600' : 'bg-red-600'}`}>
        <h2 className="text-lg font-bold">Feedback de {statusAlvo}</h2>
        <button onClick={() => setIsFeedbackModalOpen(false)}><X size={20} /></button>
      </div>
      <form onSubmit={confirmarDecisao} className="p-4 space-y-4">
        <p className="text-sm text-gray-600 font-medium">
          Justifique a decisão para <strong>{candidatoAlvo?.nome}</strong>:
        </p>
        <textarea
          required
          rows="4"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          placeholder={statusAlvo === 'Aprovado' ? "Ex: Ótima didática e proatividade..." : "Ex: Falta de experiência com educação infantil..."}
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
        />
        <div className="flex gap-3">
          <button type="button" onClick={() => setIsFeedbackModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button type="submit" className={`flex-1 px-4 py-2 text-white rounded-lg font-bold ${statusAlvo === 'Aprovado' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
            Confirmar {statusAlvo}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

    </div>
    
  );
}