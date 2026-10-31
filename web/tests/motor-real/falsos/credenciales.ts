// Fake credenciales.ts: every device has a token.
export async function leerToken(): Promise<string> {
  return 'token';
}
