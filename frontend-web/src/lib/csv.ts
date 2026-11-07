export type CsvRow = Record<string, unknown>;

const FORMULA_PREFIX = /^[=+\-@]/;

export const escapeCsvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  const safeText = FORMULA_PREFIX.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
};

export const serializeCsv = (rows: CsvRow[], columns: string[]): string => {
  const header = columns.map(escapeCsvCell).join(',');
  const body = rows.map(row => columns.map(column => escapeCsvCell(row[column])).join(','));
  return [header, ...body].join('\r\n');
};

export const downloadCsv = (rows: CsvRow[], columns: string[], filename: string): void => {
  if (rows.length === 0) return;
  const blob = new Blob([`\uFEFF${serializeCsv(rows, columns)}`], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${filename}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};
