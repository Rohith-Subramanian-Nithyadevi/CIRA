import xlsx from 'xlsx';

export interface ParsedRow {
  question_type: string;
  content: string;
  options: string;
  correct_option: string;
  difficulty: string;
  topic: string;
  sub_topics: string;
  __rowNum__: number;
}

export const parseExcelBuffer = (buffer: Buffer): ParsedRow[] => {
  // Read the workbook from memory buffer
  const workbook = xlsx.read(buffer, { type: 'buffer' });

  // Assume the first sheet is the target
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert the sheet to JSON, including the row number for error reporting
  // raw: false forces string conversion for all cells, avoiding date/number format issues
  const rows = xlsx.utils.sheet_to_json(worksheet, { defval: '', raw: false });

  return rows.map((row: any, index: number) => {
    // sheet_to_json returns rows starting from index 0 mapping to Excel row 2 (if header is row 1)
    const rowNum = index + 2; 

    // Extract headers dynamically to avoid exact case sensitivity issues, but expecting strict column names
    const getCell = (key: string) => {
      const foundKey = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase());
      return foundKey ? row[foundKey] : '';
    };

    return {
      question_type: String(getCell('Question Type')).trim(),
      content: String(getCell('Content')).trim(),
      options: String(getCell('Options')).trim(),
      correct_option: String(getCell('Correct Answer')).trim(),
      difficulty: String(getCell('Difficulty')).trim(),
      topic: String(getCell('Topic')).trim(),
      sub_topics: String(getCell('Sub-Divisions')).trim(),
      __rowNum__: rowNum
    };
  });
};
