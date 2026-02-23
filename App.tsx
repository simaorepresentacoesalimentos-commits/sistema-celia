import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import SalesForm from './components/SalesForm';
import Financeiro from './components/Financeiro';
import Reports from './components/Reports';
import SystemSettings from './components/SystemSettings';
import RestoreBackup from './components/RestoreBackup';
import AgendaVendas from './components/AgendaVendas';
import Vendedores from './components/Vendedores';
import { View, Product, Customer, SaleOrder, FinanceiroReceber, Seller } from './types';
import { 
  Plus, X, Edit2, Trash2, ShoppingCart, Loader2, Save, CheckCircle2, AlertCircle, Search, Phone, User, MapPin, Database, ShieldAlert, Calendar
} from 'lucide-react';
import { dbService } from './services/dbService';
import { backupService } from './services/backupService';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [salesOrders, setSalesOrders] = useState<SaleOrder[]>([]);
  const [financials, setFinancials] = useState<FinanceiroReceber[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<{id: string, name: string} | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<{id: string, clientName: string} | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<SaleOrder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [backupAtrasado, setBackupAtrasado] = useState(false);
  
  const [searchTermCustomers, setSearchTermCustomers] = useState('');
  const [searchTermSales, setSearchTermSales] = useState('');
  
  const [newCustomer, setNewCustomer] = useState<Omit<Customer, 'id'>>({
    name: '', cnpj: '', cidade: '', telefone: '', telefone_secundario: '',
    contato: '', vendedor: '', status: 'Ativo', ultima_compra: '', anotacoes: ''
  });

  const checkBackupStatus = () => {
    const lastBackup = localStorage.getItem('nexus_last_backup_timestamp');
    if (!lastBackup) {
      setBackupAtrasado(true);
      return;
    }
    const lastDate = new Date(parseInt(lastBackup));
    const now = new Date();
    const diffTime = now.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    setBackupAtrasado(diffDays >= 7);
  };

  const handleManualBackup = async () => {
    try {
      setIsSubmitting(true);
      await backupService.runFullBackup();
      const now = new Date().getTime();
      localStorage.setItem('nexus_last_backup_timestamp', now.toString());
      localStorage.setItem('nexus_last_backup', new Date().toLocaleString('pt-BR'));
      setBackupAtrasado(false);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (e) {
      alert("Erro ao realizar backup.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    checkBackupStatus();
    const interval = setInterval(checkBackupStatus, 3600000);
    return () => clearInterval(interval);
  }, []);

  const formatCNPJ = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 11) {
      return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return digits.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 10) {
      return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
    }
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [custData, ordersData, financialData, sellerData] = await Promise.all([
        dbService.getCustomers(),
        dbService.getSaleOrders(),
        dbService.getFinanceiro(),
        dbService.getSellers()
      ]);
      setCustomers(custData || []);
      const sortedOrders = (ordersData || []).sort((a, b) => b.data_pedido.localeCompare(a.data_pedido));
      setSalesOrders(sortedOrders);
      setFinancials(financialData || []);
      setSellers(sellerData || []);
      checkBackupStatus();
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = (customer?: Customer) => {
    setModalError(null);
    if (customer) {
      setEditingCustomerId(customer.id);
      setNewCustomer({ ...customer, ultima_compra: customer.ultima_compra || '' });
    } else {
      setEditingCustomerId(null);
      setNewCustomer({
        name: '', cnpj: '', cidade: '', telefone: '', telefone_secundario: '',
        contato: '', vendedor: '', status: 'Ativo', ultima_compra: '', anotacoes: ''
      });
    }
    setIsCustomerModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!newCustomer.name.trim()) {
      setModalError("O nome é obrigatório.");
      return;
    }
    setIsSubmitting(true);
    try {
      // Sanitização para garantir que datas vazias sejam enviadas como null
      const customerToSave = {
        ...newCustomer,
        ultima_compra: newCustomer.ultima_compra && newCustomer.ultima_compra.trim() !== "" ? newCustomer.ultima_compra : null
      };

      if (editingCustomerId) {
        await dbService.updateCustomer(editingCustomerId, customerToSave);
      } else {
        await dbService.addCustomer(customerToSave);
      }
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      setIsCustomerModalOpen(false);
      await loadData();
    } catch (error: any) {
      setModalError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const performDelete = async () => {
    if (!customerToDelete) return;
    setIsSubmitting(true);
    try {
      await dbService.deleteCustomer(customerToDelete.id);
      setCustomerToDelete(null);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      await loadData();
    } catch (error: any) {
      alert(`Erro ao excluir: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const performDeleteOrder = async () => {
    if (!orderToDelete) return;
    setIsSubmitting(true);
    try {
      await dbService.deleteSaleOrder(orderToDelete.id);
      setOrderToDelete(null);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      await loadData();
    } catch (error: any) {
      alert(`Erro ao excluir pedido: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateSafe = (dateStr: string) => {
    if (!dateStr) return '---';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const renderContent = () => {
    if (loading) return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
        <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Sincronizando Banco Nexus...</p>
      </div>
    );

    switch(currentView) {
      case 'agenda': return <AgendaVendas />;
      case 'sellers': return <Vendedores />;
      case 'customers':
        const filteredCustomers = customers.filter(c => 
          (c.name || '').toLowerCase().includes(searchTermCustomers.toLowerCase()) ||
          (c.cnpj || '').toLowerCase().includes(searchTermCustomers.toLowerCase()) ||
          (c.contato || '').toLowerCase().includes(searchTermCustomers.toLowerCase())
        );
        return (
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
              <div className="shrink-0">
                <h2 className="text-lg font-bold text-slate-800 uppercase tracking-tighter">Gerenciamento de Clientes</h2>
                <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Base de dados unificada</p>
              </div>
              
              <div className="flex-1 max-w-xs w-full relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  type="text"
                  placeholder="BUSCAR NOME, CNPJ OU CONTATO..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-2 font-medium text-[9px] uppercase tracking-widest outline-none focus:border-indigo-500 transition-all shadow-sm"
                  value={searchTermCustomers}
                  onChange={e => setSearchTermCustomers(e.target.value)}
                />
              </div>
              
              <button onClick={() => handleOpenModal()} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/10">
                <Plus size={14} /> Novo Cadastro
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-900 text-white font-medium uppercase text-[9px] tracking-widest">
                    <th className="px-4 py-3">Cliente / Documento</th>
                    <th className="px-4 py-3">Cidade</th>
                    <th className="px-4 py-3">Vendedor</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center">
                        <AlertCircle size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-slate-400 font-black uppercase tracking-widest italic">Nenhum cliente encontrado para esta busca.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-4 py-4">
                          <div className="font-bold text-slate-800 text-[12px] uppercase">{c.name}</div>
                          <div className="text-[12px] text-slate-400 font-bold uppercase tracking-widest">
                            {c.cnpj || 'Sem Documento'} {c.contato ? `• ${c.contato}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-500 font-bold text-[12px] uppercase">{c.cidade}</td>
                        <td className="px-4 py-4"><span className="text-indigo-600 font-bold text-[12px] uppercase bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">{c.vendedor}</span></td>
                        <td className="px-4 py-4"><span className={`px-3 py-1 rounded-lg text-[12px] font-bold uppercase ${c.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{c.status}</span></td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenModal(c)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Edit2 size={14}/></button>
                            <button onClick={() => setCustomerToDelete({id: c.id, name: c.name})} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={14}/></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'new_sale':
        return <SalesForm onSuccess={() => { setEditingOrder(null); setCurrentView('sales_list'); loadData(); }} initialData={editingOrder} sellersList={sellers} />;
      case 'sales_list':
        const filteredSales = salesOrders.filter(o => {
          const search = searchTermSales.toLowerCase();
          const clientName = (o.cliente_nome || 'Consumidor').toLowerCase();
          const orderDate = formatDateSafe(o.data_pedido);
          return clientName.includes(search) || orderDate.includes(search) || o.data_pedido.includes(search);
        });
        return (
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
              <div className="shrink-0">
                <h2 className="text-lg font-bold text-slate-800 uppercase tracking-tighter">Pedidos Realizados</h2>
                <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Histórico de Movimentações</p>
              </div>
              <div className="flex-1 max-w-xs w-full relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  type="text"
                  placeholder="BUSCAR CLIENTE OU DATA..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-2 font-medium text-[9px] uppercase tracking-widest outline-none focus:border-indigo-500 transition-all shadow-sm"
                  value={searchTermSales}
                  onChange={e => setSearchTermSales(e.target.value)}
                />
              </div>
              <button onClick={() => { setEditingOrder(null); setCurrentView('new_sale'); }} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/10">
                <ShoppingCart size={14} /> Novo Pedido
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-900 text-white font-medium text-[9px] uppercase tracking-widest">
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Vendedor</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center">
                        <AlertCircle size={32} className="mx-auto text-slate-200 mb-2" />
                        <p className="text-slate-400 font-medium uppercase tracking-widest italic text-[10px]">Nenhum pedido encontrado.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map(o => (
                      <tr key={o.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-4 py-4 font-bold text-xs uppercase tracking-wider text-slate-500">{formatDateSafe(o.data_pedido)}</td>
                        <td className="px-4 py-4 font-bold text-xs uppercase tracking-wider text-slate-800">{o.cliente_nome || 'Consumidor'}</td>
                        <td className="px-4 py-4 font-bold text-xs uppercase tracking-wider text-indigo-600">{o.vendedor}</td>
                        <td className="px-4 py-4 font-bold text-xs uppercase tracking-wider text-slate-900">R$ {o.total_pedido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingOrder(o); setCurrentView('new_sale'); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Edit2 size={14}/></button>
                            <button onClick={() => setOrderToDelete({id: o.id!, clientName: o.cliente_nome || 'Consumidor'})} className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'financeiro': return <Financeiro />;
      case 'reports': return <Reports />;
      case 'system': return <SystemSettings />;
      case 'restore': return <RestoreBackup />;
      default: return <Dashboard products={products} orders={salesOrders} financials={financials} sellers={sellers} />;
    }
  };

  return (
    <div className="min-h-screen flex bg-[#f1f5f9] text-slate-900 font-sans selection:bg-indigo-100">
      <Sidebar currentView={currentView} setView={setCurrentView} />
      <main className="flex-1 ml-64 p-8 relative">
        {backupAtrasado && (
          <div className="mb-6 bg-rose-600 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between gap-4 animate-in slide-in-from-top duration-300 border-b-2 border-rose-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-xl border border-white/20">
                <ShieldAlert size={24} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight leading-tight">Backup Necessário!</h3>
                <p className="text-[10px] font-black text-rose-100 uppercase tracking-widest opacity-80">Última cópia há mais de 7 dias.</p>
              </div>
            </div>
            <button 
              onClick={handleManualBackup}
              disabled={isSubmitting}
              className="bg-white text-rose-600 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md hover:bg-slate-50 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Database size={16} />}
              Exportar Agora
            </button>
          </div>
        )}

        {showSuccessToast && (
          <div className="fixed top-8 right-8 bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300 z-[200]">
            <CheckCircle2 size={24} />
            <span className="font-black uppercase text-xs tracking-widest">Operação Realizada com Sucesso</span>
          </div>
        )}
        {renderContent()}
      </main>

      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold uppercase tracking-tighter">{editingCustomerId ? 'Editar Cliente' : 'Novo Cadastro'}</h3>
                <p className="text-[8px] font-medium text-indigo-400 uppercase tracking-widest mt-0.5">Gestão de Dados Nexus</p>
              </div>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-white/20 hover:text-white transition-all"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[85vh] overflow-y-auto custom-scrollbar">
              {modalError && <div className="p-3 bg-rose-50 text-rose-600 rounded-xl flex items-center gap-2 text-[10px] font-bold uppercase border border-rose-100 animate-bounce"><AlertCircle size={16} /> {modalError}</div>}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-1 flex items-center gap-2"><User size={12}/> Identificação</h4>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">Nome Fantasia / Razão Social *</label>
                    <input required className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 font-medium text-slate-700 outline-none focus:border-indigo-500 shadow-inner text-sm" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">CNPJ / CPF</label>
                    <input className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 font-medium text-slate-700 outline-none focus:border-indigo-500 shadow-inner text-sm" value={newCustomer.cnpj} onChange={e => setNewCustomer({...newCustomer, cnpj: formatCNPJ(e.target.value)})} placeholder="00.000.000/0000-00" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">Cidade</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                      <input className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-2.5 font-medium text-slate-700 outline-none focus:border-indigo-500 shadow-inner text-sm" value={newCustomer.cidade} onChange={e => setNewCustomer({...newCustomer, cidade: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">Vendedor</label>
                      <select className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-slate-800 outline-none focus:border-indigo-500 shadow-sm" value={newCustomer.vendedor} onChange={e => setNewCustomer({...newCustomer, vendedor: e.target.value})}>
                        <option value="">Selecione...</option>
                        {sellers.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">Última Compra</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                        <input type="date" className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-3 py-2.5 font-medium text-slate-700 outline-none focus:border-indigo-500 shadow-inner text-sm" value={newCustomer.ultima_compra || ''} onChange={e => setNewCustomer({...newCustomer, ultima_compra: e.target.value})} />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-1 flex items-center gap-2"><Phone size={12}/> Comunicação</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">Telefone</label>
                      <input className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 font-medium text-slate-700 outline-none focus:border-indigo-500 shadow-inner text-sm" value={newCustomer.telefone} onChange={e => setNewCustomer({...newCustomer, telefone: formatPhone(e.target.value)})} placeholder="(00) 00000-0000" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">WhatsApp</label>
                      <input className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 font-medium text-slate-700 outline-none focus:border-indigo-500 shadow-inner text-sm" value={newCustomer.telefone_secundario} onChange={e => setNewCustomer({...newCustomer, telefone_secundario: formatPhone(e.target.value)})} placeholder="(00) 00000-0000" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">Pessoa de Contato</label>
                    <input className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 font-medium text-slate-700 outline-none focus:border-indigo-500 shadow-inner text-sm" value={newCustomer.contato} onChange={e => setNewCustomer({...newCustomer, contato: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">Status</label>
                    <select className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 font-bold text-[10px] uppercase tracking-widest text-slate-800 outline-none focus:border-indigo-500" value={newCustomer.status} onChange={e => setNewCustomer({...newCustomer, status: e.target.value})}>
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                      <option value="Bloqueado">Bloqueado</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">Anotações</label>
                <textarea className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 font-medium text-slate-600 outline-none focus:border-indigo-500 min-h-[80px] resize-none shadow-inner text-sm" placeholder="Histórico ou observações..." value={newCustomer.anotacoes} onChange={e => setNewCustomer({...newCustomer, anotacoes: e.target.value})} />
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-emerald-600 transition-all disabled:opacity-50 active:scale-95 group">
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} className="group-hover:rotate-12 transition-transform" />}
                {editingCustomerId ? 'Salvar Alterações' : 'Registrar Cliente'}
              </button>
            </form>
          </div>
        </div>
      )}

      {customerToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full text-center border border-slate-100 shadow-2xl">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={48} />
            </div>
            <h3 className="text-xl font-black uppercase text-slate-800 mb-2">Excluir Registro?</h3>
            <p className="text-slate-500 font-medium mb-8">Tem certeza que deseja apagar o cliente <span className="font-bold text-slate-900">{customerToDelete.name}</span>?</p>
            <div className="flex gap-4">
              <button onClick={() => setCustomerToDelete(null)} className="flex-1 py-4 font-black uppercase text-xs tracking-widest text-slate-400 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all">Cancelar</button>
              <button onClick={performDelete} className="flex-1 py-4 font-black uppercase text-xs tracking-widest text-white bg-rose-500 rounded-2xl shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {orderToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full text-center border border-slate-100 shadow-2xl">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={48} />
            </div>
            <h3 className="text-xl font-black uppercase text-slate-800 mb-2">Remover Pedido</h3>
            <p className="text-slate-500 font-medium mb-8">Deseja remover o pedido de <span className="font-bold text-slate-900">{orderToDelete.clientName}</span>?</p>
            <div className="flex gap-4">
              <button onClick={() => setOrderToDelete(null)} className="flex-1 py-4 font-black uppercase text-xs tracking-widest text-slate-400 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all">Voltar</button>
              <button onClick={performDeleteOrder} className="flex-1 py-4 font-black uppercase text-xs tracking-widest text-white bg-rose-500 rounded-2xl shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all">Remover</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
