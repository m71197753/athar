export type CellStyle = {
  value: string;
  bold?: boolean;
  italic?: boolean;
  textColor?: string;
  backgroundColor?: string;
  textAlign?: "left" | "center" | "right";
};

export function colName(index: number): string {
  let n = index + 1;
  let result = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

export function cellAddress(row: number, col: number): string {
  return `${colName(col)}${row + 1}`;
}

export function addressParts(address: string): { row: number; col: number } | null {
  const match = /^([A-Z]+)(\d+)$/i.exec(address);
  if (!match) return null;
  let col = 0;
  for (const char of match[1].toUpperCase()) col = col * 26 + char.charCodeAt(0) - 64;
  return { row: Number(match[2]) - 1, col: col - 1 };
}

export function evaluateFormula(input: string, cells: Record<string, CellStyle>, visiting = new Set<string>()): string {
  if (!input.startsWith("=")) return input;
  if (visiting.size > 100) return "#خطأ";

  const source = input.slice(1).replace(/\s+/g, "");
  const pattern = /[A-Za-z]+\d+|SUM|(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/:,]/iy;
  const tokens: string[] = [];
  let offset = 0;
  while (offset < source.length) {
    pattern.lastIndex = offset;
    const match = pattern.exec(source);
    if (!match) return "#خطأ";
    tokens.push(match[0]);
    offset = pattern.lastIndex;
  }
  if (!tokens.length) return "#خطأ";

  let cursor = 0;
  const peek = () => tokens[cursor];
  const take = () => tokens[cursor++];
  const valueAt = (ref: string): number => {
    const key = ref.toUpperCase();
    if (visiting.has(key)) throw new Error("cycle");
    const raw = cells[key]?.value ?? "";
    if (raw.startsWith("=")) {
      const next = new Set(visiting);
      next.add(key);
      const calculated = evaluateFormula(raw, cells, next);
      if (calculated === "#خطأ") return Number.NaN;
      const parsed = Number(calculated);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  };

  const expression = (): number => {
    let value = term();
    while (peek() === "+" || peek() === "-") {
      const operator = take();
      const right = term();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  };
  const primary = (): number => {
    const token = take();
    if (token === "(") {
      const value = expression();
      if (take() !== ")") throw new Error("parenthesis");
      return value;
    }
    if (token === "-") return -primary();
    if (token?.toUpperCase() === "SUM") {
      if (take() !== "(") throw new Error("sum");
      const first = take();
      if (!/^[A-Z]+\d+$/i.test(first || "")) throw new Error("range");
      let result = 0;
      if (peek() === ":") {
        take();
        const last = take();
        const start = addressParts(first);
        const end = addressParts(last || "");
        if (!start || !end
          || start.row < 0 || end.row < 0 || start.col < 0 || end.col < 0
          || start.row >= 100 || end.row >= 100 || start.col >= 26 || end.col >= 26) {
          throw new Error("range");
        }
        for (let row = Math.min(start.row, end.row); row <= Math.max(start.row, end.row); row++) {
          for (let col = Math.min(start.col, end.col); col <= Math.max(start.col, end.col); col++) {
            result += valueAt(cellAddress(row, col));
          }
        }
      } else {
        result = valueAt(first);
      }
      if (take() !== ")") throw new Error("sum");
      return result;
    }
    if (/^[A-Z]+\d+$/i.test(token || "")) return valueAt(token);
    const number = Number(token);
    if (Number.isFinite(number)) return number;
    throw new Error("token");
  };
  const term = (): number => {
    let value = primary();
    while (peek() === "*" || peek() === "/") {
      const operator = take();
      const right = primary();
      value = operator === "*" ? value * right : right === 0 ? Number.NaN : value / right;
    }
    return value;
  };

  try {
    const result = expression();
    if (cursor !== tokens.length || !Number.isFinite(result)) return "#خطأ";
    return Number.isInteger(result) ? String(result) : String(Number(result.toFixed(8)));
  } catch {
    return "#خطأ";
  }
}
