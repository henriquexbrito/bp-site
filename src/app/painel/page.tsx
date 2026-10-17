"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, FileText, HeartHandshake, LogOut, MessageCircle, ShieldCheck, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Appointment = {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  appointment_type: string;
  patient_name: string;
};

export default function PatientPanel() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("patient");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      if (!supabase) {
        if (active) {
          setMessage("Conecte o projeto Supabase para ativar a área privada.");
          setLoading(false);
        }
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      setEmail(user.email ?? "");
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (profile?.role) setRole(profile.role);
      const { data, error } = await supabase.from("appointments")
        .select("id,appointment_date,appointment_time,status,appointment_type,patient_name")
        .order("appointment_date", { ascending: true }).limit(20);
      if (active) {
        if (error) setMessage("Não foi possível carregar as consultas. Verifique as políticas de acesso do banco.");
        else setAppointments((data ?? []) as Appointment[]);
        setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function logout() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const staff = role === "admin" || role === "receptionist";

  return (
    <main className="portal-page">
      <div className="portal-wrap">
        <Link href="/" className="portal-back"><ArrowLeft size={16} /> Voltar ao site</Link>
        <section className="portal-card" style={{ maxWidth: 760 }}>
          <Link href="/" className="brand portal-brand">
            <span className="brand-mark"><HeartHandshake size={24} /></span>
            <span><strong>britos<span> pediatria</span></strong><small>{staff ? "Área da equipe" : "Área do paciente"}</small></span>
          </Link>
          <span className="eyebrow"><ShieldCheck size={14} /> ÁREA PRIVADA</span>
          <h1>{staff ? "Bem-vindo à área da equipe." : "Olá, que bom ter você aqui."}</h1>
          <p>{email || "Acompanhe seus pedidos e próximos passos do cuidado."}</p>
          {loading ? <p>Carregando suas informações…</p> : (
            <>
              {message && <div className="notice notice-warning">{message}</div>}
              {staff && (
                <div className="service-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", marginTop: 25 }}>
                  <article className="service-card">
                    <div className="service-icon"><CalendarDays size={22} /></div>
                    <h3>Agenda da recepção</h3>
                    <p>Consulte consultas e prepare mensagens para pacientes.</p>
                    <Link href="/recepcao/agenda">Abrir agenda <CalendarDays size={15} /></Link>
                  </article>
                  <article className="service-card service-1">
                    <div className="service-icon"><Users size={22} /></div>
                    <h3>Pacientes</h3>
                    <p>O cadastro e a gestão completa serão integrados à agenda.</p>
                  </article>
                </div>
              )}
              {!staff && (
                <div className="service-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", marginTop: 25 }}>
                  <article className="service-card">
                    <div className="service-icon"><CalendarDays size={22} /></div>
                    <h3>Agendamentos</h3>
                    <p>Consulte pedidos e próximos horários.</p>
                    <Link href="/agendar">Solicitar consulta <CalendarDays size={15} /></Link>
                  </article>
                  <article className="service-card service-1">
                    <div className="service-icon"><FileText size={22} /></div>
                    <h3>Documentos</h3>
                    <p>Documentos serão exibidos quando liberados pela equipe, com segurança.</p>
                  </article>
                </div>
              )}
              <h2 style={{ fontFamily: "Manrope", fontSize: 21, marginTop: 32 }}> {staff ? "Agenda de consultas" : "Suas consultas"}</h2>
              {appointments.length === 0 ? <p className="form-note">Nenhuma consulta encontrada.{staff ? "" : " Solicite um horário para começar."}</p> : appointments.map((appointment) => (
                <div key={appointment.id} className="notice" style={{ marginTop: 10, background: "#f6f8f4" }}>
                  <strong>{appointment.patient_name}</strong> · {new Date(appointment.appointment_date + "T12:00:00").toLocaleDateString("pt-BR")} às {String(appointment.appointment_time).slice(0, 5)}
                  <br />{appointment.appointment_type === "pre_natal" ? "Pré-natal" : appointment.appointment_type === "retorno" ? "Retorno" : "Consultório"} · {appointment.status === "confirmed" ? "Confirmado" : appointment.status === "cancelled" ? "Cancelado" : appointment.status === "completed" ? "Concluído" : "Aguardando confirmação"}
                </div>
              ))}
              {staff && <p className="form-note" style={{ marginTop: 12 }}><MessageCircle size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Para lembretes e remarcações, abra a agenda da recepção.</p>}
              <button onClick={logout} className="button button-secondary" style={{ marginTop: 25 }}><LogOut size={16} /> Sair da conta</button>
            </>
          )}
        </section>
        <p className="portal-footer">Acesso limitado a informações autorizadas. Nunca compartilhe sua senha.</p>
      </div>
    </main>
  );
}
