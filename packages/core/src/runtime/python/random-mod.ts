// Python's `random` module (PY-41): randint, random, randrange, choice, shuffle, uniform and seed.
//
// Compiler concept: *bit-exact library emulation*. The student's expected output comes from CPython, so the generator
// here is CPython's own Mersenne Twister (MT19937) and every function consumes numbers the way CPython's does.
// With the same seed, `random.randint(1, 6)` then prints the same dice as the real thing.
import type { Span } from "../../diagnostics.ts";
import type { Machine } from "../evaluate.ts";
import { NONE, pyint, real, str, type Value } from "../values.ts";
import { pyError, typeError, valueError } from "./errors.ts";
import { asBig, toFloat } from "./numbers.ts";
import { pyTypeName } from "./repr.ts";
import { sha512 } from "./sha512.ts";

export const RANDOM_FUNCTIONS = new Set(["random", "randint", "randrange", "choice", "shuffle", "uniform", "seed"]);

const N = 624;
const M = 397;

/** The Mersenne Twister: 624 words of state, "twisted" in bulk and "tempered" one word at a time. */
class MersenneTwister {
  private readonly mt = new Uint32Array(N);
  private index = N + 1;

  constructor(key: number[]) {
    this.initByArray(key);
  }

  private initGenrand(seed: number): void {
    this.mt[0] = seed >>> 0;
    for (let i = 1; i < N; i++) {
      const prev = this.mt[i - 1] as number;
      this.mt[i] = (Math.imul(1812433253, prev ^ (prev >>> 30)) + i) >>> 0;
    }
    this.index = N;
  }

  private initByArray(key: number[]): void {
    this.initGenrand(19650218);
    const mt = this.mt;
    let i = 1;
    let j = 0;
    for (let k = Math.max(N, key.length); k > 0; k--) {
      const prev = mt[i - 1] as number;
      mt[i] = ((mt[i] as number) ^ Math.imul(prev ^ (prev >>> 30), 1664525)) + (key[j] as number) + j;
      i++;
      j++;
      if (i >= N) {
        mt[0] = mt[N - 1] as number;
        i = 1;
      }
      if (j >= key.length) j = 0;
    }
    for (let k = N - 1; k > 0; k--) {
      const prev = mt[i - 1] as number;
      mt[i] = ((mt[i] as number) ^ Math.imul(prev ^ (prev >>> 30), 1566083941)) - i;
      i++;
      if (i >= N) {
        mt[0] = mt[N - 1] as number;
        i = 1;
      }
    }
    mt[0] = 0x80000000;
  }

  /** The next 32 random bits. */
  next32(): number {
    const mt = this.mt;
    if (this.index >= N) {
      for (let k = 0; k < N; k++) {
        const y = ((mt[k] as number) & 0x80000000) | ((mt[(k + 1) % N] as number) & 0x7fffffff);
        mt[k] = (mt[(k + M) % N] as number) ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0);
      }
      this.index = 0;
    }
    let y = mt[this.index++] as number;
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  /** A float from 0 up to (not including) 1 with 53 random bits, built from two words as CPython does. */
  float(): number {
    const a = this.next32() >>> 5;
    const b = this.next32() >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  }

  /** `k` random bits as an int (k >= 0). */
  bits(k: number): bigint {
    if (k <= 0) return 0n;
    if (k <= 32) return BigInt(this.next32() >>> (32 - k));
    let out = 0n;
    for (let i = 0, left = k; left > 0; i++, left -= 32) {
      let r = this.next32();
      if (left < 32) r >>>= 32 - left;
      out |= BigInt(r) << BigInt(32 * i);
    }
    return out;
  }

  /** A whole number from 0 to n-1: draw bits, throw away anything too big (CPython's `_randbelow`). */
  below(n: bigint): bigint {
    const k = n.toString(2).length;
    let r = this.bits(k);
    while (r >= n) r = this.bits(k);
    return r;
  }
}

const generators = new WeakMap<Machine, MersenneTwister>();

/** Seeds from a non-negative integer: its 32-bit words, least significant first (0 is the one word 0). */
function fromInt(n: bigint): MersenneTwister {
  const key: number[] = [];
  for (let v = n < 0n ? -n : n; v > 0n; v >>= 32n) key.push(Number(v & 0xffffffffn));
  return new MersenneTwister(key.length === 0 ? [0] : key);
}

const MOD61 = (1n << 61n) - 1n;

/** CPython's `hash(float)`, used to seed from a float: the number reduced modulo 2**61 - 1 (see PEP/pyhash.c). */
function floatHash(v: number): bigint {
  if (Number.isNaN(v)) return 0n;
  if (!Number.isFinite(v)) return v > 0 ? 314159n : -314159n;
  if (v === 0) return 0n;
  let m = Math.abs(v);
  let e = 0;
  while (m >= 1) {
    m /= 2;
    e++;
  }
  while (m < 0.5) {
    m *= 2;
    e--;
  }
  let x = 0n;
  while (m !== 0) {
    x = ((x << 28n) & MOD61) | (x >> 33n);
    m *= 268435456;
    e -= 28;
    const y = Math.floor(m);
    m -= y;
    x += BigInt(y);
    if (x >= MOD61) x -= MOD61;
  }
  e = e >= 0 ? e % 61 : 60 - ((-1 - e) % 61);
  const sh = BigInt(e);
  x = ((x << sh) & MOD61) | (x >> (61n - sh));
  const h = v < 0 ? -x : x;
  return h === -1n ? -2n : h;
}

function seeded(arg: Value | undefined, machine: Machine, span: Span): MersenneTwister {
  if (arg === undefined || arg.kind === "none")
    return fromInt(BigInt(machine.nowMs()) * 1000n + BigInt(Math.floor(Math.random() * 1000)));
  if (arg.kind === "pyint") return fromInt(arg.value);
  if (arg.kind === "bool") return fromInt(arg.value ? 1n : 0n);
  if (arg.kind === "real") return fromInt(BigInt.asUintN(64, floatHash(arg.value)));
  if (arg.kind === "str") {
    // Version 2 seeding: the bytes of the text followed by their SHA-512, read as one big number.
    const bytes = new TextEncoder().encode(arg.value);
    const all = new Uint8Array([...bytes, ...sha512(bytes)]);
    return fromInt(all.reduce((n, b) => (n << 8n) | BigInt(b), 0n));
  }
  throw typeError("The only supported seed types are: None,\nint, float, str, bytes, and bytearray.", span);
}

function generator(machine: Machine): MersenneTwister {
  let g = generators.get(machine);
  if (g === undefined) {
    // The run starts as if the program began with `random.seed(<run seed>)` (SH-12), so a fixed seed replays a run.
    g = fromInt(BigInt(machine.runSeed));
    generators.set(machine, g);
  }
  return g;
}

function index(v: Value | undefined, span: Span): bigint {
  const n = v === undefined ? null : asBig(v);
  if (n === null)
    throw typeError(
      `'${v === undefined ? "NoneType" : pyTypeName(v)}' object cannot be interpreted as an integer`,
      span,
    );
  return n;
}

const show = (n: bigint): string => n.toString();

function randrange(g: MersenneTwister, args: Value[], span: Span): bigint {
  if (args.length === 0 || args.length > 3)
    throw typeError(
      args.length === 0
        ? "Random.randrange() missing 1 required positional argument: 'start'"
        : `Random.randrange() takes from 2 to 4 positional arguments but ${String(args.length + 1)} were given`,
      span,
    );
  const start = index(args[0], span);
  if (args.length === 1) {
    if (start > 0n) return g.below(start);
    throw valueError("empty range for randrange()", span);
  }
  const stop = index(args[1], span);
  const width = stop - start;
  const step = args.length === 3 ? index(args[2], span) : 1n;
  if (step === 1n) {
    if (width > 0n) return start + g.below(width);
    throw valueError(`empty range in randrange(${show(start)}, ${show(stop)})`, span);
  }
  let n: bigint;
  if (step > 0n) n = (width + step - 1n) / step;
  else if (step < 0n) n = (width + step + 1n) / step;
  else throw valueError("zero step for randrange()", span);
  if (n <= 0n) throw valueError(`empty range in randrange(${show(start)}, ${show(stop)}, ${show(step)})`, span);
  return start + step * g.below(n);
}

function sequenceItems(v: Value | undefined, span: Span): Value[] {
  if (v?.kind === "list" || v?.kind === "tuple") return v.items;
  if (v?.kind === "str") return Array.from(v.value, (c) => str(c));
  if (v?.kind === "range") {
    const out: Value[] = [];
    for (let x = v.start; v.step > 0n ? x < v.stop : x > v.stop; x += v.step) out.push(pyint(x));
    return out;
  }
  throw typeError(`object of type '${v === undefined ? "NoneType" : pyTypeName(v)}' has no len()`, span);
}

export function randomCall(name: string, args: Value[], machine: Machine, span: Span): Value {
  if (name === "seed") {
    generators.set(machine, seeded(args[0], machine, span));
    return NONE;
  }
  const g = generator(machine);
  const need = (n: number): void => {
    if (args.length !== n)
      throw typeError(
        args.length < n
          ? `Random.${name}() missing ${String(n - args.length)} required positional argument${n - args.length === 1 ? "" : "s"}: '${(["a", "b"] as const)[args.length] ?? "seq"}'`
          : `Random.${name}() takes ${String(n + 1)} positional arguments but ${String(args.length + 1)} were given`,
        span,
      );
  };
  switch (name) {
    case "random":
      if (args.length > 0)
        throw typeError(`Random.random() takes 1 positional argument but ${String(args.length + 1)} were given`, span);
      return real(g.float());
    case "randint": {
      need(2);
      const a = index(args[0], span);
      const b = index(args[1], span);
      return pyint(randrange(g, [pyint(a), pyint(b + 1n)], span));
    }
    case "randrange":
      return pyint(randrange(g, args, span));
    case "choice": {
      need(1);
      const items = sequenceItems(args[0], span);
      if (items.length === 0) throw pyError("IndexError", "Cannot choose from an empty sequence", span);
      return items[Number(g.below(BigInt(items.length)))] as Value;
    }
    case "shuffle": {
      need(1);
      const target = args[0];
      if (target?.kind !== "list")
        throw typeError(
          `'${target === undefined ? "NoneType" : pyTypeName(target)}' object does not support item assignment`,
          span,
        );
      const items = target.items;
      for (let i = items.length - 1; i >= 1; i--) {
        const j = Number(g.below(BigInt(i + 1)));
        [items[i], items[j]] = [items[j] as Value, items[i] as Value];
      }
      return NONE;
    }
    case "uniform": {
      need(2);
      for (const v of args)
        if (v.kind !== "pyint" && v.kind !== "real" && v.kind !== "bool")
          throw typeError(`unsupported operand type(s) for -: '${pyTypeName(v)}' and 'int'`, span);
      const a = toFloat(args[0] as Value);
      const b = toFloat(args[1] as Value);
      return real(a + (b - a) * g.float());
    }
    default:
      throw typeError(`random.${name} is not a function`, span);
  }
}
