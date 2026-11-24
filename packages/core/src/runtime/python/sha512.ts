// SHA-512, needed only because CPython seeds `random` from a string by hashing it (PY-41).
//
// Written with BigInt so it stays short and needs no Node-only `crypto` (packages/core must also run in a browser
// worker). The 88 constants are not typed in: they are the fractional parts of square and cube roots of the first
// primes, which is how the standard defines them, so they are computed once on first use.
const MASK = (1n << 64n) - 1n;

/** floor of the k-th root of n, by Newton's method. */
function iroot(n: bigint, k: bigint): bigint {
  let x = 1n << BigInt(Math.ceil(n.toString(2).length / Number(k)) + 1);
  for (;;) {
    const y = ((k - 1n) * x + n / x ** (k - 1n)) / k;
    if (y >= x) return x;
    x = y;
  }
}

function primes(count: number): bigint[] {
  const out: bigint[] = [];
  for (let n = 2; out.length < count; n++) if (out.every((p) => n % Number(p) !== 0)) out.push(BigInt(n));
  return out;
}

let constants: { h: bigint[]; k: bigint[] } | undefined;
function tables(): { h: bigint[]; k: bigint[] } {
  if (constants === undefined) {
    const ps = primes(80);
    constants = {
      h: ps.slice(0, 8).map((p) => iroot(p << 128n, 2n) & MASK),
      k: ps.map((p) => iroot(p << 192n, 3n) & MASK),
    };
  }
  return constants;
}

const rotr = (x: bigint, n: bigint): bigint => ((x >> n) | (x << (64n - n))) & MASK;

export function sha512(data: Uint8Array): Uint8Array {
  const { h: h0, k } = tables();
  const bits = BigInt(data.length) * 8n;
  const padded = new Uint8Array(Math.ceil((data.length + 17) / 128) * 128);
  padded.set(data);
  padded[data.length] = 0x80;
  for (let i = 0; i < 16; i++) padded[padded.length - 1 - i] = Number((bits >> BigInt(8 * i)) & 0xffn);
  const h = [...h0];
  const w = new Array<bigint>(80).fill(0n);
  for (let off = 0; off < padded.length; off += 128) {
    for (let t = 0; t < 16; t++) {
      let word = 0n;
      for (let b = 0; b < 8; b++) word = (word << 8n) | BigInt(padded[off + t * 8 + b] as number);
      w[t] = word;
    }
    for (let t = 16; t < 80; t++) {
      const w15 = w[t - 15] as bigint;
      const w2 = w[t - 2] as bigint;
      const s0 = rotr(w15, 1n) ^ rotr(w15, 8n) ^ (w15 >> 7n);
      const s1 = rotr(w2, 19n) ^ rotr(w2, 61n) ^ (w2 >> 6n);
      w[t] = ((w[t - 16] as bigint) + s0 + (w[t - 7] as bigint) + s1) & MASK;
    }
    let [a, b, c, d, e, f, g, hh] = h as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
    for (let t = 0; t < 80; t++) {
      const S1 = rotr(e, 14n) ^ rotr(e, 18n) ^ rotr(e, 41n);
      const ch = (e & f) ^ (~e & MASK & g);
      const t1 = (hh + S1 + ch + (k[t] as bigint) + (w[t] as bigint)) & MASK;
      const S0 = rotr(a, 28n) ^ rotr(a, 34n) ^ rotr(a, 39n);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) & MASK;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) & MASK;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) & MASK;
    }
    [a, b, c, d, e, f, g, hh].forEach((v, i) => {
      h[i] = ((h[i] as bigint) + v) & MASK;
    });
  }
  const out = new Uint8Array(64);
  h.forEach((v, i) => {
    for (let b = 0; b < 8; b++) out[i * 8 + b] = Number((v >> BigInt(56 - 8 * b)) & 0xffn);
  });
  return out;
}
