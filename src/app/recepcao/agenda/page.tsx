"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Clock3, LoaderCircle, MessageCircle, RefreshCw, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Appointment = {
  id: string;
  patient_name: string;
  guardian_name: string;
  contact_phone: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type: "presencial" | "retorno" | "pre_natal";
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  doctors: { full_name: string } | null;
};

const messageOptions = [
  { value: "reminder", label: "Lembrete de consulta" },
  { value: "confirm", label: "Solicitar confirmação" },
  { value: "reschedule", label: "Solicitar remarcação" },
  { value: "cancel", label: "Aviso de cancelamento" },
  { value: "custom", label: "Mensagem personalizada" },
] as const;

type MessageKind = (typeof messageOptions)[number]["value"];

function formatDate(date: string) {
  if (!date) return "Data a definir";
  const [year, month, day] = date.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function phoneForWhatsApp(phone: string) {
  return phone.replace(/\D/g, "").replace(/^0+/, "");
}

export default function ReceptionAgendaPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<MessageKind>("reminder");
  const [customMessage, setCustomMessage] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("upcoming");

  async function loadAppointments() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    if (!supabase) {
      setError("O Supabase ainda não está configurado neste ambiente.");
      setLoading(false);
      return;
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      window.location.href = "/login";
      return;
    }
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile) {
      setError("Não foi possível validar seu perfil. Peça ao administrador para verificar seu acesso.");
      setLoading(false);
      return;
    }
    setRole(profile.role);
    if (!["admin", "receptionist"].includes(profile.role)) {
      setError("Esta área é exclusiva para a administração e a recepção.");
      setLoading(false);
      return;
    }
    const { data, error: appointmentsError } = await supabase
      .from("appointments")
      .select("id,patient_name,guardian_name,contact_phone,appointment_date,appointment_time,appointment_type,status,doctors(full_name)")
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });
    if (appointmentsError) {
      setError("Não foi possível carregar a agenda. Confira as políticas do Supabase e tente novamente.");
      setAppointments([]);
    } else {
      setAppointments((data ?? []) as unknown as Appointment[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadAppointments();
  }, []);

  const visibleAppointments = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA");
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return appointments.filter((appointment) => {
      const matchesQuery = !normalizedQuery || [
        appointment.patient_name,
        appointment.guardian_name,
        appointment.contact_phone,
      ].some((value) => value?.toLocaleLowerCase("pt-BR").includes(normalizedQuery));
      const matchesFilter = filter === "all"
        || (filter === "upcoming" && appointment.appointment_date >= today && !["cancelled", "completed"].includes(appointment.status))
        || (filter === "pending" && appointment.status === "pending")
        || (filter === "cancelled" && appointment.status === "cancelled");
      return matchesQuery && matchesFilter;
    });
  }, [appointments, filter, query]);

  function messageFor(appointment: Appointment) {
    const date = formatDate(appointment.appointment_date);
    const time = appointment.appointment_time?.slice(0, 5) ?? "";
    const doctor = appointment.doctors?.full_name ?? "equipe médica da Britos Pediatria";
    const greeting = `Olá, ${appointment.guardian_name}! Aqui é a equipe da Britos Pediatria.\n\n`;
    const details = `Paciente: ${appointment.patient_name}\nData: ${date}\nHorário: ${time}\nProfissional: ${doctor}\n\n`;
    const messages: Record<Exclude<MessageKind, "custom">, string> = {
      reminder: `${greeting}Este é um lembrete da consulta de ${appointment.patient_name}.\n\n${details}Se precisar de ajuda, responda a esta mensagem. Será um prazer atender vocês! 💚🩷`,
      confirm: `${greeting}Gostaríamos de confirmar a consulta abaixo:\n\n${details}Por favor, responda confirmando sua presença ou avise se precisar de ajuda. 💚🩷`,
      reschedule: `${greeting}Precisamos conversar sobre a remarcação da consulta de ${appointment.patient_name}, prevista para ${date} às ${time}.\n\nPor favor, responda a esta mensagem para combinarmos um novo horário. Pedimos desculpas pelo transtorno. 💚🩷`,
      cancel: `${greeting}Estamos entrando em contato para informar que a consulta de ${appointment.patient_name}, prevista para ${date} às ${time}, precisará ser cancelada.\n\nPor favor, responda para combinarmos os próximos passos. Pedimos desculpas pelo transtorno. 💚🩷`,
    };
    return kind === "custom" ? customMessage.trim() : messages[kind];
  }

  function whatsappHref(appointment: Appointment) {
    const phone = phoneForWhatsApp(appointment.contact_phone);
    if (!phone) return "";
    return `https://wa.me/${phone}?text=${encodeURIComponent(messageFor(appointment))}`;
  }

  return (
    <main className="portal-page">
      <div className="portal-wrap" style={{ maxWidth: 1180 }}>
        <Link href="/painel" className="portal-back"><ArrowLeft size={16} /> Voltar ao painel</Link>
        <section className="portal-card" style={{ maxWidth: "none" }}>
          <div className="brand portal-brand">
            <span className="brand-mark"><CalendarDays size={24} /></span>
            <span><strong>britos<span> pediatria</span></strong><small>Agenda da recepção</small></span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap", marginTop: 24 }}>
            <div>
              <span className="eyebrow"><CalendarDays size={14} /> GESTÃO DE CONSULTAS</span>
              <h1 style={{ marginBottom: 8 }}>Agenda e comunicação</h1>
              <p>Consulte os agendamentos e prepare lembretes ou avisos para enviar pelo WhatsApp.</p>
            </div>
            <button type="button" className="button button-secondary" onClick={() => void loadAppointments()} disabled={loading}>
              {loading ? <LoaderCircle size={17} className="spin" /> : <RefreshCw size={17} />} Atualizar agenda
            </button>
          </div>

          {error && <div className="notice" role="alert"><ShieldAlert size={18} /> {error}</div>}
          {role && ["admin", "receptionist"].includes(role) && (
            <>
              <div className="form-grid" style={{ marginTop: 22, gridTemplateColumns: "minmax(200px, 1.5fr) minmax(180px, 1fr) minmax(220px, 1.5fr)" }}>
                <label className="form-field">Buscar paciente ou responsável
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, responsável ou telefone" />
                </label>
                <label className="form-field">Exibir
                  <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                    <option value="upcoming">Próximas consultas</option>
                    <option value="pending">Aguardando confirmação</option>
                    <option value="cancelled">Canceladas</option>
                    <option value="all">Todas as consultas</option>
                  </select>
                </label>
                <label className="form-field">Modelo da mensagem
                  <select value={kind} onChange={(event) => setKind(event.target.value as MessageKind)}>
                    {messageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>
              {kind === "custom" && (
                <label className="form-field" style={{ display: "block", marginTop: 12 }}>Mensagem personalizada
                  <textarea value={customMessage} onChange={(event) => setCustomMessage(event.target.value)} rows={4} placeholder="Escreva a mensagem para o responsável. Revise antes de enviar." />
                </label>
              )}
              <p className="form-note" style={{ marginTop: 12 }}>O botão abre o WhatsApp com o texto preenchido. A recepção revisa e envia manualmente; esta tela não envia mensagens automaticamente.</p>
              {loading ? <p className="form-note">Carregando agenda…</p> : visibleAppointments.length === 0 ? (
                <div className="notice" style={{ marginTop: 18 }}>Nenhuma consulta encontrada para esse filtro.</div>
              ) : (
                <div style={{ overflowX: "auto", marginTop: 20 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                    <thead><tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                      {["Paciente / responsável", "Data e horário", "Profissional", "Status", "Mensagem"].map((heading) => <th key={heading} style={{ padding: "12px 10px", fontSize: 13 }}>{heading}</th>)}
                    </tr></thead>
                    <tbody>
                      {visibleAppointments.map((appointment) => {
                        const href = whatsappHref(appointment);
                        const statusLabels: Record<Appointment["status"], string> = { pending: "Pendente", confirmed: "Confirmada", completed: "Concluída", cancelled: "Cancelada", no_show: "Não compareceu" };
                        return <tr key={appointment.id} style={{ borderBottom: "1px solid var(--line)" }}>
                          <td style={{ padding: "14px 10px" }}><strong>{appointment.patient_name}</strong><div className="form-note">{appointment.guardian_name}</div><div className="form-note">{appointment.contact_phone}</div></td>
                          <td style={{ padding: "14px 10px", whiteSpace: "nowrap" }}><div>{formatDate(appointment.appointment_date)}</div><div className="form-note"><Clock3 size={13} style={{ display: "inline", verticalAlign: "middle" }} /> {appointment.appointment_time?.slice(0, 5)}</div></td>
                          <td style={{ padding: "14px 10px" }}>{appointment.doctors?.full_name ?? "A definir"}<div className="form-note">{appointment.appointment_type === "pre_natal" ? "Pré-natal" : appointment.appointment_type === "retorno" ? "Retorno" : "Consultório"}</div></td>
                          <td style={{ padding: "14px 10px" }}><span className="eyebrow">{statusLabels[appointment.status]}</span></td>
                          <td style={{ padding: "14px 10px" }}>
                            {href && (kind !== "custom" || customMessage.trim()) ? <a className="button button-primary" href={href} target="_blank" rel="noreferrer" style={{ whiteSpace: "nowrap" }}><MessageCircle size={16} /> Abrir WhatsApp</a> : <span className="form-note">Telefone ou mensagem pendente</span>}
                          </td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
