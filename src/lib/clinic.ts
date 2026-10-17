export const clinic = {
  name: "Britos Pediatria",
  phoneDisplay: "+55 (21) 99610-0606",
  phoneE164: "5521996100606",
  whatsappUrl: "https://wa.me/5521996100606",
  address: "Avenida Embaixador Abelardo Bueno, Edifício Ayrton Senna 02, Sala 514C, Barra da Tijuca, Rio de Janeiro - RJ, 22775-040",
  whatsappHours: "Segunda a sexta, das 8h às 17h",
  description: "Britos Pediatria oferece atendimento especializado em Pediatria, Puericultura e Neonatologia, com cuidado humanizado e acolhedor para recém-nascidos, crianças e adolescentes. Atuamos também com aleitamento materno, acompanhamento do crescimento e desenvolvimento e cuidados gerais, sempre com atenção, segurança e excelência médica.",
  doctors: [
    { id: "00000000-0000-4000-8000-000000000001", name: "Dra. Danielle Lourenço Alves Brito", crm: "CRM/RJ 748188", color: "pink" },
    { id: "00000000-0000-4000-8000-000000000002", name: "Dr. Marcelo Dutra Alves Brito", crm: "CRM/RJ 748170", color: "green" },
  ],
} as const;

export const roleLabels = {
  patient: "Paciente / responsável", doctor: "Médico", receptionist: "Recepção", admin: "Administrador",
} as const;
