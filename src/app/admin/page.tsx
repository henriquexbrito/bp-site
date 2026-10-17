"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, LoaderCircle, ShieldCheck, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ upcoming: 0, pending: 0, patients: 0 });
  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      if (!supabase) { setError("Configure o Supabase para ativar o painel administrativo."); setLoading(false); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (profileError || !profile || profile.role !== "admin") {
        setError("Acesso restrito ao administrador oficial. Entre com uma conta autorizada.");
        setLoading(false); return;
      }
      const today = new Date();
      const date = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
      const [upcoming, pending, patients] = await Promise.all([
        supabase.from("appointments").select("id", { count: "exact", head: true }).gte("appointment_date", date).neq("status", "cancelled"),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("patients").select("id", { count: "exact", head: true }),
      ]);
      if (active) {
        if (upcoming.error || pending.error || patients.error) setError("Não foi possível carregar todos os indicadores. Verifique as políticas do banco.");
        setStats({ upcoming: upcoming.count ?? 0, pending: pending.count ?? 0, patients: patients.count ?? 0 });
        setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);
  return <main className="portal-page"><div className="portal-wrap" style={{ maxWidth: 1100 }}>
    <Link href="/painel" className="portal-back"><ArrowLeft size={16} /> Voltar ao painel</Link>
    <section className="portal-card" style={{ maxWidth: "none" }}>
      <div className="brand portal-brand"><span className="brand-mark"><ShieldCheck size={24} /></span><span><strong>britos<span> pediatria</span></strong><small>Administração oficial</small></span></div>
      <span className="eyebrow">PAINEL ADMINISTRATIVO</span><h1>Visão geral da clínica</h1><p>Área restrita para administração. Use uma conta criada e autorizada no Supabase.</p>
      {error && <div className="notice" role="alert">{error}</div>}
      {loading ? <p className="form-note"><LoaderCircle size={16} style={{ display: "inline", verticalAlign: "middle" }} /> Carregando indicadores…</p> : <>
        <div className="service-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", marginTop: 22 }}>
          <article className="service-card"><div className="service-icon"><CalendarDays size={22} /></div><h3>Próximas consultas</h3><p style={{ fontSize: 28, fontWeight: 700 }}>{stats.upcoming}</p></article>
          <article className="service-card service-1"><div className="service-icon"><CalendarDays size={22} /></div><h3>Aguardando confirmação</h3><p style={{ fontSize: 28, fontWeight: 700 }}>{stats.pending}</p></article>
          <article className="service-card"><div className="service-icon"><Users size={22} /></div><h3>Pacientes cadastrados</h3><p style={{ fontSize: 28, fontWeight: 700 }}>{stats.patients}</p></article>
        </div>
        <div className="service-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", marginTop: 18 }}>
          <article className="service-card"><h3>Agenda e mensagens</h3><p>Gerencie consultas, confirme horários e prepare mensagens de WhatsApp.</p><Link href="/recepcao/agenda">Abrir agenda <CalendarDays size={15} /></Link></article>
          <article className="service-card service-1"><h3>Cadastro de pacientes</h3><p>Consulte e cadastre os dados administrativos dos pacientes.</p><Link href="/recepcao/pacientes">Abrir pacientes <Users size={15} /></Link></article>
        </div>
      </>}
      <p className="form-note" style={{ marginTop: 24 }}>Este painel inicial não substitui uma revisão de segurança. Não cadastre dados reais de saúde até validar RLS, backups e perfis.</p>
    </section>
  </div></main>;
}
