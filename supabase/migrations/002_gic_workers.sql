-- Worker snapshots from CSV (bulk load via scripts/populate_supabase_pinecone.py)

create table if not exists public.gic_workers (
    worker_id bigint primary key,
    record jsonb not null,
    ingested_at timestamptz not null default now()
);

create index if not exists idx_gic_workers_city on public.gic_workers ((record->>'city'));
create index if not exists idx_gic_workers_disruption on public.gic_workers ((record->>'disruption_type'));
create index if not exists idx_gic_workers_slab on public.gic_workers ((record->>'selected_slab'));

alter table public.gic_workers enable row level security;
