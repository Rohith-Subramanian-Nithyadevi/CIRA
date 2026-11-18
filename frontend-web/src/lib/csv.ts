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

export const parseCsv = (csvText: string): Array<Record<string, string>> => {
  if (!csvText || !csvText.trim()) return [];

  const cleanText = csvText.replace(/^\uFEFF/, '').trim();
  const lines = cleanText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map(h => h.replace(/^["']|["']$/g, '').trim());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      let val = values[idx] ?? '';
      val = val.replace(/^["']|["']$/g, '').trim();
      if (val.startsWith("'")) val = val.slice(1);
      row[header] = val;
    });
    rows.push(row);
  }

  return rows;
};
