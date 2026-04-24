import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, doc, setDoc, updateDoc, onSnapshot, serverTimestamp, query 
} from 'firebase/firestore';
import { getAuth, sendPasswordResetEmail, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { auth, db } from '../../services/firebase';

// Componentes UI
import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

// Ícones
import { 
  Plus, Search, Edit2, Key, Power, PowerOff, 
  Eye, EyeOff, RefreshCw, ShieldAlert, Shield
} from 'lucide-react';

const initialFormState = {
  nome: '',
  email: '',
  senha: '',
  perfil: 'diretora', // Valor padrão
  unidadeId: '',
  unidadeNome: '',
  situacao: 'ativa'
};

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [escolas, setEscolas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSituacao, setFilterSituacao] = useState('Todas');
  const [filterPerfil, setFilterPerfil] = useState('Todos');

  // Modais e Form
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isConfirmStatusOpen, setIsConfirmStatusOpen] = useState(false);
  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});
  const [selectedUsuario, setSelectedUsuario] = useState(null);
  const [conflictingUser, setConflictingUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // 1. Buscar Escolas Ativas
  useEffect(() => {
    const q = collection(db, 'escolas');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const escolasData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(e => e.situacao === 'Ativa')
        .sort((a, b) => a.nome.localeCompare(b.nome));
      setEscolas(escolasData);
    });
    return () => unsubscribe();
  }, []);

  // 2. Buscar TODOS os Usuários
  useEffect(() => {
    const q = collection(db, 'usuarios');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      
      // Ordenação: Ativos primeiro, depois alfabético
      data.sort((a, b) => {
        if (a.situacao === 'ativa' && b.situacao === 'inativa') return -1;
        if (a.situacao === 'inativa' && b.situacao === 'ativa') return 1;
        return a.nome.localeCompare(b.nome);
      });
      
      setUsuarios(data);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar usuários:", error);
      showToast("Erro ao carregar lista de usuários.", "error");
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const showToast = (message, type = 'success') => setToast({ show: true, message, type });

  // Contadores
  const totalAtivos = useMemo(() => usuarios.filter(u => u.situacao === 'ativa').length, [usuarios]);

  // Filtragem
  const filteredUsuarios = useMemo(() => {
    return usuarios.filter(u => {
      const term = searchTerm.toLowerCase();
      const matchBusca = u.nome.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
      const matchSituacao = filterSituacao === 'Todas' ? true : u.situacao === filterSituacao.toLowerCase().slice(0, -1);
      const matchPerfil = filterPerfil === 'Todos' ? true : u.perfil === filterPerfil;
      return matchBusca && matchSituacao && matchPerfil;
    });
  }, [usuarios, searchTerm, filterSituacao, filterPerfil]);

  // Handlers do Formulário
  const handleOpenForm = (usuario = null) => {
    if (usuario) {
      setFormData({
        nome: usuario.nome,
        email: usuario.email,
        senha: '',
        perfil: usuario.perfil || 'diretora',
        unidadeId: usuario.unidadeId || '',
        unidadeNome: usuario.unidadeNome || '',
        situacao: usuario.situacao
      });
      setSelectedUsuario(usuario);
    } else {
      setFormData(initialFormState);
      setSelectedUsuario(null);
    }
    setFormErrors({});
    setShowPassword(false);
    setIsFormModalOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormModalOpen(false);
    setFormData(initialFormState);
    setFormErrors({});
    setSelectedUsuario(null);
    setShowPassword(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let newFormData = { ...formData, [name]: value };

    if (name === 'unidadeId') {
      const escola = escolas.find(es => es.id === value);
      newFormData.unidadeNome = escola ? escola.nome : '';
    }

    // Limpa a unidade se mudar o perfil para algo que não seja diretora
    if (name === 'perfil' && value !== 'diretora') {
      newFormData.unidadeId = '';
      newFormData.unidadeNome = '';
    }

    setFormData(newFormData);
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const generateRandomPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*";
    let password = "";
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, senha: password }));
    setShowPassword(true);
    if (formErrors.senha) setFormErrors(prev => ({ ...prev, senha: '' }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.nome.trim()) errors.nome = 'Nome é obrigatório';
    
    // Unidade é obrigatória APENAS para diretoras
    if (formData.perfil === 'diretora' && !formData.unidadeId) {
      errors.unidadeId = 'Vincule a diretora a uma unidade';
    }
    
    if (!selectedUsuario) {
      if (!formData.email.trim()) errors.email = 'E-mail é obrigatório';
      else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'E-mail inválido';
      
      if (!formData.senha || formData.senha.length < 6) errors.senha = 'A senha deve ter no mínimo 6 caracteres';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const checkConflict = (unidadeId, currentUid) => {
    return usuarios.find(u => u.unidadeId === unidadeId && u.situacao === 'ativa' && u.uid !== currentUid && u.perfil === 'diretora');
  };

  const handleSaveFlow = (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Verificar regra de negócio (1 diretora ativa por escola) - Apenas se for diretora
    if (formData.situacao === 'ativa' && formData.perfil === 'diretora') {
      const conflict = checkConflict(formData.unidadeId, selectedUsuario?.uid);
      if (conflict) {
        setConflictingUser(conflict);
        setIsConflictModalOpen(true);
        return;
      }
    }
    
    performSave();
  };

  const performSave = async () => {
    setIsSubmitting(true);
    setIsConflictModalOpen(false);

    try {
      if (conflictingUser && formData.situacao === 'ativa' && formData.perfil === 'diretora') {
        await updateDoc(doc(db, 'usuarios', conflictingUser.uid), {
          situacao: 'inativa',
          atualizadoEm: serverTimestamp()
        });
        setConflictingUser(null);
      }

      if (selectedUsuario) {
        // Editando
        await updateDoc(doc(db, 'usuarios', selectedUsuario.uid), {
          nome: formData.nome,
          unidadeId: formData.perfil === 'diretora' ? formData.unidadeId : null,
          unidadeNome: formData.perfil === 'diretora' ? formData.unidadeNome : null,
          situacao: formData.situacao,
          atualizadoEm: serverTimestamp()
        });
        showToast('Usuário atualizado com sucesso!');
      } else {
        // Criando
        const tempApp = initializeApp(auth.app.options, `TempApp_${Date.now()}`);
        const tempAuth = getAuth(tempApp);
        
        try {
          const userCredential = await createUserWithEmailAndPassword(tempAuth, formData.email, formData.senha);
          const newUid = userCredential.user.uid;

          await setDoc(doc(db, 'usuarios', newUid), {
            uid: newUid,
            nome: formData.nome,
            email: formData.email,
            perfil: formData.perfil,
            unidadeId: formData.perfil === 'diretora' ? formData.unidadeId : null,
            unidadeNome: formData.perfil === 'diretora' ? formData.unidadeNome : null,
            situacao: 'ativa',
            criadoEm: serverTimestamp(),
            atualizadoEm: serverTimestamp()
          });

          await deleteApp(tempApp);
          showToast('Usuário cadastrado com sucesso! Já pode fazer login.');
        } catch (authError) {
          await deleteApp(tempApp);
          if (authError.code === 'auth/email-already-in-use') {
            setFormErrors(prev => ({ ...prev, email: 'Este e-mail já está em uso.' }));
            setIsSubmitting(false);
            return;
          }
          throw authError;
        }
      }
      
      handleCloseForm();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      showToast('Erro ao salvar os dados do usuário.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedUsuario) return;
    try {
      const novoStatus = selectedUsuario.situacao === 'ativa' ? 'inativa' : 'ativa';
      
      if (novoStatus === 'ativa' && selectedUsuario.perfil === 'diretora') {
        const conflict = checkConflict(selectedUsuario.unidadeId, selectedUsuario.uid);
        if (conflict) {
          setIsConfirmStatusOpen(false);
          setConflictingUser(conflict);
          setFormData({ ...selectedUsuario, situacao: 'ativa' });
          setIsConflictModalOpen(true);
          return;
        }
      }

      await updateDoc(doc(db, 'usuarios', selectedUsuario.uid), {
        situacao: novoStatus,
        atualizadoEm: serverTimestamp()
      });
      
      showToast(`Acesso de ${selectedUsuario.nome} ${novoStatus === 'ativa' ? 'reativado' : 'desativado'}.`);
      setIsConfirmStatusOpen(false);
      setSelectedUsuario(null);
    } catch (error) {
      showToast('Erro ao atualizar situação.', 'error');
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUsuario) return;
    try {
      await sendPasswordResetEmail(auth, selectedUsuario.email);
      showToast(`E-mail de redefinição enviado para ${selectedUsuario.email}!`);
      setIsConfirmResetOpen(false);
    } catch (error) {
      showToast('Erro ao enviar e-mail de redefinição.', 'error');
    }
  };

  // Funções Visuais
  const getPerfilBadgeColor = (perfil) => {
    if (perfil === 'admin') return 'purple';
    if (perfil === 'administrativo') return 'blue';
    return 'gray';
  };

  const getPerfilNome = (perfil) => {
    if (perfil === 'admin') return 'Administrador';
    if (perfil === 'administrativo') return 'Administrativo (RH)';
    return 'Diretora';
  };

  return (
    <div className="w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Usuários</h1>
          <p className="text-gray-500 text-sm mt-1">Cadastre e gerencie os acessos do sistema</p>
          <div className="mt-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 inline-flex">
            {totalAtivos} usuários ativos
          </div>
        </div>
        <button onClick={() => handleOpenForm()} className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-sm">
          <Plus size={20} /> Novo Usuário
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input type="text" placeholder="Buscar por nome ou e-mail..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-primary outline-none" />
        </div>
        <div className="w-full sm:w-48">
          <select value={filterPerfil} onChange={(e) => setFilterPerfil(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary outline-none bg-white">
            <option value="Todos">Todos os Perfis</option>
            <option value="admin">Administrador</option>
            <option value="administrativo">Administrativo (RH)</option>
            <option value="diretora">Diretoras</option>
          </select>
        </div>
        <div className="w-full sm:w-48">
          <select value={filterSituacao} onChange={(e) => setFilterSituacao(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary outline-none bg-white">
            <option value="Todas">Todas as Situações</option>
            <option value="Ativas">Apenas Ativos</option>
            <option value="Inativas">Apenas Inativos</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><LoadingSpinner size="lg" /></div>
      ) : filteredUsuarios.length === 0 ? (
        <EmptyState 
          message={searchTerm ? "Nenhum usuário encontrado." : "Nenhum usuário cadastrado."} 
          actionLabel={!searchTerm ? "Novo Usuário" : null} 
          onAction={!searchTerm ? () => handleOpenForm() : null} 
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Perfil</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidade</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Situação</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredUsuarios.map((item) => (
                <tr key={item.uid} className={`hover:bg-gray-50 transition-colors ${item.situacao === 'inativa' ? 'opacity-70 bg-gray-50/50' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-gray-900">{item.nome}</div>
                    <div className="text-xs text-gray-500">{item.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge label={getPerfilNome(item.perfil)} color={getPerfilBadgeColor(item.perfil)} />
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">
                    {item.perfil === 'diretora' ? (item.unidadeNome || '-') : <span className="text-gray-400 italic">Acesso Geral</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge label={item.situacao === 'ativa' ? 'Ativo' : 'Inativo'} color={item.situacao === 'ativa' ? 'green' : 'gray'} />
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => { setSelectedUsuario(item); setIsConfirmResetOpen(true); }} className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-md transition-colors" title="Redefinir senha">
                        <Key size={18} />
                      </button>
                      <button onClick={() => handleOpenForm(item)} className="text-gray-500 hover:text-gray-900 hover:bg-gray-100 p-1.5 rounded-md transition-colors" title="Editar">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => { setSelectedUsuario(item); setIsConfirmStatusOpen(true); }} className={`p-1.5 rounded-md transition-colors ${item.situacao === 'ativa' ? 'text-red-500 hover:bg-red-50 hover:text-red-700' : 'text-green-600 hover:bg-green-50 hover:text-green-800'}`} title={item.situacao === 'ativa' ? 'Desativar acesso' : 'Reativar acesso'}>
                        {item.situacao === 'ativa' ? <PowerOff size={18} /> : <Power size={18} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Form Cadastrar/Editar */}
      <Modal isOpen={isFormModalOpen} onClose={handleCloseForm} title={selectedUsuario ? "Editar Usuário" : "Cadastrar Novo Usuário"} size="md">
        <form onSubmit={handleSaveFlow} className="space-y-4">
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
            <input type="text" name="nome" value={formData.nome} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-md outline-none focus:border-primary ${formErrors.nome ? 'border-red-500' : 'border-gray-300'}`} placeholder="Ex: Ana Souza" />
            {formErrors.nome && <p className="text-red-500 text-xs mt-1">{formErrors.nome}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail para Login *</label>
            <input 
              type="email" name="email" value={formData.email} onChange={handleInputChange} disabled={!!selectedUsuario}
              className={`w-full px-3 py-2 border rounded-md outline-none focus:border-primary ${formErrors.email ? 'border-red-500' : 'border-gray-300'} ${selectedUsuario ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} 
              placeholder="Ex: ana@email.com" 
            />
            {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
          </div>

          {/* NOVO: Seleção de Perfil */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Perfil de Acesso *</label>
            <select 
              name="perfil" value={formData.perfil} onChange={handleInputChange} disabled={!!selectedUsuario}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary bg-white ${selectedUsuario ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
            >
              <option value="diretora">Diretora (Acesso à Escola)</option>
              <option value="administrativo">Administrativo (Apenas RH)</option>
              <option value="admin">Administrador (Acesso Total)</option>
            </select>
            {selectedUsuario && <p className="text-xs text-gray-400 mt-1">Não é possível alterar o perfil e e-mail de um usuário existente. Crie um novo se necessário.</p>}
          </div>

          {!selectedUsuario && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha Provisória *</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} name="senha" value={formData.senha} onChange={handleInputChange} 
                  className={`w-full px-3 py-2 pr-24 border rounded-md outline-none focus:border-primary ${formErrors.senha ? 'border-red-500' : 'border-gray-300'}`} placeholder="Mínimo 6 caracteres" 
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="p-1 text-gray-400 hover:text-gray-600" title="Ver senha">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button type="button" onClick={generateRandomPassword} className="p-1 text-blue-600 hover:text-blue-800 bg-blue-50 rounded" title="Gerar senha segura">
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>
              {formErrors.senha && <p className="text-red-500 text-xs mt-1">{formErrors.senha}</p>}
            </div>
          )}

          {/* Oculta a seleção de unidade se for Admin ou Administrativo */}
          {formData.perfil === 'diretora' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidade Vinculada *</label>
              <select name="unidadeId" value={formData.unidadeId} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-md outline-none focus:border-primary bg-white ${formErrors.unidadeId ? 'border-red-500' : 'border-gray-300'}`}>
                <option value="">Selecione a escola da diretora</option>
                {escolas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
              {formErrors.unidadeId && <p className="text-red-500 text-xs mt-1">{formErrors.unidadeId}</p>}
            </div>
          )}

          {selectedUsuario && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Situação do Acesso</label>
              <select name="situacao" value={formData.situacao} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary bg-white">
                <option value="ativa">Ativa (Pode acessar)</option>
                <option value="inativa">Inativa (Acesso bloqueado)</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <button type="button" onClick={handleCloseForm} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 bg-white rounded-md hover:bg-gray-50 transition-colors">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark transition-colors flex justify-center items-center min-w-[120px]">
              {isSubmitting ? <LoadingSpinner size="sm" color="text-white" /> : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={isConfirmResetOpen} title="Redefinir Senha" message={`Deseja enviar um e-mail com instruções de redefinição de senha para ${selectedUsuario?.email}?`} onConfirm={handleResetPassword} onCancel={() => setIsConfirmResetOpen(false)} />

      <ConfirmDialog 
        isOpen={isConfirmStatusOpen} 
        title={selectedUsuario?.situacao === 'ativa' ? 'Desativar Acesso' : 'Ativar Acesso'} 
        message={selectedUsuario?.situacao === 'ativa' ? `Tem certeza? O usuário ${selectedUsuario?.nome} perderá o acesso ao sistema imediatamente.` : `Deseja reativar o acesso de ${selectedUsuario?.nome} ao sistema?`} 
        onConfirm={handleToggleStatus} 
        onCancel={() => setIsConfirmStatusOpen(false)} 
      />

      <Modal isOpen={isConflictModalOpen} onClose={() => setIsConflictModalOpen(false)} title="Atenção: Conflito de Vínculo" size="sm">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-4">
            <ShieldAlert className="text-orange-600 w-6 h-6" />
          </div>
          <h4 className="text-lg font-bold text-gray-900 mb-2">Unidade já possui diretora</h4>
          <p className="text-sm text-gray-600 mb-6">
            A unidade <strong>{formData.unidadeNome}</strong> já possui a diretora <strong>{conflictingUser?.nome}</strong> ativa no momento.<br/><br/>
            Deseja desativar o acesso de {conflictingUser?.nome} e ativar esta nova diretora?
          </p>
          <div className="flex w-full gap-3 justify-end pt-4 border-t border-gray-100">
            <button onClick={() => setIsConflictModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex-1">Cancelar</button>
            <button onClick={performSave} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 flex-1 flex justify-center">
              {isSubmitting ? <LoadingSpinner size="sm" color="text-white" /> : 'Desativar e Continuar'}
            </button>
          </div>
        </div>
      </Modal>

      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
    </div>
  );
}