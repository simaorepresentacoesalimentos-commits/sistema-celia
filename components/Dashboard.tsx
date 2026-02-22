// Added missing React and hooks imports
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Target, ShoppingCart, BarChart3, AlertCircle, TrendingUp,
  CalendarDays, Calculator, ArrowUpRight, History, UserCheck,
  Award, Star, HandCoins, ArrowRightLeft, DollarSign, CalendarCheck
} from 'lucide-react';
import { Product, SaleOrder, FinanceiroReceber, Seller } from '../types';
import { dbService } from '../services/dbService';

interface DashboardProps {
  products: Product[];
  orders: SaleOrder[];
  financials: FinanceiroReceber[];
  sellers: Seller[];
}

const Dashboard: React.FC<DashboardProps> = ({ orders, financials, sellers }) => {
  const [monthlyGoal, setMonthlyGoal] = useState<number>(() => {
    const saved = localStorage.getItem('nexus_monthly_goal_v2');
    return saved ? Number(saved) : 50000;
  });
  
  const [inputValue, setInputValue] = useState<string>(monthlyGoal.toString());
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    const loadGoal = async () => {
      try {
        const dbGoal = await dbService.getSystemConfig('monthly_goal');
        if (dbGoal !== null) {
          const val = Number(dbGoal);
          setMonthlyGoal(val);
          setInputValue(val.toString());
        }
      } catch (e) {
        console.error("Erro ao sincronizar meta:", e);
      }
    };
    loadGoal();
  }, []);

  const persistGoal = async () => {
    const numericVal = parseFloat(inputValue);
    if (isNaN(numericVal) || numericVal === monthlyGoal) return;

    setMonthlyGoal(numericVal);
    localStorage.setItem('nexus_monthly_goal_v2', numericVal.toString());
    
    try {
      setIsSavingGoal(true);
      await dbService.updateSystemConfig('monthly_goal', numericVal);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (e) {
      console.error("Erro ao salvar meta:", e);
    } finally {
      setIsSavingGoal(false);
    }
  };

  const [sellerFilter, setSellerFilter] = useState<string>('');
  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const now = new Date();
  
  const getPeriod = (date: Date) => {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${date.getFullYear()}-${month}`;
  };

  const currentPeriod = getPeriod(now);
  const prevPeriod = getPeriod(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const nextPeriod = getPeriod(new Date(now.getFullYear(), now.getMonth() + 1, 1));

  const stats = useMemo(() => {
    const fOrders = sellerFilter ? orders.filter(o => o.vendedor === sellerFilter) : orders;
    const fFinancials = sellerFilter ? financials.filter(f => f.vendedor === sellerFilter) : financials;

    const getMonthStats = (period: string) => {
      const items = fFinancials.filter(f => f.data_vencimento && f.data_vencimento.startsWith(period));
      const bruta = items.reduce((acc, f) => acc + Number(f.comissao_valor || 0), 0);
      const repasse = items.reduce((acc, f) => acc + Number(f.repasse_valor || 0), 0);
      return { bruta, repasse, liquida: bruta - repasse };
    };

    const currMonth = getMonthStats(currentPeriod);
    const prevMonth = getMonthStats(prevPeriod);
    const nextMonth = getMonthStats(nextPeriod);

    const monthOrders = fOrders.filter(o => o.data_pedido && o.data_pedido.startsWith(currentPeriod));
    const totalSoldMonth = monthOrders.reduce((acc, o) => acc + Number(o.total_pedido || 0), 0);
    const totalRepassePendente = fFinancials.filter(f => f.status === 'pendente').reduce((acc, f) => acc + Number(f.repasse_valor || 0), 0);
    const amountRemaining = Math.max(0, monthlyGoal - totalSoldMonth);

    // Inicializa o mapa com todos os vendedores ativos para garantir que apareçam no ranking
    const sellerStatsMap: Record<string, number> = {};
    sellers.filter(s => s.status === 'Ativo').forEach(s => {
      sellerStatsMap[s.nome] = 0;
    });

    // Soma as vendas do mês atual
    orders.filter(o => o.data_pedido && o.data_pedido.startsWith(currentPeriod)).forEach(o => {
      sellerStatsMap[o.vendedor] = (sellerStatsMap[o.vendedor] || 0) + Number(o.total_pedido || 0);
    });

    return {
      totalSoldMonth,
      totalOrdersMonth: monthOrders.length,
      totalRepassePendente,
      amountRemaining,
      prevMonth,
      currMonth,
      nextMonth,
      sellersRanking: Object.entries(sellerStatsMap).sort((a, b) => b[1] - a[1])
    };
  }, [orders, financials, sellers, sellerFilter, monthlyGoal, currentPeriod, prevPeriod, nextPeriod]);

  const currentMonthName = now.toLocaleDateString('pt-BR', { month: 'long' });
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthName = nextMonthDate.toLocaleDateString('pt-BR', { month: 'long' });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Resumo de Performance</h1>
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Nexus Business Intelligence | {currentPeriod}</p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-black text-slate-600 text-[10px] uppercase outline-none shadow-sm" 
            value={sellerFilter} 
            onChange={e => setSellerFilter(e.target.value)}
          >
            <option value="">Todos Vendedores</option>
            {sellers.filter(s => s.status === 'Ativo').map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
          </select>
        </div>
      </div>

      {/* BLOCO SUPERIOR - RESUMO FINANCEIRO E METAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quadrado de Resumo (Estilo Imagem) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
          <div className="mb-4 text-center">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800 underline decoration-indigo-500 decoration-2 underline-offset-4">
              Resumo {currentMonthName}
            </h3>
          </div>
          <div className="space-y-3 flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-between gap-4">
              <div className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg font-bold text-[10px] min-w-[130px] text-center uppercase tracking-wider shadow-sm">Faturamento:</div>
              <div className="text-indigo-600 font-bold text-sm">{formatCurrency(stats.totalSoldMonth)}</div>
            </div>
            
            <div className="flex items-center justify-between gap-4">
              <div className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg font-bold text-[10px] min-w-[130px] text-center uppercase tracking-wider shadow-sm">Lucro Bruto:</div>
              <div className="text-indigo-600 font-bold text-sm">{formatCurrency(stats.currMonth.bruta)}</div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="bg-rose-500 text-white px-4 py-1.5 rounded-lg font-bold text-[10px] min-w-[130px] text-center uppercase tracking-wider shadow-sm">Descontos:</div>
              <div className="text-rose-500 font-bold text-sm">{formatCurrency(stats.currMonth.repasse)}</div>
            </div>
            
            <div className="flex items-center justify-between gap-4">
              <div className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg font-bold text-[10px] min-w-[130px] text-center uppercase tracking-wider shadow-sm">Ganhos Célia:</div>
              <div className="text-emerald-500 font-bold text-sm">{formatCurrency(stats.currMonth.liquida)}</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 text-[9px] font-black text-slate-400 uppercase text-center tracking-tighter">
            Nexus Business Intelligence
          </div>
        </div>

        {/* Novo Bloco de Metas (Estilo Tabela da Imagem) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
          <div className="mb-4 text-center">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800 underline decoration-indigo-500 decoration-2 underline-offset-4">
              Meta {currentMonthName}
            </h3>
          </div>
          
          <div className="space-y-3 flex-1 flex flex-col justify-center">
            {/* META MÊS */}
            <div className="flex items-center justify-between gap-4">
              <div className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg font-bold text-[10px] min-w-[130px] text-center uppercase tracking-wider shadow-sm">
                Meta Mês:
              </div>
              <div className="flex items-center gap-1">
                <span className="text-indigo-600 font-black text-sm">R$</span>
                <input 
                  type="number" 
                  className="bg-transparent outline-none text-indigo-600 font-black text-sm w-24 text-right" 
                  value={inputValue} 
                  onChange={e => setInputValue(e.target.value)}
                  onBlur={persistGoal}
                />
              </div>
            </div>

            {/* VENDIDO */}
            <div className="flex items-center justify-between gap-4">
              <div className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg font-bold text-[10px] min-w-[130px] text-center uppercase tracking-wider shadow-sm">
                Vendido:
              </div>
              <div className="text-emerald-500 font-black text-sm">
                {formatCurrency(stats.totalSoldMonth)}
              </div>
            </div>

            {/* FALTA / SUPERADO */}
            {(() => {
              const diff = monthlyGoal - stats.totalSoldMonth;
              const isSuperado = diff <= 0;
              return (
                <div className="flex items-center justify-between gap-4">
                  <div className={`${isSuperado ? 'bg-indigo-600' : 'bg-rose-500'} text-white px-4 py-1.5 rounded-lg font-bold text-[10px] min-w-[130px] text-center uppercase tracking-wider shadow-sm`}>
                    {isSuperado ? 'Superado:' : 'Falta:'}
                  </div>
                  <div className={`${isSuperado ? 'text-indigo-600' : 'text-rose-500'} font-black text-sm`}>
                    {isSuperado ? `- ${formatCurrency(Math.abs(diff))}` : formatCurrency(diff)}
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 text-[9px] font-black text-slate-400 uppercase text-center tracking-tighter">
            {stats.totalOrdersMonth} Pedidos Realizados • Clique no valor para editar
          </div>
        </div>
      </div>

      {/* RANKING DE VENDEDORES */}
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Award size={20} className="text-indigo-600" />
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Performance Comercial</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.sellersRanking.map(([name, value], idx) => (
            <div key={idx} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${idx === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  {idx + 1}
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 uppercase truncate">{name}</p>
                  <p className="text-lg font-black text-emerald-600">{formatCurrency(value)}</p>
                </div>
              </div>
              <Star size={16} className={idx === 0 ? 'text-amber-400 fill-amber-400' : 'text-slate-100'} />
            </div>
          ))}
        </div>
      </div>

      {/* PROJEÇÕES PRÓXIMO MÊS */}
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <ArrowUpRight size={20} className="text-indigo-600" />
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Projeções {nextMonthName}</h3>
        </div>
        
        <div className="max-w-md">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg font-bold text-[10px] min-w-[140px] text-center uppercase tracking-wider shadow-sm">Comissão Geral:</div>
                <div className="text-indigo-600 font-bold text-sm">{formatCurrency(stats.nextMonth.bruta)}</div>
              </div>
              
              <div className="flex items-center justify-between gap-4">
                <div className="bg-rose-500 text-white px-4 py-1.5 rounded-lg font-bold text-[10px] min-w-[140px] text-center uppercase tracking-wider shadow-sm">Repasse:</div>
                <div className="text-rose-500 font-bold text-sm">{formatCurrency(stats.nextMonth.repasse)}</div>
              </div>
              
              <div className="flex items-center justify-between gap-4">
                <div className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg font-bold text-[10px] min-w-[140px] text-center uppercase tracking-wider shadow-sm">A receber Célia:</div>
                <div className="text-emerald-500 font-bold text-sm">{formatCurrency(stats.nextMonth.liquida)}</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 text-[9px] font-black text-slate-400 uppercase text-center tracking-tighter">
              Saldo Projetado Líquido para {nextMonthName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;