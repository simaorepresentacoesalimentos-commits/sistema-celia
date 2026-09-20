-- ============================================================
-- MIGRAÇÃO: controle de impressão dos relatórios de clientes
-- Rode este script UMA vez no SQL Editor do Supabase.
-- Cria uma tabela NOVA e separada. NÃO altera a tabela "clientes"
-- (cadastro/status) nem nenhum dado existente.
-- Se um cliente for excluído, o registro de impressão dele sai junto.
-- ============================================================
create table if not exists clientes_impressos (
  cliente_id uuid primary key references clientes(id) on delete cascade,
  impresso_em timestamptz not null default now()
);

alter table clientes_impressos enable row level security;

drop policy if exists "auth full access" on clientes_impressos;
create policy "auth full access" on clientes_impressos
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
