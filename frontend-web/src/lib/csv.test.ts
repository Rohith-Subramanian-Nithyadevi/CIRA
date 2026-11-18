import { escapeCsvCell, serializeCsv, parseCsv } from './csv';

describe('CSV export', () => {
  it('escapes quotes, commas, and newlines', () => {
    expect(escapeCsvCell('A, "quoted"\nvalue')).toBe('"A, ""quoted""\nvalue"');
  });

  it('neutralizes spreadsheet formulas', () => {
    expect(escapeCsvCell('=SUM(A1:A2)')).toBe('"\'=SUM(A1:A2)"');
    expect(escapeCsvCell('-10')).toBe('"\'-10"');
    expect(escapeCsvCell('@user')).toBe('"\'@user"');
  });

  it('serializes only requested columns', () => {
    expect(serializeCsv([{ name: 'Ada', secret: 'omit' }], ['name'])).toBe('"name"\r\n"Ada"');
  });

  it('parses standard CSV text into objects', () => {
    const csv = 'Roll Number,Student Name,Q1,Q2\r\n21CS042,Alice Smith,5,10\r\n21CS043,Bob Jones,4,8';
    const parsed = parseCsv(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({
      'Roll Number': '21CS042',
      'Student Name': 'Alice Smith',
      'Q1': '5',
      'Q2': '10'
    });
    expect(parsed[1]['Roll Number']).toBe('21CS043');
  });

  it('handles quoted commas in cells correctly', () => {
    const csv = '"Roll Number","Notes"\n"21CS042","Good work, keep it up"';
    const parsed = parseCsv(csv);
    expect(parsed[0]['Notes']).toBe('Good work, keep it up');
  });
});
