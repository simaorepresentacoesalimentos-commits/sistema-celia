"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { calcComissaoPedido, calcRepassePedido } from "@/lib/financeiro";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
        setResultado([{
          total_vendido: totalVendidoFinal,
          comissao_total: comissaoFinal,
          repasse_total: repasseFinal,
          devolucoes_abatidas: +devValor.toFixed(2),
          liquido,
        }]);
        setTituloResultado("Comissão / Repasse / Líquido do período");
        return;
      }
      setResumoFinanceiro(null);

      // ── Vendas do período ────────────────────────────────────────────────
      if (key === "vendas") {
        let pedidosQuery = supabase
          .from("pedidos")
          .select("data_pedido, data_entrega, vendedor_id, clientes(nome_fantasia, razao_social), vendedores(nome), pedido_itens(produto_nome, quantidade, valor_unitario, valor_total)")
          .gte("data_pedido", dataInicio)
          .lte("data_pedido", dataFim);
        if (vendedorFiltro) pedidosQuery = pedidosQuery.eq("vendedor_id", vendedorFiltro);

        let devQuery = supabase
          .from("devolucoes")
          .select("data_devolucao, produto_nome, quantidade, valor_unitario, valor_total, vendedor_id, clientes(nome_fantasia, razao_social), vendedores(nome), pedidos!inner(id)")
          .gte("data_devolucao", dataInicio)
          .lte("data_devolucao", dataFim);
        if (vendedorFiltro) devQuery = devQuery.eq("vendedor_id", vendedorFiltro);

        const [{ data: pedidosPeriodo, error: erroPedidos }, { data: devPeriodo, error: erroDev }] = await Promise.all([pedidosQuery, devQuery]);

        // Se o banco recusar a consulta, mostra o motivo em vez de "Sem dados".
        if (erroPedidos) {
          setResultado([]);
          setTituloResultado(`Erro ao buscar as vendas: ${erroPedidos.message}`);
          return;
        }
        if (erroDev) alert(`Não foi possível carregar as devoluções: ${erroDev.message}`);

        const fmtQtd = (q: number) => `${q.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} KG`;

        // Uma linha por item de cada pedido (data, entrega, cliente, vendedor,
        // produto, quantidade, valor unitário e valor total).
        const linhasVendas: { sortKey: string; row: any }[] = [];
        for (const p of (pedidosPeriodo ?? []) as any[]) {
          const nomeCliente = p.clientes?.nome_fantasia || p.clientes?.razao_social || "-";
          for (const it of (p.pedido_itens ?? []) as any[]) {
            linhasVendas.push({
              sortKey: `${p.data_pedido}|${nomeCliente}`,
              row: {
                data_pedido: fmtData(p.data_pedido),
                data_entrega: fmtData(p.data_entrega),
                cliente: nomeCliente,
                vendedor: p.vendedores?.nome || "-",
                produto: it.produto_nome || "-",
                quantidade: fmtQtd(Number(it.quantidade)),
                valor_unitario: fmt(Number(it.valor_unitario)),
                valor_total: fmt(Number(it.valor_total)),
              },
            });
          }
        }
        for (const d of (devPeriodo ?? []) as any[]) {
          const nomeCliente = d.clientes?.nome_fantasia || d.clientes?.razao_social || "-";
          linhasVendas.push({
            sortKey: `${d.data_devolucao}|${nomeCliente}`,
            row: {
              data_pedido: "-",
              data_entrega: fmtData(d.data_devolucao),
              cliente: nomeCliente,
              vendedor: d.vendedores?.nome || "-",
              produto: `DEVOLUÇÃO - ${d.produto_nome || "-"}`,
              quantidade: fmtQtd(-Number(d.quantidade)),
              valor_unitario: fmt(Number(d.valor_unitario)),
              valor_total: fmt(-Number(d.valor_total)),
            },
          });
        }
        const linhas = linhasVendas
          .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0))
          .map((x) => x.row);

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
    const tabelas = ["vendedores", "clientes", "vendedor_cliente_status", "agenda", "pedidos", "pedido_itens", "pedido_boletos", "devolucoes", "rascunhos", "metas_mensais"];
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
      styles: { fontSize: 8, cellPadding: 1.5, overflow: "linebreak" },
      headStyles: { fillColor: [124, 58, 237] }, // roxo, mesma cor do sistema
    });
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
        <button className="btn-primary flex items-center gap-1" onClick={backupCompleto}><Download size={16} /> Backup completo (JSON)</button>
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
        </div>
      )}
    </div>
  );
}
