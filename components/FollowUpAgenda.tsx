
import React, { useState, useEffect } from 'react';
// Added missing CalendarCheck import from lucide-react
import { 
  Calendar, Clock, User, MessageSquare, Plus, 
  CheckCircle2, Trash2, AlertCircle, RefreshCw, 
  X, Save, Loader2, Filter, Search, CalendarCheck
} from 'lucide-react';
import { Customer, FollowUp } from '../types';
import { dbService } from '../services/dbService';

const FollowUpAgenda: React.FC = () => {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<'todos' | 'pendente' | 'concluido'>('pendente');

  const [newItem, setNewItem] = useState<Omit<FollowUp, 'id'>>({
    cliente_id: '',
    cliente_nome: '',
    data_agendada: new Date().toISOString().split('T')[0],
    descricao: '',
    vendedor: '',
    status: 'pendente'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [fData, cData] = await Promise.all([
        dbService.getFollowUps(),
        dbService.getCustomers()
      ]);
      setFollowUps(fData);
      setCustomers(cData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.cliente_nome || !newItem.descricao) return alert("Preencha os campos obrigatórios.");
    
    setIsSubmitting(true);
    try {
      await dbService.addFollowUp(newItem);
      setIsModalOpen(false);
      setNewItem({
        cliente_id: '',
        cliente_nome: '',
        data_agendada: new Date().toISOString().split('T')[0],
        descricao: '',
        vendedor: '',
        status: 'pendente'
      });
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'pendente' ? 'concluido' : 'pendente';
    try {
      await dbService.updateFollowUpStatus(id, newStatus);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este agendamento?")) return;
    try {
      await dbService.deleteFollowUp(id);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  const filteredItems = followUps.filter(f => {
    if (filter === 'todos') return true;
    return f.status === filter;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-lg font-bold text-slate-800 uppercase tracking-tighter">Agenda de Follow-up</h1>
          <p className="text-slate-500 text-[8px] font-bold uppercase tracking-widest mt-0.5">Gestão de Relacionamento</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-all">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg"
          >
            <Plus size={16} /> Novo Agendamento
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 w-fit no-print">
        {['pendente', 'concluido', 'todos'].map((st) => (
          <button
            key={st}
            onClick={() => setFilter(st as any)}
            className={`px-5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${
              filter === st ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-slate-100">
            <AlertCircle size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-black uppercase tracking-widest">Nenhum compromisso encontrado.</p>
          </div>
        )}

        {filteredItems.map((item) => {
          const isAtrasado = item.status === 'pendente' && item.data_agendada < today;
          return (
            <div 
              key={item.id} 
              className={`bg-white p-2.5 rounded-xl border transition-all flex flex-col justify-between shadow-sm relative group ${
                item.status === 'concluido' ? 'border-slate-100 opacity-60' : 
                isAtrasado ? 'border-rose-100 bg-rose-50/30' : 'border-indigo-50 hover:border-indigo-200'
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-1.5">
                  <div className="flex items-center gap-1 text-[7px] font-bold uppercase tracking-widest text-slate-400">
                    <Calendar size={9} className={isAtrasado ? 'text-rose-500' : 'text-indigo-500'} />
                    {new Date(item.data_agendada).toLocaleDateString('pt-BR')}
                    {isAtrasado && <span className="bg-rose-500 text-white px-1 py-0.5 rounded text-[5px] animate-pulse">Atrasado</span>}
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg">
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>

                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight mb-1 truncate">
                  {item.cliente_nome}
                </h3>
                
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100 mb-1.5 min-h-[40px]">
                  {item.descricao}
                </p>
              </div>

              <div className="flex justify-between items-center mt-0.5">
                <div className="text-[7px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                  <User size={8} /> {item.vendedor || 'Consultor'}
                </div>
                <button 
                  onClick={() => handleToggleStatus(item.id, item.status)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-widest transition-all ${
                    item.status === 'concluido' 
                      ? 'bg-emerald-50 text-emerald-600' 
                      : 'bg-indigo-600 text-white shadow-sm hover:bg-emerald-600'
                  }`}
                >
                  {item.status === 'concluido' ? <CheckCircle2 size={9} /> : null}
                  {item.status === 'concluido' ? 'OK' : 'Concluir'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL DE AGENDAMENTO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-base font-black uppercase tracking-tighter flex items-center gap-2">
                  <CalendarCheck size={18} className="text-indigo-400" /> Novo Follow-up
                </h3>
                <p className="text-[7px] font-black text-indigo-400 uppercase tracking-widest mt-0.5">Agendar retorno ao cliente</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-white/20 hover:text-white transition-all">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Cliente *</label>
                <input 
                  list="follow-customers"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-lg px-3 py-2 font-bold text-slate-700 outline-none focus:border-indigo-500 text-xs"
                  placeholder="Selecione o cliente..."
                  value={newItem.cliente_nome}
                  onChange={e => {
                    const found = customers.find(c => c.name === e.target.value);
                    setNewItem({...newItem, cliente_nome: e.target.value, cliente_id: found ? found.id : '', vendedor: found ? found.vendedor : newItem.vendedor});
                  }}
                />
                <datalist id="follow-customers">
                  {customers.map(c => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Data Agendada *</label>
                  <input 
                    type="date"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-lg px-3 py-2 font-bold text-slate-700 outline-none focus:border-indigo-500 text-xs"
                    value={newItem.data_agendada}
                    onChange={e => setNewItem({...newItem, data_agendada: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Vendedor</label>
                  <input 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-lg px-3 py-2 font-bold text-slate-700 outline-none focus:border-indigo-500 text-xs"
                    placeholder="Nome..."
                    value={newItem.vendedor}
                    onChange={e => setNewItem({...newItem, vendedor: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">O que fazer? (Descrição) *</label>
                <textarea 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-lg px-3 py-2 font-medium text-slate-600 outline-none focus:border-indigo-500 min-h-[60px] resize-none text-xs"
                  placeholder="Ex: Ligar para confirmar recebimento da proposta..."
                  value={newItem.descricao}
                  onChange={e => setNewItem({...newItem, descricao: e.target.value})}
                />
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 text-white font-black py-3 rounded-lg flex items-center justify-center gap-2 uppercase text-[9px] tracking-[0.15em] shadow-lg hover:bg-emerald-600 transition-all disabled:opacity-50 mt-1"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                Confirmar Agendamento
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FollowUpAgenda;
