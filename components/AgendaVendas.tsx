import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, Clock, User, Phone, FileText, Plus, 
  CheckCircle2, Trash2, Edit2, AlertCircle, RefreshCw, 
  X, Save, Loader2, CalendarDays, Contact, FileBadge,
  Bell, BellRing, Check, Search
} from 'lucide-react';
import { AgendaVendas, Customer } from '../types';
import { dbService } from '../services/dbService';

const AgendaVendasComponent: React.FC = () => {
  const [agenda, setAgenda] = useState<AgendaVendas[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pendente' | 'concluido' | 'todos'>('pendente');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [itemToDelete, setItemToDelete] = useState<{id: string, cliente: string} | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  
  const [todayStr, setTodayStr] = useState('');
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  const [newItem, setNewItem] = useState<Omit<AgendaVendas, 'id'>>({
    cliente: '',
    cnpj: '',
    telefone: '',
    contato: '',
    ultima_compra: '',
    data_retorno: new Date().toISOString().split('T')[0],
    hora_retorno: '',
    anotacoes: '',
    status: 'pendente'
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      const local = new Date(now.getTime() - offset);
      const iso = local.toISOString();
      setTodayStr(iso.split('T')[0]);
      setCurrentTimeStr(iso.split('T')[1].slice(0, 5));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatDateSafe = (dateStr: string) => {
    if (!dateStr) return '---';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const formatCNPJ = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 11) {
      return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 10) {
      return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
    }
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
  };

  const loadAgenda = useCallback(async () => {
    setLoading(true);
    try {
      const [agendaData, customersData] = await Promise.all([
        dbService.getAgenda(),
        dbService.getCustomers()
      ]);
      setAgenda(agendaData || []);
      setCustomers(customersData || []);
    } catch (e) {
      console.error("Erro ao carregar dados da agenda:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgenda();
  }, [loadAgenda]);

  const handleOpenNew = () => {
    setEditingId(null);
    setNewItem({
      cliente: '',
      cnpj: '',
      telefone: '',
      contato: '',
      ultima_compra: '',
      data_retorno: todayStr,
      hora_retorno: '',
      anotacoes: '',
      status: 'pendente'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: AgendaVendas) => {
    setEditingId(item.id);
    setNewItem({
      cliente: item.cliente,
      cnpj: item.cnpj,
      telefone: item.telefone,
      contato: item.contato,
      ultima_compra: item.ultima_compra || '',
      data_retorno: item.data_retorno,
      hora_retorno: item.hora_retorno || '',
      anotacoes: item.anotacoes || '',
      status: item.status
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.cliente) return alert("O nome do cliente é obrigatório.");

    if (newItem.cnpj && newItem.cnpj.trim() !== "") {
      const isDuplicate = agenda.some(item => 
        item.cnpj === newItem.cnpj && 
        item.id !== editingId && 
        item.status === 'pendente'
      );
      
      if (isDuplicate) {
        alert("⚠️ ATENÇÃO: Já existe um agendamento PENDENTE para este CNPJ na agenda.");
        return;
      }
    }

    // Sanitização para garantir que datas vazias sejam enviadas como null
    const dataToSave = {
      ...newItem,
      ultima_compra: newItem.ultima_compra && newItem.ultima_compra.trim() !== "" ? newItem.ultima_compra : null
    };
    
    setIsSubmitting(true);
    try {
      if (editingId) {
        await dbService.updateAgenda(editingId, dataToSave);
      } else {
        await dbService.addAgenda(dataToSave);
      }
      setIsModalOpen(false);
      await loadAgenda();
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (e) {
      console.error("Erro ao salvar item:", e);
      alert("Erro ao salvar dados.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'pendente' ? 'concluido' : 'pendente';
    try {
      await dbService.updateAgendaStatus(id, newStatus as any);
      await loadAgenda();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteRequest = (id: string, cliente: string) => {
    setItemToDelete({ id: String(id), cliente });
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    
    setIsSubmitting(true);
    try {
      await dbService.deleteAgenda(itemToDelete.id);
      setItemToDelete(null);
      await loadAgenda();
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (e) {
      console.error("Erro ao excluir item da agenda:", e);
      alert("Erro ao excluir item. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = agenda.filter(i => {
    const matchesFilter = filter === 'todos' || i.status === filter;
    const search = searchTerm.toLowerCase();
    const matchesSearch = 
      (i.cliente || '').toLowerCase().includes(search) || 
      (i.cnpj || '').toLowerCase().includes(search);
    
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      <style>{`
        @keyframes custom-pulse {
          0%, 100% { background-color: rgba(244, 63, 94, 0.05); }
          50% { background-color: rgba(244, 63, 94, 0.2); }
        }
        .flashing-alert {
          animation: custom-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          border: 2px solid #f43f5e !important;
        }
      `}</style>

      {showSuccessToast && (
        <div className="fixed top-8 right-8 bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300 z-[200]">
          <CheckCircle2 size={24} />
          <span className="font-black uppercase text-xs tracking-widest">Agenda Atualizada com Sucesso</span>
        </div>
      )}

      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/20">
            <CalendarDays size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 uppercase tracking-tighter">Agenda de Retorno</h1>
            <p className="text-slate-500 text-[8px] font-bold uppercase tracking-widest">Gestão de Recompra</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadAgenda} className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-all">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={handleOpenNew}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg"
          >
            <Plus size={16} /> Novo Agendamento
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="BUSCAR NA AGENDA..." 
            className="w-full bg-white border border-slate-100 rounded-xl pl-12 pr-4 py-2.5 font-bold text-[9px] uppercase tracking-widest outline-none focus:border-indigo-500 shadow-sm transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 w-fit shrink-0">
          {['pendente', 'concluido', 'todos'].map((st) => (
            <button
              key={st}
              onClick={() => setFilter(st as any)}
              className={`px-5 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${
                filter === st ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              {st === 'pendente' ? '🔴 Pendentes' : st === 'concluido' ? '🟢 Concluídos' : '🔍 Ver Todos'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-medium uppercase text-[9px] tracking-widest">
                <th className="px-5 py-3">Cliente / Documento</th>
                <th className="px-5 py-3">Contato / Telefone</th>
                <th className="px-5 py-3">Última Compra</th>
                <th className="px-5 py-3">Retorno</th>
                <th className="px-5 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-xs">
              {filteredItems.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <AlertCircle size={32} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest italic text-[10px]">Nenhum compromisso encontrado.</p>
                  </td>
                </tr>
              )}
              {filteredItems.map((item) => {
                const isPending = item.status === 'pendente';
                
                let isDue = false;
                if (isPending) {
                  if (item.data_retorno < todayStr) {
                    isDue = true;
                  } else if (item.data_retorno === todayStr) {
                    if (!item.hora_retorno || item.hora_retorno <= currentTimeStr) {
                      isDue = true;
                    }
                  }
                }
                
                return (
                  <tr key={item.id} className={`transition-all hover:bg-slate-50/50 ${isDue ? 'flashing-alert group' : (isPending ? 'bg-white group' : 'bg-white opacity-60')}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {isDue && <BellRing size={16} className="text-rose-500 animate-bounce shrink-0" />}
                        <div>
                          <div className="font-bold text-slate-800 text-sm uppercase leading-none mb-1">{item.cliente}</div>
                          <div className="text-[8px] font-medium text-slate-400 uppercase tracking-widest">CNPJ: {item.cnpj || '---'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600">
                          <Contact size={10} className="text-indigo-500" /> {item.contato || '---'}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600">
                          <Phone size={10} /> {item.telefone || '---'}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-[10px] font-medium text-slate-500 uppercase tracking-tighter">
                        {item.ultima_compra ? formatDateSafe(item.ultima_compra) : '---'}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100 flex flex-col gap-0.5 w-fit shadow-sm">
                        <div className={`flex items-center gap-1.5 text-xs font-bold ${isDue ? 'text-rose-600' : 'text-slate-800'}`}>
                          <Calendar size={12} className={isDue ? 'text-rose-500' : 'text-slate-400'} /> {formatDateSafe(item.data_retorno)}
                        </div>
                        {item.hora_retorno && (
                          <div className={`flex items-center gap-1.5 text-[8px] font-bold uppercase ${isDue ? 'text-rose-400' : 'text-slate-500'}`}>
                            <Clock size={10} /> {item.hora_retorno}h
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => handleToggleStatus(item.id, item.status)}
                          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[8px] uppercase tracking-widest transition-all shadow-sm ${
                            isPending 
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                            : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {isPending ? <CheckCircle2 size={12} /> : <RefreshCw size={12} />}
                          {isPending ? 'FEITO' : 'REABRIR'}
                        </button>
                        <div className="flex gap-0.5">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleOpenEdit(item);
                            }}
                            className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteRequest(item.id, item.cliente);
                            }}
                            className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {itemToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full text-center border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={48} />
            </div>
            <h3 className="text-xl font-black uppercase text-slate-800 mb-2">Excluir Agendamento?</h3>
            <p className="text-slate-500 font-medium mb-8">
              Tem certeza que deseja apagar o retorno do cliente <span className="font-bold text-slate-900">{itemToDelete.cliente}</span>? 
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-4">
              <button 
                type="button"
                onClick={() => setItemToDelete(null)} 
                className="flex-1 py-4 font-black uppercase text-xs tracking-widest text-slate-400 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all"
              >
                Manter
              </button>
              <button 
                type="button"
                onClick={confirmDelete} 
                disabled={isSubmitting}
                className="flex-1 py-4 font-black uppercase text-xs tracking-widest text-white bg-rose-500 rounded-2xl shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-start justify-center overflow-y-auto p-4 md:p-10 ml-64 transition-all animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 my-auto">
            
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center sticky top-0 z-20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-600/20"><Bell size={18} /></div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tighter leading-none">{editingId ? 'Editar Agendamento' : 'Novo Retorno Manual'}</h3>
                  <p className="text-[7px] font-black text-indigo-400 uppercase tracking-widest mt-1">Atalho: Pressione [ESC] para sair</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-white/30 hover:text-white transition-all p-1.5 bg-white/5 rounded-full hover:rotate-90"
                title="Fechar (ESC)"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Nome Fantasia / Cliente *</label>
                  <input 
                    required
                    autoFocus
                    list="registered-customers"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-lg px-3 py-2.5 font-black text-base text-slate-800 outline-none focus:border-indigo-500 shadow-inner transition-all placeholder:text-slate-300"
                    placeholder="Ex: Mercado da Esquina"
                    value={newItem.cliente}
                    onChange={e => {
                      const typed = e.target.value;
                      const found = customers.find(c => c.name === typed);
                      if (found) {
                        setNewItem({
                          ...newItem,
                          cliente: typed,
                          cnpj: found.cnpj || '',
                          telefone: found.telefone || '',
                          contato: found.contato || '',
                          ultima_compra: found.ultima_compra || ''
                        });
                      } else {
                        setNewItem({...newItem, cliente: typed});
                      }
                    }}
                  />
                  <datalist id="registered-customers">
                    {customers.map(c => <option key={c.id} value={c.name} />)}
                  </datalist>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">CNPJ ou CPF</label>
                  <input 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-lg px-3 py-2 font-bold text-slate-700 outline-none focus:border-indigo-500 shadow-sm text-xs"
                    placeholder="00.000.000/0001-00"
                    value={newItem.cnpj}
                    onChange={e => setNewItem({...newItem, cnpj: formatCNPJ(e.target.value)})}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">WhatsApp / Telefone</label>
                  <input 
                    className="w-full bg-emerald-50/30 border-2 border-emerald-100 rounded-lg px-3 py-2 font-black text-emerald-700 outline-none focus:border-emerald-500 shadow-sm text-xs"
                    placeholder="(00) 00000-0000"
                    value={newItem.telefone}
                    onChange={e => setNewItem({...newItem, telefone: formatPhone(e.target.value)})}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Pessoa de Contato</label>
                  <input 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-lg px-3 py-2 font-bold text-slate-700 outline-none focus:border-indigo-500 shadow-sm text-xs"
                    placeholder="Nome do comprador"
                    value={newItem.contato}
                    onChange={e => setNewItem({...newItem, contato: e.target.value})}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Última Compra (Opcional)</label>
                  <input 
                    type="date"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-lg px-3 py-2 font-bold text-slate-700 outline-none focus:border-indigo-500 shadow-sm text-xs"
                    value={newItem.ultima_compra || ''}
                    onChange={e => setNewItem({...newItem, ultima_compra: e.target.value})}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black text-rose-500 uppercase tracking-widest px-1">Data do Retorno *</label>
                  <input 
                    type="date"
                    required
                    className="w-full bg-rose-50/30 border-2 border-rose-100 rounded-lg px-3 py-2 font-black text-rose-700 outline-none focus:border-rose-500 shadow-sm text-xs"
                    value={newItem.data_retorno}
                    onChange={e => setNewItem({...newItem, data_retorno: e.target.value})}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black text-rose-500 uppercase tracking-widest px-1">Hora do Retorno</label>
                  <input 
                    type="time"
                    className="w-full bg-rose-50/30 border-2 border-rose-100 rounded-lg px-3 py-2 font-black text-rose-700 outline-none focus:border-rose-500 shadow-sm text-xs"
                    value={newItem.hora_retorno}
                    onChange={e => setNewItem({...newItem, hora_retorno: e.target.value})}
                  />
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Anotações Estratégicas</label>
                  <textarea 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-lg px-3 py-2 font-medium text-slate-600 outline-none focus:border-indigo-500 min-h-[80px] resize-none shadow-sm text-xs"
                    placeholder="Detalhes para a abordagem de venda..."
                    value={newItem.anotacoes}
                    onChange={e => setNewItem({...newItem, anotacoes: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-6">
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-indigo-600 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 uppercase text-[10px] tracking-[0.2em] shadow-[0_20px_50px_rgba(79,70,229,0.3)] hover:bg-emerald-600 transition-all disabled:opacity-50 active:scale-95 group"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} className="group-hover:rotate-12 transition-transform" />}
                  {editingId ? 'Salvar Alterações' : 'Efetivar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgendaVendasComponent;