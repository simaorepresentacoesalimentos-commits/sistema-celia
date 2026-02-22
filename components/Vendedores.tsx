
import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, Trash2, Edit2, Save, X, Loader2, Phone, Mail, AlertCircle, RefreshCw } from 'lucide-react';
import { Seller } from '../types';
import { dbService } from '../services/dbService';

const Vendedores: React.FC = () => {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Omit<Seller, 'id'>>({
    nome: '',
    email: '',
    telefone: '',
    status: 'Ativo'
  });

  const loadSellers = async () => {
    setLoading(true);
    try {
      const data = await dbService.getSellers();
      setSellers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSellers();
  }, []);

  const handleOpenModal = (seller?: Seller) => {
    if (seller) {
      setEditingId(seller.id);
      setFormData({
        nome: seller.nome,
        email: seller.email || '',
        telefone: seller.telefone || '',
        status: seller.status
      });
    } else {
      setEditingId(null);
      setFormData({ nome: '', email: '', telefone: '', status: 'Ativo' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) return alert("O nome é obrigatório.");

    setIsSubmitting(true);
    try {
      if (editingId) {
        await dbService.updateSeller(editingId, formData);
      } else {
        await dbService.addSeller(formData);
      }
      setIsModalOpen(false);
      await loadSellers();
    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Excluir vendedor "${nome}"?`)) return;
    try {
      await dbService.deleteSeller(id);
      await loadSellers();
    } catch (e: any) {
      alert("Erro ao excluir: " + e.message);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/20">
            <UserCheck size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 uppercase tracking-tighter">Equipe de Vendedores</h1>
            <p className="text-slate-500 text-[8px] font-medium uppercase tracking-widest">Gestão Comercial Nexus</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadSellers} className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-all">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-indigo-600 text-white px-5 py-2 rounded-xl flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/10"
          >
            <Plus size={14} /> Novo Vendedor
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-900 text-white font-medium uppercase text-[9px] tracking-widest">
                <th className="px-6 py-3">Vendedor</th>
                <th className="px-6 py-3">Contato</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sellers.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="py-10 text-center">
                    <AlertCircle size={32} className="mx-auto text-slate-200 mb-2" />
                    <p className="text-slate-400 font-medium uppercase tracking-widest italic text-[10px]">Nenhum vendedor cadastrado ainda.</p>
                  </td>
                </tr>
              )}
              {sellers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-6 py-3">
                    <div className="font-medium text-slate-800 text-sm uppercase leading-none mb-1">{s.nome}</div>
                    <div className="text-[8px] font-medium text-slate-400 uppercase tracking-widest">ID: {s.id.slice(0, 8)}</div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600">
                        <Mail size={12} className="text-indigo-500" /> {s.email || '---'}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-indigo-600">
                        <Phone size={12} /> {s.telefone || '---'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-medium uppercase tracking-widest ${
                      s.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleOpenModal(s)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDelete(s.id, s.nome)}
                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 transition-all animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-xl"><UserCheck size={24} /></div>
                <h3 className="text-xl font-black uppercase tracking-tighter">{editingId ? 'Editar Vendedor' : 'Novo Vendedor'}</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-white/20 hover:text-white"><X size={28} /></button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nome Completo *</label>
                <input 
                  required autoFocus
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black text-lg text-slate-800 outline-none focus:border-indigo-500 shadow-inner"
                  value={formData.nome}
                  onChange={e => setFormData({...formData, nome: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">E-mail</label>
                <input 
                  type="email"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:border-indigo-500 shadow-inner"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Telefone</label>
                <input 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:border-indigo-500 shadow-inner"
                  value={formData.telefone}
                  onChange={e => setFormData({...formData, telefone: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Status</label>
                <select 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black text-xs uppercase tracking-widest text-slate-800 outline-none focus:border-indigo-500"
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value as any})}
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </div>
              <button 
                type="submit" disabled={isSubmitting}
                className="w-full bg-indigo-600 text-white font-black py-6 rounded-[1.8rem] flex items-center justify-center gap-4 uppercase text-xs tracking-widest shadow-xl hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                {editingId ? 'Salvar Alterações' : 'Cadastrar Vendedor'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vendedores;
