import React, { useState, useEffect } from 'react';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { ouvir } from '../../services/leitura';
// Gravações passam pela camada com histórico e lixeira (ver services/db.js)
import { addDoc, updateDoc, deleteDoc } from '../../services/db';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';

// Componentes UI
import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { EsqueletoDeLista, EsqueletoDeCartoes } from '../../components/ui/Esqueleto';

// Ícones
import { Plus, Search, Edit2, Trash2, Phone, Briefcase, User, Hash } from 'lucide-react';

const initialFormState = {
  nome: '', especialidade: 'Geral', tipo: 'Interno', telefone: '', documento: '', pix: ''
};

export default function Prestadores() {
  const [prestadores, setPrestadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [formData, setFormData] = useState(initialFormState);
  const [selectedPrestador, setSelectedPrestador] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    const q = collection(db, 'prestadores');
    const unsubscribe = ouvir(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => a.nome.localeCompare(b.nome));
      setPrestadores(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const showToast = (message, type = 'success') => setToast({ show: true, message, type });

  const filteredPrestadores = prestadores.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.especialidade.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenForm = (prestador = null) => {
    if (prestador) {
      setFormData(prestador);
      setSelectedPrestador(prestador);
    } else {
      setFormData(initialFormState);
      setSelectedPrestador(null);
    }
    setIsFormModalOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormModalOpen(false);
    setFormData(initialFormState);
    setSelectedPrestador(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nome.trim()) return showToast('O nome é obrigatório', 'error');
    
    setIsSubmitting(true);
    try {
      const dataToSave = { ...formData, atualizadoEm: serverTimestamp() };
      
      if (selectedPrestador) {
        await updateDoc(doc(db, 'prestadores', selectedPrestador.id), dataToSave);
        showToast('Prestador atualizado!');
      } else {
        dataToSave.criadoEm = serverTimestamp();
        await addDoc(collection(db, 'prestadores'), dataToSave);
        showToast('Prestador cadastrado!');
      }
      handleCloseForm();
    } catch (error) {
      showToast('Erro ao salvar prestador.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedPrestador) return;
    try {
      await deleteDoc(doc(db, 'prestadores', selectedPrestador.id));
      showToast('Prestador movido para a lixeira.');
      setIsConfirmDeleteOpen(false);
    } catch (error) {
      showToast('Erro ao excluir prestador.', 'error');
    }
  };

  const openWhatsApp = (telefone) => {
    const num = telefone.replace(/\D/g, '');
    if (num) window.open(`https://wa.me/55${num}`, '_blank');
  };

  return (
    <div className="w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prestadores</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie a equipe de manutenção e terceirizados.</p>
        </div>
        <button onClick={() => handleOpenForm()} className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm">
          <Plus size={20} /> Novo prestador
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input type="text" placeholder="Buscar por nome ou especialidade..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-primary outline-none" />
        </div>
      </div>

      {loading ? (
        <EsqueletoDeCartoes quantidade={6} />
      ) : filteredPrestadores.length === 0 ? (
        prestadores.length === 0 ? (
          <EmptyState
            titulo="Nenhum prestador cadastrado"
            mensagem="Cadastre quem faz os serviços (equipe interna ou terceirizados) para atribuir os chamados e enviar a O.S. por WhatsApp."
            acoes={[{ rotulo: 'Adicionar prestador', onClick: () => handleOpenForm() }]}
          />
        ) : (
          <EmptyState
            titulo="Nenhum prestador encontrado"
            mensagem={`Nada encontrado para "${searchTerm}".`}
            acoes={[{ rotulo: 'Limpar busca', onClick: () => setSearchTerm('') }]}
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPrestadores.map((prestador) => (
            <div key={prestador.id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${prestador.tipo === 'Interno' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                    {prestador.tipo === 'Interno' ? <User size={20} /> : <Briefcase size={20} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{prestador.nome}</h3>
                    <Badge label={prestador.tipo} color={prestador.tipo === 'Interno' ? 'blue' : 'orange'} />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2 mt-4 text-sm text-gray-600">
                <p className="flex items-center gap-2"><Briefcase size={16} className="text-gray-500"/> {prestador.especialidade}</p>
                {prestador.telefone && (
                  <p className="flex items-center gap-2">
                    <Phone size={16} className="text-gray-500"/> 
                    <button onClick={() => openWhatsApp(prestador.telefone)} className="text-green-600 hover:underline">{prestador.telefone}</button>
                  </p>
                )}
                {prestador.documento && <p className="flex items-center gap-2"><Hash size={16} className="text-gray-500"/> {prestador.documento}</p>}
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
                <button title={`Editar ${prestador.nome}`} aria-label={`Editar ${prestador.nome}`} onClick={() => handleOpenForm(prestador)} className="p-2 text-gray-500 hover:text-primary transition-colors"><Edit2 size={18} /></button>
                <button title={`Excluir ${prestador.nome}`} aria-label={`Excluir ${prestador.nome}`} onClick={() => { setSelectedPrestador(prestador); setIsConfirmDeleteOpen(true); }} className="p-2 text-gray-500 hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isFormModalOpen} onClose={handleCloseForm} title={selectedPrestador ? "Editar prestador" : "Novo prestador"} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo / Empresa *</label>
            <input type="text" name="nome" value={formData.nome} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Especialidade</label>
              <select name="especialidade" value={formData.especialidade} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
                <option value="Geral">Geral (Faz Tudo)</option>
                <option value="Eletricista">Eletricista</option>
                <option value="Encanador">Encanador</option>
                <option value="Marceneiro">Marceneiro</option>
                <option value="Pintor">Pintor</option>
                <option value="TI / Informática">TI / Informática</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de vínculo</label>
              <select name="tipo" value={formData.tipo} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
                <option value="Interno">Funcionário interno</option>
                <option value="Externo">Terceirizado (externo)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
              <input type="text" name="telefone" value={formData.telefone} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary" placeholder="(19) 99999-9999" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CPF / CNPJ</label>
              <input type="text" name="documento" value={formData.documento} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chave PIX (Opcional)</label>
            <input type="text" name="pix" value={formData.pix} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary" placeholder="Para facilitar pagamentos" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <button type="button" onClick={handleCloseForm} className="px-4 py-2 text-sm text-gray-700 border rounded-md hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm text-white bg-primary rounded-md hover:bg-primary-dark w-32 flex justify-center">
              {isSubmitting ? <LoadingSpinner size="sm" color="white" /> : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={isConfirmDeleteOpen} title="Excluir prestador" message="Tem certeza que deseja excluir este prestador? Ele vai para a lixeira e pode ser restaurado; o histórico de manutenções é mantido." onConfirm={handleConfirmDelete} onCancel={() => setIsConfirmDeleteOpen(false)} />
      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
    </div>
  );
}