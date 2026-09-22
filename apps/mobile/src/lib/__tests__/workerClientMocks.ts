export async function authenticatedWorkerHeaders(headers?: HeadersInit): Promise<Headers> {
  return new Headers(headers);
}

export function getWorkerBaseUrl(): string {
  return "https://worker.example.test";
}
