import {
  detectSensitive,
  isSensitive,
  isTurkishNationalId,
  passesLuhn,
  sensitiveRegistry,
} from '../sensitiveDataGuard';

afterEach(() => {
  sensitiveRegistry.clear();
});

describe('the worked examples', () => {
  it.each([
    ['iletisim: ali@example.com', 'email'],
    ['TR33 0006 1005 1978 6457 8413 26', 'iban'],
    ['0532 123 45 67', 'phone'],
    ['Kart: 4242 4242 4242 4242', 'card'],
  ])('refuses %p as %s', (text, reason) => {
    expect(detectSensitive(text)).toBe(reason);
  });

  it.each([
    // 11 digits, but fails the checksum.
    'Sipariş no 12345678901',
    // No pattern matches — and 5.000.000 must not read as a phone number.
    'Toplam 5.000.000 TL ödendi',
    // 12 digits, below the card candidate's 13-digit floor.
    'Referans 2024 0001 0002',
  ])('allows %p', (text) => {
    expect(detectSensitive(text)).toBeNull();
  });
});

describe('isTurkishNationalId', () => {
  it('accepts a number that satisfies both check digits', () => {
    // Constructed from the documented rules rather than a real identity.
    // d0..d8 = 1,0,0,0,0,0,0,0,0 -> d9 = (1*7 - 0) % 10 = 7, d10 = (1+7) % 10 = 8
    expect(isTurkishNationalId('10000000078')).toBe(true);
  });

  it('rejects a leading zero', () => {
    expect(isTurkishNationalId('01234567890')).toBe(false);
  });

  it('rejects a wrong first check digit', () => {
    expect(isTurkishNationalId('10000000018')).toBe(false);
  });

  it('rejects a wrong second check digit', () => {
    expect(isTurkishNationalId('10000000071')).toBe(false);
  });

  it('handles the case where the modulo would go negative', () => {
    // odd*7 - even is negative here, which a plain `%` would leave negative
    // and so let a valid number slip through.
    // d0..d8 = 1,9,0,9,0,9,0,9,0 -> odd = 1, even = 36
    // (1*7 - 36) = -29 -> ((-29 % 10) + 10) % 10 = 1
    // d9 = 1, sum(d0..d9) = 1+9+0+9+0+9+0+9+0+1 = 38 -> d10 = 8
    expect(isTurkishNationalId('19090909018')).toBe(true);
  });

  it.each(['', '1234567890', '123456789012', '1234567890a'])(
    'rejects %p as not eleven digits',
    (value) => {
      expect(isTurkishNationalId(value)).toBe(false);
    }
  );
});

describe('passesLuhn', () => {
  it.each(['4242424242424242', '4111111111111111', '5500005555555559'])(
    'accepts %s',
    (digits) => {
      expect(passesLuhn(digits)).toBe(true);
    }
  );

  it.each(['4242424242424241', '1234567890123'])('rejects %s', (digits) => {
    expect(passesLuhn(digits)).toBe(false);
  });

  it('rejects a non-numeric string', () => {
    expect(passesLuhn('4242-4242')).toBe(false);
  });
});

describe('pattern coverage', () => {
  it('catches an IBAN written without spaces', () => {
    expect(detectSensitive('TR330006100519786457841326')).toBe('iban');
  });

  it('catches a mobile number with the +90 prefix', () => {
    expect(detectSensitive('Arayın: +90 532 123 45 67')).toBe('phone');
  });

  it('catches a card number written with dashes', () => {
    expect(detectSensitive('4242-4242-4242-4242')).toBe('card');
  });

  it('catches an identity number inside a sentence', () => {
    expect(detectSensitive('TC kimlik no 10000000078 olarak kayıtlıdır.')).toBe(
      'nationalId'
    );
  });

  it('allows ordinary prose', () => {
    expect(
      isSensitive(
        'Hesap sahibi, gerçek kişi müşterilere sunulan hizmetlerden ' +
          'yararlanmak için gerekli belgeleri ibraz etmekle yükümlüdür.'
      )
    ).toBe(false);
  });

  it.each(['', '   ', '\n\t'])('treats %p as not sensitive', (text) => {
    expect(isSensitive(text)).toBe(false);
  });
});

describe('the marked-text registry', () => {
  it('refuses text the host marked', () => {
    sensitiveRegistry.register(['Ahmet Yılmaz']);
    expect(detectSensitive('Ahmet Yılmaz')).toBe('marked');
  });

  it('matches both ways round', () => {
    sensitiveRegistry.register(['Ahmet Yılmaz']);

    // The user selected part of the marked region.
    expect(isSensitive('Ahmet')).toBe(true);
    // The user selected more than the marked region.
    expect(isSensitive('Sayın Ahmet Yılmaz, hoş geldiniz.')).toBe(true);
    // Something unrelated is still fine.
    expect(isSensitive('Mehmet Demir')).toBe(false);
  });

  it('ignores empty and whitespace-only entries, and trims the rest', () => {
    sensitiveRegistry.register(['', '   ', '  Ahmet  ']);

    expect(sensitiveRegistry.entries).toEqual(['Ahmet']);
    expect(isSensitive('Ahmet')).toBe(true);
  });

  it('removes only what that registration added', () => {
    const releaseA = sensitiveRegistry.register(['Ahmet', 'Mehmet']);
    sensitiveRegistry.register(['Mehmet', 'Ayşe']);

    releaseA();

    // Ahmet was only A's; Mehmet was registered twice and must survive.
    expect(isSensitive('Ahmet')).toBe(false);
    expect(isSensitive('Mehmet')).toBe(true);
    expect(isSensitive('Ayşe')).toBe(true);
  });

  it('is idempotent when released twice', () => {
    const release = sensitiveRegistry.register(['Ahmet']);
    sensitiveRegistry.register(['Ahmet']);

    release();
    release();

    // The second call must not consume the other region's registration.
    expect(isSensitive('Ahmet')).toBe(true);
  });

  it('wins over the pattern layer, being checked first', () => {
    sensitiveRegistry.register(['Merhaba dünya']);
    expect(detectSensitive('Merhaba dünya')).toBe('marked');
  });
});
