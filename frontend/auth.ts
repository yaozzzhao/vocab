// Converts a string to an ArrayBuffer.
function str2ab(str: string): ArrayBuffer {
  const buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
  const bufView = new Uint16Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

// Converts an ArrayBuffer to a hex string.
function ab2hex(ab: ArrayBuffer): string {
  return Array.from(new Uint8Array(ab))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPassword(password: string): Promise<string> {
  const data = str2ab(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return ab2hex(hashBuffer);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const newHash = await hashPassword(password);
  return newHash === hash;
}
