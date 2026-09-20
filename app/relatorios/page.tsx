"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { calcComissaoPedido, calcRepassePedido } from "@/lib/financeiro";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { baixarXlsx } from "@/lib/xlsx";

const RELATORIOS = [
  { key: "cadastro", label: "Cadastro de clientes" },
  { key: "ativos", label: "Clientes ativos" },
  { key: "inativos", label: "Clientes inativos" },
  { key: "prospecto", label: "Clientes prospecto" },
  { key: "cidade", label: "Clientes por cidade" },
  { key: "segmento", label: "Clientes por segmento" },
  { key: "vendas", label: "Vendas do período" },
  { key: "financeiro", label: "Comissão / Repasse / Líquido do período" },
];

const RELATORIOS_CLIENTE = ["cadastro", "ativos", "inativos", "prospecto", "cidade", "segmento"];
const RELATORIOS_FINANCEIRO = ["vendas", "financeiro"];
// Relatórios de clientes que têm o filtro "Impressão" (controle salvo no banco,
// na tabela clientes_impressos — não altera o cadastro do cliente).
const RELATORIOS_IMPRESSAO = ["ativos", "inativos", "cidade"];

// Restauração de backup: tabelas na ordem que respeita as chaves estrangeiras.
const TABELAS_RESTAURACAO = [
  "vendedores", "clientes", "vendedor_cliente_status", "pedidos", "pedido_itens",
  "pedido_boletos", "devolucoes", "agenda", "rascunhos", "metas_mensais", "clientes_impressos",
];
// Colunas calculadas pelo banco (não podem ser gravadas): valor_total = quantidade x valor unitário.
const COLUNAS_GERADAS: Record<string, string[]> = {
  pedido_itens: ["valor_total"],
  devolucoes: ["valor_total"],
};

function downloadCsv(filename: string, rows: any[]) {
  if (!rows.length) { alert("Sem dados para exportar."); return; }
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function primeiroDiaMesAtual() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function ultimoDiaMesAtual() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export default function RelatoriosPage() {
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [clientesTodos, setClientesTodos] = useState<any[]>([]);

  const [relatorioAtivo, setRelatorioAtivo] = useState<string | null>(null);
  const [resultado, setResultado] = useState<any[] | null>(null);
  const [tituloResultado, setTituloResultado] = useState("");
  const [resumoFinanceiro, setResumoFinanceiro] = useState<any | null>(null);
  const [carregando, setCarregando] = useState(false);

  // ── Filtros ──────────────────────────────────────────────────────────────
  const [dataInicio, setDataInicio] = useState(primeiroDiaMesAtual());
  const [dataFim, setDataFim] = useState(ultimoDiaMesAtual());
  const [vendedorFiltro, setVendedorFiltro] = useState("");
  const [cidadeFiltro, setCidadeFiltro] = useState("");
  const [segmentoFiltro, setSegmentoFiltro] = useState("");
  // Período dedicado aos relatórios de clientes (última compra). Fica vazio
  // por padrão — vazio significa "sem restrição de período", como nos
  // sistemas de gestão de verdade.
  const [clienteDataInicio, setClienteDataInicio] = useState("");
  const [clienteDataFim, setClienteDataFim] = useState("");
  // Intervalo de impressão por numeração (Nº), só para os relatórios de
  // clientes. Vazio = imprime/exporta tudo, sem restringir.
  const [numeroDe, setNumeroDe] = useState("");
  const [numeroAte, setNumeroAte] = useState("");
  // Filtro "Impressão" (ainda não impressos / já impressos / todos) e os ids
  // dos clientes na mesma ordem das linhas exibidas (usado para marcar ao imprimir).
  const [impressaoFiltro, setImpressaoFiltro] = useState<"todos" | "nao" | "sim">("todos");
  const [idsResultado, setIdsResultado] = useState<string[]>([]);
  // Fechamento do relatório "Vendas do período" (totais por unidade e valor).
  const [restaurando, setRestaurando] = useState(false);
  const [totaisVendas, setTotaisVendas] = useState<{ kg: number; un: number; valor: number } | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: vd }, { data: cl }] = await Promise.all([
        supabase.from("vendedores").select("id, nome").order("nome"),
        supabase
          .from("clientes")
          .select("id, nome_fantasia, razao_social, cnpj, cidade, uf, telefone, whatsapp, contato, vendedor_id, status, segmento, ultima_compra, vendedores(nome)"),
      ]);
      setVendedores(vd ?? []);
      setClientesTodos(cl ?? []);
    })();
  }, []);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtNum = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  const fmtData = (d: string | null | undefined) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "-";
  const fmtDataCurta = (d: string | null | undefined) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "-";

  const cidadesDisponiveis = Array.from(new Set(clientesTodos.map((c) => c.cidade).filter(Boolean))).sort();
  const segmentosDisponiveis = Array.from(new Set(clientesTodos.map((c) => c.segmento).filter(Boolean))).sort();

  function mapClienteRow(c: any) {
    return {
      cliente: c.nome_fantasia || c.razao_social || "-",
      cnpj: c.cnpj || "-",
      cidade: c.cidade ? `${c.cidade}${c.uf ? "/" + c.uf : ""}` : "-",
      telefone: c.telefone || "-",
      whatsapp: c.whatsapp || "-",
      contato: c.contato || "-",
      vendedor: c.vendedores?.nome || "-",
      status: c.status || "-",
      segmento: c.segmento || "-",
    };
  }

  function aplicarFiltrosClientes(lista: any[]) {
    return lista.filter((c) => {
      if (vendedorFiltro && c.vendedor_id !== vendedorFiltro) return false;
      if (cidadeFiltro && c.cidade !== cidadeFiltro) return false;
      if (segmentoFiltro && c.segmento !== segmentoFiltro) return false;
      if (clienteDataInicio || clienteDataFim) {
        if (!c.ultima_compra) return false;
        if (clienteDataInicio && c.ultima_compra < clienteDataInicio) return false;
        if (clienteDataFim && c.ultima_compra > clienteDataFim) return false;
      }
      return true;
    });
  }

  const rodar = useCallback(async (key: string) => {
    setRelatorioAtivo(key);
    setCarregando(true);
    try {
      // ── Relatório financeiro (Comissão / Repasse / Líquido do período) ──────
      if (key === "financeiro") {
        let pixQuery = supabase
          .from("pedidos")
          .select("valor_total, comissao_percentual, repasse_percentual, comissao_manual, vendedor_id")
          .eq("forma_pagamento", "pix")
          .gte("data_entrega", dataInicio)
          .lte("data_entrega", dataFim);
        if (vendedorFiltro) pixQuery = pixQuery.eq("vendedor_id", vendedorFiltro);

        let boletoQuery = supabase
          .from("pedido_boletos")
          .select("valor, data_vencimento, pedidos!inner(valor_total, comissao_percentual, repasse_percentual, comissao_manual, vendedor_id)")
          .gte("data_vencimento", dataInicio)
          .lte("data_vencimento", dataFim);
        if (vendedorFiltro) boletoQuery = boletoQuery.eq("pedidos.vendedor_id", vendedorFiltro);

        let devQuery = supabase
          .from("devolucoes")
          .select("valor_total, comissao_percentual, repasse_percentual, vendedor_id, pedidos!inner(id)")
          .gte("data_devolucao", dataInicio)
          .lte("data_devolucao", dataFim);
        if (vendedorFiltro) devQuery = devQuery.eq("vendedor_id", vendedorFiltro);

        const [{ data: pixPedidos }, { data: boletos }, { data: devs }] = await Promise.all([pixQuery, boletoQuery, devQuery]);

        let totalVendido = 0, comissaoTotal = 0, repasseTotal = 0;
        for (const p of pixPedidos ?? []) {
          totalVendido += Number(p.valor_total);
          comissaoTotal += calcComissaoPedido(Number(p.valor_total), Number(p.comissao_percentual), p.comissao_manual);
          repasseTotal += calcRepassePedido(Number(p.valor_total), Number(p.repasse_percentual));
        }
        for (const b of (boletos ?? []) as any[]) {
          const pedido = b.pedidos;
          if (!pedido) continue;
          totalVendido += Number(b.valor);
          const proporcao = Number(b.valor) / Number(pedido.valor_total || 1);
          comissaoTotal += calcComissaoPedido(Number(pedido.valor_total), Number(pedido.comissao_percentual), pedido.comissao_manual) * proporcao;
          repasseTotal += calcRepassePedido(Number(pedido.valor_total), Number(pedido.repasse_percentual)) * proporcao;
        }

        let devValor = 0, devComissao = 0, devRepasse = 0;
        for (const d of (devs ?? []) as any[]) {
          devValor += Number(d.valor_total);
          const pctCom = Number(d.comissao_percentual) || 0;
          const pctRep = Number(d.repasse_percentual) || 0;
          if (pctCom > 0) devComissao += Number(d.valor_total) * (pctCom / 100);
          if (pctRep > 0) devRepasse += Number(d.valor_total) * (pctRep / 100);
        }

        const totalVendidoFinal = +(totalVendido - devValor).toFixed(2);
        const comissaoFinal = +(comissaoTotal - devComissao).toFixed(2);
        const repasseFinal = +(repasseTotal - devRepasse).toFixed(2);
        const liquido = +(comissaoFinal - repasseFinal).toFixed(2);

        setResumoFinanceiro({ totalVendido: totalVendidoFinal, comissaoTotal: comissaoFinal, repasseTotal: repasseFinal, liquido, devolucoesAbatidas: +devValor.toFixed(2) });

        // ── Detalhamento venda por venda ────────────────────────────────────
        // Mesmos filtros e mesmas regras dos totais acima: à vista/PIX entra pela
        // data de entrega; cada parcela de boleto entra pelo seu vencimento
        // (comissão/repasse proporcionais ao valor da parcela); devoluções pela
        // data da devolução. Só detalha de onde vêm os valores dos cards.
        let pixDetQuery = supabase
          .from("pedidos")
          .select("id, data_pedido, data_entrega, valor_total, comissao_percentual, repasse_percentual, repasse_para, comissao_manual, vendedor_id, clientes(nome_fantasia, razao_social), vendedores(nome)")
          .eq("forma_pagamento", "pix")
          .gte("data_entrega", dataInicio)
          .lte("data_entrega", dataFim);
        if (vendedorFiltro) pixDetQuery = pixDetQuery.eq("vendedor_id", vendedorFiltro);

        let boletoDetQuery = supabase
          .from("pedido_boletos")
          .select("numero_parcela, valor, data_vencimento, pedidos!inner(id, data_pedido, data_entrega, qtd_parcelas, valor_total, comissao_percentual, repasse_percentual, repasse_para, comissao_manual, vendedor_id, clientes(nome_fantasia, razao_social), vendedores(nome))")
          .gte("data_vencimento", dataInicio)
          .lte("data_vencimento", dataFim);
        if (vendedorFiltro) boletoDetQuery = boletoDetQuery.eq("pedidos.vendedor_id", vendedorFiltro);

        let devDetQuery = supabase
          .from("devolucoes")
          .select("data_devolucao, valor_total, comissao_percentual, repasse_percentual, vendedor_id, clientes(nome_fantasia, razao_social), vendedores(nome), pedidos!inner(id, data_pedido, data_entrega, repasse_para)")
          .gte("data_devolucao", dataInicio)
          .lte("data_devolucao", dataFim);
        if (vendedorFiltro) devDetQuery = devDetQuery.eq("vendedor_id", vendedorFiltro);

        const [{ data: pixDet, error: erroPixDet }, { data: bolDet, error: erroBolDet }, { data: devDet, error: erroDevDet }] =
          await Promise.all([pixDetQuery, boletoDetQuery, devDetQuery]);
        const erroDet = erroPixDet || erroBolDet || erroDevDet;
        if (erroDet) {
          setResultado([]);
          setTituloResultado(`Erro ao montar o detalhamento: ${erroDet.message}`);
          return;
        }

        const fmtPct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
        // % efetivo de comissão do pedido (se houve comissão manual em R$, mostra o % equivalente)
        const pctComissaoPedido = (ped: any) => {
          const vt = Number(ped.valor_total) || 0;
          if (ped.comissao_manual !== null && ped.comissao_manual !== undefined && vt > 0) return (Number(ped.comissao_manual) / vt) * 100;
          return Number(ped.comissao_percentual) || 0;
        };
        const nomeDe = (o: any) => o?.clientes?.nome_fantasia || o?.clientes?.razao_social || "-";
        const linhasFin: { sortKey: string; row: any }[] = [];

        for (const p of (pixDet ?? []) as any[]) {
          const vt = Number(p.valor_total);
          const com = calcComissaoPedido(vt, Number(p.comissao_percentual), p.comissao_manual);
          const rep = calcRepassePedido(vt, Number(p.repasse_percentual));
          linhasFin.push({
            sortKey: `${p.data_entrega}|${nomeDe(p)}`,
            row: {
              "Data do pedido": fmtData(p.data_pedido),
              "Data de entrega": fmtData(p.data_entrega),
              "Cliente": nomeDe(p),
              "Vendedor": p.vendedores?.nome || "-",
              "Forma de pagamento": "PIX / À vista",
              "Vencimento do boleto": "-",
              "Valor da venda": fmt(vt),
              "Comissão %": fmtPct(pctComissaoPedido(p)),
              "Valor da comissão": fmt(com),
              "Repasse %": fmtPct(Number(p.repasse_percentual) || 0),
              "Repasse para": p.repasse_para || "-",
              "Valor do repasse": fmt(rep),
              "Líquido": fmt(com - rep),
            },
          });
        }

        for (const b of (bolDet ?? []) as any[]) {
          const ped = b.pedidos;
          if (!ped) continue;
          const vt = Number(ped.valor_total);
          const valorParcela = Number(b.valor);
          const proporcao = valorParcela / Number(ped.valor_total || 1);
          const com = calcComissaoPedido(vt, Number(ped.comissao_percentual), ped.comissao_manual) * proporcao;
          const rep = calcRepassePedido(vt, Number(ped.repasse_percentual)) * proporcao;
          linhasFin.push({
            sortKey: `${b.data_vencimento}|${nomeDe(ped)}`,
            row: {
              "Data do pedido": fmtData(ped.data_pedido),
              "Data de entrega": fmtData(ped.data_entrega),
              "Cliente": nomeDe(ped),
              "Vendedor": ped.vendedores?.nome || "-",
              "Forma de pagamento": ped.qtd_parcelas ? `Boleto ${b.numero_parcela}/${ped.qtd_parcelas}` : `Boleto parcela ${b.numero_parcela}`,
              "Vencimento do boleto": fmtData(b.data_vencimento),
              "Valor da venda": fmt(valorParcela),
              "Comissão %": fmtPct(pctComissaoPedido(ped)),
              "Valor da comissão": fmt(com),
              "Repasse %": fmtPct(Number(ped.repasse_percentual) || 0),
              "Repasse para": ped.repasse_para || "-",
              "Valor do repasse": fmt(rep),
              "Líquido": fmt(com - rep),
            },
          });
        }

        for (const d of (devDet ?? []) as any[]) {
          const vt = Number(d.valor_total);
          const pctCom = Number(d.comissao_percentual) || 0;
          const pctRep = Number(d.repasse_percentual) || 0;
          const com = pctCom > 0 ? -(vt * (pctCom / 100)) : 0;
          const rep = pctRep > 0 ? -(vt * (pctRep / 100)) : 0;
          linhasFin.push({
            sortKey: `${d.data_devolucao}|${nomeDe(d)}`,
            row: {
              "Data do pedido": fmtData(d.pedidos?.data_pedido),
              "Data de entrega": fmtData(d.pedidos?.data_entrega),
              "Cliente": nomeDe(d),
              "Vendedor": d.vendedores?.nome || "-",
              "Forma de pagamento": `Devolução ${fmtData(d.data_devolucao)}`,
              "Vencimento do boleto": "-",
              "Valor da venda": fmt(-vt),
              "Comissão %": fmtPct(pctCom),
              "Valor da comissão": fmt(com),
              "Repasse %": fmtPct(pctRep),
              "Repasse para": d.pedidos?.repasse_para || "-",
              "Valor do repasse": fmt(rep),
              "Líquido": fmt(com - rep),
            },
          });
        }

        setResultado(
          linhasFin
            .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0))
            .map((x) => x.row)
        );
        setTituloResultado("Comissão / Repasse / Líquido do período");
        return;
      }
      setResumoFinanceiro(null);

      // ── Vendas do período ────────────────────────────────────────────────
      if (key === "vendas") {
        let pedidosQuery = supabase
          .from("pedidos")
          .select("data_pedido, data_entrega, vendedor_id, clientes(nome_fantasia, razao_social), vendedores(nome), pedido_itens(produto_nome, quantidade, unidade, valor_unitario, valor_total)")
          .gte("data_pedido", dataInicio)
          .lte("data_pedido", dataFim);
        if (vendedorFiltro) pedidosQuery = pedidosQuery.eq("vendedor_id", vendedorFiltro);

        let devQuery = supabase
          .from("devolucoes")
          .select("data_devolucao, produto_nome, quantidade, valor_unitario, valor_total, vendedor_id, clientes(nome_fantasia, razao_social), vendedores(nome), pedido_itens(unidade), pedidos!inner(id)")
          .gte("data_devolucao", dataInicio)
          .lte("data_devolucao", dataFim);
        if (vendedorFiltro) devQuery = devQuery.eq("vendedor_id", vendedorFiltro);

        const [{ data: pedidosPeriodo, error: erroPedidos }, { data: devPeriodo, error: erroDev }] = await Promise.all([pedidosQuery, devQuery]);

        // Se o banco recusar a consulta, mostra o motivo em vez de "Sem dados".
        if (erroPedidos) {
          setResultado([]);
          setTotaisVendas(null);
          setTituloResultado(`Erro ao buscar as vendas: ${erroPedidos.message}`);
          return;
        }
        if (erroDev) alert(`Não foi possível carregar as devoluções: ${erroDev.message}`);

        // Quantidade com a unidade do item (KG ou UN). Itens sem unidade = KG.
        const fmtQtd = (q: number, un: string) => `${fmtNum(q)} ${un}`;
        let totalKg = 0;
        let totalUn = 0;
        let totalValor = 0;

        // Uma linha por item de cada pedido (data, entrega, cliente, vendedor,
        // produto, quantidade, valor unitário e valor total).
        const linhasVendas: { sortKey: string; row: any }[] = [];
        for (const p of (pedidosPeriodo ?? []) as any[]) {
          const nomeCliente = p.clientes?.nome_fantasia || p.clientes?.razao_social || "-";
          for (const it of (p.pedido_itens ?? []) as any[]) {
            const un = it.unidade === "UN" ? "UN" : "KG";
            if (un === "UN") totalUn += Number(it.quantidade); else totalKg += Number(it.quantidade);
            totalValor += Number(it.valor_total);
            linhasVendas.push({
              sortKey: `${p.data_pedido}|${nomeCliente}`,
              row: {
                data_pedido: fmtData(p.data_pedido),
                data_entrega: fmtData(p.data_entrega),
                cliente: nomeCliente,
                vendedor: p.vendedores?.nome || "-",
                produto: it.produto_nome || "-",
                quantidade: fmtQtd(Number(it.quantidade), un),
                valor_unitario: fmt(Number(it.valor_unitario)),
                valor_total: fmt(Number(it.valor_total)),
              },
            });
          }
        }
        for (const d of (devPeriodo ?? []) as any[]) {
          const nomeCliente = d.clientes?.nome_fantasia || d.clientes?.razao_social || "-";
          // A devolução segue a unidade do item devolvido (sem vínculo = KG).
          const un = d.pedido_itens?.unidade === "UN" ? "UN" : "KG";
          if (un === "UN") totalUn -= Number(d.quantidade); else totalKg -= Number(d.quantidade);
          totalValor -= Number(d.valor_total);
          linhasVendas.push({
            sortKey: `${d.data_devolucao}|${nomeCliente}`,
            row: {
              data_pedido: "-",
              data_entrega: fmtData(d.data_devolucao),
              cliente: nomeCliente,
              vendedor: d.vendedores?.nome || "-",
              produto: `DEVOLUÇÃO - ${d.produto_nome || "-"}`,
              quantidade: fmtQtd(-Number(d.quantidade), un),
              valor_unitario: fmt(Number(d.valor_unitario)),
              valor_total: fmt(-Number(d.valor_total)),
            },
          });
        }
        const linhas = linhasVendas
          .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0))
          .map((x) => x.row);

        setTotaisVendas({
          kg: Math.round(totalKg * 1000) / 1000,
          un: Math.round(totalUn * 1000) / 1000,
          valor: Math.round(totalValor * 100) / 100,
        });
        setResultado(linhas);
        setTituloResultado("Vendas do período");
        return;
      }

      // ── Relatórios de clientes ───────────────────────────────────────────
      let base = clientesTodos;
      if (key === "ativos") base = base.filter((c) => c.status === "ativo");
      if (key === "inativos") base = base.filter((c) => c.status === "inativo");
      if (key === "prospecto") base = base.filter((c) => c.status === "prospecto");
      if (key === "cidade" && !cidadeFiltro) { setResultado([]); setTituloResultado("Clientes por cidade — selecione uma cidade"); return; }
      if (key === "segmento" && !segmentoFiltro) { setResultado([]); setTituloResultado("Clientes por segmento — selecione um segmento"); return; }

      let filtrados = aplicarFiltrosClientes(base);
      if (RELATORIOS_IMPRESSAO.includes(key) && impressaoFiltro !== "todos") {
        const { data: imp, error: erroImp } = await supabase.from("clientes_impressos").select("cliente_id");
        if (erroImp) {
          setResultado([]);
          setIdsResultado([]);
          setTituloResultado(`Erro ao consultar o controle de impressão: ${erroImp.message}`);
          return;
        }
        const jaImpressos = new Set((imp ?? []).map((r: any) => r.cliente_id));
        filtrados = filtrados.filter((c) => (impressaoFiltro === "sim" ? jaImpressos.has(c.id) : !jaImpressos.has(c.id)));
      }
      setIdsResultado(filtrados.map((c) => c.id));
      setResultado(filtrados.map(mapClienteRow));
      setTituloResultado(RELATORIOS.find((r) => r.key === key)?.label ?? "");
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataInicio, dataFim, vendedorFiltro, cidadeFiltro, segmentoFiltro, clienteDataInicio, clienteDataFim, clientesTodos, impressaoFiltro]);

  // Reaplica o relatório ativo sempre que um filtro muda
  useEffect(() => {
    if (relatorioAtivo) rodar(relatorioAtivo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataInicio, dataFim, vendedorFiltro, cidadeFiltro, segmentoFiltro, clienteDataInicio, clienteDataFim, impressaoFiltro]);

  async function backupCompleto() {
    const tabelas = ["vendedores", "clientes", "vendedor_cliente_status", "agenda", "pedidos", "pedido_itens", "pedido_boletos", "devolucoes", "rascunhos", "metas_mensais", "clientes_impressos"];
    const out: Record<string, any> = {};
    for (const t of tabelas) {
      const { data } = await supabase.from(t).select("*");
      out[t] = data ?? [];
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `backup-sistema-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  // Exporta para Excel (.xlsx) exatamente o que está na tela (já com os filtros
  // aplicados), com o fechamento no final dos relatórios que têm totais.
  function exportarExcel() {
    const linhas = (resultadoNumerado ?? resultado) as any[] | null;
    if (!linhas || linhas.length === 0) { alert("Sem dados para exportar."); return; }
    const colunas = Object.keys(linhas[0]);
    let rodape: any[][] | undefined;
    if (relatorioAtivo === "vendas" && totaisVendas) {
      rodape = [
        ["TOTAL KG", { valor: totaisVendas.kg, formato: "kg" }],
        ["TOTAL UN", { valor: totaisVendas.un, formato: "num" }],
        ["VALOR TOTAL", { valor: totaisVendas.valor, formato: "moeda" }],
      ];
    } else if (relatorioAtivo === "financeiro" && resumoFinanceiro) {
      rodape = [
        ["TOTAL VENDIDO", { valor: resumoFinanceiro.totalVendido, formato: "moeda" }],
        ["TOTAL COMISSÃO", { valor: resumoFinanceiro.comissaoTotal, formato: "moeda" }],
        ["TOTAL REPASSE", { valor: resumoFinanceiro.repasseTotal, formato: "moeda" }],
        ["DEVOLUÇÕES", { valor: resumoFinanceiro.devolucoesAbatidas, formato: "moeda" }],
        ["TOTAL LÍQUIDO", { valor: resumoFinanceiro.liquido, formato: "moeda" }],
      ];
    }
    baixarXlsx({
      arquivo: `${tituloResultado}.xlsx`,
      planilha: tituloResultado,
      colunas,
      linhas: linhas.map((r) => colunas.map((c) => r[c])),
      rodape,
    });
  }

  // Restaura os dados de um backup JSON (gerado pelo botão "Backup completo").
  // Grava os registros do backup (mesmo código = sobrescreve). Não apaga nada
  // que exista hoje e não esteja no backup.
  function restaurarBackup() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const arquivo = input.files?.[0];
      if (!arquivo) return;

      let dados: any;
      try {
        dados = JSON.parse(await arquivo.text());
      } catch {
        alert("Não foi possível ler o arquivo. Escolha um backup .json gerado por este sistema.");
        return;
      }
      const tabelas = TABELAS_RESTAURACAO.filter((t) => dados && Array.isArray(dados[t]));
      if (!dados || typeof dados !== "object" || tabelas.length === 0) {
        alert("Este arquivo não parece ser um backup do sistema.");
        return;
      }

      const resumo = tabelas.map((t) => `${t}: ${dados[t].length} registro(s)`).join("\n");
      if (!confirm(`Restaurar este backup?\n\n${resumo}\n\nOs registros do backup serão gravados no sistema (registros com o mesmo código são sobrescritos pelos dados do backup). Nada que existe hoje e não está no backup será apagado.`)) return;

      setRestaurando(true);
      const erros: string[] = [];
      let total = 0;
      try {
        for (const t of tabelas) {
          const geradas = COLUNAS_GERADAS[t] ?? [];
          const linhas = (dados[t] as any[]).map((r) => {
            const c = { ...r };
            for (const col of geradas) delete c[col];
            return c;
          });
          for (let i = 0; i < linhas.length; i += 500) {
            const lote = linhas.slice(i, i + 500);
            const { error } = await supabase.from(t).upsert(lote);
            if (error) { erros.push(`${t}: ${error.message}`); break; }
            total += lote.length;
          }
        }
      } finally {
        setRestaurando(false);
      }

      if (erros.length) {
        alert(`Restauração concluída com problemas.\n\nGravados: ${total} registro(s).\n\nErros:\n${erros.join("\n")}`);
      } else {
        alert(`Backup restaurado com sucesso: ${total} registro(s) gravado(s).`);
      }
      window.location.reload();
    };
    input.click();
  }

  const isClienteReport = relatorioAtivo ? RELATORIOS_CLIENTE.includes(relatorioAtivo) : false;
  const isFinanceiroReport = relatorioAtivo ? RELATORIOS_FINANCEIRO.includes(relatorioAtivo) : false;
  const isImpressaoReport = relatorioAtivo ? RELATORIOS_IMPRESSAO.includes(relatorioAtivo) : false;

  // Numeração sequencial (1, 2, 3...) só para os relatórios de clientes —
  // é só uma coluna de exibição/organização, não mexe em nenhum id do banco
  // nem em nenhuma regra de funcionamento. Cada relatório numera do zero.
  const resultadoNumerado = (isClienteReport && resultado)
    ? resultado.map((row, i) => ({ "Nº": i + 1, ...row }))
    : resultado;

  // Intervalo de impressão/PDF por Nº (ex.: do 1 ao 20). Vazio = tudo.
  const resultadoParaImprimir = (() => {
    if (!resultadoNumerado) return resultadoNumerado;
    if (!isClienteReport) return resultadoNumerado;
    const de = numeroDe ? parseInt(numeroDe, 10) : 1;
    const ate = numeroAte ? parseInt(numeroAte, 10) : resultadoNumerado.length;
    return resultadoNumerado.filter((row: any) => row["Nº"] >= de && row["Nº"] <= ate);
  })();

  function baixarPdf() {
    if (!resultadoParaImprimir || resultadoParaImprimir.length === 0) { alert("Sem dados para gerar o PDF."); return; }

    if (isClienteReport) {
      baixarPdfClientesEmBlocos();
      marcarComoImpressos();
      return;
    }

    // A4 paisagem explícito (297 x 210mm) — usable width ≈ 297 - 2*margem.
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const margemLateral = 8;
    const colunas = Object.keys(resultadoParaImprimir[0]);
    doc.setFontSize(14);
    doc.text(tituloResultado, margemLateral, 15);
    autoTable(doc, {
      startY: 20,
      margin: { left: margemLateral, right: margemLateral },
      head: [colunas],
      body: resultadoParaImprimir.map((row: any) => colunas.map((c) => String(row[c] ?? ""))),
      styles: { fontSize: relatorioAtivo === "financeiro" ? 7 : 8, cellPadding: 1.5, overflow: "linebreak" },
      headStyles: { fillColor: [124, 58, 237] }, // roxo, mesma cor do sistema
    });
    // Fechamento no final do PDF (Vendas do período / Comissão-Repasse-Líquido).
    const fechamento: string[] =
      relatorioAtivo === "vendas" && totaisVendas
        ? [
            `TOTAL KG: ${fmtNum(totaisVendas.kg)} KG`,
            `TOTAL UNIDADES: ${fmtNum(totaisVendas.un)} UN`,
            `VALOR TOTAL DO PERÍODO: ${fmt(totaisVendas.valor)}`,
          ]
        : relatorioAtivo === "financeiro" && resumoFinanceiro
        ? [
            `TOTAL VENDIDO: ${fmt(resumoFinanceiro.totalVendido)}`,
            `TOTAL COMISSÃO: ${fmt(resumoFinanceiro.comissaoTotal)}`,
            `TOTAL REPASSE: ${fmt(resumoFinanceiro.repasseTotal)}`,
            `DEVOLUÇÕES: ${fmt(resumoFinanceiro.devolucoesAbatidas)}`,
            `TOTAL LÍQUIDO: ${fmt(resumoFinanceiro.liquido)}`,
          ]
        : [];
    if (fechamento.length > 0) {
      let yTot = ((doc as any).lastAutoTable?.finalY ?? 20) + 8;
      if (yTot + fechamento.length * 5 + 4 > doc.internal.pageSize.getHeight() - 8) { doc.addPage(); yTot = 15; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      fechamento.forEach((linha, i) => doc.text(linha, margemLateral, yTot + i * 5));
      doc.setFont("helvetica", "normal");
    }
    doc.save(`${tituloResultado}.pdf`);
  }

  // Depois de gerar o PDF, grava no banco (tabela clientes_impressos) que os
  // clientes daquela impressão já foram impressos. Não altera o cadastro.
  async function marcarComoImpressos() {
    if (!relatorioAtivo || !RELATORIOS_IMPRESSAO.includes(relatorioAtivo)) return;
    const ids = ((resultadoParaImprimir ?? []) as any[])
      .map((row) => idsResultado[Number(row["Nº"]) - 1])
      .filter(Boolean);
    if (ids.length === 0) return;
    const agora = new Date().toISOString();
    const { error } = await supabase
      .from("clientes_impressos")
      .upsert(ids.map((id) => ({ cliente_id: id, impresso_em: agora })), { onConflict: "cliente_id" });
    if (error) {
      alert(`O PDF foi gerado, mas não foi possível registrar os clientes como impressos: ${error.message}`);
      return;
    }
    rodar(relatorioAtivo);
  }

  // ── PDF de clientes em blocos por cliente (para anotação à mão) ────────────
  // Cada cliente ocupa uma faixa própria com os campos em 3 colunas, separada
  // da próxima por uma linha horizontal escura. Sem tabela de colunas
  // apertadas — CNPJ, telefone e WhatsApp saem em texto corrido, sem quebrar.
  function baixarPdfClientesEmBlocos() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();   // 297mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
    const margem = 10;
    const colX = [margem, margem + 95, margem + 190]; // 3 colunas de campos

    const faixaTexto = (numeroDe || numeroAte)
      ? `Clientes nº ${numeroDe || (resultadoNumerado?.[0]?.["Nº"] ?? 1)} ao nº ${numeroAte || (resultadoNumerado?.[resultadoNumerado.length - 1]?.["Nº"] ?? "")}`
      : "";
    // Cabeçalho compacto (título + faixa, quando houver), redesenhado em
    // TODA página — assim, ao imprimir, cada folha mostra de qual relatório
    // se trata, sem ficar confuso quando as páginas forem separadas.
    const alturaCabecalho = faixaTexto ? 11 : 7;
    function desenharCabecalho() {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(tituloResultado, margem, margem + 3);
      if (faixaTexto) {
        doc.setFontSize(8);
        doc.text(faixaTexto, margem, margem + 7.5);
      }
    }

    // 17,8mm por bloco => fecha 10 clientes por página, inclusive na
    // primeira (mesmo com o cabeçalho ocupando espaço). Fonte continua 9pt;
    // só o espaçamento entre as 3 linhas e a folga antes da linha divisória
    // ficaram um pouco mais enxutos.
    const alturaBloco = 17.8;

    let y = margem + alturaCabecalho;
    desenharCabecalho();
    doc.setFontSize(9);

    (resultadoParaImprimir as any[]).forEach((row) => {
      if (y + alturaBloco > pageHeight - margem) {
        doc.addPage();
        desenharCabecalho();
        y = margem + alturaCabecalho;
        doc.setFontSize(9);
      }

      const y1 = y + 4.4;
      const y2 = y + 8.8;
      const y3 = y + 13.2;

      doc.setFont("helvetica", "normal");
      doc.text(`Nº ${row["Nº"]}   Cliente: ${row.cliente}`, colX[0], y1);
      doc.text(`CNPJ: ${row.cnpj}`, colX[1], y1);
      doc.text(`Cidade: ${row.cidade}`, colX[2], y1);

      doc.text(`Telefone: ${row.telefone}`, colX[0], y2);
      doc.text(`WhatsApp: ${row.whatsapp}`, colX[1], y2);
      doc.text(`Contato: ${row.contato}`, colX[2], y2);

      doc.text(`Vendedor: ${row.vendedor}`, colX[0], y3);
      doc.text(`Status: ${row.status}`, colX[1], y3);
      doc.text(`Segmento: ${row.segmento}`, colX[2], y3);

      // Linha horizontal escura separando este cliente do próximo.
      doc.setDrawColor(60, 60, 60);
      doc.setLineWidth(0.3);
      doc.line(margem, y + alturaBloco - 1, pageWidth - margem, y + alturaBloco - 1);

      y += alturaBloco;
    });

    doc.save(`${tituloResultado}.pdf`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-1" onClick={restaurarBackup} disabled={restaurando}>
            <Download size={16} className="rotate-180" /> {restaurando ? "Restaurando..." : "Restaurar backup (JSON)"}
          </button>
          <button className="btn-primary flex items-center gap-1" onClick={backupCompleto}><Download size={16} /> Backup completo (JSON)</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {RELATORIOS.map((r) => (
          <button
            key={r.key}
            onClick={() => { setNumeroDe(""); setNumeroAte(""); rodar(r.key); }}
            className={`card text-left hover:ring-2 hover:ring-brand-200 transition text-sm font-medium ${relatorioAtivo === r.key ? "ring-2 ring-brand-500" : ""}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {relatorioAtivo && (
        <div className="card">
          <p className="text-xs font-semibold text-gray-500 mb-2">Filtros</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            {isFinanceiroReport && (
              <>
                <div><label className="text-xs text-gray-500">📅 Data inicial</label><input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></div>
                <div><label className="text-xs text-gray-500">📅 Data final</label><input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></div>
              </>
            )}

            {isClienteReport && (
              <>
                <div><label className="text-xs text-gray-500">📅 Data inicial</label><input type="date" value={clienteDataInicio} onChange={(e) => setClienteDataInicio(e.target.value)} /></div>
                <div><label className="text-xs text-gray-500">📅 Data final</label><input type="date" value={clienteDataFim} onChange={(e) => setClienteDataFim(e.target.value)} /></div>
              </>
            )}

            {(isFinanceiroReport || isClienteReport) && (
              <div>
                <label className="text-xs text-gray-500">Vendedor</label>
                <select value={vendedorFiltro} onChange={(e) => setVendedorFiltro(e.target.value)}>
                  <option value="">Todos</option>
                  {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                </select>
              </div>
            )}

            {isClienteReport && (
              <div>
                <label className="text-xs text-gray-500">{relatorioAtivo === "cidade" ? "Cidade (selecione)" : "Cidade"}</label>
                <select value={cidadeFiltro} onChange={(e) => setCidadeFiltro(e.target.value)}>
                  <option value="">{relatorioAtivo === "cidade" ? "Selecione uma cidade" : "Todas"}</option>
                  {cidadesDisponiveis.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            {isClienteReport && (
              <div>
                <label className="text-xs text-gray-500">{relatorioAtivo === "segmento" ? "Segmento (selecione)" : "Segmento"}</label>
                <select value={segmentoFiltro} onChange={(e) => setSegmentoFiltro(e.target.value)}>
                  <option value="">{relatorioAtivo === "segmento" ? "Selecione um segmento" : "Todos"}</option>
                  {segmentosDisponiveis.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {isImpressaoReport && (
              <div>
                <label className="text-xs text-gray-500">Impressão</label>
                <select value={impressaoFiltro} onChange={(e) => setImpressaoFiltro(e.target.value as "todos" | "nao" | "sim")}>
                  <option value="nao">Ainda não impressos</option>
                  <option value="sim">Já impressos</option>
                  <option value="todos">Todos</option>
                </select>
              </div>
            )}
          </div>
          {isClienteReport && (
            <p className="text-[11px] text-gray-400 mt-2">
              Data inicial/final filtram pela <strong>última compra</strong> do cliente. Deixe em branco para não restringir por período.
            </p>
          )}
          {isImpressaoReport && (
            <p className="text-[11px] text-gray-400 mt-1">
              Ao baixar o PDF, os clientes desse relatório ficam marcados como <strong>já impressos</strong> (controle salvo no banco; o cadastro do cliente não é alterado).
            </p>
          )}
        </div>
      )}

      {resumoFinanceiro && (
        <div className="card grid grid-cols-2 md:grid-cols-5 gap-4">
          <div><p className="text-xs text-gray-500">Total vendido</p><p className="font-bold">{fmt(resumoFinanceiro.totalVendido)}</p></div>
          <div><p className="text-xs text-gray-500">Comissão total</p><p className="font-bold text-blue-600">{fmt(resumoFinanceiro.comissaoTotal)}</p></div>
          <div><p className="text-xs text-gray-500">Repasse</p><p className="font-bold text-orange-600">{fmt(resumoFinanceiro.repasseTotal)}</p></div>
          <div><p className="text-xs text-gray-500">Devoluções abatidas</p><p className="font-bold text-red-600">{fmt(resumoFinanceiro.devolucoesAbatidas)}</p></div>
          <div><p className="text-xs text-gray-500">Líquido a receber</p><p className="font-bold text-violet-600">{fmt(resumoFinanceiro.liquido)}</p></div>
        </div>
      )}

      {resultado && (
        <div className="card overflow-x-auto">
          <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
            <p className="font-semibold">{tituloResultado}{carregando ? " (carregando...)" : ""}</p>
            <div className="flex items-center gap-2 flex-wrap">
              {isClienteReport && resultado.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <span>Imprimir do nº</span>
                  <input
                    type="number" min={1} value={numeroDe}
                    onChange={(e) => setNumeroDe(e.target.value)}
                    placeholder="1"
                    className="!w-16 !py-1"
                  />
                  <span>ao nº</span>
                  <input
                    type="number" min={1} value={numeroAte}
                    onChange={(e) => setNumeroAte(e.target.value)}
                    placeholder={String(resultado.length)}
                    className="!w-16 !py-1"
                  />
                </div>
              )}
              <button className="btn-secondary flex items-center gap-1" onClick={() => downloadCsv(`${tituloResultado}.csv`, resultadoNumerado ?? resultado)}>
                <Download size={14} /> Exportar CSV
              </button>
              <button className="btn-secondary flex items-center gap-1" onClick={exportarExcel}>
                <Download size={14} /> Exportar Excel
              </button>
              <button className="btn-primary flex items-center gap-1" onClick={baixarPdf}>
                <Download size={14} /> Baixar PDF
              </button>
            </div>
          </div>
          {resultado.length === 0 ? <p className="text-sm text-gray-400">Sem dados para os filtros selecionados.</p> : (
            <table className="w-full">
              <thead><tr>{Object.keys((resultadoNumerado ?? resultado)[0]).map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {(resultadoNumerado ?? resultado).map((row: any, i: number) => (
                  <tr key={i}>{Object.values(row).map((v: any, j) => <td key={j}>{String(v ?? "")}</td>)}</tr>
                ))}
              </tbody>
            </table>
          )}
          {relatorioAtivo === "financeiro" && resumoFinanceiro && resultado.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div><p className="text-xs text-gray-500 font-semibold">TOTAL VENDIDO</p><p className="font-bold">{fmt(resumoFinanceiro.totalVendido)}</p></div>
              <div><p className="text-xs text-gray-500 font-semibold">TOTAL COMISSÃO</p><p className="font-bold text-blue-600">{fmt(resumoFinanceiro.comissaoTotal)}</p></div>
              <div><p className="text-xs text-gray-500 font-semibold">TOTAL REPASSE</p><p className="font-bold text-orange-600">{fmt(resumoFinanceiro.repasseTotal)}</p></div>
              <div><p className="text-xs text-gray-500 font-semibold">DEVOLUÇÕES</p><p className="font-bold text-red-600">{fmt(resumoFinanceiro.devolucoesAbatidas)}</p></div>
              <div><p className="text-xs text-gray-500 font-semibold">TOTAL LÍQUIDO</p><p className="font-bold text-violet-600">{fmt(resumoFinanceiro.liquido)}</p></div>
            </div>
          )}
          {relatorioAtivo === "vendas" && totaisVendas && resultado.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 text-sm font-semibold space-y-1">
              <p>TOTAL KG: {fmtNum(totaisVendas.kg)} KG</p>
              <p>TOTAL UNIDADES: {fmtNum(totaisVendas.un)} UN</p>
              <p>VALOR TOTAL DO PERÍODO: {fmt(totaisVendas.valor)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
