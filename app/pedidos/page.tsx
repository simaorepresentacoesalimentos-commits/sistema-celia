"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, Pencil, X, CheckCircle2 } from "lucide-react";

type Item = { produto_nome: string; quantidade: string; unidade: string; valor_unitario: string };

const emptyItem = (): Item => ({ produto_nome: "", quantidade: "1", unidade: "KG", valor_unitario: "0" });

// Forma de pagamento exibida no formulário. "pix" e "avista" são ambas
// pagamentos imediatos (sem parcelas) e são gravadas no banco como "pix",
// que é o único valor de pagamento à vista aceito pela coluna forma_pagamento.
// Isso evita qualquer alteração no banco de dados ou em outras telas
// (Dashboard/Relatórios) que já leem forma_pagamento = 'pix' para esse cálculo.
type FormaPagamentoUI = "pix" | "avista" | "boleto";

// Soma um número de dias a uma data ISO.
function addDias(dataStr: string, dias: number) {
  const d = new Date(dataStr + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Interpreta o texto digitado em "Parcelas (dias)" — ex.: "7/14/21" — numa
// lista de prazos independentes. Cada valor é um número de dias somado
// diretamente na data base, sem nenhuma relação entre eles (não é um
// intervalo fixo repetido).
function parsePrazos(texto: string): number[] {
  return texto
    .split("/")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

// Gera as datas de vencimento dos boletos somando cada prazo diretamente na
// data base (ex.: pedido 08/07, prazos "7/14/21" => 15/07, 22/07, 29/07).
function gerarParcelasPorLista(dataBase: string, valorTotal: number, prazos: number[]) {
  const qtd = prazos.length;
  const valorParcela = +(valorTotal / qtd).toFixed(2);
  return prazos.map((dias, idx) => ({
    numero_parcela: idx + 1,
    data_vencimento: addDias(dataBase, dias),
    valor: idx === qtd - 1 ? +(valorTotal - valorParcela * (qtd - 1)).toFixed(2) : valorParcela,
  }));
}

// Diferença em dias entre duas datas ISO (usado para reconstruir o texto de
// prazos ao editar um pedido de boleto já salvo).
function diffDias(dataBase: string, dataAlvo: string) {
  const a = new Date(dataBase + "T00:00:00").getTime();
  const b = new Date(dataAlvo + "T00:00:00").getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

// Reconstrói o texto "7/14/21" a partir dos boletos já salvos de um pedido,
// para o campo voltar preenchido corretamente ao editar.
function inferirPrazosTexto(dataBase: string, boletos: any[]): string {
  return boletos
    .slice()
    .sort((a, b) => a.numero_parcela - b.numero_parcela)
    .map((b) => diffDias(dataBase, b.data_vencimento))
    .join("/");
}

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");

  const [dataPedido, setDataPedido] = useState(new Date().toISOString().slice(0, 10));
  const [dataEntrega, setDataEntrega] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [clienteBusca, setClienteBusca] = useState("");
  const [clienteDropdownAberto, setClienteDropdownAberto] = useState(false);
  const [clienteDestacadoIdx, setClienteDestacadoIdx] = useState(0);
  const [vendedorId, setVendedorId] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoUI>("pix");
  const [prazosTexto, setPrazosTexto] = useState("7/14/21");
  const [comissaoPct, setComissaoPct] = useState("0");
  const [repassePct, setRepassePct] = useState("0");
  const [repassePara, setRepassePara] = useState("");
  const [comissaoManual, setComissaoManual] = useState("");
  const [itens, setItens] = useState<Item[]>([emptyItem()]);
  const [observacoes, setObservacoes] = useState("");

  const [toast, setToast] = useState<{ id: string; cliente: string; total: number; mensagem: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function mostrarToast(t: { id: string; cliente: string; total: number; mensagem: string }) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(t);
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }
  function fecharToast() {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  }
  useEffect(() => {
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, []);

  const load = useCallback(async () => {
    const [{ data: pd }, { data: cl }, { data: vd }] = await Promise.all([
      supabase.from("pedidos").select("*, clientes(nome_fantasia, razao_social, cnpj), vendedores(nome), pedido_boletos(*), pedido_itens(*)").order("data_pedido", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("clientes").select("id, nome_fantasia, razao_social, cnpj, cidade"),
      supabase.from("vendedores").select("id, nome"),
    ]);
    setPedidos(pd ?? []);
    setClientes(cl ?? []);
    setVendedores(vd ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const valorTotal = itens.reduce((s, i) => s + (parseFloat(i.quantidade) || 0) * (parseFloat(i.valor_unitario) || 0), 0);
  const prazosArr = parsePrazos(prazosTexto);
  const previewParcelas = formaPagamento === "boleto" && dataEntrega && valorTotal > 0 && prazosArr.length > 0
    ? gerarParcelasPorLista(dataEntrega, valorTotal, prazosArr)
    : [];

  // Autocomplete de cliente: só mostra sugestões depois de digitar, filtrando
  // por nome, CNPJ ou cidade — nunca lista todos os clientes de uma vez.
  const clientesFiltrados = clienteBusca.trim().length === 0
    ? []
    : clientes.filter((c) => {
        const termo = clienteBusca.trim().toLowerCase();
        const campos = [c.nome_fantasia, c.razao_social, c.cnpj, c.cidade];
        return campos.some((v) => (v || "").toString().toLowerCase().includes(termo));
      }).slice(0, 20);

  function selecionarCliente(c: any) {
    setClienteId(c.id);
    setClienteBusca(c.nome_fantasia || c.razao_social || "");
    setClienteDropdownAberto(false);
    setClienteDestacadoIdx(0);
  }

  function addItem() { setItens((i) => [...i, emptyItem()]); }
  function removeItem(idx: number) { setItens((i) => i.filter((_, k) => k !== idx)); }
  function updateItem(idx: number, field: keyof Item, value: string) {
    setItens((i) => i.map((it, k) => (k === idx ? { ...it, [field]: value } : it)));
  }

  function resetForm() {
    setDataPedido(new Date().toISOString().slice(0, 10));
    setDataEntrega(""); setClienteId(""); setClienteBusca(""); setVendedorId("");
    setFormaPagamento("pix"); setPrazosTexto("7/14/21");
    setComissaoPct("0"); setRepassePct("0"); setRepassePara(""); setComissaoManual("");
    setItens([emptyItem()]); setObservacoes("");
    setEditingId(null);
  }

  async function salvar() {
    if (!clienteId || !vendedorId || !dataEntrega) { alert("Preencha cliente, vendedor e data de entrega"); return; }
    if (formaPagamento === "boleto" && prazosArr.length === 0) { alert("Informe pelo menos um prazo válido (ex.: 7/14/21)"); return; }

    setSalvando(true);
    try {
      // avista e pix são gravados com o mesmo valor no banco (pagamento imediato, sem parcelas)
      const formaPagamentoDb = formaPagamento === "boleto" ? "boleto" : "pix";

      const payload = {
        data_pedido: dataPedido,
        data_entrega: dataEntrega,
        cliente_id: clienteId,
        vendedor_id: vendedorId,
        forma_pagamento: formaPagamentoDb,
        qtd_parcelas: formaPagamento === "boleto" ? prazosArr.length : 1,
        comissao_percentual: parseFloat(comissaoPct) || 0,
        repasse_percentual: parseFloat(repassePct) || 0,
        repasse_para: repassePara.trim() || null,
        comissao_manual: comissaoManual ? parseFloat(comissaoManual) : null,
        valor_total: valorTotal,
        observacoes,
      };

      const { data: pedido, error } = editingId
        ? await supabase.from("pedidos").update(payload).eq("id", editingId).select().single()
        : await supabase.from("pedidos").insert(payload).select().single();

      if (error || !pedido) { alert("Erro ao salvar pedido: " + error?.message); return; }

      if (editingId) {
        await supabase.from("pedido_itens").delete().eq("pedido_id", editingId);
        await supabase.from("pedido_boletos").delete().eq("pedido_id", editingId);
      }

      const itensPayload = itens
        .filter((i) => i.produto_nome)
        .map((i) => ({
          pedido_id: pedido.id,
          produto_nome: i.produto_nome,
          quantidade: parseFloat(i.quantidade) || 0,
          unidade: i.unidade === "UN" ? "UN" : "KG",
          valor_unitario: parseFloat(i.valor_unitario) || 0,
        }));
      if (itensPayload.length) {
        const { error: errItens } = await supabase.from("pedido_itens").insert(itensPayload);
        if (errItens) alert("Erro ao salvar os itens do pedido: " + errItens.message);
      }

      if (formaPagamento === "boleto") {
        const parcelas = gerarParcelasPorLista(dataEntrega, valorTotal, prazosArr).map((p) => ({
          pedido_id: pedido.id, ...p,
        }));
        await supabase.from("pedido_boletos").insert(parcelas);
      }

      // atualiza última compra do cliente
      await supabase.from("clientes").update({ ultima_compra: dataPedido, status: "ativo" }).eq("id", clienteId);

      const eraEdicao = !!editingId;
      const clienteNome = clientes.find((c) => c.id === clienteId)?.nome_fantasia
        || clientes.find((c) => c.id === clienteId)?.razao_social
        || "Cliente";

      resetForm();
      setShowForm(false);
      load();

      mostrarToast({
        id: pedido.id,
        cliente: clienteNome,
        total: valorTotal,
        mensagem: eraEdicao ? "Pedido atualizado com sucesso!" : "Pedido cadastrado com sucesso!",
      });
    } finally {
      setSalvando(false);
    }
  }

  async function editar(id: string) {
    fecharToast();
    const { data: p, error } = await supabase
      .from("pedidos")
      .select("*, pedido_itens(*), pedido_boletos(*)")
      .eq("id", id)
      .single();
    if (error || !p) { alert("Não foi possível carregar o pedido para edição."); return; }

    setDataPedido(p.data_pedido || new Date().toISOString().slice(0, 10));
    setDataEntrega(p.data_entrega || "");
    setClienteId(p.cliente_id || "");
    const clienteDoPedido = clientes.find((c) => c.id === p.cliente_id);
    setClienteBusca(clienteDoPedido?.nome_fantasia || clienteDoPedido?.razao_social || "");
    setVendedorId(p.vendedor_id || "");
    setFormaPagamento(p.forma_pagamento === "boleto" ? "boleto" : "pix");
    setComissaoPct(String(p.comissao_percentual ?? "0"));
    setRepassePct(String(p.repasse_percentual ?? "0"));
    setRepassePara(p.repasse_para || "");
    setComissaoManual(p.comissao_manual != null ? String(p.comissao_manual) : "");
    setObservacoes(p.observacoes || "");

    const itensCarregados: Item[] = (p.pedido_itens ?? []).map((i: any) => ({
      produto_nome: i.produto_nome,
      quantidade: String(i.quantidade),
      // pedidos antigos não têm unidade cadastrada: consideram-se KG
      unidade: i.unidade === "UN" ? "UN" : "KG",
      valor_unitario: String(i.valor_unitario),
    }));
    setItens(itensCarregados.length ? itensCarregados : [emptyItem()]);

    const boletos = (p.pedido_boletos ?? []).slice().sort((a: any, b: any) => a.numero_parcela - b.numero_parcela);
    if (p.forma_pagamento === "boleto" && boletos.length > 0) {
      setPrazosTexto(inferirPrazosTexto(p.data_entrega, boletos));
    } else {
      setPrazosTexto("7/14/21");
    }

    setEditingId(id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este pedido? As devoluções vinculadas a ele também serão excluídas.")) return;
    // Remove primeiro as devoluções vinculadas para não deixar vestígio
    // financeiro órfão, independente da regra de exclusão configurada no banco.
    const { error: errDev } = await supabase.from("devolucoes").delete().eq("pedido_id", id);
    if (errDev) { alert("Erro ao excluir devoluções vinculadas: " + errDev.message); return; }
    const { error: errPedido } = await supabase.from("pedidos").delete().eq("id", id);
    if (errPedido) { alert("Erro ao excluir pedido: " + errPedido.message); return; }
    fecharToast();
    if (editingId === id) resetForm();
    load();
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtData = (d: string | null | undefined) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "-";
  const fmtDataCurta = (d: string | null | undefined) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "-";

  const pedidosFiltrados = pedidos.filter((p) => {
    if (!busca.trim()) return true;
    const termo = busca.trim().toLowerCase();
    const campos = [
      p.clientes?.nome_fantasia,
      p.clientes?.razao_social,
      p.clientes?.cnpj,
      p.vendedores?.nome,
      p.data_pedido,
      fmtData(p.data_pedido),
      p.data_entrega,
      fmtData(p.data_entrega),
    ];
    return campos.some((c) => (c || "").toString().toLowerCase().includes(termo));
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <button
          className="btn-primary flex items-center gap-1"
          onClick={() => { if (showForm) { resetForm(); setShowForm(false); } else { setShowForm(true); } }}
        >
          <Plus size={16} /> Novo pedido
        </button>
      </div>

      {showForm && (
        <div className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div><label className="text-xs text-gray-500">Data do pedido</label><input type="date" value={dataPedido} onChange={(e) => setDataPedido(e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Data de entrega</label><input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} /></div>
            <div className="relative">
              <label className="text-xs text-gray-500">Cliente</label>
              <input
                type="text"
                value={clienteBusca}
                onChange={(e) => {
                  setClienteBusca(e.target.value);
                  setClienteDropdownAberto(true);
                  setClienteDestacadoIdx(0);
                  if (clienteId) setClienteId("");
                }}
                onFocus={() => setClienteDropdownAberto(true)}
                onBlur={() => setTimeout(() => setClienteDropdownAberto(false), 150)}
                onKeyDown={(e) => {
                  if (!clienteDropdownAberto || clientesFiltrados.length === 0) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setClienteDestacadoIdx((i) => Math.min(i + 1, clientesFiltrados.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setClienteDestacadoIdx((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter") {
                    const escolhido = clientesFiltrados[clienteDestacadoIdx];
                    if (escolhido) {
                      e.preventDefault();
                      selecionarCliente(escolhido);
                    }
                  } else if (e.key === "Tab") {
                    const escolhido = clientesFiltrados[clienteDestacadoIdx];
                    if (escolhido) selecionarCliente(escolhido);
                  }
                }}
                placeholder="Digite nome, CNPJ ou cidade..."
                autoComplete="off"
              />
              {clienteDropdownAberto && clienteBusca.trim().length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                  {clientesFiltrados.length === 0 ? (
                    <p className="text-xs text-gray-400 px-3 py-2">Nenhum cliente encontrado.</p>
                  ) : (
                    clientesFiltrados.map((c, idx) => (
                      <button
                        type="button"
                        key={c.id}
                        onMouseDown={() => selecionarCliente(c)}
                        onMouseEnter={() => setClienteDestacadoIdx(idx)}
                        className={`w-full text-left px-3 py-2 text-sm border-b border-gray-50 last:border-b-0 ${
                          idx === clienteDestacadoIdx ? "bg-brand-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="font-medium">{c.nome_fantasia || c.razao_social}</div>
                        <div className="text-xs text-gray-400">{c.cnpj || "sem CNPJ"}{c.cidade ? ` — ${c.cidade}` : ""}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500">Vendedor</label>
              <select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)}>
                <option value="">Selecione</option>
                {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Itens do pedido</label>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
                <span className="col-span-4">Produto</span>
                <span className="col-span-2">Quantidade</span>
                <span className="col-span-1">Unidade</span>
                <span className="col-span-2">Valor Unitário</span>
                <span className="col-span-2">Subtotal</span>
                <span className="col-span-1"></span>
              </div>
              {itens.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input className="col-span-4" placeholder="Produto" value={it.produto_nome} onChange={(e) => updateItem(idx, "produto_nome", e.target.value)} />
                  <input className="col-span-2" type="number" placeholder="Qtd" value={it.quantidade} onChange={(e) => updateItem(idx, "quantidade", e.target.value)} />
                  <select className="col-span-1 !px-1" value={it.unidade} onChange={(e) => updateItem(idx, "unidade", e.target.value)}>
                    <option value="KG">KG</option>
                    <option value="UN">UN</option>
                  </select>
                  <input className="col-span-2" type="number" placeholder="Vlr unit." value={it.valor_unitario} onChange={(e) => updateItem(idx, "valor_unitario", e.target.value)} />
                  <span className="col-span-2 text-sm font-medium">{fmt((parseFloat(it.quantidade) || 0) * (parseFloat(it.valor_unitario) || 0))}</span>
                  <button className="col-span-1 btn-danger" onClick={() => removeItem(idx)}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <button className="btn-secondary mt-2 flex items-center gap-1" onClick={addItem}><Plus size={14} /> Adicionar item</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500">Forma de pagamento</label>
              <select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value as FormaPagamentoUI)}>
                <option value="pix">Pix</option>
                <option value="avista">À Vista</option>
                <option value="boleto">Boleto</option>
              </select>
            </div>
            {formaPagamento === "boleto" && (
              <div>
                <label className="text-xs text-gray-500">Parcelas (dias)</label>
                <input type="text" placeholder="Ex.: 7/14/21" value={prazosTexto} onChange={(e) => setPrazosTexto(e.target.value)} />
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {prazosArr.length > 0 ? `${prazosArr.length} parcela${prazosArr.length > 1 ? "s" : ""}: pedido + ${prazosArr.join(", + ")} dias` : "Digite os prazos separados por \"/\", ex.: 7/14/21"}
                </p>
              </div>
            )}
            <div><label className="text-xs text-gray-500">Comissão %</label><input type="number" value={comissaoPct} onChange={(e) => setComissaoPct(e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Repasse %</label><input type="number" value={repassePct} onChange={(e) => setRepassePct(e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Repasse para</label><input type="text" placeholder="Ex.: MARCOS" value={repassePara} onChange={(e) => setRepassePara(e.target.value)} /></div>
            <div className="md:col-span-1"><label className="text-xs text-gray-500">Comissão manual (R$, opcional)</label><input type="number" value={comissaoManual} onChange={(e) => setComissaoManual(e.target.value)} placeholder="sobrepõe a %" /></div>
          </div>

          {previewParcelas.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
              <p className="font-semibold mb-1">Datas dos boletos (calculadas automaticamente):</p>
              <div className="flex flex-wrap gap-2">
                {previewParcelas.map((p) => (
                  <span key={p.numero_parcela} className="bg-white border rounded px-2 py-1">
                    Boleto {p.numero_parcela} — {new Date(p.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")} — {fmt(p.valor)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div><label className="text-xs text-gray-500">Observações</label><textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>

          <div className="flex justify-between items-center">
            <p className="text-lg font-bold">Total: {fmt(valorTotal)}</p>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => { resetForm(); setShowForm(false); }}>Cancelar</button>
              <button className="btn-primary" onClick={salvar} disabled={salvando}>
                {salvando ? "Salvando..." : editingId ? "Atualizar pedido" : "Salvar pedido"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="card border-l-4 border-l-green-500 relative">
          <button
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
            onClick={fecharToast}
            title="Fechar"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-2 text-green-700 font-medium">
            <CheckCircle2 size={18} />
            {toast.mensagem}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <span className="font-medium">{toast.cliente}</span>
            <span className="text-gray-300">|</span>
            <span>{fmt(toast.total)}</span>
            <span className="text-gray-300">|</span>
            <button className="btn-secondary flex items-center gap-1 py-1" onClick={() => editar(toast.id)}>
              <Pencil size={12} /> Editar
            </button>
            <button className="btn-danger flex items-center gap-1" onClick={() => excluir(toast.id)}>
              <Trash2 size={12} /> Excluir
            </button>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-gray-500">Pedidos cadastrados ({pedidosFiltrados.length})</h2>
        </div>
        <input
          placeholder="Buscar por cliente, CNPJ, vendedor, data do pedido ou data de entrega..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="mb-3"
        />
        <div className="space-y-3">
          {pedidosFiltrados.map((p) => {
            const boletos = (p.pedido_boletos ?? []).slice().sort((a: any, b: any) => a.numero_parcela - b.numero_parcela);
            return (
              <div key={p.id} className="card border-l-4 border-l-brand-500 py-2.5 px-4">
                <div
                  className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4 cursor-pointer"
                  onClick={() => editar(p.id)}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 flex-1 text-sm">
                    {/* Coluna 1 */}
                    <div className="space-y-1">
                      <div>
                        <span className="text-[11px] text-gray-400">Data do pedido </span>
                        <span className="font-medium">{fmtData(p.data_pedido)}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-gray-400">Data de entrega </span>
                        <span className="font-medium">{fmtData(p.data_entrega)}</span>
                      </div>
                    </div>
                    {/* Coluna 2 */}
                    <div className="space-y-1">
                      <div className="truncate">
                        <span className="text-[11px] text-gray-400">Cliente </span>
                        <span className="font-medium">{p.clientes?.nome_fantasia || p.clientes?.razao_social || "-"}</span>
                      </div>
                      <div className="truncate">
                        <span className="text-[11px] text-gray-400">Vendedor </span>
                        <span className="font-medium">{p.vendedores?.nome || "-"}</span>
                      </div>
                    </div>
                    {/* Coluna 3 */}
                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          <span className="text-[11px] text-gray-400">Pagamento </span>
                          <span className="font-medium">
                            {p.forma_pagamento === "boleto" ? `Boleto (${p.qtd_parcelas}x)` : "Pix / À Vista"}
                          </span>
                        </span>
                        <span className="font-semibold">{fmt(Number(p.valor_total))}</span>
                      </div>
                      {p.forma_pagamento === "boleto" && boletos.length > 0 && (
                        <div className="truncate text-xs text-gray-600">
                          {boletos.map((b: any) => `📄 ${fmtDataCurta(b.data_vencimento)}`).join(" | ")}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0 lg:pl-2" onClick={(e) => e.stopPropagation()}>
                    <button className="btn-danger flex items-center gap-1 px-2" onClick={() => excluir(p.id)}>
                      <Trash2 size={12} /> Excluir
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {pedidosFiltrados.length === 0 && (
            <div className="text-sm text-gray-400 py-4">
              {pedidos.length === 0 ? "Nenhum pedido cadastrado ainda." : "Nenhum pedido encontrado para essa busca."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
