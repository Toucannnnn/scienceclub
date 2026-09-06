/**
 * Minimal RFC 4180 CSV writer. No dependency — this is the only place in the
 * app that needs one.
 */

/** Characters Excel and Sheets treat as the start of a formula. A tutor
 * named "=Smith" or a note starting with "-" would otherwise execute on
 * open, which is the classic CSV injection. */
const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let text = String(value);
  if (FORMULA_TRIGGERS.includes(text.charAt(0))) {
    text = `'${text}`;
  }
  // Quote unconditionally rather than sniffing for delimiters, and double
  // any embedded quotes.
  return `"${text.replaceAll('"', '""')}"`;
}

/**
 * Rows to a CSV string.
 *
 * - CRLF line endings, per the spec — Excel on Windows needs them.
 * - A UTF-8 BOM, or Excel mangles any non-ASCII name.
 */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** A filename-safe timestamp, e.g. 2026-09-06. */
export function csvDateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
