import type { SourceSpan } from './types.js';

export function toLines(text: string): string[] {
  // Normalize newlines, keep it simple/deterministic.
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

export function spanForSingleLine(lineNumber1Based: number): SourceSpan {
  return { kind: 'line-range', startLine: lineNumber1Based, endLine: lineNumber1Based };
}

export function spanForLineRange(startLine: number, endLine: number): SourceSpan {
  return { kind: 'line-range', startLine, endLine };
}

export function isBlank(line: string): boolean {
  return line.trim().length === 0;
}
