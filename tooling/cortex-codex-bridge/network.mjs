import dns from "node:dns";
import https from "node:https";

// macOS can retain a failed system lookup even while DNS is answering normally.
export function resilientLookup(hostname, options, callback) {
  dns.lookup(hostname, options, (error, address, family) => {
    if (!error || !["ENOTFOUND", "EAI_AGAIN"].includes(error.code)) return callback(error, address, family);
    dns.resolve4(hostname, (fallbackError, addresses) => {
      if (fallbackError || !addresses.length) return callback(fallbackError || error);
      if (options?.all) callback(null, addresses.map(address => ({ address, family: 4 })));
      else callback(null, addresses[0], 4);
    });
  });
}

export function requestJson(url, { method = "GET", headers = {}, body, timeoutMs = 20_000 } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const request = https.request(url, {
      method, lookup: resilientLookup,
      headers: { ...headers, ...(data ? { "content-type": "application/json", "content-length": Buffer.byteLength(data) } : {}) },
    }, response => {
      const chunks = [];
      response.on("data", chunk => chunks.push(chunk));
      response.on("error", reject);
      response.on("end", () => {
        clearTimeout(timer);
        let parsed;
        try { parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
        catch { return reject(new Error(`Remote service returned HTTP ${response.statusCode} without JSON.`)); }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          // Don't echo response bodies: environment APIs may include secrets.
          return reject(new Error(`Remote service returned HTTP ${response.statusCode}.`));
        }
        resolve(parsed);
      });
    });
    const timer = setTimeout(() => request.destroy(new Error("Connection timed out.")), timeoutMs);
    request.on("error", error => { clearTimeout(timer); reject(error); });
    request.end(data);
  });
}
