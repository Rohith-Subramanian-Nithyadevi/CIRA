import { escapeCsvCell, serializeCsv } from './csv';

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
});
