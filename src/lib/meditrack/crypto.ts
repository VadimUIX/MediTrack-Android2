function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function hashPin(pin: string, salt?: string): Promise<{ salt: string; hash: string }> {
  const s = salt ?? bufToB64(crypto.getRandomValues(new Uint8Array(16)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${s}:${pin}`));
  return { salt: s, hash: bufToB64(digest) };
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations: 120000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptJson(value: unknown, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const data = new TextEncoder().encode(JSON.stringify(value));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.stringify({
    format: "meditrack-enc-v1",
    salt: bufToB64(salt),
    iv: bufToB64(iv),
    data: bufToB64(ct),
  });
}

export async function decryptJson(raw: string, passphrase: string): Promise<unknown> {
  const parsed = JSON.parse(raw) as { salt?: string; iv?: string; data?: string };
  if (!parsed.salt || !parsed.iv || !parsed.data) throw new Error("format");
  const salt = b64ToBytes(parsed.salt);
  const iv = b64ToBytes(parsed.iv);
  const data = b64ToBytes(parsed.data);
  const key = await deriveKey(passphrase, salt);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    data.buffer as ArrayBuffer,
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

export function randomIdBytes(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

export async function registerBiometric(): Promise<string> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Лекарственный дневник" },
      user: {
        id: randomIdBytes() as BufferSource,
        name: "local",
        displayName: "Дневник",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
      timeout: 60000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("cancelled");
  return bufToB64(cred.rawId);
}

export async function verifyBiometric(idB64: string): Promise<boolean> {
  const cred = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: "public-key", id: b64ToBytes(idB64) as BufferSource }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  return !!cred;
}

export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function compressImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image"));
      img.src = url;
    });
    const max = 720;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  } finally {
    URL.revokeObjectURL(url);
  }
}
