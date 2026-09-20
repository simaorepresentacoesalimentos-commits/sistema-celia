-- ============================================================
-- MIGRAÇÃO: campo "Repasse para" no cadastro do pedido
-- Rode este script UMA vez no SQL Editor do Supabase,
-- ANTES de publicar o código novo.
-- Alteração 100% aditiva: só acrescenta a coluna "repasse_para" (texto,
-- opcional) na tabela pedidos. A % de repasse e todos os dados existentes
-- continuam iguais; os pedidos antigos ficam com o campo em branco.
-- ============================================================
alter table pedidos
  add column if not exists repasse_para text;

-- Faz a API do Supabase enxergar a coluna nova imediatamente.
notify pgrst, 'reload schema';
