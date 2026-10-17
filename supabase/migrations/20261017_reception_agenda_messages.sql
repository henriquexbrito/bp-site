-- Britos Pediatria: agenda da recepção, modalidades e cadastro administrativo de pacientes.
-- Execute em um projeto de testes primeiro e revise as políticas de acesso antes de usar dados reais.
alter type public.appointment_type add value if not exists 'pre_natal';

insert into public.doctors (id, full_name, crm, active)
values
 ('00000000-0000-4000-8000-000000000001', 'Dra. Danielle Lourenço Alves Brito', 'CRM/RJ 748188', true),
 ('00000000-0000-4000-8000-000000000002', 'Dr. Marcelo Dutra Alves Brito', 'CRM/RJ 748170', true)
on conflict (crm) do update
set full_name = excluded.full_name, active = true;

-- Pacientes podem ser cadastrados pela recepção antes de criarem uma conta no portal.
alter table public.patients alter column guardian_user_id drop not null;
alter table public.patients add column if not exists contact_email text;
alter table public.patients add column if not exists contact_phone text;
alter table public.patients add column if not exists relationship_to_patient text;
alter table public.patients add column if not exists administrative_notes text;

-- Evita dois agendamentos ativos para o mesmo profissional no mesmo horário exato.
-- Cancelamentos liberam o horário novamente. A aplicação ainda deve validar duração/intervalos.
create unique index if not exists appointments_doctor_datetime_active_uidx
on public.appointments (doctor_id, appointment_date, appointment_time)
where doctor_id is not null and status <> 'cancelled';

-- A recepção pode cadastrar e atualizar dados administrativos de pacientes; RLS continua obrigatória.
drop policy if exists "guardian or staff add patient" on public.patients;
create policy "guardian or staff add patient" on public.patients for insert to authenticated
with check (
  guardian_user_id = auth.uid()
  or public.current_app_role() in ('doctor','receptionist','admin')
);
drop policy if exists "reception admin update patient" on public.patients;
create policy "reception admin update patient" on public.patients for update to authenticated
using (public.current_app_role() in ('receptionist','admin'))
with check (public.current_app_role() in ('receptionist','admin'));

-- A mensagem do WhatsApp é preparada no navegador e enviada manualmente pela equipe.
-- Não armazene dados clínicos em mensagens de lembrete.
