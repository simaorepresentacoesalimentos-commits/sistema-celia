
import React, { useState, useEffect } from 'react';
import { 
  Package, DollarSign, Percent, CreditCard, Save, 
  Loader2, Plus, Trash2, ShoppingCart, XCircle, User, Calendar, Calculator, ArrowRight,
  Clock, Info, UserCheck, ShieldCheck, BellRing, CalendarCheck
} from 'lucide-react';
import { Customer, SaleOrder, OrderItem, FinanceiroReceber, Seller } from '../types';
import { dbService } from '../services/dbService';

interface SalesFormProps {
  onSuccess: () => void;
  initialData?: SaleOrder | null;
  sellersList: Seller[];
}

const SalesForm: React.FC<SalesFormProps> = ({ onSuccess, initialData, sellersList }) => {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [errorLog, setErrorLog] = useState<string | null>(null);
  
  const getLocalDate = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  };

  const [order, setOrder] = useState<SaleOrder>({
    data_pedido: getLocalDate(),
    data_entrega: '', 
    cliente_id: null,
    cliente_nome: '', 
    vendedor: '',
    itens: [{ produto_item: '', quantidade: 1, unidade: 'UND', valor_unitario: 0 }],
    forma_pagamento: 'PIX',
    condicao_pagamento: '',
    quant_parcelas: 1,
    valor_parcela: 0,
    total_pedido: 0,
    comissao_percentual: 0,
    repasse_percentual: 0,
    comissao_real: 0
  });

  const [parcelDays, setParcelDays] = useState<number[]>([]);

  useEffect(() => {
    dbService.getCustomers().then(res => setCustomers(res)).catch(e => console.error(e));
    
    if (initialData) {
      setOrder(initialData);
      if (initialData.condicao_pagamento) {
        const days = initialData.condicao_pagamento.split('/').map(Number);
        setParcelDays(days);
      }
    }
  }, [initialData]);

  useEffect(() => {
    if (order.forma_pagamento === 'BOLETO') {
      const current = [...parcelDays];
      if (current.length < order.quant_parcelas) {
        while (current.length < order.quant_parcelas) current.push(0);
      } else if (current.length > order.quant_parcelas) {
        current.length = order.quant_parcelas;
      }
      setParcelDays(current);
    }
  }, [order.quant_parcelas, order.forma_pagamento]);

  useEffect(() => {
    const total = order.itens.reduce((acc, item) => {
      const q = parseFloat(String(item.quantidade)) || 0;
      const v = parseFloat(String(item.valor_unitario)) || 0;
      return acc + (q * v);
    }, 0);
    
    const nParc = order.quant_parcelas || 1;
    const vParcela = nParc > 0 ? total / nParc : total;
    
    setOrder(prev => ({ ...prev, total_pedido: total, valor_parcela: vParcela }));
  }, [order.itens, order.quant_parcelas]);

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    const newItens = [...order.itens];
    newItens[index] = { ...newItens[index], [field]: value };
    setOrder({ ...order, itens: newItens });
  };

  const addItem = () => {
    setOrder(prev => ({ 
      ...prev, 
      itens: [...prev.itens, { produto_item: '', quantidade: 1, unidade: 'UND', valor_unitario: 0 }] 
    }));
  };
  
  const removeItem = (e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    if (order.itens.length > 1) {
      const updatedItens = order.itens.filter((_, i) => i !== idx);
      setOrder(prev => ({ ...prev, itens: updatedItens }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
  };

  const getPreviewDate = (baseDateStr: string, days: number) => {
    if (!baseDateStr) return '---';
    const [y, m, d] = baseDateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toLocaleDateString('pt-BR');
  };

  const calculateTotals = () => {
    const total = order.itens.reduce((acc, item) => {
      const q = parseFloat(String(item.quantidade)) || 0;
      const v = parseFloat(String(item.valor_unitario)) || 0;
      return acc + (q * v);
    }, 0);
    
    const comissao = Number(order.comissao_real) > 0 
      ? Number(order.comissao_real) 
      : (total * (Number(order.comissao_percentual) / 100));

    const repasse = (total * (Number(order.repasse_percentual) / 100));
    
    return { total, comissao, repasse };
  };

  const { total: totalAtual, comissao: comissaoCalculada, repasse: repasseCalculado } = calculateTotals();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLog(null);
    
    if (!order.cliente_nome) return alert("❌ Selecione o cliente.");
    if (!order.vendedor) return alert("❌ ATENÇÃO: É obrigatório selecionar o VENDEDOR.");
    if (order.forma_pagamento === 'BOLETO' && (!order.data_entrega || order.data_entrega === '')) {
       return alert("❌ Para Boleto, a DATA DE ENTREGA é obrigatória para calcular os vencimentos.");
    }
    
    setLoading(true);
    try {
      const { total: finalTotal, comissao: finalComissao, repasse: finalRepasse = 0 } = calculateTotals();
      const numParc = Math.max(1, order.quant_parcelas);
      const vParcela = finalTotal / numParc;

      const condicaoFormatada = parcelDays.join('/');
      const orderToSave = {
        ...order,
        total_pedido: finalTotal,
        valor_parcela: vParcela,
        comissao_real: order.comissao_real, 
        condicao_pagamento: condicaoFormatada
      };
      
      const savedPedido = await dbService.saveSaleOrder(orderToSave);
      const createdOrderId = savedPedido.id!;

      const financeiroRecords: Omit<FinanceiroReceber, 'id'>[] = [];
      const commonData = {
        pedido_id: createdOrderId,
        cliente_id: order.cliente_id,
        cliente_nome: order.cliente_nome,
        vendedor: order.vendedor,
      };

      if (order.forma_pagamento === 'PIX') {
        financeiroRecords.push({
          ...commonData,
          valor: finalTotal,
          data_vencimento: order.data_pedido,
          data_pagamento: order.data_pedido,
          status: 'pago',
          parcela_numero: 1,
          comissao_valor: finalComissao,
          repasse_valor: finalRepasse
        });
      } else {
        const baseDateStr = order.data_entrega!;
        const [year, month, day] = baseDateStr.split('-').map(Number);
        const valorParcelaIndividual = finalTotal / numParc;

        for (let i = 0; i < numParc; i++) {
          const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); 
          const diasParaAdicionar = Number(parcelDays[i] || 0);
          dt.setUTCDate(dt.getUTCDate() + diasParaAdicionar);

          const y_res = dt.getUTCFullYear();
          const m_res = String(dt.getUTCMonth() + 1).padStart(2, '0');
          const d_res = String(dt.getUTCDate()).padStart(2, '0');
          const dataVencimentoFormatada = `${y_res}-${m_res}-${d_res}`;

          financeiroRecords.push({
            ...commonData,
            valor: valorParcelaIndividual,
            data_vencimento: dataVencimentoFormatada,
            data_pagamento: null,
            status: 'pendente',
            parcela_numero: i + 1,
            comissao_valor: finalComissao / numParc,
            repasse_valor: finalRepasse / numParc
          });
        }
      }

      await dbService.addFinanceiroRecords(financeiroRecords);
      alert("✅ Venda Finalizada! Dados gravados com sucesso.");
      onSuccess();
    } catch (err: any) {
      setErrorLog(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-24">
      {errorLog && (
        <div className="mb-6 p-6 rounded-3xl border-2 flex items-start gap-4 bg-rose-50 border-rose-200 text-rose-900">
          <XCircle className="shrink-0" size={24} />
          <div>
            <h4 className="font-black uppercase text-xs mb-1">Erro de Processamento</h4>
            <p className="text-sm font-medium">{errorLog}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-8 border-b border-slate-100 bg-slate-900 flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg"><ShoppingCart size={36} /></div>
            <div>
              <h3 className="text-3xl font-black uppercase tracking-tighter">{order.id ? 'Alterar Pedido' : 'Nova Venda'}</h3>
              <p className="text-[12px] font-bold uppercase tracking-widest text-indigo-300">Nexus Sales Core v2.2</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-2">
              <label className="text-[13px] font-black text-slate-500 uppercase tracking-widest block px-1">Data Emissão</label>
              <input type="date" required className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:border-indigo-500" value={order.data_pedido} onChange={e => setOrder({...order, data_pedido: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-black text-indigo-500 uppercase tracking-widest block px-1">Data Entrega (Base) *</label>
              <input type="date" className="w-full bg-indigo-50/50 border-2 border-indigo-100 rounded-2xl px-5 py-4 font-black text-slate-700 outline-none focus:border-indigo-500 shadow-sm" value={order.data_entrega || ''} onChange={e => setOrder({...order, data_entrega: e.target.value})} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-[13px] font-black text-slate-500 uppercase tracking-widest block px-1">Cliente *</label>
              <input 
                list="customers-list"
                type="text" 
                required 
                placeholder="Selecione o cliente..."
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:border-indigo-500 shadow-inner" 
                value={order.cliente_nome || ''} 
                onChange={e => {
                  const typed = e.target.value;
                  const found = customers.find(c => c.name === typed);
                  setOrder({
                    ...order, 
                    cliente_nome: typed, 
                    cliente_id: found ? found.id : null,
                    vendedor: found ? found.vendedor : order.vendedor
                  });
                }} 
              />
              <datalist id="customers-list">
                {customers.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="text-[14px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2"><Package size={20}/> Itens do Pedido</h4>
            </div>
            <div className="space-y-4">
              {order.itens.map((item, idx) => (
                <div key={idx} className="flex flex-wrap md:flex-nowrap gap-4 items-end bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 transition-all hover:border-indigo-200">
                  <div className="flex-1 min-w-[200px] space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Produto / Descrição</label>
                    <input 
                      required 
                      className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 font-semibold outline-none focus:border-indigo-500 shadow-sm uppercase" 
                      value={item.produto_item} 
                      onChange={e => updateItem(idx, 'produto_item', e.target.value)} 
                    />
                  </div>
                  <div className="w-32 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Qtd</label>
                    <input type="number" step="0.01" required className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 font-black text-center outline-none focus:border-indigo-500 shadow-sm" value={item.quantidade} onChange={e => updateItem(idx, 'quantidade', e.target.value)} />
                  </div>
                  <div className="w-36 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Unitário R$</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      required 
                      className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 font-black outline-none focus:border-indigo-500 shadow-sm" 
                      value={item.valor_unitario} 
                      onChange={e => updateItem(idx, 'valor_unitario', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx)}
                    />
                  </div>
                  <div className="w-36 space-y-1">
                    <label className="text-[10px] font-black text-indigo-500 uppercase">Subtotal</label>
                    <div className="w-full bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 font-black text-indigo-700">
                      {(Number(item.quantidade) * Number(item.valor_unitario)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <button type="button" onClick={(e) => removeItem(e, idx)} className="p-4 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"><Trash2 size={24}/></button>
                </div>
              ))}
            </div>
            <div className="flex justify-center pt-2">
              <button type="button" onClick={addItem} className="group flex items-center gap-3 bg-white border-2 border-dashed border-indigo-100 text-indigo-600 px-12 py-4 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                <Plus size={24} className="group-hover:rotate-90 transition-transform" /> Adicionar Outro Item (ENTER)
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[13px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2"><UserCheck size={20}/> Vendedor & Gestão de Comissões</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-sm">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Vendedor *</label>
                <select 
                  required 
                  className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-4 font-black text-slate-800 text-xs uppercase outline-none focus:border-indigo-500 shadow-sm transition-all" 
                  value={order.vendedor} 
                  onChange={e => setOrder({...order, vendedor: e.target.value})}
                >
                  <option value="">Selecione...</option>
                  {sellersList.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                </select>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Célia %</label>
                <input type="number" className="w-full bg-transparent font-black text-xl text-emerald-600 outline-none" value={order.comissao_percentual} onChange={e => setOrder({...order, comissao_percentual: Number(e.target.value)})} />
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Repasse %</label>
                <input type="number" className="w-full bg-transparent font-black text-xl text-amber-500 outline-none" value={order.repasse_percentual} onChange={e => setOrder({...order, repasse_percentual: Number(e.target.value)})} />
              </div>
              <div className="bg-emerald-50 p-4 rounded-2xl border-2 border-emerald-100 shadow-sm space-y-1">
                <label className="text-[10px] font-black text-emerald-600 uppercase block mb-1">Manual R$</label>
                <input type="number" className="w-full bg-transparent font-black text-xl text-emerald-700 outline-none" value={order.comissao_real} onChange={e => setOrder({...order, comissao_real: Number(e.target.value)})} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[13px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2"><CreditCard size={20}/> Condição de Pagamento & Vencimentos</h4>
            <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-sm">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="w-full md:w-1/3 space-y-4">
                  <div className="flex gap-2">
                    <select className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-black text-slate-700 shadow-sm outline-none focus:border-indigo-500" value={order.forma_pagamento} onChange={e => setOrder({...order, forma_pagamento: e.target.value as any})}>
                      <option value="PIX">💰 À VISTA (PIX)</option>
                      <option value="BOLETO">📄 PARCELADO (BOLETO)</option>
                    </select>
                    {order.forma_pagamento === 'BOLETO' && (
                      <input type="number" title="Parcelas" className="w-20 bg-slate-50 border-2 border-slate-100 rounded-2xl px-2 py-4 font-black text-center shadow-sm outline-none focus:border-indigo-500" value={order.quant_parcelas} onChange={e => setOrder({...order, quant_parcelas: Math.max(1, Number(e.target.value))})} />
                    )}
                  </div>
                  <div className="flex items-start gap-2 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                     <Info size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                     <p className="text-[10px] font-bold text-indigo-500 uppercase leading-tight">
                       Para Boleto, preencha os dias após a entrega em cada parcela.
                     </p>
                  </div>
                </div>

                <div className="flex-1">
                  {order.forma_pagamento === 'BOLETO' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       {parcelDays.map((days, idx) => (
                         <div key={idx} className="space-y-1 bg-slate-50 p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center">
                           <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Parcela {idx + 1}</span>
                           <input 
                             type="number" 
                             className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 font-black text-center text-indigo-700 text-lg outline-none focus:border-indigo-500 shadow-sm transition-all"
                             value={days === 0 ? '' : days}
                             placeholder="Dias..."
                             onChange={e => {
                               const newVal = e.target.value === '' ? 0 : Number(e.target.value);
                               const next = [...parcelDays];
                               next[idx] = newVal;
                               setParcelDays(next);
                             }}
                           />
                           <div className="text-base font-black text-emerald-600 text-center mt-3 flex items-center justify-center gap-2 bg-white px-4 py-2 rounded-2xl border border-emerald-50 shadow-inner w-full">
                             <CalendarCheck size={18} className="shrink-0" /> {getPreviewDate(order.data_entrega || '', days)}
                           </div>
                         </div>
                       ))}
                    </div>
                  )}
                  {order.forma_pagamento === 'PIX' && (
                    <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-100 rounded-[2rem] p-8">
                       <p className="text-slate-300 font-black uppercase text-xs tracking-widest">Pagamento à vista selecionado</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm">
             <div className="flex flex-wrap gap-12">
               <div>
                 <span className="text-[11px] font-black text-emerald-600 uppercase block tracking-widest leading-tight mb-1">Comissão Bruta</span>
                 <span className="text-2xl font-black text-slate-900">R$ {comissaoCalculada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
               </div>
               <div>
                 <span className="text-[11px] font-black text-rose-500 uppercase block tracking-widest leading-tight mb-1">Repasse Externo</span>
                 <span className="text-2xl font-black text-slate-900">R$ {repasseCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
               </div>
               <div className="border-l-4 border-indigo-200 pl-12">
                 <span className="text-[11px] font-black text-indigo-600 uppercase block tracking-widest leading-tight mb-1">Líquido Célia</span>
                 <span className="text-3xl font-black text-indigo-700">R$ {(comissaoCalculada - repasseCalculado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
               </div>
            </div>
          </div>

          <div className="bg-slate-900 p-10 rounded-[3rem] flex flex-col md:flex-row justify-between items-center gap-10 shadow-2xl relative border-b-[16px] border-indigo-600 overflow-hidden">
            <div className="text-center md:text-left relative z-10">
              <p className="text-[12px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-2">Total do Pedido</p>
              <h2 className="text-6xl font-black tracking-tighter text-white">R$ {totalAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
            </div>
            <button 
              type="submit" 
              disabled={loading} 
              className="bg-indigo-600 text-white px-14 py-6 rounded-[2rem] font-black text-sm uppercase tracking-[0.3em] hover:bg-emerald-600 transition-all flex items-center gap-4 shadow-2xl disabled:opacity-50 active:scale-95 group min-w-[320px] justify-center relative z-10"
            >
              {loading ? <Loader2 className="animate-spin" size={32} /> : <Save size={32}/>}
              {order.id ? 'Salvar Alterações' : 'Finalizar Pedido'}
              <ArrowRight size={28} className="group-hover:translate-x-3 transition-transform"/>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SalesForm;
