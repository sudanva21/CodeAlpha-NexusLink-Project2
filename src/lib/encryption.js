// End-to-End Encryption using Web Crypto API (AES-GCM)

let roomKey = null;
let roomKeyRaw = null;

// Derive a key from room ID + shared passphrase
export async function deriveRoomKey(roomId) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(roomId + '_nexuslink_e2e_key'),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  roomKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('nexuslink_salt_v1'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  roomKeyRaw = await crypto.subtle.exportKey('raw', roomKey);
  return roomKey;
}

// Encrypt a message
export async function encryptMessage(plaintext) {
  if (!roomKey) throw new Error('Room key not derived');

  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = encoder.encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    roomKey,
    encoded
  );

  // Combine IV + ciphertext into a single base64 string
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return arrayBufferToBase64(combined.buffer);
}

// Decrypt a message
export async function decryptMessage(encryptedBase64) {
  if (!roomKey) throw new Error('Room key not derived');

  try {
    const combined = base64ToArrayBuffer(encryptedBase64);
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      roomKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (err) {
    console.error('[Encryption] Decryption failed:', err);
    return '[Decryption failed]';
  }
}

// Helper: ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: Base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function hasKey() {
  return roomKey !== null;
}
