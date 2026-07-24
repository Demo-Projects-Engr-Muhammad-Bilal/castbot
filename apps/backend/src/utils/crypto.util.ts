import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || "default_castbot_secret_32_bytes_key!!";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a plain text token string into an IV:AuthTag:EncryptedHex string using AES-256-GCM.
 */
export function encryptToken(text: string): string {
  if (!text) return "";
  const trimmed = text.trim();
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(trimmed, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts an IV:AuthTag:EncryptedHex string back into original plain text using AES-256-GCM.
 * If the input payload is not encrypted (does not contain valid IV/AuthTag hex parts), returns original raw string.
 */
export function decryptToken(encryptedPayload: string): string {
  if (!encryptedPayload) return "";
  const trimmed = encryptedPayload.trim();

  // If payload does not contain colon separators, assume unencrypted plaintext string
  if (!trimmed.includes(":")) {
    return trimmed;
  }

  try {
    const parts = trimmed.split(":");
    // AES-256-GCM IV is 16 bytes (32 hex chars) and AuthTag is 16 bytes (32 hex chars)
    if (parts.length !== 3 || parts[0].length !== 32 || parts[1].length !== 32) {
      return trimmed;
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encryptedText = Buffer.from(encryptedHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (err) {
    console.warn("⚠️ [crypto.util] Decryption failed, returning raw string:", err);
    return trimmed;
  }
}
