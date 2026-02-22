
import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Calendar, RefreshCw, CheckCircle2, 
  Clock, AlertCircle, TrendingUp, Users, Search, ArrowRightLeft, Wallet, ArrowUpRight,
  HandCoins, Loader2
} from 'lucide-react';
import { FinanceiroReceber } from '../types';
import { dbService } from '../services/dbService';

const Financeiro: React.FC = () => {
  const [data, setData] = useState<FinanceiroReceber[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  const loadFinanceiro = async () => {
    try {
      setLoading(true);
      const res = await dbService.getFinanceiro();
      setData(res || []);
    } catch (error) {
      console.error("Financeiro: Erro ao carregar dados", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinanceiro();
  }, []);

  const handleMarcarComoPago = async (id: string) => {
    const targetId = String(id);
    if (!targetId) return;

    // 1. BACKUP PARA ROLLBACK (Caso o banco falhe)
    const previousData = [...data];
    
    // 2. GERAÇÃO DA DATA DE PAGAMENTO
    const hoje = new Date();
    const offset = hoje.getTimezoneOffset() * 60000;
    const dataPagamentoStr = new Date(hoje.getTime() - offset).toISOString().split('T')[0];

    // 3. ATUALIZAÇÃO OTIMISTA (MUDANÇA INSTANTÂNEA NA TELA)
    // Isso remove o botão e mostra "Liquidado" na hora que clica, sem esperar.
    setData(current => current.map(item => 
      String(item.id) === targetId 
        ? { ...item, status: 'pago' as any, data_pagamento: dataPagamentoStr } 
        : item
    ));

    try {
      // 4. ATUALIZAÇÃO NO BANCO EM SEGUNDO PLANO
      await dbService.updateFinanceiroStatus(targetId, 'pago', dataPagamentoStr);
      console.log("Financeiro: Baixa processada com sucesso no servidor.");
    } catch (error: any) {
      // 5. REVERTE SE DER ERRO NO BANCO
      console.error("Financeiro: Erro ao salvar no banco, revertendo estado local.", error);
      setData(previousData);
      alert(`❌ Erro no Servidor: Não foi possível processar a baixa. Verifique sua conexão. (${error.message})`);
    }
  };

  const formatDateSafe = (dateStr: string) => {
    if (!dateStr) return '---';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  
  const firstDayCurrent = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDayCurrent = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const firstDayNext = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];
  const lastDayNext = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split('T')[0];

  const itensPagos = data.filter(i => i.status === 'pago');
  const faturamentoLiquidado = itensPagos.reduce((acc, i) => acc + Number(i.valor || 0), 0);
  const repassePago = itensPagos.reduce((acc, i) => acc + Number(i.repasse_valor || 0), 0);
  const comissaoPaga = itensPagos.reduce((acc, i) => acc + Number(i.comissao_valor || 0), 0);
  const saldoComissaoLiquido = comissaoPaga - repassePago;

  const itensPendentes = data.filter(i => i.status === 'pendente');
  const totalRepassePendente = itensPendentes.reduce((acc, i) => acc + Number(i.repasse_valor || 0), 0);

  const itensMes = itensPendentes.filter(i => i.data_vencimento >= firstDayCurrent && i.data_vencimento <= lastDayCurrent);
  const prevReceberMes = itensMes.reduce((acc, i) => acc + Number(i.valor || 0), 0);
  const prevRepasseMes = itensMes.reduce((acc, i) => acc + Number(i.repasse_valor || 0), 0);

  const itensProxMes = itensPendentes.filter(i => i.data_vencimento >= firstDayNext && i.data_vencimento <= lastDayNext);
  const prevReceberProx = itensProxMes.reduce((acc, i) => acc + Number(i.valor || 0), 0);
  const prevRepasseProx = itensProxMes.reduce((acc, i) => acc + Number(i.repasse_valor || 0), 0);

  const filteredData = data.filter(item => {
    const matchesSearch = (item.cliente_nome || '').toLowerCase().includes(filterText.toLowerCase()) || 
                          (item.vendedor || '').toLowerCase().includes(filterText.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || item.status === statusFilter;
    const isAtrasado = statusFilter === 'atrasado' && item.status === 'pendente' && item.data_vencimento < todayStr;
    
    if (statusFilter === 'atrasado') return isAtrasado && matchesSearch;
    return matchesStatus && matchesSearch;
  }).sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-800 uppercase tracking-tighter">Fluxo de Caixa & Gestão Financeira</h1>
          <p className="text-slate-500 text-base font-bold uppercase tracking-widest mt-1">Monitoramento de Faturamento e Previsões de Repasse</p>
        </div>
        <button 
          onClick={loadFinanceiro} 
          disabled={loading}
          className="flex items-center gap-3 bg-white border-2 border-slate-200 px-8 py-4 rounded-2xl text-slate-700 font-black uppercase text-sm hover:border-indigo-500 transition-all shadow-md active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          Sincronizar Banco
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5">
        <div className="bg-emerald-600 p-7 rounded-[2.5rem] text-white shadow-2xl flex flex-col justify-between min-h-[180px] border-b-8 border-emerald-700">
          <p className="text-sm font-black text-emerald-100 uppercase tracking-widest mb-1">Faturamento Liquidado</p>
          <h4 className="text-4xl font-black tracking-tighter">R$ {faturamentoLiquidado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
          <p className="text-xs font-bold text-emerald-200 mt-2 uppercase tracking-wide">Total já recebido (Vendas)</p>
        </div>

        <div className="bg-slate-900 p-7 rounded-[2.5rem] text-white shadow-2xl border-b-8 border-indigo-600 flex flex-col justify-between min-h-[180px]">
          <p className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-1 flex items-center gap-2"><TrendingUp size={18}/> Comissão Líquida</p>
          <h4 className="text-4xl font-black text-white tracking-tighter">R$ {saldoComissaoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
          <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">Lucro real apurado</p>
        </div>

        <div className="bg-amber-600 p-7 rounded-[2.5rem] text-white shadow-2xl border-b-8 border-amber-700 flex flex-col justify-between min-h-[180px]">
          <p className="text-sm font-black text-amber-100 uppercase tracking-widest mb-1 flex items-center gap-2"><ArrowRightLeft size={18}/> Repasse Previsto</p>
          <h4 className="text-4xl font-black text-white tracking-tighter">R$ {totalRepassePendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
          <p className="text-xs font-bold text-amber-100 mt-2 uppercase tracking-widest">Compromissos Pendentes</p>
        </div>

        <div className="bg-white p-7 rounded-[2.5rem] border-2 border-slate-100 shadow-xl flex flex-col justify-between min-h-[180px]">
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">Prev. Mês Atual <Calendar size={18}/></p>
          <h4 className="text-4xl font-black text-slate-800 tracking-tighter">R$ {prevReceberMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
          <div className="pt-2 border-t border-slate-50 flex justify-between items-center">
             <span className="text-[10px] font-bold text-slate-400 uppercase">Repasse:</span>
             <span className="text-sm font-black text-amber-500">R$ {prevRepasseMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="bg-indigo-50 p-7 rounded-[2.5rem] border-2 border-indigo-100 shadow-xl flex flex-col justify-between min-h-[180px]">
          <p className="text-sm font-black text-indigo-500 uppercase tracking-widest mb-1 flex items-center gap-2">Próximo Mês <ArrowUpRight size={18}/></p>
          <h4 className="text-4xl font-black text-indigo-900 tracking-tighter">R$ {prevReceberProx.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
          <div className="pt-2 border-t border-indigo-100 flex justify-between items-center">
             <span className="text-[10px] font-bold text-indigo-400 uppercase">Repasse:</span>
             <span className="text-sm font-black text-amber-500">R$ {prevRepasseProx.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-md border border-slate-100 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por cliente ou vendedor..." 
            className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-12 pr-4 py-2.5 font-medium text-sm outline-none focus:border-indigo-400 transition-all shadow-inner"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5">
          {['todos', 'pendente', 'atrasado', 'pago'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-5 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm ${
                statusFilter === status 
                ? 'bg-slate-900 text-white shadow-lg scale-105' 
                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-900 text-white font-medium uppercase text-[9px] tracking-widest">
                <th className="px-6 py-4">Cliente / Vendedor</th>
                <th className="px-6 py-4">Vencimento</th>
                <th className="px-6 py-4">Valor Parcela</th>
                <th className="px-6 py-4">Repasse / Lucro</th>
                <th className="px-6 py-4 text-right">Controle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map((item) => {
                const isOverdue = item.status === 'pendente' && item.data_vencimento < todayStr;
                
                return (
                  <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${isOverdue ? 'bg-rose-50/60' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-sm text-slate-800 uppercase leading-none mb-1">{item.cliente_nome || 'Consumidor'}</div>
                      <div className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">{item.vendedor}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`font-medium text-xs ${isOverdue ? 'text-rose-600 animate-pulse' : 'text-slate-600'}`}>
                        {formatDateSafe(item.data_vencimento)}
                      </div>
                      {isOverdue && <span className="text-[8px] font-bold uppercase text-rose-500 tracking-tighter">Vencido</span>}
                    </td>
                    <td className="px-6 py-4 font-medium text-base text-slate-900 tabular-nums">
                      R$ {Number(item.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[10px] font-medium text-amber-500 uppercase tracking-tighter flex items-center gap-1">
                        <HandCoins size={12}/> Repasse: R$ {Number(item.repasse_valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] font-medium text-emerald-600 uppercase tracking-tighter flex items-center gap-1">
                        <TrendingUp size={12}/> Lucro: R$ {(Number(item.comissao_valor || 0) - Number(item.repasse_valor || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {item.status !== 'pago' ? (
                        <button 
                          type="button"
                          onClick={() => handleMarcarComoPago(item.id)} 
                          className="bg-emerald-600 text-white px-5 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md flex items-center gap-2 ml-auto group/btn active:scale-95"
                        >
                          <CheckCircle2 size={14} className="group-hover/btn:scale-110 transition-transform" />
                          Baixar
                        </button>
                      ) : (
                        <div className="text-emerald-600 font-medium text-[10px] uppercase flex items-center justify-end gap-1.5 pr-2">
                          <CheckCircle2 size={16} />
                          Liquidado
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <AlertCircle size={48} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-400 font-black uppercase tracking-widest">Nenhum lançamento encontrado para estes filtros.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Financeiro;
