import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { clinicDisplayName, countNeedsReview, getSetting, setSetting } from "@/lib/settings";
import { useTempDataDir } from "../helpers";

describe("settings", () => {
  useTempDataDir();

  it("reads and updates values", () => {
    expect(getSetting("auto_send")).toBe("false");
    setSetting("auto_send", "true");
    expect(getSetting("auto_send")).toBe("true");
  });

  it("shows a neutral name until the clinic sets one", () => {
    expect(clinicDisplayName()).toBe("Respuestas de la clínica");
    setSetting("clinic_name", "  Fisio Centro  ");
    expect(clinicDisplayName()).toBe("Fisio Centro");
  });

  it("returns an empty value for a missing key", () => {
    getDb().prepare("DELETE FROM settings WHERE key = 'clinic_name'").run();
    expect(getSetting("clinic_name")).toBe("");
  });

  it("counts the messages waiting for review", () => {
    const db = getDb();
    const contact = db.prepare("INSERT INTO contacts (channel, external_id) VALUES ('whatsapp', '34600000000')").run();
    const insert = db.prepare(
      "INSERT INTO messages (contact_id, channel, direction, external_id, body, status) VALUES (?, 'whatsapp', 'in', ?, 'hola', ?)",
    );
    insert.run(contact.lastInsertRowid, "m1", "needs_review");
    insert.run(contact.lastInsertRowid, "m2", "draft_ready");
    insert.run(contact.lastInsertRowid, "m3", "needs_review");
    expect(countNeedsReview()).toBe(2);
  });
});
