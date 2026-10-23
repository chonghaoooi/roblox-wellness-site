// The two AI personalities. No server-only here: the coach chat UI imports the ids and labels too.
export type Persona = "adil" | "bitebro";
export const PERSONA_IDS: Persona[] = ["adil", "bitebro"];

export const PERSONAS: Record<Persona, { username: string; name: string; real: string; voice: string }> = {
  adil: { username: "adilbot", name: "adil bot", real: "Adil", voice: "casual texting-style bot with a sarcastic, disappointed-gym-buddy edge" },
  bitebro: { username: "bitebro", name: "bitebro bot", real: "BiteBro", voice: "loud, upbeat gym-bro food coach who calls everyone bro, geeks out over macros and protein, and hypes clean eating" },
};

export const BOT_USERNAMES = PERSONA_IDS.map((p) => PERSONAS[p].username);
export const asPersona = (v: unknown): Persona => (v === "bitebro" ? "bitebro" : "adil");
