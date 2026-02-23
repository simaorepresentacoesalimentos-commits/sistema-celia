
import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Users, ShoppingCart, 
  TrendingUp, Activity, Clock, 
  UserMinus, UserPlus, Search, CheckCircle2,
  FileSpreadsheet, Download,
  ClipboardList, DollarSign, FileText
} from 'lucide-react';
import { Customer, SaleOrder, FinanceiroReceber } from '../types';
import { dbService } from '../services/dbService';

type ReportTab = 'billing' | 'pending' | 'paid' | 'customers_base';

const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('billing');
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [financials, setFinancials] = useState<FinanceiroReceber[]>([]);
  
  const [filters, setFilters] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
    vendedor: '',
    customerStatus: 'todos',
  });

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [c, o, f] = await Promise.all([
        dbService.getCustomers(),
        dbService.getSaleOrders(),
        dbService.getFinanceiro()
      ]);
      setCustomers(c);
      setOrders(o);
      setFinancials(f);
    } catch (error) {
      console.error("Erro ao carregar dados dos relatórios:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatDateSafe = (dateStr: string) => {
    if (!dateStr) return '---';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const exportToCSV = (data: any[], fileName: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(';');
    const rows = data.map(obj => 
      Object.values(obj).map(val => `"${String(val).replace(/"/g, '""')}"`).join(';')
    ).join('\n');
    
    const csvContent = '\ufeff' + headers + '\n' + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName}_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadReport = () => {
    const reportContent = document.getElementById('printable-report')?.innerHTML;
    if (!reportContent) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório Nexus - ${new Date().toLocaleDateString()}</title>
        <style>
          @media print { .no-print { display: none; } }
          body { font-family: sans-serif; padding: 20px; color: #000; background: #fff; }
          h1 { font-size: 18px; margin-bottom: 5px; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 5px; }
          p.meta { font-size: 10px; margin-bottom: 20px; color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; font-size: 10px; word-break: break-word; }
          th { background-color: #f0f0f0; font-weight: bold; text-transform: uppercase; }
          .total-row { font-weight: bold; background-color: #f0f0f0; }
          .footer { margin-top: 30px; text-align: center; font-size: 9px; color: #666; border-top: 1px dashed #ccc; padding-top: 10px; }
        </style>
      </head>
      <body>
        <h1>Nexus Business Intelligence - Relatório de ${activeTab === 'customers_base' ? 'Clientes (Filtro: Status ' + filters.customerStatus.toUpperCase() + ' / Vendedor: ' + (filters.vendedor || 'TODOS') + ')' : activeTab}</h1>
        <p class="meta">Extraído em: ${new Date().toLocaleString()} | Período: ${formatDateSafe(filters.start)} até ${formatDateSafe(filters.end)}</p>
        ${reportContent}
        <div class="footer">Documento gerado pelo Sistema Nexus Sales - Impressão Econômica Otimizada</div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Nexus_Relatorio_${activeTab}_${new Date().getTime()}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredOrders = orders
    .filter(o => {
      const dateMatch = o.data_pedido >= filters.start && o.data_pedido <= filters.end;
      const sellerMatch = !filters.vendedor || o.vendedor.toLowerCase() === filters.vendedor.toLowerCase();
      return dateMatch && sellerMatch;
    })
    .sort((a, b) => a.data_pedido.localeCompare(b.data_pedido));

  const filteredFinancials = financials
    .filter(f => {
      const sellerMatch = !filters.vendedor || f.vendedor.toLowerCase() === filters.vendedor.toLowerCase();
      return sellerMatch;
    })
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));

  const paidFinancials = filteredFinancials
    .filter(f => f.status === 'pago' && f.data_pagamento && f.data_pagamento >= filters.start && f.data_pagamento <= filters.end)
    .sort((a, b) => (a.data_pagamento || '').localeCompare(b.data_pagamento || ''));

  const filteredCustomers = customers.filter(c => {
    const statusMatch = filters.customerStatus === 'todos' || (c.status || '').toLowerCase() === filters.customerStatus.toLowerCase();
    const sellerMatch = !filters.vendedor || (c.vendedor || '').toLowerCase() === filters.vendedor.toLowerCase();
    return statusMatch && sellerMatch;
  });

  const renderTabButton = (id: ReportTab, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-6 py-4 border-b-2 font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${
        activeTab === id 
          ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' 
          : 'border-transparent text-slate-400 hover:text-slate-600'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  const ActionButtons = ({ data, name }: { data: any[], name: string }) => (
    <div className="flex gap-2 no-print">
      <button 
        onClick={() => exportToCSV(data, name)}
        className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-emerald-100 transition-all border border-emerald-100 shadow-sm"
      >
        <FileSpreadsheet size={12}/> Excel
      </button>
      <button 
        onClick={handleDownloadReport}
        className="flex items-center gap-1 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-slate-800 transition-all shadow-md"
      >
        <Download size={12}/> Gerar PDF para Impressão
      </button>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center no-print">
        <div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Nexus BI Reports</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Inteligência de Vendas e Fluxo de Caixa</p>
        </div>
        <button onClick={loadAllData} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm">
          <Activity size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end no-print">
        <div className="flex-1 min-w-[150px]">
          <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Início</label>
          <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-600 outline-none"
            value={filters.start} onChange={e => setFilters({...filters, start: e.target.value})} />
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Fim</label>
          <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-600 outline-none"
            value={filters.end} onChange={e => setFilters({...filters, end: e.target.value})} />
        </div>
        
        {activeTab === 'customers_base' ? (
          <>
            <div className="flex-1 min-w-[180px]">
              <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Filtrar por Status</label>
              <select 
                className="w-full bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2 font-black text-indigo-600 outline-none uppercase text-[10px]"
                value={filters.customerStatus}
                onChange={e => setFilters({...filters, customerStatus: e.target.value})}
              >
                <option value="todos">Todos os Status</option>
                <option value="Ativo">Apenas Ativos</option>
                <option value="Inativo">Apenas Inativos</option>
                <option value="Prospecção">Apenas Prospecção</option>
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Vendedor</label>
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-black text-slate-600 outline-none uppercase text-[10px]"
                value={filters.vendedor}
                onChange={e => setFilters({...filters, vendedor: e.target.value})}
              >
                <option value="">Todos os Vendedores</option>
                {Array.from(new Set(customers.map(c => c.vendedor).filter(v => v))).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </>
        ) : (
          <div className="flex-1 min-w-[200px]">
            <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Vendedor</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-600 outline-none"
              value={filters.vendedor}
              onChange={e => setFilters({...filters, vendedor: e.target.value})}
            >
              <option value="">Todos</option>
              {Array.from(new Set(orders.map(o => o.vendedor))).map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-100 bg-slate-50/50 no-print">
          {renderTabButton('billing', 'Faturamento', <ShoppingCart size={16}/>)}
          {renderTabButton('pending', 'Pendentes', <Clock size={16}/>)}
          {renderTabButton('paid', 'Comissões', <CheckCircle2 size={16}/>)}
          {renderTabButton('customers_base', 'Lista de Clientes', <Users size={16}/>)}
        </div>

        <div className="p-8" id="printable-report">
          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center no-print">
                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Faturamento Detalhado</h4>
                <ActionButtons data={filteredOrders.map(o => ({ Data: o.data_pedido, Cliente: o.cliente_nome, Vendedor: o.vendedor, Total: o.total_pedido }))} name="Faturamento" />
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Vendedor</th>
                    <th className="px-6 py-4 text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map(o => (
                    <tr key={o.id} className="text-xs">
                      <td className="px-6 py-4 font-bold text-slate-500">{formatDateSafe(o.data_pedido)}</td>
                      <td className="px-6 py-4 font-black text-slate-800 uppercase">{o.cliente_nome}</td>
                      <td className="px-6 py-4 text-[10px] font-black text-indigo-500 uppercase">{o.vendedor}</td>
                      <td className="px-6 py-4 text-right font-black">{formatCurrency(o.total_pedido)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="total-row bg-slate-900 text-white font-black">
                    <td colSpan={2} className="px-6 py-5 text-[10px] uppercase">Totais do Período</td>
                    <td className="px-6 py-5 text-center">{filteredOrders.length} Vendas</td>
                    <td className="px-6 py-5 text-right text-lg">{formatCurrency(filteredOrders.reduce((acc, o) => acc + o.total_pedido, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {activeTab === 'paid' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center no-print">
                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Comissões Recebidas</h4>
                <ActionButtons data={paidFinancials} name="Comissoes" />
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-900 text-[10px] uppercase font-black text-indigo-300">
                    <th className="px-6 py-4">Pagtº</th>
                    <th className="px-6 py-4">Cliente / Vendedor</th>
                    <th className="px-6 py-4 text-right">Bruto</th>
                    <th className="px-6 py-4 text-right">Repasse</th>
                    <th className="px-6 py-4 text-right">Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paidFinancials.map(f => (
                    <tr key={f.id} className="text-xs">
                      <td className="px-6 py-4 font-bold text-slate-500">{formatDateSafe(f.data_pagamento!)}</td>
                      <td className="px-6 py-4">
                        <div className="font-black text-slate-800 uppercase">{f.cliente_nome}</div>
                        <div className="text-[9px] font-black text-indigo-500 uppercase">{f.vendedor}</div>
                      </td>
                      <td className="px-6 py-4 text-right font-bold">{formatCurrency(f.comissao_valor)}</td>
                      <td className="px-6 py-4 text-right text-rose-600 font-bold">{formatCurrency(f.repasse_valor)}</td>
                      <td className="px-6 py-4 text-right text-emerald-600 font-black">{formatCurrency(f.comissao_valor - f.repasse_valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Resumo Estilizado conforme Dashboard */}
              <div className="mt-12 flex justify-end">
                <div className="w-full max-w-xs space-y-3">
                  {(() => {
                    const totalFaturamento = filteredOrders.reduce((acc, o) => acc + o.total_pedido, 0);
                    const totalLucro = paidFinancials.reduce((acc, f) => acc + f.comissao_valor, 0);
                    const totalDescontos = paidFinancials.reduce((acc, f) => acc + f.repasse_valor, 0);
                    const totalGanhos = totalLucro - totalDescontos;

                    return (
                      <>
                        <div className="flex items-center justify-between gap-8">
                          <div className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg font-bold text-[10px] min-w-[140px] text-center uppercase tracking-wider shadow-sm">Faturamento:</div>
                          <div className="text-indigo-600 font-bold text-sm">{formatCurrency(totalFaturamento)}</div>
                        </div>
                        <div className="flex items-center justify-between gap-8">
                          <div className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg font-bold text-[10px] min-w-[140px] text-center uppercase tracking-wider shadow-sm">Lucro Bruto:</div>
                          <div className="text-indigo-600 font-bold text-sm">{formatCurrency(totalLucro)}</div>
                        </div>
                        <div className="flex items-center justify-between gap-8">
                          <div className="bg-rose-500 text-white px-4 py-1.5 rounded-lg font-bold text-[10px] min-w-[140px] text-center uppercase tracking-wider shadow-sm">Descontos:</div>
                          <div className="text-rose-500 font-bold text-sm">{formatCurrency(totalDescontos)}</div>
                        </div>
                        <div className="flex items-center justify-between gap-8">
                          <div className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg font-bold text-[10px] min-w-[140px] text-center uppercase tracking-wider shadow-sm">Ganhos Célia:</div>
                          <div className="text-emerald-500 font-bold text-sm">{formatCurrency(totalGanhos)}</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pending' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center no-print">
                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Boletos Pendentes</h4>
                <ActionButtons data={filteredFinancials.filter(f => f.status === 'pendente')} name="Pendentes" />
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
                    <th className="px-6 py-4">Vencimento</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Vendedor</th>
                    <th className="px-6 py-4 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFinancials.filter(f => f.status === 'pendente').map(f => (
                    <tr key={f.id} className="text-xs">
                      <td className="px-6 py-4 font-bold text-slate-500">{formatDateSafe(f.data_vencimento)}</td>
                      <td className="px-6 py-4 font-black text-slate-800 uppercase">{f.cliente_nome}</td>
                      <td className="px-6 py-4 text-[10px] font-black text-indigo-500 uppercase">{f.vendedor}</td>
                      <td className="px-6 py-4 text-right font-black">{formatCurrency(f.valor)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="total-row bg-amber-500 text-white font-black">
                    <td colSpan={3} className="px-6 py-4 uppercase text-[10px]">Total de Recebíveis em Aberto</td>
                    <td className="px-6 py-4 text-right text-xl">{formatCurrency(filteredFinancials.filter(f => f.status === 'pendente').reduce((acc, f) => acc + f.valor, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {activeTab === 'customers_base' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center no-print">
                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Base de Clientes ({filters.customerStatus} / {filters.vendedor || 'Todos Vendedores'})</h4>
                <ActionButtons data={filteredCustomers.map(({ anotacoes, ...rest }) => rest)} name="Clientes_Filtrados" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[1000px]">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] uppercase font-black text-slate-400">
                      <th className="px-4 py-3">Nome Fantasia</th>
                      <th className="px-4 py-3">CNPJ / CPF</th>
                      <th className="px-4 py-3">Cidade</th>
                      <th className="px-4 py-3">Telefones</th>
                      <th className="px-4 py-3">Contato</th>
                      <th className="px-4 py-3">Vendedor</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Última Compra</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCustomers.sort((a,b) => a.name.localeCompare(b.name)).map(c => (
                      <tr key={c.id} className="text-[11px] hover:bg-slate-50">
                        <td className="px-4 py-3 font-black text-slate-800 uppercase">{c.name}</td>
                        <td className="px-4 py-3 font-medium text-slate-500">{c.cnpj || '---'}</td>
                        <td className="px-4 py-3 font-medium text-slate-500 uppercase">{c.cidade}</td>
                        <td className="px-4 py-3">
                           <div className="font-bold">{c.telefone}</div>
                           <div className="text-slate-400">{c.telefone_secundario}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-500 uppercase">{c.contato}</td>
                        <td className="px-4 py-3 font-black text-indigo-500 uppercase">{c.vendedor}</td>
                        <td className="px-4 py-3">
                           <span className={`font-black uppercase ${c.status === 'Ativo' ? 'text-emerald-600' : c.status === 'Inativo' ? 'text-rose-600' : 'text-amber-600'}`}>{c.status}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-500">{c.ultima_compra ? formatDateSafe(c.ultima_compra) : 'Sem registro'}</td>
                      </tr>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-20 text-center text-slate-400 font-black uppercase tracking-widest">Nenhum cliente encontrado com os filtros selecionados</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
