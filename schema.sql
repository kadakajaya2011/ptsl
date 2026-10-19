-- =====================================================================
--  SKEMA SUPABASE — PTSL & Letter C Desa Kadakajaya
--  Jalankan seluruh isi berkas ini di Supabase → SQL Editor → Run.
--  Aman dijalankan ulang (idempotent) untuk pembaruan.
-- =====================================================================

-- ---------- 1. Profil pengguna & peran ----------
create table if not exists public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nama text,
  role text not null default 'petugas' check (role in ('admin','petugas')),
  aktif boolean not null default false,
  akses jsonb not null default '{"ptsl":"tidak","pemberkasan":"tidak","letterc":"tidak"}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Pengguna PERTAMA yang mendaftar otomatis menjadi admin aktif; berikutnya petugas nonaktif
-- sampai diaktifkan admin (menu Kelola Pengguna).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
declare pertama boolean;
begin
  select not exists(select 1 from public.profiles) into pertama;
  insert into public.profiles(id,email,nama,role,aktif,akses)
  values(new.id,new.email,coalesce(nullif(new.raw_user_meta_data->>'nama',''),split_part(new.email,'@',1)),
    case when pertama then 'admin' else 'petugas' end, pertama,
    case when pertama then '{"ptsl":"tulis","pemberkasan":"tulis","letterc":"tulis"}'::jsonb
         else '{"ptsl":"tidak","pemberkasan":"tidak","letterc":"tidak"}'::jsonb end);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- 2. Fungsi hak akses (dipakai kebijakan RLS) ----------
create or replace function public.akses(mod text) returns text
language sql stable security definer set search_path=public as $$
  select case when p.role='admin' then 'tulis' else coalesce(p.akses->>mod,'tidak') end
  from public.profiles p where p.id=auth.uid() and p.aktif
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select coalesce((select true from public.profiles where id=auth.uid() and role='admin' and aktif),false)
$$;
create or replace function public.can_read(mod text) returns boolean
language sql stable security definer set search_path=public as $$
  select coalesce(public.akses(mod),'tidak') in ('baca','tulis') $$;
create or replace function public.can_write(mod text) returns boolean
language sql stable security definer set search_path=public as $$
  select coalesce(public.akses(mod),'tidak')='tulis' $$;

drop policy if exists profiles_sel on public.profiles;
drop policy if exists profiles_upd on public.profiles;
drop policy if exists profiles_del on public.profiles;
create policy profiles_sel on public.profiles for select to authenticated using (id=auth.uid() or public.is_admin());
create policy profiles_upd on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy profiles_del on public.profiles for delete to authenticated using (public.is_admin() and id<>auth.uid());

-- ---------- 3. Log aktivitas ----------
create table if not exists public.audit_log(
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid, tabel text, row_id text, aksi text, detail jsonb
);
alter table public.audit_log enable row level security;
drop policy if exists audit_sel on public.audit_log;
create policy audit_sel on public.audit_log for select to authenticated using (public.is_admin());

-- ---------- 4. Pemicu umum ----------
create or replace function public.touch_row() returns trigger language plpgsql as $$
begin
  if tg_op='INSERT' then new.ver:=1; new.created_by:=auth.uid();
  else new.ver:=old.ver+1; new.created_by:=old.created_by; end if;
  new.updated_by:=auth.uid(); new.updated_at:=now();
  return new;
end $$;

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path=public as $$
declare d jsonb; ks jsonb;
begin
  if tg_op='DELETE' then
    insert into public.audit_log(user_id,tabel,row_id,aksi,detail) values(auth.uid(),tg_table_name,old.id,'hapus',old.data);
    return old;
  elsif tg_op='UPDATE' then
    select coalesce(jsonb_object_agg(k,v),'{}'::jsonb) into d from jsonb_each(new.data) e(k,v) where old.data->k is distinct from v;
    if length(d::text)>3000 then select coalesce(jsonb_agg(k),'[]'::jsonb) into ks from jsonb_object_keys(d) k; d:=jsonb_build_object('field_berubah',ks); end if;
    insert into public.audit_log(user_id,tabel,row_id,aksi,detail) values(auth.uid(),tg_table_name,new.id,'ubah',d);
  else
    insert into public.audit_log(user_id,tabel,row_id,aksi,detail) values(auth.uid(),tg_table_name,new.id,'tambah',null);
  end if;
  return new;
end $$;

-- ---------- 5. Tabel data (dokumen JSON + versi) ----------
-- modul akses: ptsl | pemberkasan | letterc
do $$
declare r record;
begin
  for r in select * from (values
    ('pengajuan','ptsl',true,true),('penduduk','ptsl',false,false),('dhkp','ptsl',false,false),
    ('berkas','pemberkasan',true,true),
    ('letter_c','letterc',true,true),('mutasi','letterc',true,true),('arsip','letterc',true,true),('pengaturan','letterc',true,true)
  ) v(t,m,rt,aud) loop
    execute format('create table if not exists public.%I(id text primary key, data jsonb not null, ver integer not null default 1, created_by uuid, updated_by uuid, updated_at timestamptz not null default now())', r.t);
    execute format('alter table public.%I enable row level security', r.t);
    execute format('drop policy if exists %I on public.%I', r.t||'_sel', r.t);
    execute format('drop policy if exists %I on public.%I', r.t||'_ins', r.t);
    execute format('drop policy if exists %I on public.%I', r.t||'_upd', r.t);
    execute format('drop policy if exists %I on public.%I', r.t||'_del', r.t);
    execute format('create policy %I on public.%I for select to authenticated using (public.can_read(%L))', r.t||'_sel', r.t, r.m);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_write(%L))', r.t||'_ins', r.t, r.m);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_write(%L)) with check (public.can_write(%L))', r.t||'_upd', r.t, r.m, r.m);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_write(%L))', r.t||'_del', r.t, r.m);
    execute format('drop trigger if exists %I on public.%I', r.t||'_touch', r.t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.touch_row()', r.t||'_touch', r.t);
    execute format('drop trigger if exists %I on public.%I', r.t||'_audit', r.t);
    if r.aud then
      execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', r.t||'_audit', r.t);
    end if;
    if r.rt then
      begin execute format('alter publication supabase_realtime add table public.%I', r.t);
      exception when duplicate_object then null; when undefined_object then null; end;
    end if;
  end loop;
end $$;

-- Indeks bantu pencarian
create index if not exists letter_c_kohir_idx on public.letter_c ((data->>'kohir'));
create index if not exists pengajuan_nop_idx  on public.pengajuan ((data->>'nop'));
create index if not exists mutasi_cid_idx     on public.mutasi ((data->>'cId'));

-- Cabut hak anon sepenuhnya (hanya pengguna login yang boleh mengakses)
revoke all on all tables in schema public from anon;
