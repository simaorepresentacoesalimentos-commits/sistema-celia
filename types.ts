
export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
}

export interface Customer {
  id: string;
  name: string;
  cnpj: string;
  cidade: string;
  telefone: string;
  telefone_secundario: string;
  contato: string;
  vendedor: string;
  status: string;
  ultima_compra: string;
  anotacoes: string;
}

export interface Seller {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  status: 'Ativo' | 'Inativo';
  created_at?: string;
}

export interface OrderItem {
  produto_item: string;
  quantidade: number;
  unidade: 'KG' | 'UND';
  valor_unitario: number;
}

export interface Sale {
  id: string;
  customerId: string;
  total: number;
  date: string;
  paymentMethod: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
    name: string;
  }>;
}

export interface SaleOrder {
  id?: string;
  data_pedido: string;
  data_entrega: string | null;
  cliente_id: string | null;
  cliente_nome?: string;
  vendedor: string;
  itens: OrderItem[];
  forma_pagamento: 'BOLETO' | 'PIX';
  condicao_pagamento?: string;
  quant_parcelas: number;
  valor_parcela: number;
  total_pedido: number;
  comissao_percentual: number;
  repasse_percentual: number;
  comissao_real: number;
  created_at?: string;
}

export interface FinanceiroReceber {
  id: string;
  pedido_id: string;
  cliente_id: string | null;
  cliente_nome?: string;
  vendedor: string;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: 'pendente' | 'pago' | 'atrasado' | 'projetada';
  parcela_numero: number;
  comissao_valor: number;
  repasse_valor: number;
  created_at?: string;
  base_cliente?: { name: string };
}

export interface AgendaVendas {
  id: string;
  cliente: string;
  cnpj: string;
  telefone: string;
  contato: string;
  ultima_compra: string;
  data_retorno: string;
  hora_retorno: string;
  anotacoes: string;
  status: 'pendente' | 'concluido';
  created_at?: string;
}

export interface FollowUp {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  data_agendada: string;
  descricao: string;
  vendedor: string;
  status: 'pendente' | 'concluido';
  created_at?: string;
}

export type View = 'dashboard' | 'agenda' | 'customers' | 'sellers' | 'new_sale' | 'sales_list' | 'financeiro' | 'reports' | 'system' | 'restore';
