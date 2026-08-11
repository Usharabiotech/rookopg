import { InvalidPhoneNumberError, maskPhone, normalisePhone } from './phone.util';

describe('normalisePhone', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['+919876543210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['+91 98765-43210', '+919876543210'],
    ['(+91) 9876543210', '+919876543210'],
  ])('normalises %s to %s', (input, expected) => {
    expect(normalisePhone(input)).toBe(expected);
  });

  it('treats every spelling of one number as the same identity', () => {
    const forms = ['9876543210', '+919876543210', '09876543210', '91 98765 43210'];
    const normalised = new Set(forms.map(normalisePhone));
    expect(normalised.size).toBe(1);
  });

  it.each([
    ['5876543210', 'starts with 5 — not a mobile prefix'],
    ['987654321', 'nine digits'],
    ['98765432101', 'eleven digits'],
    ['', 'empty'],
    ['abcdefghij', 'letters'],
    ['+14155552671', 'not an Indian number'],
  ])('rejects %s (%s)', (input) => {
    expect(() => normalisePhone(input)).toThrow(InvalidPhoneNumberError);
  });
});

describe('maskPhone', () => {
  it('hides the middle digits', () => {
    expect(maskPhone('+919876543210')).toBe('+9198765***10');
  });

  it('does not leak short input', () => {
    expect(maskPhone('+91')).toBe('***');
  });
});
