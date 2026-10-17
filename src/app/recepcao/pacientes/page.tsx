"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, LoaderCircle, RefreshCw, Search, UserPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Patient = {
  id: string; full_name: string; birth_date: string | null; guardian_name: string;
  contact_email: string | null; contact_phone: string | null; relationship_to_patient: string | null;
  created_at: string;
};
const emptyForm = { full_name: "", birth_date: "", guardian_name: "", contact_email: "", contact_phone: "", relationship_to_patient: "" };

export default function ReceptionPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadPatients() {
    setLoading(true); setError("");
    const supabase = createClient();
    if (!supabase) { setError("O Supabase ainda não está configurado."); setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError || !profile) { setError("Não foi possível validar seu perfil."); setLoading(false); return; }
    setRole(profile.role);
    if (!["admin", "receptionist"].includes(profile.role)) { setError("Esta área é exclusiva para administração e recepção."); setLoading(false); return; }
    const { data, error: patientsError } = await supabase.from("patients")
      .select("id,full_name,birth_date,guardian_name,contact_email,contact_phone,relationship_to_patient,created_at")
      .order("full_name", { ascending: true }).limit(500);
    if (patientsError) { setError("Não foi possível carregar os pacientes. Execute a migração e confira as políticas RLS."); setPatients([]); }
    else setPatients((data ?? []) as Patient[]);
    setLoading(false);
  }
  useEffect(() => { void loadPatients(); }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    if (!q) return patients;
    return patients.filter((p) => [p.full_name, p.guardian_name, p.contact_phone ?? "", p.contact_email ?? ""].some((v) => v.toLocaleLowerCase("pt-BR").includes(q)));
  }, [patients, query]);

  async function createPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    const supabase = createClient();
    if (!supabase) { setError("Supabase não configurado."); setSaving(false); return; }
    const { error: insertError } = await supabase.from("patients").insert({
      full_name: form.full_name.trim(),
      birth_date: form.birth_date || null,
      guardian_user_id: null,
      guardian_name: form.guardian_name.trim(),
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      relationship_to_patient: form.relationship_to_patient.trim() || null,
    });
    setSaving(false);
    if (insertError) { setError("Não foi possível cadastrar. Confira a migração do Supabase e suas permissões."); return; }
    setNotice("Paciente cadastrado com sucesso.");
    setForm({ ...emptyForm }); setShowForm(false); await loadPatients();
  }

  return <main className="portal-page"><div className="portal-wrap" style={{ maxWidth: 1100 }}>
    <Link href="/painel" className="portal-back"><ArrowLeft size={16} /> Voltar ao painel</Link>
    <section className="portal-card" style={{ maxWidth: "none" }}>
      <div className="brand portal-brand"><span className="brand-mark"><Users size={24} /></span><span><strong>britos<span> pediatria</span></strong><small>Cadastro de pacientes</small></span></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, marginTop: 24 }}>
        <div><span className="eyebrow">GESTÃO ADMINISTRATIVA</span><h1 style={{ marginBottom: 8 }}>Pacientes</h1><p>Cadastro e contatos dos responsáveis para apoiar a agenda.</p></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="button button-secondary" onClick={() => void loadPatients()} disabled={loading}>{loading ? <LoaderCircle size={16} /> : <RefreshCw size={16} />} Atualizar</button>
          <button type="button" className="button button-primary" onClick={() => setShowForm(!showForm)}><UserPlus size={16} /> Novo paciente</button>
        </div>
      </div>
      {error && <div className="notice" role="alert">{error}</div>}
      {notice && <div className="notice" role="status">{notice}</div>}
      {showForm && <form className="form-grid" onSubmit={createPatient} style={{ marginTop: 22, padding: 18, border: "1px solid var(--line)", borderRadius: 16 }}>
        <h2 style={{ gridColumn: "1 / -1", fontFamily: "Manrope", fontSize: 21, margin: 0 }}>Novo cadastro</h2>
        <label className="form-field">Nome completo da criança/paciente<input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
        <label className="form-field">Data de nascimento<input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></label>
        <label className="form-field">Nome do responsável<input required value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} /></label>
        <label className="form-field">Parentesco<input value={form.relationship_to_patient} onChange={(e) => setForm({ ...form, relationship_to_patient: e.target.value })} placeholder="Mãe, pai, responsável legal..." /></label>
        <label className="form-field">Telefone / WhatsApp<input required type="tel" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></label>
        <label className="form-field">E-mail do responsável<input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></label>
        <p className="form-note" style={{ gridColumn: "1 / -1" }}>Cadastre somente dados administrativos necessários. Não inclua informações clínicas nesta ficha.</p>
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}><button className="button button-primary" disabled={saving}>{saving ? <LoaderCircle size={16} /> : <UserPlus size={16} />} Salvar paciente</button><button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>Fechar</button></div>
      </form>}
      <label className="form-field" style={{ display: "block", marginTop: 22 }}><span style={{ display: "flex", gap: 7, alignItems: "center" }}><Search size={15} /> Buscar paciente ou responsável</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome, telefone ou e-mail" /></label>
      {loading ? <p className="form-note">Carregando cadastros…</p> : visible.length === 0 ? <div className="notice" style={{ marginTop: 16 }}>Nenhum paciente encontrado.</div> : <div style={{ overflowX: "auto", marginTop: 18 }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}><thead><tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>{["Paciente", "Nascimento", "Responsável", "Contato"].map((h) => <th key={h} style={{ padding: "12px 10px", fontSize: 13 }}>{h}</th>)}</tr></thead><tbody>{visible.map((p) => <tr key={p.id} style={{ borderBottom: "1px solid var(--line)" }}><td style={{ padding: "14px 10px" }}><strong>{p.full_name}</strong></td><td style={{ padding: "14px 10px" }}>{p.birth_date ? new Date(p.birth_date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td><td style={{ padding: "14px 10px" }}>{p.guardian_name}{p.relationship_to_patient ? <div className="form-note">{p.relationship_to_patient}</div> : null}</td><td style={{ padding: "14px 10px" }}>{p.contact_phone}{p.contact_email ? <div className="form-note">{p.contact_email}</div> : null}</td></tr>)}</tbody></table></div>}
      {role && <p className="form-note" style={{ marginTop: 18 }}>Acesso restrito à recepção e administração. Dados de saúde não são exibidos nesta tela.</p>}
    </section>
  </div></main>;
}
