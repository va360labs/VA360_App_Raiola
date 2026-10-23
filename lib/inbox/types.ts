export type Channel = "whatsapp" | "email";

/** A message from any channel, normalised before it is stored. */
export interface InboundMessage {
  channel: Channel;
  /** Provider id (WhatsApp `wamid`, email `MessageID`); used to ignore duplicates. */
  externalId: string;
  /** Phone number in international digits, or email address. */
  from: string;
  contactName: string | null;
  subject: string | null;
  body: string;
  kind: "text" | "unsupported";
  receivedAt: string;
  simulated: boolean;
}

/** Ids the simulator gives its messages so they can be told apart from real ones. */
export const SIMULATED_WHATSAPP_PREFIX = "wamid.SIM.";
export const SIMULATED_EMAIL_PREFIX = "sim-";

export class PayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayloadError";
  }
}
