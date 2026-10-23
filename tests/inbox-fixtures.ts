/** Payloads with the shape of the official WhatsApp Cloud API and Postmark inbound examples. */

export function whatsappText({
  id = "wamid.HBgLMzQ2MDAxMTEyMjIVAgASGBQzQTdDRjdFRjE3QjA0QjM2RTlBNgA=",
  from = "34600111222",
  name = "Lucía Martín",
  body = "¿Cuánto cuesta una sesión?",
  timestamp = "1792770000",
} = {}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "102290129340398",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "34910000000", phone_number_id: "106540352242922" },
              contacts: [{ profile: { name }, wa_id: from }],
              messages: [{ from, id, timestamp, type: "text", text: { body } }],
            },
          },
        ],
      },
    ],
  };
}

export function whatsappImage({ id = "wamid.IMG1", from = "34600111222" } = {}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "102290129340398",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "34910000000", phone_number_id: "106540352242922" },
              contacts: [{ profile: { name: "Lucía Martín" }, wa_id: from }],
              messages: [
                { from, id, timestamp: "1792770100", type: "image", image: { mime_type: "image/jpeg", sha256: "abc", id: "1234" } },
              ],
            },
          },
        ],
      },
    ],
  };
}

export function whatsappStatusOnly() {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "102290129340398",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "34910000000", phone_number_id: "106540352242922" },
              statuses: [{ id: "wamid.OUT1", status: "read", timestamp: "1792770200", recipient_id: "34600111222" }],
            },
          },
        ],
      },
    ],
  };
}

export function postmarkInbound(overrides: Record<string, unknown> = {}) {
  return {
    FromName: "Javier Ruiz",
    MessageStream: "inbound",
    From: "javier.ruiz@correo.es",
    FromFull: { Email: "javier.ruiz@correo.es", Name: "Javier Ruiz", MailboxHash: "" },
    To: "\"Clínica\" <recepcion@clinica.es>",
    Subject: "Horario del sábado",
    MessageID: "73e6d360-66eb-11e1-8e72-a8904824019b",
    Date: "Fri, 23 Oct 2026 10:15:00 +0200",
    TextBody: "Hola, ¿abrís los sábados?\n\nGracias\n\n> El 20 oct escribiste:\n> mensaje anterior",
    StrippedTextReply: "Hola, ¿abrís los sábados?\n\nGracias",
    HtmlBody: "<p>Hola</p>",
    Attachments: [],
    ...overrides,
  };
}
