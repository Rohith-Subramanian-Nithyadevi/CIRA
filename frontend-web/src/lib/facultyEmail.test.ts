import { getFacultyEmailError, normalizeFacultyEmail } from './facultyEmail';

describe('faculty email validation', () => {
  it('accepts and normalizes the exact institutional domain', () => {
    expect(getFacultyEmailError('  Faculty@CH.AMRITA.EDU ')).toBeNull();
    expect(normalizeFacultyEmail('  Faculty@CH.AMRITA.EDU ')).toBe('faculty@ch.amrita.edu');
  });

  it.each([
    'faculty@gmail.com',
    'faculty@amrita.edu',
    'faculty@evilch.amrita.edu',
    'faculty@ch-amrita.edu',
    'faculty@sub.ch.amrita.edu',
    'not-an-email',
    'faculty..name@ch.amrita.edu',
  ])('rejects invalid or lookalike address %s', (email) => {
    expect(getFacultyEmailError(email)).toBeTruthy();
  });
});
