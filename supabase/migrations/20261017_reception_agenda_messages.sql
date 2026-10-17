-- Britos Pediatria: recursos de agenda e comunicação da recepção.
-- Execute no SQL Editor do Supabase antes de testar consultas pré-natais.
alter type public.appointment_type add value if not exists 'pre_natal';

insert into public.doctors (id, full_name, crm, active)
values
 ('00000000-0000-4000-8000-000000000001', 'Dra. Danielle Lourenço Alves Brito', 'CRM/RJ 748188', true),
 ('00000000-0000-4000-8000-000000000002', 'Dr. Marcelo Dutra Alves Brito', 'CRM/RJ 748170', true)
on conflict (crm) do update
set full_name = excluded.full_name, active = true;

-- Observação: mensagens são preparadas para revisão humana e abertas no WhatsApp.
-- Nenhum envio automático é feito por esta alteração.
