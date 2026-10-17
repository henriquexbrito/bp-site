-- Britos Pediatria: schema inicial. Revisar e aplicar no SQL Editor do Supabase.
-- Dados de saúde são sensíveis sob a LGPD. Não usar dados reais antes de revisar as políticas.
create extension if not exists pgcrypto;
create type public.app_role as enum ('patient','doctor','receptionist','admin');
create type public.appointment_status as enum ('pending','confirmed','completed','cancelled','no_show');
create type public.appointment_type as enum ('presencial','retorno','pre_natal');

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null,
 email text,
 phone text,
 role public.app_role not null default 'patient',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.patients (
 id uuid primary key default gen_random_uuid(),
 full_name text not null,
 birth_date date,
 guardian_user_id uuid not null references public.profiles(id),
 guardian_name text not null,
 created_at timestamptz not null default now()
);
create table public.doctors (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid unique references public.profiles(id),
 full_name text not null,
 crm text not null unique,
 active boolean not null default true,
 created_at timestamptz not null default now()
);

-- Identificadores estáveis usados pelo formulário de agendamento.
insert into public.doctors (id, full_name, crm, active)
values
 ('00000000-0000-4000-8000-000000000001', 'Dra. Danielle Lourenço Alves Brito', 'CRM/RJ 748188', true),
 ('00000000-0000-4000-8000-000000000002', 'Dr. Marcelo Dutra Alves Brito', 'CRM/RJ 748170', true)
on conflict (crm) do update
set full_name = excluded.full_name, active = true;
create table public.availability_slots (
 id uuid primary key default gen_random_uuid(),
 doctor_id uuid not null references public.doctors(id),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 is_available boolean not null default true,
 created_by uuid references public.profiles(id),
 constraint valid_slot check(ends_at > starts_at),
 constraint unique_doctor_start unique(doctor_id, starts_at)
);
create table public.appointments (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid references public.patients(id),
 patient_name text not null,
 guardian_name text not null,
 contact_email text not null,
 contact_phone text not null,
 doctor_id uuid references public.doctors(id),
 appointment_type public.appointment_type not null default 'presencial',
 appointment_date date not null,
 appointment_time time not null,
 slot_id uuid references public.availability_slots(id),
 status public.appointment_status not null default 'pending',
 created_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.medical_records (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid not null references public.patients(id),
 doctor_id uuid not null references public.doctors(id),
 appointment_id uuid references public.appointments(id),
 record_type text not null default 'evolucao',
 clinical_notes text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.documents (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid not null references public.patients(id),
 uploaded_by uuid not null references public.profiles(id),
 title text not null,
 document_type text not null,
 storage_path text not null,
 visible_to_guardian boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.payments (
 id uuid primary key default gen_random_uuid(),
 appointment_id uuid not null references public.appointments(id),
 amount_cents integer not null check(amount_cents >= 0),
 payment_method text,
 paid_at timestamptz,
 recorded_by uuid not null references public.profiles(id),
 notes text,
 created_at timestamptz not null default now()
);
create table public.audit_logs (
 id bigint generated always as identity primary key,
 actor_id uuid references public.profiles(id),
 action text not null,
 resource_type text not null,
 resource_id text,
 created_at timestamptz not null default now()
);
create index appointments_date_idx on public.appointments(appointment_date, appointment_time);
create index appointments_doctor_idx on public.appointments(doctor_id, appointment_date);
create index patients_guardian_idx on public.patients(guardian_user_id);
create index records_patient_idx on public.medical_records(patient_id, created_at desc);

create or replace function public.current_app_role() returns public.app_role
language sql stable security definer set search_path=public
as $$ select role from public.profiles where id=auth.uid() $$;

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.doctors enable row level security;
alter table public.availability_slots enable row level security;
alter table public.appointments enable row level security;
alter table public.medical_records enable row level security;
alter table public.documents enable row level security;
alter table public.payments enable row level security;
alter table public.audit_logs enable row level security;

create policy "profile self or staff read" on public.profiles for select to authenticated
using(id=auth.uid() or public.current_app_role() in ('doctor','receptionist','admin'));
create policy "profile self update without role change" on public.profiles for update to authenticated
using(id=auth.uid()) with check(id=auth.uid() and role=public.current_app_role());
create policy "guardian or staff read patients" on public.patients for select to authenticated
using(guardian_user_id=auth.uid() or public.current_app_role() in ('doctor','receptionist','admin'));
create policy "guardian or staff add patient" on public.patients for insert to authenticated
with check(guardian_user_id=auth.uid() or public.current_app_role() in ('doctor','receptionist','admin'));
create policy "active doctor directory" on public.doctors for select to anon,authenticated using(active=true);
create policy "admin manage doctors" on public.doctors for all to authenticated
using(public.current_app_role()='admin') with check(public.current_app_role()='admin');
create policy "available slots read" on public.availability_slots for select to anon,authenticated
using(is_available=true or public.current_app_role() in ('doctor','receptionist','admin'));
create policy "staff manage slots" on public.availability_slots for all to authenticated
using(public.current_app_role() in ('doctor','receptionist','admin')) with check(public.current_app_role() in ('doctor','receptionist','admin'));
create policy "appointments authorized read" on public.appointments for select to authenticated
using(created_by=auth.uid() or (patient_id is not null and patient_id in(select id from public.patients where guardian_user_id=auth.uid())) or public.current_app_role() in ('doctor','receptionist','admin'));
create policy "create own appointment or staff" on public.appointments for insert to authenticated
with check(created_by=auth.uid() or public.current_app_role() in ('doctor','receptionist','admin'));
create policy "staff update appointments" on public.appointments for update to authenticated
using(public.current_app_role() in ('doctor','receptionist','admin')) with check(public.current_app_role() in ('doctor','receptionist','admin'));
create policy "doctor admin read records" on public.medical_records for select to authenticated
using(public.current_app_role() in ('doctor','admin'));
create policy "doctor admin create records" on public.medical_records for insert to authenticated
with check(public.current_app_role() in ('doctor','admin'));
create policy "doctor admin update records" on public.medical_records for update to authenticated
using(public.current_app_role() in ('doctor','admin')) with check(public.current_app_role() in ('doctor','admin'));
create policy "guardian released documents or staff" on public.documents for select to authenticated
using(public.current_app_role() in ('doctor','receptionist','admin') or (visible_to_guardian=true and patient_id in(select id from public.patients where guardian_user_id=auth.uid())));
create policy "clinical staff upload documents" on public.documents for insert to authenticated
with check(public.current_app_role() in ('doctor','admin'));
create policy "reception or admin manage payments" on public.payments for all to authenticated
using(public.current_app_role() in ('receptionist','admin')) with check(public.current_app_role() in ('receptionist','admin'));
create policy "admin read audit" on public.audit_logs for select to authenticated using(public.current_app_role()='admin');
create policy "staff append audit" on public.audit_logs for insert to authenticated
with check(actor_id=auth.uid() and public.current_app_role() in ('doctor','receptionist','admin'));

-- Production checklist: role assignment only through trusted admin workflow; atomic slot reservation RPC;
-- clinician-scoped policies; private Storage bucket policies; audit triggers; backup and restore tests.
-- Never expose service_role keys in client code. Appointment submissions from anonymous users need a
-- rate-limited server endpoint with validation; do not weaken RLS to make a public form work.
