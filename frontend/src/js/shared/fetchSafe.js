export async function fetchJsonSafe(url, attempts = 3, delayMs = 500) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { data: await res.json(), failed: false };
    } catch {
      if (i === attempts - 1) return { data: null, failed: true };
      await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
    }
  }
}
