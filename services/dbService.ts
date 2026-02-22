import { supabase } from '../lib/supabase';
import { Customer, SaleOrder, FinanceiroReceber, FollowUp, AgendaVendas, Seller } from '../types';

const TABLE_CLIENTE = 'base_cliente';
const TABLE_PEDIDOS = 'pedidos_venda';
const TABLE_FINANCEIRO = 'financeiro_receber';
const TABLE_CONFIGS = 'system_configs';
const TABLE_FOLLOWUPS = 'follow_ups';
const TABLE_AGENDA = 'agenda_vendas';
const TABLE_VENDEDORES = 'vendedores';

export const dbService = {
  async getCustomers(): Promise<Customer[]> {
    const { data, error } = await supabase.from(TABLE_CLIENTE).select('*').order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addCustomer(customer: Omit<Customer, 'id'>): Promise<void> {
    const payload = {
      name: String(customer.name).trim(),
      cnpj: String(customer.cnpj || '').trim(),
      cidade: String(customer.cidade || '').trim(),
      telefone: String(customer.telefone || '').trim(),
      telefone_secundario: String(customer.telefone_secundario || '').trim(),
      contato: String(customer.contato || '').trim(),
      vendedor: String(customer.vendedor || '').trim(),
      status: customer.status || 'Ativo',
      ultima_compra: customer.ultima_compra && String(customer.ultima_compra).trim() !== "" ? customer.ultima_compra : null,
      anotacoes: String(customer.anotacoes || '').trim()
    };
    const { error } = await supabase.from(TABLE_CLIENTE).insert([payload]);
    if (error) throw error;
  },

  async updateCustomer(id: string, customer: Partial<Customer>): Promise<void> {
    const payload = { ...customer };
    if (payload.ultima_compra === "" || (payload.ultima_compra && String(payload.ultima_compra).trim() === "")) {
      payload.ultima_compra = null as any;
    }
    const { error } = await supabase.from(TABLE_CLIENTE).update(payload).eq('id', id);
    if (error) throw error;
  },

  async deleteCustomer(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE_CLIENTE).delete().eq('id', id);
    if (error) throw error;
  },

  async getSellers(): Promise<Seller[]> {
    const { data, error } = await supabase.from(TABLE_VENDEDORES).select('*').order('nome', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addSeller(seller: Omit<Seller, 'id'>): Promise<void> {
    const { error } = await supabase.from(TABLE_VENDEDORES).insert([seller]);
    if (error) throw error;
  },

  async updateSeller(id: string, seller: Partial<Seller>): Promise<void> {
    const { error } = await supabase.from(TABLE_VENDEDORES).update(seller).eq('id', id);
    if (error) throw error;
  },

  async deleteSeller(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE_VENDEDORES).delete().eq('id', id);
    if (error) throw error;
  },

  async saveSaleOrder(order: SaleOrder): Promise<SaleOrder> {
    const payload: any = {
      data_pedido: order.data_pedido,
      data_entrega: order.data_entrega,
      cliente_id: order.cliente_id || null,
      cliente_nome: order.cliente_nome || 'Consumidor',
      vendedor: String(order.vendedor || 'Sistema').trim(),
      itens: order.itens,
      forma_pagamento: order.forma_pagamento || 'PIX',
      condicao_pagamento: order.condicao_pagamento || '',
      quant_parcelas: Math.max(1, Math.floor(Number(order.quant_parcelas || 1))),
      valor_parcela: parseFloat(Number(order.valor_parcela || 0).toFixed(2)),
      total_pedido: parseFloat(Number(order.total_pedido || 0).toFixed(2)),
      comissao_percentual: parseFloat(Number(order.comissao_percentual || 0).toFixed(2)),
      repasse_percentual: parseFloat(Number(order.repasse_percentual || 0).toFixed(2)),
      comissao_real: parseFloat(Number(order.comissao_real || 0).toFixed(2))
    };

    if (order.id) {
      await supabase.from(TABLE_FINANCEIRO).delete().eq('pedido_id', order.id);
      const { data, error } = await supabase.from(TABLE_PEDIDOS).update(payload).eq('id', order.id).select();
      if (error) throw error;
      return data[0];
    } else {
      const { data, error } = await supabase.from(TABLE_PEDIDOS).insert([payload]).select();
      if (error) throw error;
      return data[0];
    }
  },

  async getSaleOrders(): Promise<SaleOrder[]> {
    const { data, error } = await supabase.from(TABLE_PEDIDOS).select('*').order('data_pedido', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async deleteSaleOrder(id: string): Promise<void> {
    await supabase.from(TABLE_FINANCEIRO).delete().eq('pedido_id', id);
    const { error } = await supabase.from(TABLE_PEDIDOS).delete().eq('id', id);
    if (error) throw error;
  },

  async getFinanceiro(filters?: { vendedor?: string, status?: string }): Promise<FinanceiroReceber[]> {
    let query = supabase.from(TABLE_FINANCEIRO).select('*, base_cliente(name)').order('data_vencimento', { ascending: true });
    if (filters?.vendedor) query = query.ilike('vendedor', `%${filters.vendedor}%`);
    if (filters?.status) query = query.eq('status', filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async addFinanceiroRecords(records: Omit<FinanceiroReceber, 'id'>[]): Promise<void> {
    const cleanRecords = records.map(r => ({
      pedido_id: r.pedido_id,
      cliente_id: r.cliente_id || null,
      cliente_nome: r.cliente_nome || '',
      vendedor: String(r.vendedor || '').trim(),
      valor: parseFloat(Number(r.valor).toFixed(2)),
      data_vencimento: r.data_vencimento,
      data_pagamento: r.data_pagamento,
      status: r.status,
      parcela_numero: r.parcela_numero,
      comissao_valor: parseFloat(Number(r.comissao_valor).toFixed(2)),
      repasse_valor: parseFloat(Number(r.repasse_valor || 0).toFixed(2))
    }));

    const { error } = await supabase.from(TABLE_FINANCEIRO).insert(cleanRecords);
    if (error) throw error;
  },

  async updateFinanceiroStatus(id: string, status: string, dataPagamento: string | null): Promise<void> {
    const { error } = await supabase.from(TABLE_FINANCEIRO).update({ status, data_pagamento: dataPagamento }).eq('id', id);
    if (error) throw error;
  },

  async getSystemConfig(key: string): Promise<any> {
    try {
      const { data, error } = await supabase.from(TABLE_CONFIGS).select('value').eq('key', key).single();
      if (error || !data) return null;
      return data.value;
    } catch (e) {
      return null;
    }
  },

  async updateSystemConfig(key: string, value: any): Promise<void> {
    const { error } = await supabase.from(TABLE_CONFIGS).upsert(
      { key, value }, 
      { onConflict: 'key' }
    );
    if (error) throw error;
  },

  async upsertCustomers(customers: Customer[]): Promise<void> {
    const sanitized = customers.map(c => ({
      ...c,
      ultima_compra: c.ultima_compra && String(c.ultima_compra).trim() !== "" ? c.ultima_compra : null
    }));
    const { error } = await supabase.from(TABLE_CLIENTE).upsert(sanitized);
    if (error) throw error;
  },

  async upsertSaleOrders(orders: SaleOrder[]): Promise<void> {
    const { error } = await supabase.from(TABLE_PEDIDOS).upsert(orders);
    if (error) throw error;
  },

  async upsertFinanceiroRecords(records: FinanceiroReceber[]): Promise<void> {
    const { error } = await supabase.from(TABLE_FINANCEIRO).upsert(records);
    if (error) throw error;
  },

  async upsertSellers(sellers: Seller[]): Promise<void> {
    const { error } = await supabase.from(TABLE_VENDEDORES).upsert(sellers);
    if (error) throw error;
  },

  async upsertAgenda(items: AgendaVendas[]): Promise<void> {
    const sanitized = items.map(item => ({
      ...item,
      ultima_compra: item.ultima_compra && String(item.ultima_compra).trim() !== "" ? item.ultima_compra : null
    }));
    const { error } = await supabase.from(TABLE_AGENDA).upsert(sanitized);
    if (error) throw error;
  },

  async getFollowUps(): Promise<FollowUp[]> {
    const { data, error } = await supabase.from(TABLE_FOLLOWUPS).select('*').order('data_agendada', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addFollowUp(followUp: Omit<FollowUp, 'id'>): Promise<void> {
    const { error } = await supabase.from(TABLE_FOLLOWUPS).insert([followUp]);
    if (error) throw error;
  },

  async updateFollowUpStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase.from(TABLE_FOLLOWUPS).update({ status }).eq('id', id);
    if (error) throw error;
  },

  async deleteFollowUp(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE_FOLLOWUPS).delete().eq('id', id);
    if (error) throw error;
  },

  async getAgenda(): Promise<AgendaVendas[]> {
    const { data, error } = await supabase.from(TABLE_AGENDA).select('*').order('data_retorno', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addAgenda(item: Omit<AgendaVendas, 'id'>): Promise<void> {
    const sanitized = {
      ...item,
      ultima_compra: item.ultima_compra && String(item.ultima_compra).trim() !== "" ? item.ultima_compra : null
    };
    const { error } = await supabase.from(TABLE_AGENDA).insert([sanitized]);
    if (error) throw error;
  },

  async updateAgenda(id: string, item: Partial<AgendaVendas>): Promise<void> {
    const payload = { ...item };
    if (payload.ultima_compra === "" || (payload.ultima_compra && String(payload.ultima_compra).trim() === "")) {
      payload.ultima_compra = null as any;
    }
    const { error } = await supabase.from(TABLE_AGENDA).update(payload).eq('id', id);
    if (error) throw error;
  },

  async updateAgendaStatus(id: string, status: 'pendente' | 'concluido'): Promise<void> {
    const { error } = await supabase.from(TABLE_AGENDA).update({ status }).eq('id', id);
    if (error) throw error;
  },

  async deleteAgenda(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE_AGENDA).delete().eq('id', id);
    if (error) throw error;
  }
};