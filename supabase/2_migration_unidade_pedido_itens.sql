-- ============================================================
-- MIGRAÇÃO: Unidade (KG / UN) em cada item do pedido
-- Rode este script UMA vez no SQL Editor do Supabase,
-- ANTES de publicar o código novo.
-- Alteração 100% aditiva: só acrescenta a coluna "unidade" em pedido_itens.
-- Nenhum valor, quantidade ou produto existente é alterado.
-- Os itens já cadastrados ficam com unidade = 'KG' (padrão da coluna),
-- que é como todos estão registrados hoje.
-- ============================================================
alter table pedido_itens
  add column if not exists unidade text not null default 'KG'
  check (unidade in ('KG', 'UN'));

-- Faz a API do Supabase enxergar a coluna nova imediatamente.
notify pgrst, 'reload schema';

-- (Opcional) Conferência: deve mostrar todos os itens antigos como KG.
-- select unidade, count(*) from pedido_itens group by unidade;
