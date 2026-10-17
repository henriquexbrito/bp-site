"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Check, Clock3, LoaderCircle, MessageCircle, RefreshCw, ShieldAlert, UserPlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clinic } from "@/lib/clinic";

type Status = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
type Appointment = {
  id: string; patient_name: string; guardian_name: string; contact_email: string;
  contact_phone: string; appointment_date: string; appointment_time: string;
  appointment_type: "presencial" | "retorno" | "pre_natal"; status: Status;
  doctor_id: string | null; doctors: { full_name: string } | null;
};
type MessageKind = "reminder" | "confirm" | "reschedule" | "cancel" | "custom";
const messageOptions: { value: MessageKind; label: string }[] = [
  { value: "reminder", label: "Lembrete de consulta" },
  { value: "confirm", label: "Solicitar confirmação" },
  { value: "reschedule", label: "Solicitar remarcação" },
  { value: "cancel", label: "Aviso de cancelamento" },
  { value: "custom", label: "Mensagem personalizada" },
];
const statusLabels: Record<Status, string> = {
  pending: "Pendente", confirmed: "Confirmada", completed: "Concluída",
  cancelled: "Cancelada", no_show: "Não compareceu",
};
function formatDate(date: string) {
  if (!date) return "Data a definir";
  const [year, month, day] = date.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}
function phoneForWhatsApp(phone: string) {
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}
function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
const emptyForm = { patient_name: "", guardian_name: "", contact_email: "", contact_phone: "", doctor_id: "", appointment_type: "presencial" as Appointment["appointment_type"], appointment_date: "", appointment_time: "" };

export default function ReceptionAgendaPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [kind, setKind] = useState<MessageKind>("reminder");
  const [customMessage, setCustomMessage] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("upcoming");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  async function loadAppointments() {
    setLoading(true); setError("");
    const supabase = createClient();
    if (!supabase) { setError("O Supabase ainda não está configurado neste ambiente."); setLoading(false); return; }
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) { window.location.href = "/login"; return; }
    setUserId(user.id);
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError || !profile) { setError("Não foi possível validar seu perfil. Peça ao administrador para verificar seu acesso."); setLoading(false); return; }
    setRole(profile.role);
    if (!["admin", "receptionist"].includes(profile.role)) { setError("Esta área é exclusiva para administração e recepção."); setLoading(false); return; }
    const { data, error: appointmentsError } = await supabase.from("appointments")
      .select("id,patient_name,guardian_name,contact_email,contact_phone,appointment_date,appointment_time,appointment_type,status,doctor_id,doctors(full_name)")
      .order("appointment_date", { ascending: true }).order("appointment_time", { ascending: true });
    if (appointmentsError) { setError("Não foi possível carregar a agenda. Confira as políticas e o schema do Supabase."); setAppointments([]); }
    else setAppointments((data ?? []) as unknown as Appointment[]);
    setLoading(false);
  }
  useEffect(() => { void loadAppointments(); }, []);

  const visibleAppointments = useMemo(() => {
    const today = localToday(); const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return appointments.filter((a) => {
      const matchesQuery = !normalizedQuery || [a.patient_name, a.guardian_name, a.contact_phone].some((v) => v?.toLocaleLowerCase("pt-BR").includes(normalizedQuery));
      const matchesFilter = filter === "all" || (filter === "upcoming" && a.appointment_date >= today && !["cancelled", "completed"].includes(a.status)) || (filter === "pending" && a.status === "pending") || (filter === "cancelled" && a.status === "cancelled");
      return matchesQuery && matchesFilter;
    });
  }, [appointments, filter, query]);

  async function createAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    if (!form.appointment_date || form.appointment_date < localToday()) { setError("Escolha uma data de hoje em diante."); return; }
    if (!form.doctor_id) { setError("Selecione o profissional."); return; }
    const supabase = createClient(); if (!supabase) { setError("Supabase não configurado."); return; }
    setSaving(true);
    const { error: insertError } = await supabase.from("appointments").insert({
      ...form, created_by: userId, status: "pending",
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.code === "23505" ? "Esse horário acabou de ser ocupado. Atualize a agenda e escolha outro." : "Não foi possível criar a consulta. Verifique as políticas e as migrações do Supabase.");
      return;
    }
    setNotice("Consulta cadastrada como pendente. Confirme a disponibilidade antes de informar ao responsável.");
    setForm({ ...emptyForm }); setShowCreate(false); await loadAppointments();
  }

  async function updateStatus(appointment: Appointment, status: Status) {
    if (status === "cancelled" && !window.confirm("Confirma o cancelamento desta consulta?")) return;
    setError(""); setNotice("");
    const supabase = createClient(); if (!supabase) { setError("Supabase não configurado."); return; }
    const { error: updateError } = await supabase.from("appointments").update({ status, updated_at: new Date().toISOString() }).eq("id", appointment.id);
    if (updateError) { setError("Não foi possível atualizar o status. Verifique suas permissões no Supabase."); return; }
    setNotice(`Consulta de ${appointment.patient_name}: ${statusLabels[status].toLocaleLowerCase("pt-BR")}.`);
    await loadAppointments();
  }

  async function saveReschedule(appointment: Appointment) {
    if (!newDate || newDate < localToday() || !newTime) { setError("Escolha uma data válida e um horário."); return; }
    const supabase = createClient(); if (!supabase) { setError("Supabase não configurado."); return; }
    setError(""); setNotice("");
    const { error: updateError } = await supabase.from("appointments").update({
      appointment_date: newDate, appointment_time: newTime, status: "pending", updated_at: new Date().toISOString(),
    }).eq("id", appointment.id);
    if (updateError) { setError(updateError.code === "23505" ? "Este horário já está ocupado. Escolha outro." : "Não foi possível remarcar. Verifique as permissões e as migrações do banco."); return; }
    setRescheduling(null); setNotice("Consulta remarcada e voltou para pendente. Envie um aviso ao responsável pelo WhatsApp."); await loadAppointments();
  }

  function messageFor(a: Appointment) {
    const date = formatDate(a.appointment_date), time = a.appointment_time?.slice(0, 5) ?? "", doctor = a.doctors?.full_name ?? "equipe médica da Britos Pediatria";
    const greeting = `Olá, ${a.guardian_name}! Aqui é a equipe da Britos Pediatria.\n\n`;
    const details = `Paciente: ${a.patient_name}\nData: ${date}\nHorário: ${time}\nProfissional: ${doctor}\n\n`;
    const messages: Record<Exclude<MessageKind, "custom">, string> = {
      reminder: `${greeting}Este é um lembrete da consulta de ${a.patient_name}.\n\n${details}Se precisar de ajuda, responda a esta mensagem. Será um prazer atender vocês! 💚🩷`,
      confirm: `${greeting}Gostaríamos de confirmar a consulta abaixo:\n\n${details}Por favor, responda confirmando sua presença ou avise se precisar de ajuda. 💚🩷`,
      reschedule: `${greeting}Precisamos conversar sobre a remarcação da consulta de ${a.patient_name}, prevista para ${date} às ${time}.\n\nPor favor, responda para combinarmos um novo horário. Pedimos desculpas pelo transtorno. 💚🩷`,
      cancel: `${greeting}Estamos entrando em contato para informar que a consulta de ${a.patient_name}, prevista para ${date} às ${time}, precisará ser cancelada.\n\nPor favor, responda para combinarmos os próximos passos. Pedimos desculpas pelo transtorno. 💚🩷`,
    };
    return kind === "custom" ? customMessage.trim() : messages[kind];
  }
  function whatsappHref(a: Appointment) {
    const phone = phoneForWhatsApp(a.contact_phone);
    return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(messageFor(a))}` : "";
  }

  return <main className="portal-page"><div className="portal-wrap" style={{ maxWidth: 1240 }}>
    <Link href="/painel" className="portal-back"><ArrowLeft size={16} /> Voltar ao painel</Link>
    <section className="portal-card" style={{ maxWidth: "none" }}>
      <div className="brand portal-brand"><span className="brand-mark"><CalendarDays size={24} /></span><span><strong>britos<span> pediatria</span></strong><small>Agenda da recepção</small></span></div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap", marginTop: 24 }}>
        <div><span className="eyebrow"><CalendarDays size={14} /> GESTÃO DE CONSULTAS</span><h1 style={{ marginBottom: 8 }}>Agenda e comunicação</h1><p>Cadastre, confirme, remarque e envie avisos ao responsável.</p></div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="button button-secondary" onClick={() => void loadAppointments()} disabled={loading}>{loading ? <LoaderCircle size={17} /> : <RefreshCw size={17} />} Atualizar</button>
          <button type="button" className="button button-primary" onClick={() => { setShowCreate(!showCreate); setError(""); }}><UserPlus size={17} /> Nova consulta</button>
        </div>
      </div>
      {error && <div className="notice" role="alert"><ShieldAlert size={18} /> {error}</div>}
      {notice && <div className="notice" role="status">{notice}</div>}
      {showCreate && <form className="form-grid" onSubmit={createAppointment} style={{ marginTop: 22, padding: 18, border: "1px solid var(--line)", borderRadius: 16 }}>
        <h2 style={{ gridColumn: "1 / -1", fontFamily: "Manrope", fontSize: 21, margin: 0 }}>Cadastrar consulta</h2>
        <label className="form-field">Nome da criança/paciente<input required value={form.patient_name} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} /></label>
        <label className="form-field">Nome do responsável<input required value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} /></label>
        <label className="form-field">E-mail do responsável<input required type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></label>
        <label className="form-field">Telefone / WhatsApp<input required type="tel" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="(21) 99999-9999" /></label>
        <label className="form-field">Profissional<select required value={form.doctor_id} onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}><option value="">Selecione</option>{clinic.doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select></label>
        <label className="form-field">Modalidade<select value={form.appointment_type} onChange={(e) => setForm({ ...form, appointment_type: e.target.value as Appointment["appointment_type"] })}><option value="pre_natal">Consulta pré-natal</option><option value="presencial">Consulta no consultório</option><option value="retorno">Consulta de retorno</option></select></label>
        <label className="form-field">Data<input required type="date" min={localToday()} value={form.appointment_date} onChange={(e) => setForm({ ...form, appointment_date: e.target.value })} /></label>
        <label className="form-field">Horário<input required type="time" min="08:00" max="16:45" step={900} value={form.appointment_time} onChange={(e) => setForm({ ...form, appointment_time: e.target.value })} /></label>
        <p className="form-note" style={{ gridColumn: "1 / -1" }}>O cadastro fica pendente. A disponibilidade deve ser conferida e confirmada antes de avisar a família.</p>
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, flexWrap: "wrap" }}><button className="button button-primary" disabled={saving}>{saving ? <LoaderCircle size={17} /> : <Check size={17} />} Salvar consulta</button><button type="button" className="button button-secondary" onClick={() => setShowCreate(false)}><X size={17} /> Fechar</button></div>
      </form>}
      {role && ["admin", "receptionist"].includes(role) && <>
        <div className="form-grid" style={{ marginTop: 22, gridTemplateColumns: "minmax(200px, 1.5fr) minmax(180px, 1fr) minmax(220px, 1.5fr)" }}>
          <label className="form-field">Buscar paciente ou responsável<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome, responsável ou telefone" /></label>
          <label className="form-field">Exibir<select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="upcoming">Próximas consultas</option><option value="pending">Aguardando confirmação</option><option value="cancelled">Canceladas</option><option value="all">Todas as consultas</option></select></label>
          <label className="form-field">Modelo da mensagem<select value={kind} onChange={(e) => setKind(e.target.value as MessageKind)}>{messageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        </div>
        {kind === "custom" && <label className="form-field" style={{ display: "block", marginTop: 12 }}>Mensagem personalizada<textarea value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} rows={3} placeholder="Escreva e revise a mensagem antes de abrir o WhatsApp." /></label>}
        <p className="form-note" style={{ marginTop: 12 }}>O WhatsApp abre com a mensagem preenchida; a recepção revisa e envia manualmente.</p>
        {loading ? <p className="form-note">Carregando agenda…</p> : visibleAppointments.length === 0 ? <div className="notice" style={{ marginTop: 18 }}>Nenhuma consulta encontrada para esse filtro.</div> : <div style={{ overflowX: "auto", marginTop: 20 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1050 }}><thead><tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>{["Paciente / responsável", "Data e horário", "Profissional", "Status", "Ações", "Mensagem"].map((h) => <th key={h} style={{ padding: "12px 10px", fontSize: 13 }}>{h}</th>)}</tr></thead>
            <tbody>{visibleAppointments.map((a) => {
              const href = whatsappHref(a);
              return <tr key={a.id} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "14px 10px" }}><strong>{a.patient_name}</strong><div className="form-note">{a.guardian_name}</div><div className="form-note">{a.contact_phone}</div></td>
                <td style={{ padding: "14px 10px", whiteSpace: "nowrap" }}><div>{formatDate(a.appointment_date)}</div><div className="form-note"><Clock3 size={13} style={{ display: "inline", verticalAlign: "middle" }} /> {a.appointment_time?.slice(0, 5)}</div></td>
                <td style={{ padding: "14px 10px" }}>{a.doctors?.full_name ?? "A definir"}<div className="form-note">{a.appointment_type === "pre_natal" ? "Pré-natal" : a.appointment_type === "retorno" ? "Retorno" : "Consultório"}</div></td>
                <td style={{ padding: "14px 10px" }}><span className="eyebrow">{statusLabels[a.status]}</span></td>
                <td style={{ padding: "14px 10px", minWidth: 210 }}><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {a.status === "pending" && <button className="button button-secondary" style={{ padding: "8px 10px" }} onClick={() => void updateStatus(a, "confirmed")}><Check size={14} /> Confirmar</button>}
                  {a.status !== "cancelled" && a.status !== "completed" && <button className="button button-secondary" style={{ padding: "8px 10px" }} onClick={() => { setRescheduling(rescheduling === a.id ? null : a.id); setNewDate(a.appointment_date); setNewTime(a.appointment_time.slice(0, 5)); }}><CalendarDays size={14} /> Remarcar</button>}
                  {a.status !== "cancelled" && a.status !== "completed" && <button className="button button-secondary" style={{ padding: "8px 10px" }} onClick={() => void updateStatus(a, "cancelled")}><X size={14} /> Cancelar</button>}
                  {a.status === "confirmed" && <button className="button button-secondary" style={{ padding: "8px 10px" }} onClick={() => void updateStatus(a, "completed")}><Check size={14} /> Concluir</button>}
                </div>{rescheduling === a.id && <div style={{ marginTop: 10, display: "grid", gap: 8 }}><label className="form-field">Nova data<input type="date" min={localToday()} value={newDate} onChange={(e) => setNewDate(e.target.value)} /></label><label className="form-field">Novo horário<input type="time" step={900} value={newTime} onChange={(e) => setNewTime(e.target.value)} /></label><button className="button button-primary" onClick={() => void saveReschedule(a)}>Salvar remarcação</button><p className="form-note">Depois, selecione “Aviso de remarcação” e abra o WhatsApp.</p></div>}</td>
                <td style={{ padding: "14px 10px" }}>{href && (kind !== "custom" || customMessage.trim()) ? <a className="button button-primary" href={href} target="_blank" rel="noreferrer" style={{ whiteSpace: "nowrap" }}><MessageCircle size={16} /> Abrir WhatsApp</a> : <span className="form-note">Informe telefone e mensagem</span>}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>}
      </>}
    </section>
  </div></main>;
}
