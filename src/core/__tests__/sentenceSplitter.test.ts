import {
  indexForOffset,
  isLetter,
  isUpperLetter,
  normalizeSegment,
  segmentTexts,
  splitByLength,
  splitSentences,
  type SegmentRange,
} from '../sentenceSplitter';

/** The text each range covers, so assertions read like the prose they check. */
const pieces = (text: string, ranges: SegmentRange[]): string[] =>
  ranges.map((r) => text.slice(r.start, r.end));

/** Segments as they would actually be sent. */
const sent = (text: string): string[] =>
  segmentTexts(text, splitSentences(text));

describe('character helpers', () => {
  it('treats Turkish dotted and dotless i as letters', () => {
    for (const ch of ['ı', 'İ', 'i', 'I', 'ş', 'Ş', 'ğ', 'Ğ', 'ö', 'Ö']) {
      expect(isLetter(ch)).toBe(true);
    }
  });

  it('recognises Turkish uppercase correctly', () => {
    expect(isUpperLetter('İ')).toBe(true);
    expect(isUpperLetter('Ş')).toBe(true);
    expect(isUpperLetter('ı')).toBe(false);
    expect(isUpperLetter('ş')).toBe(false);
  });

  it('finds no cased letters in Arabic, by design', () => {
    // A deliberate consequence: Arabic falls back to whole-paragraph behavior
    // rather than being mis-split by rules tuned for Latin Turkish.
    expect(isLetter('م')).toBe(false);
    expect(isUpperLetter('م')).toBe(false);
  });

  it.each(['1', ' ', '.', '!'])('does not treat %p as a letter', (ch) => {
    expect(isLetter(ch)).toBe(false);
  });
});

describe('the losslessness invariant', () => {
  const CORPUS = [
    '',
    ' ',
    '   \n\t  ',
    'Tek cümle.',
    'Bir. İki. Üç.',
    'Merhaba dünya',
    'T.C. Ziraat Bankası A.Ş. hesabınıza 5.000.000 TL yatırdı.',
    'Soru? Evet! Devam… Sonra.',
    'Satır bir\nSatır iki\n\nSatır dört',
    '7. Para yatırma işlemi. 8. Para çekme işlemi.',
    'www.ziraatbank.com.tr adresine gidin. Sonra ali@example.com yazın.',
    '(Bir şey gibi.) Sonrasında “devam etti.” Bitti.',
    'a',
    '.',
    '...',
    '   Öndeki boşluk. Arkadaki boşluk.   ',
    'Çok uzun boşluklu metin. Devamı burada.',
    'مرحبا بالعالم. هذه جملة أخرى.',
    'Karışık نص عربي ve Türkçe. İkinci cümle.',
    'NoSpacesAtAllJustOneVeryLongRunOfCharactersThatNeverBreaks',
    'Ancak bu böyle. Fakat şu öyle. Çünkü öyle gerekiyor.',
  ];

  it.each(CORPUS)('partitions %p exactly', (text) => {
    const ranges = splitSentences(text);

    if (!text.length) {
      expect(ranges).toHaveLength(0);
      return;
    }

    // Contiguous, ordered, covering the whole string.
    expect(ranges[0]!.start).toBe(0);
    expect(ranges[ranges.length - 1]!.end).toBe(text.length);
    for (let i = 0; i < ranges.length; i++) {
      expect(ranges[i]!.end).toBeGreaterThan(ranges[i]!.start);
      if (i > 0) expect(ranges[i]!.start).toBe(ranges[i - 1]!.end);
    }

    // Concatenation reproduces the input character for character.
    expect(pieces(text, ranges).join('')).toBe(text);
  });

  it('holds under generated input', () => {
    // A deterministic generator: no dependency, but wide enough to shake out
    // an off-by-one in the boundary placement.
    const ALPHABET = [
      'Merhaba',
      'dünya',
      'T.C.',
      'A.Ş.',
      'vb.',
      '5.000',
      '7.',
      'ancak',
      've',
      'ya da',
      '.',
      '!',
      '?',
      '…',
      '\n',
      ' ',
      '  ',
      ')',
      '“',
      'İş',
      'ı',
      'Ölçüm',
      'test.txt',
      'www.a.com',
      ' ',
      ',',
      ';',
    ];

    // Linear congruential generator — reproducible across runs.
    let seed = 12345;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);

    for (let round = 0; round < 400; round++) {
      const length = next() % 25;
      let text = '';
      for (let i = 0; i < length; i++) {
        text += ALPHABET[next() % ALPHABET.length];
      }

      const ranges = splitSentences(text);
      expect(pieces(text, ranges).join('')).toBe(text);
      if (text.length) {
        expect(ranges.length).toBeGreaterThan(0);
        expect(ranges[0]!.start).toBe(0);
        expect(ranges[ranges.length - 1]!.end).toBe(text.length);
      }
    }
  });

  it('yields no ranges for empty input and one for blank input', () => {
    expect(splitSentences('')).toHaveLength(0);
    expect(splitSentences('   ')).toHaveLength(1);
    expect(splitSentences('\n\n')).toHaveLength(1);
  });
});

describe('boundary detection', () => {
  it('splits on a plain sentence terminator', () => {
    expect(sent('Bir cümle. İkinci cümle.')).toEqual([
      'Bir cümle.',
      'İkinci cümle.',
    ]);
  });

  it('splits on ! and ?', () => {
    expect(sent('Gerçekten mi? Evet! Tamam.')).toEqual([
      'Gerçekten mi?',
      'Evet!',
      'Tamam.',
    ]);
  });

  it('splits on a hard line break', () => {
    expect(sent('birinci satır\nikinci satır')).toEqual([
      'birinci satır',
      'ikinci satır',
    ]);
  });

  it('breaks after closing punctuation', () => {
    expect(sent('(Bir şey gibi.) Sonrası burada.')).toEqual([
      '(Bir şey gibi.)',
      'Sonrası burada.',
    ]);
    expect(sent('“Oraya gitti.” Sonra döndü.')).toEqual([
      '“Oraya gitti.”',
      'Sonra döndü.',
    ]);
  });

  it('does not split when the next word is lowercase', () => {
    expect(sent('Bir şey oldu. sonra devam etti.')).toEqual([
      'Bir şey oldu. sonra devam etti.',
    ]);
  });

  it('does not split at the very end of the text', () => {
    expect(splitSentences('Tek cümle.')).toHaveLength(1);
  });
});

describe('when a period does not end a sentence', () => {
  it('keeps initialisms together', () => {
    expect(sent('T.C. Ziraat Bankası bugün açıklama yaptı.')).toEqual([
      'T.C. Ziraat Bankası bugün açıklama yaptı.',
    ]);
    expect(sent('Şirket A.Ş. olarak kuruldu.')).toEqual([
      'Şirket A.Ş. olarak kuruldu.',
    ]);
  });

  it('keeps grouped numbers together', () => {
    expect(sent('Toplam 5.000.000 TL ödendi. Sonra bitti.')).toEqual([
      'Toplam 5.000.000 TL ödendi.',
      'Sonra bitti.',
    ]);
  });

  it('keeps domains and e-mail addresses together', () => {
    // No rule of their own is needed: a boundary requires whitespace after the
    // terminator, and these dots are each followed immediately by a letter.
    expect(sent('www.ziraatbank.com.tr adresini ziyaret edin.')).toEqual([
      'www.ziraatbank.com.tr adresini ziyaret edin.',
    ]);
    expect(sent('Bize ali@example.com adresinden yazın.')).toEqual([
      'Bize ali@example.com adresinden yazın.',
    ]);
    expect(sent('Dosya dosya.txt olarak kaydedildi.')).toEqual([
      'Dosya dosya.txt olarak kaydedildi.',
    ]);
  });

  it.each(['vb', 'vs', 'bkz', 'örn', 'Prof', 'Ltd', 'Dr', 'Mah', 'Cad'])(
    'does not split after the abbreviation %s.',
    (abbr) => {
      const text = `Bir şey ${abbr}. Sonrası burada.`;
      // The abbreviation holds its sentence together; the real terminator
      // still splits.
      expect(sent(text)).toEqual([`Bir şey ${abbr}. Sonrası burada.`]);
    }
  );

  it('keeps a clause number with the sentence it introduces', () => {
    expect(sent('7. Para yatırma işlemi ücretsizdir.')).toEqual([
      '7. Para yatırma işlemi ücretsizdir.',
    ]);
  });

  it('keeps clause numbers with their clauses across a list', () => {
    const text = '7. Para yatırma ücretsizdir.\n8. Para çekme ücretlidir.';
    expect(sent(text)).toEqual([
      '7. Para yatırma ücretsizdir.',
      '8. Para çekme ücretlidir.',
    ]);
  });
});

describe('merging short fragments', () => {
  it('merges a fragment too short to stand alone', () => {
    // "A." carries one cased letter, so it cannot be a sentence of its own.
    const parts = sent('Bir cümle. A. Devam eden cümle.');
    expect(
      parts.every((p) => p.replace(/[^a-zçğıöşü]/gi, '').length >= 2)
    ).toBe(true);
  });

  it('appends a too-short tail to the previous segment', () => {
    const parts = sent('Bir cümle burada. X');
    expect(parts).toHaveLength(1);
    expect(parts[0]).toBe('Bir cümle burada. X');
  });

  it('leaves a single sentence as one range', () => {
    // So the caller can fall back to the paragraph.
    expect(splitSentences('Sadece bir cümle var burada.')).toHaveLength(1);
  });
});

describe('length chunking', () => {
  const MAX = 60;

  it('never chunks text under the limit', () => {
    // Real contract clauses are 190-250 characters and must never trigger it.
    const clause =
      'Hesap sahibi, gerçek kişi müşterilerine sunulan hizmetlerden ' +
      'yararlanabilmek için gerekli belgeleri ibraz etmekle yükümlüdür.';
    expect(splitSentences(clause, 900)).toHaveLength(1);
  });

  it('chunks over-long text so every chunk fits, losslessly', () => {
    const text =
      'Bu cümle oldukça uzun bir metin parçasıdır ve sınırı aşmaktadır, ' +
      'bu yüzden bölünmesi gerekir, ancak anlamını korumalıdır.';

    const ranges = splitSentences(text, MAX);

    expect(ranges.length).toBeGreaterThan(1);
    for (const range of ranges) {
      expect(range.end - range.start).toBeLessThanOrEqual(MAX);
    }
    expect(pieces(text, ranges).join('')).toBe(text);
  });

  it('cuts near the middle rather than peeling maxChars off the front', () => {
    const text =
      'aaaa bbbb cccc dddd eeee ffff gggg hhhh iiii jjjj kkkk llll mmmm';
    const ranges = splitByLength(text, 40);

    // A front-peeling implementation leaves a stub of a few words at the end.
    const lengths = ranges.map((r) => r.end - r.start);
    const shortest = Math.min(...lengths);
    expect(shortest).toBeGreaterThan(10);
  });

  it('prefers a comma over a conjunction', () => {
    const text =
      'birinci bölüm burada yer alır, ikinci bölüm ise buradadır ve devam eder';
    const ranges = splitByLength(text, 45);

    // The cut lands after the comma's whitespace, so the second chunk opens
    // with the word that followed the comma.
    expect(text.slice(ranges[1]!.start)).toMatch(/^ikinci/);
  });

  it('puts a conjunction at the start of the next chunk', () => {
    const text =
      'birinci bölüm burada yer almaktadır ancak ikinci bölüm başka yerdedir';
    const ranges = splitByLength(text, 40);

    expect(ranges.length).toBeGreaterThan(1);
    expect(text.slice(ranges[1]!.start)).toMatch(/^ancak/);
  });

  it('hard-cuts pathological input with no whitespace', () => {
    const text = 'x'.repeat(200);
    const ranges = splitByLength(text, 50);

    expect(ranges).toHaveLength(4);
    for (const range of ranges) {
      expect(range.end - range.start).toBeLessThanOrEqual(50);
    }
    expect(pieces(text, ranges).join('')).toBe(text);
  });

  it('respects the limit in paragraph mode while ignoring sentence boundaries', () => {
    const text = 'Bir. İki. Üç. Dört. Beş. Altı. Yedi. Sekiz.';

    // One segment when it fits, regardless of the sentences inside it.
    expect(splitByLength(text, 900)).toHaveLength(1);

    const chunked = splitByLength(text, 20);
    expect(chunked.length).toBeGreaterThan(1);
    for (const range of chunked) {
      expect(range.end - range.start).toBeLessThanOrEqual(20);
    }
  });
});

describe('indexForOffset', () => {
  const text = 'Bir cümle. İkinci cümle. Üçüncü cümle.';
  const ranges = splitSentences(text);

  it('maps an offset to its sentence', () => {
    expect(indexForOffset(ranges, 0)).toBe(0);
    expect(indexForOffset(ranges, ranges[1]!.start)).toBe(1);
    expect(indexForOffset(ranges, ranges[2]!.start + 2)).toBe(2);
  });

  it('clamps an offset past the end to the last sentence', () => {
    expect(indexForOffset(ranges, text.length)).toBe(ranges.length - 1);
    expect(indexForOffset(ranges, text.length + 500)).toBe(ranges.length - 1);
  });

  it('reports a negative offset as not found', () => {
    expect(indexForOffset(ranges, -1)).toBe(-1);
  });

  it('reports not found for an empty range list', () => {
    expect(indexForOffset([], 0)).toBe(-1);
  });
});

describe('normalizeSegment', () => {
  it('strips the inline-content placeholder', () => {
    expect(normalizeSegment('Bir￼şey')).toBe('Bir şey');
  });

  it('collapses whitespace runs, soft line breaks included', () => {
    expect(normalizeSegment('Bir   şey\n  daha\t\tvar')).toBe(
      'Bir şey daha var'
    );
  });

  it('collapses non-breaking spaces too', () => {
    expect(normalizeSegment('Bir  şey')).toBe('Bir şey');
  });

  it('trims', () => {
    expect(normalizeSegment('  Bir şey  ')).toBe('Bir şey');
  });

  it('produces the same string for the same sentence, wrapped or not', () => {
    // That string is the cache key, so this is not cosmetic.
    expect(normalizeSegment('Bir şey\nvar')).toBe(
      normalizeSegment('Bir şey var')
    );
  });
});
