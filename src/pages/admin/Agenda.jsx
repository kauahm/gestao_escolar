import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, onSnapshot, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';
// Gravações passam pela camada com histórico e lixeira (ver services/db.js)
import { addDoc, updateDoc, deleteDoc } from '../../services/db';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';

// FullCalendar Imports
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';

// Componentes UI
import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Badge from '../../components/ui/Badge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

// Ícones
import { 
  Plus, Calendar as CalendarIcon, Clock, MapPin, 
  AlignLeft, Trash2, Edit2, ExternalLink, X, Tag
} from 'lucide-react';

const CATEGORIAS_CORES = {
  'Reunião': '#185FA5',
  'Visita': '#3B6D11',
  'Prazo': '#A32D2D',
  'Compromisso': '#534AB7',
  'Outro': '#5F5E5A'
};

const AUTO_CORES = {
  contas: '#E24B4A',
  ciclos: '#EF9F27',
  manutencoes: '#378ADD',
  rh: '#10B981' // Verde para as entrevistas do RH
};

const PALETA_CORES = [
  '#185FA5', '#3B6D11', '#A32D2D', '#534AB7', 
  '#5F5E5A', '#E24B4A', '#EF9F27', '#378ADD', '#10B981'
];

const initialFormState = {
  titulo: '',
  descricao: '',
  local: '',
  categoria: 'Reunião',
  cor: CATEGORIAS_CORES['Reunião'],
  diaInteiro: false,
  dataInicio: '',
  horaInicio: '09:00',
  dataFim: '',
  horaFim: '10:00'
};

export default function Agenda() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const calendarRef = useRef(null);

  // Estados de Dados
  const [eventosManuais, setEventosManuais] = useState([]);
  const [eventosAutomaticos, setEventosAutomaticos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de Filtros (Incluímos o RH aqui)
  const [filtros, setFiltros] = useState({
    'Reunião': true,
    'Visita': true,
    'Prazo': true,
    'Compromisso': true,
    'Outro': true,
    'contas': true,
    'ciclos': true,
    'manutencoes': true,
    'rh': true
  });

  // Modais e Form
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // 1. Buscar Eventos Manuais (Real-time)
  useEffect(() => {
    const q = collection(db, 'eventos');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEventosManuais(eventosData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar eventos:", error);
      showToast("Erro ao carregar agenda.", "error");
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Buscar Eventos Automáticos (Corrigido para tratar Datas corretamente)
  const fetchAutomaticEvents = async () => {
    try {
      const autoEvents = [];
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      // 2.1 Contas a Pagar
      const contasSnap = await getDocs(collection(db, 'contas'));
      contasSnap.forEach(doc => {
        const data = doc.data();
        // Pendente = tudo que ainda não foi enviado (inclui registros antigos gravados como 'Vencida')
        if (data.status !== 'Enviada' && data.vencimento) {
          const [ano, mes, dia] = data.vencimento.split('-');
          const vDate = new Date(ano, mes - 1, dia); // CORREÇÃO: Transforma a string em Data real
          const diffDias = Math.ceil((vDate - hoje) / (1000 * 60 * 60 * 24));
          
          if (diffDias <= 7) {
            autoEvents.push({
              id: `conta_${doc.id}`,
              title: `Vencto: ${data.tipo} — ${data.escolaNome}`,
              start: vDate,
              allDay: true,
              backgroundColor: AUTO_CORES.contas,
              borderColor: AUTO_CORES.contas,
              extendedProps: { ...data, type: 'conta', isManual: false, originalId: doc.id }
            });
          }
        }
      });

      // 2.2 Ciclos
      const ciclosSnap = await getDocs(collection(db, 'ciclos'));
      ciclosSnap.forEach(doc => {
        const data = doc.data();
        if (data.proximaExecucao) {
          const [ano, mes, dia] = data.proximaExecucao.split('-');
          const pDate = new Date(ano, mes - 1, dia); // CORREÇÃO: Transforma a string em Data real
          const diffDias = Math.ceil((pDate - hoje) / (1000 * 60 * 60 * 24));
          
          if (diffDias <= 30) {
            autoEvents.push({
              id: `ciclo_${doc.id}`,
              title: `Ciclo: ${data.tipo} — ${data.escolaNome}`,
              start: pDate,
              allDay: true,
              backgroundColor: AUTO_CORES.ciclos,
              borderColor: AUTO_CORES.ciclos,
              extendedProps: { ...data, type: 'ciclo', isManual: false, originalId: doc.id }
            });
          }
        }
      });

      // 2.3 Manutenções
      const manuSnap = await getDocs(collection(db, 'manutencoes'));
      manuSnap.forEach(doc => {
        const data = doc.data();
        if (data.prazo && data.status !== 'Concluído') {
          const [ano, mes, dia] = data.prazo.split('-');
          const mDate = new Date(ano, mes - 1, dia); // CORREÇÃO: Transforma a string em Data real
          autoEvents.push({
            id: `manu_${doc.id}`,
            title: `Prazo: ${data.descricao} — ${data.escolaNome}`,
            start: mDate,
            allDay: true,
            backgroundColor: AUTO_CORES.manutencoes,
            borderColor: AUTO_CORES.manutencoes,
            extendedProps: { ...data, type: 'manutencao', isManual: false, originalId: doc.id }
          });
        }
      });

      // 2.4 Processo Seletivo (Novo!)
      const rhSnap = await getDocs(collection(db, 'curriculos'));
      rhSnap.forEach(doc => {
        const data = doc.data();
        if (data.status === 'Entrevista Agendada' && data.dataEntrevista) {
          const [ano, mes, dia] = data.dataEntrevista.split('-');
          const rhDate = new Date(ano, mes - 1, dia); // Transforma em Data real
          
          if (data.horaEntrevista) {
            const [hora, min] = data.horaEntrevista.split(':');
            rhDate.setHours(hora, min, 0, 0); // Aplica a hora certinha
          }
          
          autoEvents.push({
            id: `rh_${doc.id}`,
            title: `Entrevista: ${data.nome} (${data.vaga})`,
            start: rhDate,
            allDay: !data.horaEntrevista,
            backgroundColor: AUTO_CORES.rh,
            borderColor: AUTO_CORES.rh,
            extendedProps: { ...data, type: 'rh', isManual: false, originalId: doc.id }
          });
        }
      });

      setEventosAutomaticos(autoEvents);
    } catch (error) {
      console.error("Erro ao buscar eventos automáticos:", error);
    }
  };

  useEffect(() => {
    fetchAutomaticEvents();
  }, []);

  const showToast = (message, type = 'success') => setToast({ show: true, message, type });

  // Preparar Eventos para o FullCalendar
  const fullCalendarEvents = useMemo(() => {
    const formattedManuais = eventosManuais.map(m => {
      const start = m.inicio?.toDate ? m.inicio.toDate() : new Date(m.inicio);
      const end = m.fim?.toDate ? m.fim.toDate() : (m.fim ? new Date(m.fim) : null);
      
      return {
        id: m.id,
        title: m.titulo,
        start,
        end,
        allDay: m.diaInteiro,
        backgroundColor: m.cor || CATEGORIAS_CORES['Outro'],
        borderColor: m.cor || CATEGORIAS_CORES['Outro'],
        extendedProps: { ...m, isManual: true }
      };
    }).filter(e => filtros[e.extendedProps.categoria]);

    const filteredAuto = eventosAutomaticos.filter(e => {
      if (e.extendedProps.type === 'conta') return filtros['contas'];
      if (e.extendedProps.type === 'ciclo') return filtros['ciclos'];
      if (e.extendedProps.type === 'manutencao') return filtros['manutencoes'];
      if (e.extendedProps.type === 'rh') return filtros['rh']; // Filtro do RH
      return true;
    });

    return [...formattedManuais, ...filteredAuto];
  }, [eventosManuais, eventosAutomaticos, filtros]);

  // Handler de Filtros
  const toggleFiltro = (chave) => {
    setFiltros(prev => ({ ...prev, [chave]: !prev[chave] }));
  };

  // FullCalendar Handlers
  const handleDateClick = (info) => {
    const dateStr = info.dateStr.split('T')[0];
    const isAllDay = info.allDay;
    
    let timeStr = '09:00';
    if (!isAllDay && info.dateStr.includes('T')) {
      timeStr = info.dateStr.split('T')[1].substring(0, 5);
    }

    setFormData({
      ...initialFormState,
      dataInicio: dateStr,
      dataFim: dateStr,
      horaInicio: timeStr,
      diaInteiro: isAllDay
    });
    setFormErrors({});
    setSelectedEvent(null);
    setIsDetailsModalOpen(false);
    setIsFormModalOpen(true);
  };

  const handleEventClick = (info) => {
    setSelectedEvent(info.event);
    setIsDetailsModalOpen(true);
  };

  const handleEventDropOrResize = async (info) => {
    const { event, revert } = info;
    
    if (!event.extendedProps.isManual) {
      revert();
      showToast("Não é possível alterar a data de eventos automáticos por aqui.", "error");
      return;
    }

    try {
      const docRef = doc(db, 'eventos', event.id);
      const updates = {
        atualizadoEm: serverTimestamp()
      };

      if (event.start) updates.inicio = Timestamp.fromDate(event.start);
      if (event.end) updates.fim = Timestamp.fromDate(event.end);
      if (info.type === 'eventDrop') updates.diaInteiro = event.allDay;

      await updateDoc(docRef, updates);
      showToast('Data do evento atualizada!');
    } catch (error) {
      console.error("Erro ao mover evento:", error);
      revert();
      showToast('Erro ao atualizar evento.', 'error');
    }
  };

  // Form Handlers
  const handleCloseForm = () => {
    setIsFormModalOpen(false);
    setFormData(initialFormState);
    setFormErrors({});
    setSelectedEvent(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let novoValor = type === 'checkbox' ? checked : value;
    
    setFormData(prev => {
      const atualizado = { ...prev, [name]: novoValor };
      if (name === 'categoria' && CATEGORIAS_CORES[value]) {
        atualizado.cor = CATEGORIAS_CORES[value];
      }
      return atualizado;
    });
    
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.titulo.trim()) errors.titulo = 'O título é obrigatório';
    if (!formData.dataInicio) errors.dataInicio = 'A data de início é obrigatória';
    if (!formData.diaInteiro && !formData.horaInicio) errors.horaInicio = 'Hora de início é obrigatória';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      let inicioDate = new Date(`${formData.dataInicio}T00:00:00`);
      let fimDate = formData.dataFim ? new Date(`${formData.dataFim}T00:00:00`) : null;

      if (!formData.diaInteiro) {
        inicioDate = new Date(`${formData.dataInicio}T${formData.horaInicio}:00`);
        if (formData.dataFim && formData.horaFim) {
          fimDate = new Date(`${formData.dataFim}T${formData.horaFim}:00`);
        }
      }

      const dataToSave = {
        titulo: formData.titulo,
        descricao: formData.descricao,
        local: formData.local,
        categoria: formData.categoria,
        cor: formData.cor,
        diaInteiro: formData.diaInteiro,
        inicio: Timestamp.fromDate(inicioDate),
        fim: fimDate ? Timestamp.fromDate(fimDate) : null,
        atualizadoEm: serverTimestamp()
      };

      if (selectedEvent && selectedEvent.extendedProps.isManual) {
        await updateDoc(doc(db, 'eventos', selectedEvent.id), dataToSave);
        showToast('Evento atualizado com sucesso!');
      } else {
        dataToSave.criadoPor = currentUser.uid;
        dataToSave.criadoEm = serverTimestamp();
        await addDoc(collection(db, 'eventos'), dataToSave);
        showToast('Evento criado com sucesso!');
      }
      handleCloseForm();
    } catch (error) {
      console.error("Erro ao salvar evento:", error);
      showToast('Erro ao salvar o evento.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = () => {
    if (!selectedEvent || !selectedEvent.extendedProps.isManual) return;
    
    const props = selectedEvent.extendedProps;
    const start = selectedEvent.start;
    const end = selectedEvent.end || selectedEvent.start;

    const formatData = (d) => {
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(d - tzOffset)).toISOString().slice(0, -1);
      return localISOTime.split('T')[0];
    };

    const formatHora = (d) => d.toTimeString().substring(0, 5);

    setFormData({
      titulo: props.titulo,
      descricao: props.descricao || '',
      local: props.local || '',
      categoria: props.categoria || 'Outro',
      cor: props.cor || CATEGORIAS_CORES['Outro'],
      diaInteiro: selectedEvent.allDay,
      dataInicio: start ? formatData(start) : '',
      horaInicio: start ? formatHora(start) : '09:00',
      dataFim: end ? formatData(end) : '',
      horaFim: end ? formatHora(end) : '10:00'
    });
    
    setIsDetailsModalOpen(false);
    setIsFormModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedEvent || !selectedEvent.extendedProps.isManual) return;
    try {
      await deleteDoc(doc(db, 'eventos', selectedEvent.id));
      showToast('Evento movido para a lixeira. Dá para restaurar em Segurança dos dados.');
      setIsConfirmDeleteOpen(false);
      setIsDetailsModalOpen(false);
      setSelectedEvent(null);
    } catch (error) {
      showToast('Erro ao excluir evento.', 'error');
    }
  };

  const navigateToModule = () => {
    if (!selectedEvent) return;
    const type = selectedEvent.extendedProps.type;
    setIsDetailsModalOpen(false);
    if (type === 'conta') navigate('/admin/contas');
    if (type === 'ciclo') navigate('/admin/ciclos');
    if (type === 'manutencao') navigate('/admin/manutencoes');
    if (type === 'rh') navigate('/admin/selecao'); // Navega para as Entrevistas
  };

  // Renderização Auxiliar (Corrigida e livre de erros!)
  const renderProximosEventos = () => {
    const hoje = new Date();
    const proximos = fullCalendarEvents
      .filter(e => e.start >= hoje || e.allDay)
      .sort((a, b) => a.start - b.start)
      .slice(0, 5);

    if (proximos.length === 0) return <p className="text-sm text-gray-500">Nenhum evento próximo.</p>;

    return (
      <div className="space-y-3">
        {proximos.map(e => (
          <div key={e.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-md transition-colors border-l-4" style={{ borderColor: e.backgroundColor }}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{e.title}</p>
              <p className="text-xs text-gray-500">
                {e.allDay ? 'Dia inteiro' : e.start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                {' · '}{e.start.toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col md:flex-row gap-6">
      
      {/* Sidebar de Filtros e Próximos Eventos */}
      <aside className="w-full md:w-64 flex flex-col gap-6 order-2 md:order-1">
        
        {/* Painel de Filtros */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2">
            <Tag size={18} className="text-primary" /> Filtros
          </h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Eventos Manuais</h4>
              <div className="space-y-2">
                {Object.keys(CATEGORIAS_CORES).map(cat => (
                  <label key={cat} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 hover:text-gray-900">
                    <input type="checkbox" checked={filtros[cat]} onChange={() => toggleFiltro(cat)} className="rounded text-primary focus:ring-primary" />
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORIAS_CORES[cat] }}></span>
                    {cat}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sistema Automático</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 hover:text-gray-900">
                  <input type="checkbox" checked={filtros['contas']} onChange={() => toggleFiltro('contas')} className="rounded text-primary focus:ring-primary" />
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: AUTO_CORES.contas }}></span>
                  Vencimentos
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 hover:text-gray-900">
                  <input type="checkbox" checked={filtros['ciclos']} onChange={() => toggleFiltro('ciclos')} className="rounded text-primary focus:ring-primary" />
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: AUTO_CORES.ciclos }}></span>
                  Ciclos
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 hover:text-gray-900">
                  <input type="checkbox" checked={filtros['manutencoes']} onChange={() => toggleFiltro('manutencoes')} className="rounded text-primary focus:ring-primary" />
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: AUTO_CORES.manutencoes }}></span>
                  Manutenções
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 hover:text-gray-900">
                  <input type="checkbox" checked={filtros['rh']} onChange={() => toggleFiltro('rh')} className="rounded text-primary focus:ring-primary" />
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: AUTO_CORES.rh }}></span>
                  Entrevistas (RH)
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Próximos Eventos */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hidden md:block">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2">
            <Clock size={18} className="text-primary" /> Próximos
          </h3>
          {renderProximosEventos()}
        </div>
      </aside>

      {/* Calendário Principal */}
      <main className="flex-1 bg-white p-4 rounded-lg shadow-sm border border-gray-200 order-1 md:order-2 overflow-hidden h-[calc(100vh-120px)] md:h-auto min-h-[600px]">
        {loading ? (
          <div className="h-full flex items-center justify-center"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="h-full calendar-container">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
              initialView={window.innerWidth < 768 ? 'listWeek' : 'dayGridMonth'}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
              }}
              locale={ptBrLocale}
              events={fullCalendarEvents}
              editable={true}
              droppable={true}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={true}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              eventDrop={handleEventDropOrResize}
              eventResize={handleEventDropOrResize}
              datesSet={() => fetchAutomaticEvents()} 
              height="100%"
            />
          </div>
        )}
      </main>

      {/* Modal: Form de Evento */}
      <Modal isOpen={isFormModalOpen} onClose={handleCloseForm} title={selectedEvent ? "Editar Evento" : "Novo Evento"} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título do Evento *</label>
            <input type="text" name="titulo" value={formData.titulo} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-md outline-none focus:border-primary ${formErrors.titulo ? 'border-red-500' : 'border-gray-300'}`} placeholder="Ex: Reunião de Pais" />
            {formErrors.titulo && <p className="text-red-500 text-xs mt-1">{formErrors.titulo}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
              <select name="categoria" value={formData.categoria} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary bg-white">
                {Object.keys(CATEGORIAS_CORES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cor</label>
              <div className="flex gap-2 flex-wrap mt-1.5">
                {PALETA_CORES.map(c => (
                  <button type="button" key={c} onClick={() => setFormData({...formData, cor: c})} className={`w-6 h-6 rounded-full border-2 transition-all ${formData.cor === c ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-110'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-md border border-gray-200">
            <input type="checkbox" id="diaInteiro" name="diaInteiro" checked={formData.diaInteiro} onChange={handleInputChange} className="rounded text-primary focus:ring-primary w-4 h-4" />
            <label htmlFor="diaInteiro" className="text-sm font-medium text-gray-800 cursor-pointer">Evento de Dia Inteiro</label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Início *</label>
              <input type="date" name="dataInicio" value={formData.dataInicio} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-md outline-none focus:border-primary ${formErrors.dataInicio ? 'border-red-500' : 'border-gray-300'}`} />
              {formErrors.dataInicio && <p className="text-red-500 text-xs mt-1">{formErrors.dataInicio}</p>}
            </div>
            {!formData.diaInteiro && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora Início *</label>
                <input type="time" name="horaInicio" value={formData.horaInicio} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-md outline-none focus:border-primary ${formErrors.horaInicio ? 'border-red-500' : 'border-gray-300'}`} />
                {formErrors.horaInicio && <p className="text-red-500 text-xs mt-1">{formErrors.horaInicio}</p>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim <span className="text-xs text-gray-400">(Opcional)</span></label>
              <input type="date" name="dataFim" value={formData.dataFim} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary" />
            </div>
            {!formData.diaInteiro && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora Fim</label>
                <input type="time" name="horaFim" value={formData.horaFim} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Local</label>
            <input type="text" name="local" value={formData.local} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary" placeholder="Onde será?" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea name="descricao" value={formData.descricao} onChange={handleInputChange} rows="2" className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary resize-none" placeholder="Detalhes, pautas..."></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <button type="button" onClick={handleCloseForm} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 bg-white rounded-md hover:bg-gray-50 transition-colors">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark transition-colors flex justify-center items-center min-w-[120px]">
              {isSubmitting ? <LoadingSpinner size="sm" color="text-white" /> : 'Salvar Evento'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Detalhes do Evento */}
      {selectedEvent && !isFormModalOpen && (
        <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title="Detalhes do Evento" size="md">
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: selectedEvent.backgroundColor }}>
                <CalendarIcon className="text-white w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900">{selectedEvent.title}</h3>
                <div className="text-sm font-medium text-gray-500 flex items-center gap-1 mt-1">
                  {selectedEvent.extendedProps.isManual ? (
                    <Badge label={selectedEvent.extendedProps.categoria} color="gray" />
                  ) : (
                    <Badge label="Sistema" color="blue" />
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-900 font-medium">Quando</p>
                  <p className="text-sm text-gray-600">
                    {selectedEvent.start.toLocaleDateString('pt-BR')}
                    {!selectedEvent.allDay && ` às ${selectedEvent.start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                    {selectedEvent.end && selectedEvent.end.getTime() !== selectedEvent.start.getTime() && (
                      ` até ${selectedEvent.end.toLocaleDateString('pt-BR')} ${!selectedEvent.allDay ? selectedEvent.end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}`
                    )}
                  </p>
                </div>
              </div>

              {selectedEvent.extendedProps.local && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-900 font-medium">Local</p>
                    <p className="text-sm text-gray-600">{selectedEvent.extendedProps.local}</p>
                  </div>
                </div>
              )}

              {selectedEvent.extendedProps.descricao && (
                <div className="flex items-start gap-3">
                  <AlignLeft className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-900 font-medium">Descrição</p>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedEvent.extendedProps.descricao}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Ações baseadas no tipo de evento */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
              {selectedEvent.extendedProps.isManual ? (
                <>
                  <button onClick={() => setIsConfirmDeleteOpen(true)} className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors">
                    <Trash2 size={16} /> Excluir
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => setIsDetailsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Fechar</button>
                    <button onClick={handleEditClick} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark transition-colors">
                      <Edit2 size={16} /> Editar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-400 italic">Evento gerado automaticamente</p>
                  <div className="flex gap-2">
                    <button onClick={() => setIsDetailsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Fechar</button>
                    <button onClick={navigateToModule} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark transition-colors">
                      Ver no módulo <ExternalLink size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmação Exclusão */}
      <ConfirmDialog 
        isOpen={isConfirmDeleteOpen} 
        title="Excluir Evento" 
        message={`Tem certeza que deseja excluir o evento "${selectedEvent?.title}"?`} 
        onConfirm={handleConfirmDelete} 
        onCancel={() => setIsConfirmDeleteOpen(false)} 
      />

      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
      
      {/* Estilos complementares para o FullCalendar */}
      <style dangerouslySetInnerHTML={{__html: `
        .calendar-container .fc-theme-standard td, .calendar-container .fc-theme-standard th { border-color: #e5e7eb; }
        .calendar-container .fc-button-primary { background-color: #185FA5; border-color: #185FA5; text-transform: capitalize; }
        .calendar-container .fc-button-primary:hover { background-color: #114478; border-color: #114478; }
        .calendar-container .fc-button-primary:not(:disabled).fc-button-active, .calendar-container .fc-button-primary:not(:disabled):active { background-color: #114478; border-color: #114478; }
        .calendar-container .fc-event { cursor: pointer; border-radius: 4px; padding: 2px 4px; font-size: 0.75rem; border: none; }
        .calendar-container .fc-daygrid-event-dot { border-color: currentColor; }
        @media (max-width: 768px) { .calendar-container .fc-toolbar { flex-direction: column; gap: 1rem; } .calendar-container .fc-toolbar-title { font-size: 1.25rem; } }
      `}} />
    </div>
  );
}