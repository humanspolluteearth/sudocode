// Python's `datetime` module (PY-42): date, datetime and timedelta.
//
// Compiler concept: *normalised representation*. All three types are stored as whole days plus a time of day in
// seconds and microseconds, the way CPython keeps a timedelta (secs 0..86399, micros 0..999999). For a date or
// datetime, `days` is the proleptic Gregorian ordinal (0001-01-01 is day 1). Adding and subtracting then becomes
// plain integer arithmetic on one big number of microseconds, and the calendar only matters at the edges (building
// a date from year/month/day, and printing one).
import type { Span } from "../../diagnostics.ts";
import { pyint, real, str, type Value } from "../values.ts";
import { pyError, typeError, valueError } from "./errors.ts";
import { asBig } from "./numbers.ts";
import { pyTypeName } from "./repr.ts";

export type Moment = Extract<Value, { kind: "moment" }>;
export const MOMENT_TYPES = new Set(["date", "datetime", "timedelta"]);

const US_DAY = 86_400_000_000n;
const US_SEC = 1_000_000n;
const MAX_ORDINAL = 3_652_059; // 9999-12-31
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const qualified = (v: Value): string => (v.kind === "moment" ? `datetime.${v.type}` : pyTypeName(v));
const pad = (n: number, width = 2): string => String(n).padStart(width, "0");

// ---------- calendar

const isLeap = (y: number): boolean => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
const daysIn = (y: number, m: number): number =>
  m === 2 ? (isLeap(y) ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31;

/** Days from year/month/day to the ordinal (Howard Hinnant's civil-calendar algorithm, shifted to 0001-01-01 = 1). */
function toOrdinal(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468 + 719163;
}

function fromOrdinal(ord: number): { y: number; m: number; d: number } {
  const z = ord - 719163 + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
}

const weekday = (ord: number): number => (((ord + 6) % 7) + 7) % 7; // Monday = 0

// ---------- building values

const micros = (m: Moment): bigint => BigInt(m.days) * US_DAY + BigInt(m.secs) * US_SEC + BigInt(m.micros);

function fromMicros(type: Moment["type"], total: bigint, span: Span): Moment {
  let days = total / US_DAY;
  let rest = total % US_DAY;
  if (rest < 0n) {
    rest += US_DAY;
    days -= 1n;
  }
  const d = Number(days);
  if (type === "timedelta") {
    if (Math.abs(d) > 999_999_999)
      throw pyError("OverflowError", `days=${String(d)}; must have magnitude <= 999999999`, span);
  } else if (d < 1 || d > MAX_ORDINAL) {
    throw pyError("OverflowError", "date value out of range", span);
  }
  return { kind: "moment", type, days: d, secs: Number(rest / US_SEC), micros: Number(rest % US_SEC) };
}

const intArg = (v: Value | undefined, span: Span): number => {
  const n = v === undefined ? null : asBig(v);
  if (n === null)
    throw typeError(
      `'${v === undefined ? "NoneType" : pyTypeName(v)}' object cannot be interpreted as an integer`,
      span,
    );
  return Number(n);
};

function build(type: "date" | "datetime", f: number[], span: Span): Moment {
  const [y = 0, m = 0, d = 0, hh = 0, mm = 0, ss = 0, us = 0] = f;
  if (y < 1 || y > 9999) throw valueError(`year ${String(y)} is out of range`, span);
  if (m < 1 || m > 12) throw valueError("month must be in 1..12", span);
  if (d < 1 || d > daysIn(y, m)) throw valueError("day is out of range for month", span);
  if (hh < 0 || hh > 23) throw valueError("hour must be in 0..23", span);
  if (mm < 0 || mm > 59) throw valueError("minute must be in 0..59", span);
  if (ss < 0 || ss > 59) throw valueError("second must be in 0..59", span);
  if (us < 0 || us > 999_999) throw valueError("microsecond must be in 0..999999", span);
  return {
    kind: "moment",
    type,
    days: toOrdinal(y, m, d),
    secs: type === "date" ? 0 : hh * 3600 + mm * 60 + ss,
    micros: type === "date" ? 0 : us,
  };
}

const UNITS: [string, bigint][] = [
  ["days", US_DAY],
  ["seconds", US_SEC],
  ["microseconds", 1n],
  ["milliseconds", 1000n],
  ["minutes", 60n * US_SEC],
  ["hours", 3600n * US_SEC],
  ["weeks", 7n * US_DAY],
];

function timedelta(args: Value[], kwargs: Map<string, Value>, span: Span): Moment {
  let total = 0n;
  UNITS.forEach(([name, factor], i) => {
    const v = args[i] ?? kwargs.get(name);
    if (v === undefined) return;
    if (v.kind === "real") total += BigInt(Math.round(v.value * Number(factor)));
    else {
      const n = asBig(v);
      if (n === null) throw typeError(`unsupported type for timedelta ${name} component: ${pyTypeName(v)}`, span);
      total += n * factor;
    }
  });
  return fromMicros("timedelta", total, span);
}

/** `date(...)`, `datetime(...)` and `timedelta(...)`. */
export function constructMoment(type: string, args: Value[], kwargs: Map<string, Value>, span: Span): Value {
  if (type === "timedelta") return timedelta(args, kwargs, span);
  const names = ["year", "month", "day", "hour", "minute", "second", "microsecond"];
  const need = 3;
  const f: number[] = [];
  for (let i = 0; i < (type === "date" ? 3 : 7); i++) {
    const v = args[i] ?? kwargs.get(names[i] as string);
    if (v === undefined) {
      if (i < need)
        throw typeError(`function missing required argument '${names[i] as string}' (pos ${String(i + 1)})`, span);
      f.push(0);
    } else f.push(intArg(v, span));
  }
  return build(type as "date" | "datetime", f, span);
}

/** `date.today()`, `datetime.now()`, `date.fromisoformat(text)`. `nowMs` is the machine clock (local time). */
export function momentClassMethod(type: string, name: string, args: Value[], nowMs: number, span: Span): Value {
  const now = new Date(nowMs);
  if (name === "today" && type === "date")
    return build("date", [now.getFullYear(), now.getMonth() + 1, now.getDate()], span);
  if ((name === "now" || name === "today") && type === "datetime")
    return build(
      "datetime",
      [
        now.getFullYear(),
        now.getMonth() + 1,
        now.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds() * 1000,
      ],
      span,
    );
  if (name === "fromisoformat" && type !== "timedelta") {
    const text = args[0]?.kind === "str" ? args[0].value : null;
    const m = text === null ? null : /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
    if (m === null || (type === "date" && m[4] !== undefined))
      throw valueError(`Invalid isoformat string: ${JSON.stringify(text ?? "").replace(/"/g, "'")}`, span);
    return build(
      type as "date" | "datetime",
      m.slice(1).map((x: string | undefined) => Number(x ?? 0)),
      span,
    );
  }
  throw pyError("AttributeError", `type object '${type}' has no attribute '${name}'`, span);
}

// ---------- printing

function timeText(m: Moment): string {
  const h = Math.floor(m.secs / 3600);
  const base = `${String(h)}:${pad(Math.floor((m.secs % 3600) / 60))}:${pad(m.secs % 60)}`;
  return m.micros === 0 ? base : `${base}.${pad(m.micros, 6)}`;
}

export function momentStr(m: Moment): string {
  if (m.type === "timedelta") {
    const day = m.days === 0 ? "" : `${String(m.days)} day${Math.abs(m.days) === 1 ? "" : "s"}, `;
    return day + timeText(m);
  }
  const { y, m: mo, d } = fromOrdinal(m.days);
  const date = `${pad(y, 4)}-${pad(mo)}-${pad(d)}`;
  return m.type === "date"
    ? date
    : `${date} ${pad(Math.floor(m.secs / 3600))}:${timeText(m).split(":").slice(1).join(":")}`;
}

export function momentRepr(m: Moment): string {
  if (m.type === "timedelta") {
    const parts = [
      m.days !== 0 ? `days=${String(m.days)}` : "",
      m.secs !== 0 ? `seconds=${String(m.secs)}` : "",
      m.micros !== 0 ? `microseconds=${String(m.micros)}` : "",
    ].filter(Boolean);
    return `datetime.timedelta(${parts.length === 0 ? "0" : parts.join(", ")})`;
  }
  const { y, m: mo, d } = fromOrdinal(m.days);
  if (m.type === "date") return `datetime.date(${String(y)}, ${String(mo)}, ${String(d)})`;
  const f = [y, mo, d, Math.floor(m.secs / 3600), Math.floor((m.secs % 3600) / 60)];
  if (m.micros !== 0) f.push(m.secs % 60, m.micros);
  else if (m.secs % 60 !== 0) f.push(m.secs % 60);
  return `datetime.datetime(${f.map(String).join(", ")})`;
}

function strftime(m: Moment, format: string): string {
  const { y, m: mo, d } = fromOrdinal(m.days);
  const wd = weekday(m.days);
  const yday = m.days - toOrdinal(y, 1, 1) + 1;
  const hour = Math.floor(m.secs / 3600);
  const code = (c: string): string => {
    switch (c) {
      case "d":
        return pad(d);
      case "m":
        return pad(mo);
      case "Y":
        return String(y);
      case "y":
        return pad(y % 100);
      case "H":
        return pad(hour);
      case "I":
        return pad(hour % 12 === 0 ? 12 : hour % 12);
      case "M":
        return pad(Math.floor((m.secs % 3600) / 60));
      case "S":
        return pad(m.secs % 60);
      case "f":
        return pad(m.micros, 6);
      case "p":
        return hour < 12 ? "AM" : "PM";
      case "A":
        return DAYS[wd] as string;
      case "a":
        return (DAYS[wd] as string).slice(0, 3);
      case "B":
        return MONTHS[mo - 1] as string;
      case "b":
        return (MONTHS[mo - 1] as string).slice(0, 3);
      case "j":
        return pad(yday, 3);
      case "w":
        return String((wd + 1) % 7);
      case "U":
        return pad(Math.floor((yday - 1 + 7 - ((wd + 1) % 7)) / 7));
      case "%":
        return "%";
      default:
        return `%${c}`;
    }
  };
  return format.replace(/%(.)/gs, (_all, c: string) => code(c));
}

// ---------- attributes and methods

export function momentAttr(m: Moment, name: string, span: Span): Value {
  if (m.type === "timedelta") {
    if (name === "days") return pyint(BigInt(m.days));
    if (name === "seconds") return pyint(BigInt(m.secs));
    if (name === "microseconds") return pyint(BigInt(m.micros));
  } else {
    const { y, m: mo, d } = fromOrdinal(m.days);
    const t: Record<string, number> = {
      year: y,
      month: mo,
      day: d,
      hour: Math.floor(m.secs / 3600),
      minute: Math.floor((m.secs % 3600) / 60),
      second: m.secs % 60,
      microsecond: m.micros,
    };
    if (name in t && (m.type === "datetime" || ["year", "month", "day"].includes(name)))
      return pyint(BigInt(t[name] as number));
  }
  throw pyError("AttributeError", `'${m.type}' object has no attribute '${name}'`, span);
}

export function momentMethod(m: Moment, name: string, args: Value[], span: Span): Value {
  switch (name) {
    case "weekday":
      if (m.type !== "timedelta") return pyint(BigInt(weekday(m.days)));
      break;
    case "isoweekday":
      if (m.type !== "timedelta") return pyint(BigInt(weekday(m.days) + 1));
      break;
    case "isoformat":
      if (m.type === "date") return str(momentStr(m));
      if (m.type === "datetime") return str(momentStr(m).replace(" ", "T"));
      break;
    case "date":
      if (m.type === "datetime") return { kind: "moment", type: "date", days: m.days, secs: 0, micros: 0 };
      break;
    case "strftime":
      if (m.type !== "timedelta") {
        const f = args[0];
        if (f?.kind !== "str")
          throw typeError(`strftime() argument 1 must be str, not ${f === undefined ? "None" : pyTypeName(f)}`, span);
        return str(strftime(m, f.value));
      }
      break;
    case "total_seconds":
      if (m.type === "timedelta") return real(Number(micros(m)) / 1e6);
      break;
    default:
      break;
  }
  throw pyError("AttributeError", `'${m.type}' object has no attribute '${name}'`, span);
}

// ---------- operators

/** `+`, `-`, `*` where at least one side is a moment. Returns undefined when the pair is not supported. */
export function momentArith(op: string, a: Value, b: Value, span: Span): Value | undefined {
  const isDelta = (v: Value): v is Moment => v.kind === "moment" && v.type === "timedelta";
  const isPoint = (v: Value): v is Moment => v.kind === "moment" && v.type !== "timedelta";
  if (op === "add") {
    if (isDelta(a) && isDelta(b)) return fromMicros("timedelta", micros(a) + micros(b), span);
    if (isPoint(a) && isDelta(b)) return fromMicros(a.type, micros(a) + micros(b), span);
    if (isDelta(a) && isPoint(b)) return fromMicros(b.type, micros(a) + micros(b), span);
  }
  if (op === "sub") {
    if (isDelta(a) && isDelta(b)) return fromMicros("timedelta", micros(a) - micros(b), span);
    if (isPoint(a) && isDelta(b)) return fromMicros(a.type, micros(a) - micros(b), span);
    if (isPoint(a) && isPoint(b) && a.type === b.type) return fromMicros("timedelta", micros(a) - micros(b), span);
  }
  if (op === "mul") {
    const [d, n] = isDelta(a) ? [a, b] : [b, a];
    const k = isDelta(d) ? asBig(n) : null;
    if (isDelta(d) && k !== null) return fromMicros("timedelta", micros(d) * k, span);
  }
  if ((op === "truediv" || op === "floordiv") && isDelta(a)) {
    const zero = (): Error => pyError("ZeroDivisionError", "integer division or modulo by zero", span);
    if (isDelta(b)) {
      if (micros(b) === 0n) throw zero();
      return op === "floordiv" ? pyint(floorDiv(micros(a), micros(b))) : real(Number(micros(a)) / Number(micros(b)));
    }
    const k = asBig(b);
    if (k !== null) {
      if (k === 0n) throw zero();
      return fromMicros("timedelta", op === "floordiv" ? floorDiv(micros(a), k) : roundDiv(micros(a), k), span);
    }
  }
  return undefined;
}

/** Floor division on BigInts (BigInt `/` truncates toward zero, Python's `//` rounds toward minus infinity). */
function floorDiv(n: bigint, d: bigint): bigint {
  const q = n / d;
  return n % d !== 0n && n < 0n !== d < 0n ? q - 1n : q;
}

/** Division rounded to the nearest whole number, ties to even (how CPython rounds `timedelta / int`). */
function roundDiv(n: bigint, d: bigint): bigint {
  const q = floorDiv(n, d);
  const twice = 2n * (n - q * d);
  const abs = d < 0n ? -d : d;
  const up = d < 0n ? -twice : twice;
  if (up > abs || (up === abs && q % 2n !== 0n)) return q + 1n;
  return q;
}

export function momentTypeError(symbol: string, a: Value, b: Value, span: Span): Error {
  return typeError(`unsupported operand type(s) for ${symbol}: '${qualified(a)}' and '${qualified(b)}'`, span);
}

/** Orders two moments of the same type (-1, 0, 1), or null when they cannot be compared. */
export function momentOrder(a: Value, b: Value): number | null {
  if (a.kind !== "moment" || b.kind !== "moment" || a.type !== b.type) return null;
  const x = micros(a);
  const y = micros(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export const momentEquals = (a: Value, b: Value): boolean => momentOrder(a, b) === 0;
export const momentIsTruthy = (m: Moment): boolean => m.type !== "timedelta" || micros(m) !== 0n;
