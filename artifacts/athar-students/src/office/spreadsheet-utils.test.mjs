import assert from "node:assert/strict";
import { test } from "node:test";
import { cellAddress, colName, evaluateFormula } from "./spreadsheet-utils.ts";

test("converts spreadsheet positions to A1 addresses", () => {
  assert.equal(colName(0), "A");
  assert.equal(colName(25), "Z");
  assert.equal(colName(26), "AA");
  assert.equal(cellAddress(2, 3), "D3");
});

test("evaluates arithmetic with precedence and parentheses", () => {
  assert.equal(evaluateFormula("=2+3*4", {}), "14");
  assert.equal(evaluateFormula("=(2+3)*4", {}), "20");
});

test("evaluates references and SUM ranges", () => {
  const cells = {
    A1: { value: "2" },
    A2: { value: "3" },
    A3: { value: "4" },
    B1: { value: "=A1+A2" },
  };
  assert.equal(evaluateFormula("=B1*2", cells), "10");
  assert.equal(evaluateFormula("=SUM(A1:A3)", cells), "9");
});

test("rejects unsupported text, cycles, and excessively large ranges", () => {
  assert.equal(evaluateFormula("=1+2unknown", {}), "#خطأ");
  assert.equal(evaluateFormula("=A1", { A1: { value: "=A1" } }), "#خطأ");
  assert.equal(evaluateFormula("=SUM(A1:A100000)", {}), "#خطأ");
});
