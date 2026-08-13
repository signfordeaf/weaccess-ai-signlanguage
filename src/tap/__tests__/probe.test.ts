import { Keyboard } from 'react-native';
import { classify, classifyLegacy } from '../probe';
import { isTranslatable, readText } from '../textNode';
import { composite, deepest, host, pressable, text, txt } from './fixtures';

/** A private-use codepoint, as an icon font would render. */
const ICON = '';

describe('isTranslatable', () => {
  it('accepts ordinary prose', () => {
    expect(isTranslatable('Merhaba dünya')).toBe(true);
  });

  it('rejects an icon glyph', () => {
    // Load-bearing, not cosmetic: without it, icon buttons stop being pressable.
    expect(isTranslatable(ICON)).toBe(false);
  });

  it('rejects a supplementary private-use glyph', () => {
    expect(isTranslatable('\u{F0001}')).toBe(false);
    expect(isTranslatable('\u{100001}')).toBe(false);
  });

  it.each(['', '   ', '\n\t\r ', '￼'])('rejects %j as content', (value) => {
    expect(isTranslatable(value)).toBe(false);
  });

  it('accepts Arabic', () => {
    // The regression that guards against an "is this a letter" test: Arabic is
    // uncased, so a case-based filter would silently reject a supported
    // language.
    expect(isTranslatable('مرحبا')).toBe(true);
    expect(isTranslatable('٥')).toBe(true);
  });

  it('accepts a label that also carries an icon', () => {
    expect(isTranslatable(`${ICON} Kabul ediyorum`)).toBe(true);
  });
});

describe('readText', () => {
  it('concatenates nested text in render order', () => {
    const node = host(
      'RCTText',
      {},
      txt('Merhaba '),
      host('RCTVirtualText', {}, txt('dünya')),
      txt('!')
    );

    expect(readText(node)).toBe('Merhaba dünya!');
  });

  it('marks inline embedded content with one placeholder', () => {
    const node = host(
      'RCTText',
      {},
      txt('Bak: '),
      host('RCTImage', {}),
      txt(' burada')
    );

    // Dropping it would shift every index after it and misalign the
    // tap-to-character mapping.
    expect(readText(node)).toBe('Bak: ￼ burada');
  });

  it('never reads an accessibility label', () => {
    const node = host(
      'RCTText',
      { accessibilityLabel: 'Something else entirely' },
      txt('Görünen metin')
    );

    expect(readText(node)).toBe('Görünen metin');
  });

  it('reads numeric children', () => {
    expect(
      readText(
        host('RCTText', {}, txt('Tutar: '), { type: null, memoizedProps: 42 })
      )
    ).toBe('Tutar: 42');
  });
});

describe('classify', () => {
  it('claims plain text', () => {
    const tree = host('RCTView', {}, text('Merhaba dünya'));
    const outcome = classify(deepest(tree));

    expect(outcome.kind).toBe('text');
    expect(outcome.text).toBe('Merhaba dünya');
  });

  it('reads a labelled button rather than pressing it', () => {
    // A Deaf user must be able to read the button that agrees to the contract.
    const tree = host('RCTView', {}, pressable(text('Kabul ediyorum')));
    const outcome = classify(deepest(tree));

    expect(outcome.kind).toBe('text');
    expect(outcome.text).toBe('Kabul ediyorum');
  });

  it('lets an icon-only control still press', () => {
    const tree = host('RCTView', {}, pressable(text(ICON)));
    expect(classify(deepest(tree)).kind).toBe('interactive');
  });

  it('does not let an icon shadow the label beside it', () => {
    const tree = host('RCTView', {}, pressable(text(ICON), text('Kaydet')));

    // Tapping the label reads it...
    const label = tree.child!.child!.child!.sibling!;
    expect(classify(label as never).text).toBe('Kaydet');

    // ...and tapping the icon still presses the button.
    const icon = tree.child!.child!.child!;
    expect(classify(icon as never).kind).toBe('interactive');
  });

  it('gives one row two outcomes', () => {
    // A checkbox row reads when tapped on its label and ticks when tapped on
    // its box.
    const box = host('RCTView', {});
    const label = text('Şartları kabul ediyorum');
    const row = host('RCTView', {}, pressable(box, label));

    expect(classify(label as never).kind).toBe('text');
    expect(classify(box as never).kind).toBe('interactive');
    expect(row).toBeTruthy();
  });

  it('hands an editable field to the app', () => {
    const input = host('AndroidTextInput', { editable: true, value: 'abc' });
    expect(classify(input).kind).toBe('interactive');
  });

  it('leaves a read-only selectable field translatable', () => {
    const input = host('AndroidTextInput', {
      editable: false,
      value: 'Sözleşme metni',
    });

    const outcome = classify(input);
    expect(outcome.kind).toBe('text');
    expect(outcome.text).toBe('Sözleşme metni');
  });

  it('returns none for empty space', () => {
    expect(classify(host('RCTView', {})).kind).toBe('none');
    expect(classify(host('RCTImage', {})).kind).toBe('none');
  });

  describe('inside a scroll view', () => {
    it('keeps plain text translatable', () => {
      // A scroll view's own listeners are ancestors of its content, so without
      // the stop-at-scrollable rule nothing in any list is ever translatable.
      const label = text('Uzun bir sözleşme metni');
      host(
        'RCTScrollView',
        { onStartShouldSetResponder: () => true },
        host('RCTView', {}, label)
      );

      expect(classify(label as never).kind).toBe('text');
    });

    it('still reads a labelled button', () => {
      const label = text('Devam et');
      host(
        'RCTScrollView',
        { onStartShouldSetResponder: () => true },
        pressable(label)
      );

      expect(classify(label as never).kind).toBe('text');
    });

    it('hands the tap back when it would dismiss the keyboard', () => {
      const label = text('Bir metin');
      host('RCTScrollView', {}, host('RCTView', {}, label));

      expect(classify(label as never, { keyboardVisible: true }).kind).toBe(
        'interactive'
      );
    });

    it('keeps translating when taps are set to persist', () => {
      const label = text('Bir metin');
      host(
        'RCTScrollView',
        { keyboardShouldPersistTaps: 'handled' },
        host('RCTView', {}, label)
      );

      expect(classify(label as never, { keyboardVisible: true }).kind).toBe(
        'text'
      );
    });
  });

  describe('ambient listeners', () => {
    it('skips a page-wide keyboard-dismiss wrapper', () => {
      const label = text('Bir metin');
      host(
        'RCTView',
        { onStartShouldSetResponder: () => true, onPress: Keyboard.dismiss },
        label
      );

      const isAmbient = (fiber: any) =>
        fiber.memoizedProps?.onPress === Keyboard.dismiss;

      expect(classify(label as never, { isAmbient }).kind).toBe('text');
      // Without the guard, that one wrapper makes the whole page interactive.
      expect(classify(label as never).kind).toBe('text');
    });

    it('still treats a real control as interactive', () => {
      const tree = host('RCTView', {}, pressable(host('RCTView', {})));
      const isAmbient = () => false;

      expect(classify(deepest(tree), { isAmbient }).kind).toBe('interactive');
    });
  });

  it('treats a gesture-handler wrapper as a control', () => {
    const tree = host(
      'RCTView',
      {},
      composite('GestureDetector', {}, host('RCTView', {}))
    );

    expect(classify(deepest(tree)).kind).toBe('interactive');
  });

  it('treats host-tappable text as a control, not prose', () => {
    // This is precisely the case long press exists for.
    const node = text('Şartları oku', { isPressable: true });
    expect(classify(node as never).kind).toBe('interactive');
  });

  it('does not spin on a cyclic tree', () => {
    const node = host('RCTView', {});
    node.return = node;
    expect(() => classify(node)).not.toThrow();
  });
});

describe('classifyLegacy', () => {
  it('claims a button by returning its text', () => {
    const tree = host('RCTView', {}, pressable(text('Kabul ediyorum')));
    const outcome = classifyLegacy(deepest(tree));

    expect(outcome.kind).toBe('text');
    expect(outcome.text).toBe('Kabul ediyorum');
  });

  it('still refuses an icon glyph', () => {
    const tree = host('RCTView', {}, pressable(text(ICON)));
    expect(classifyLegacy(deepest(tree)).kind).toBe('none');
  });
});
