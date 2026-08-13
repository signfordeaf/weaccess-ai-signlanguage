/**
 * SignForDeaf showcase.
 *
 * One section per SDK capability, in the same order as the Flutter example's
 * showcase page, so both SDKs demonstrate the same things. Section 3 — the
 * contract page — is the one that matters: it is the docs/08 passthrough
 * checklist in miniature.
 *
 * Swipe sideways (or use the button at the bottom) for the content-rich demo
 * screens, which exercise the same behaviour against realistic layouts.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  SignLanguageProvider,
  SignLanguageSensitive,
  SignLanguageText,
  useSignLanguageContext,
} from 'weaccess-ai-signlanguage';

import { SDK_ENV } from './env';

const SDK_CONFIG = {
  // The key and the URL parameters (apiUrl, originUrl, fdid, tid) are build
  // defines: they come from example/.env or the shell and are inlined at
  // bundle time, so nothing secret lives in this file. See env.ts.
  //
  // Leaving fdid/tid unset in the environment keeps the SDK's own default —
  // Hesna — which is what the showcase is meant to run on.
  ...SDK_ENV,
  language: 'tr' as const,
  theme: {
    // The purple from the logo — also the SDK default.
    primaryColor: '#6750A4',
    textColor: '#1C1B1F',
  },
  accessibility: {
    announceOnOpen: true,
  },
};

const App = () => (
  <SafeAreaProvider>
    <SignLanguageProvider
      config={SDK_CONFIG}
      onReady={() => console.log('SDK ready')}
      onError={(error) => console.warn('SDK error:', error.code, error.message)}
    >
      <RootPager />
    </SignLanguageProvider>
  </SafeAreaProvider>
);

// ---------------------------------------------------------------------------
// The showcase — one section per SDK capability, mirroring the Flutter
// example's showcase page so both SDKs demo the same things in the same order.
// ---------------------------------------------------------------------------

const PRIMARY = '#6750A4';

const Section = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) => (
  <View style={sc.card}>
    <Text style={sc.cardTitle}>{title}</Text>
    {subtitle ? <Text style={sc.cardSubtitle}>{subtitle}</Text> : null}
    {children}
  </View>
);

const Chip = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Pressable style={sc.chip} onPress={onPress}>
    <Text style={sc.chipText}>{label}</Text>
  </Pressable>
);

const ShowcaseScreen = ({ onOpenDemos }: { onOpenDemos: () => void }) => {
  const { state, enable, disable, translate, controller } =
    useSignLanguageContext();

  const [accepted, setAccepted] = useState(false);
  const [note, setNote] = useState('');
  const [language, setLanguage] = useState<'tr' | 'en' | 'ar'>('tr');
  const [primary, setPrimary] = useState(PRIMARY);
  const [events, setEvents] = useState<string[]>([]);




  // 8. Live events — the controller's own stream, newest first.
  useEffect(
    () =>
      controller.events.onAny((event) => {
        const text = event.text ? ` · ${event.text.slice(0, 32)}` : '';
        setEvents((previous) => [`${event.type}${text}`, ...previous].slice(0, 8));
      }),
    [controller]
  );

  return (
    <SafeAreaView style={sc.screen}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={sc.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={sc.h1}>SignForDeaf</Text>
        <Text style={sc.lede}>
          Her bölüm SDK'nın bir yeteneğini gösterir. Çeviri modunu açın ve
          metinlere dokunun.
        </Text>

        {/* 1 ----------------------------------------------------------- */}
        <Section
          title="İşaret dili modu"
          subtitle="SDK'yı açıp kapatır. Kapalıyken uygulama tamamen dokunulmamış davranır."
        >
          <View style={sc.row}>
            <Switch
              value={state.isEnabled}
              onValueChange={(next) => (next ? enable() : disable())}
            />
            <Text style={sc.rowLabel}>
              {state.isEnabled ? 'Açık' : 'Kapalı'}
            </Text>
          </View>
        </Section>

        {/* 2 ----------------------------------------------------------- */}
        <Section
          title="Dokunarak çevir"
          subtitle="Player açıkken ekrandaki yazılara dokunmak o cümleyi çevirir."
        >
          <Text style={sc.body}>
            Bu paragrafa dokunun. Cümle cümle bölünür ve yalnızca
            dokunduğunuz cümle çevrilir. Bir sonraki cümle arka planda
            hazırlanır.
          </Text>
          <SignLanguageText style={sc.optIn}>
            Bu satır SignLanguageText ile sarılmıştır — özel çizim yapan
            ekranlarda açık tercih olarak kullanılır.
          </SignLanguageText>
        </Section>

        {/* 3 — the one that actually proves docs/08 --------------------- */}
        <Section
          title="Sözleşme sayfası (asıl test)"
          subtitle="Çeviri açıkken bile kutu işaretlenir, alan odaklanır, buton basılır."
        >
          <Text style={sc.clauseNo}>1. Genel hükümler</Text>
          <Text style={sc.body}>
            Hesap sahibi, gerçek kişi müşterilere sunulan hizmetlerden
            yararlanabilmek için gerekli belgeleri ibraz etmekle yükümlüdür.
            T.C. mevzuatı uyarınca 5.000.000 TL üzerindeki işlemler ayrıca
            bildirime tabidir.
          </Text>

          <Pressable
            style={sc.checkRow}
            onPress={() => setAccepted((value) => !value)}
          >
            {/* No text of its own: the tap must reach this box, not translate. */}
            <View style={[sc.box, accepted && sc.boxOn]} />
            {/* A label: tapping *here* must read, not tick. */}
            <Text style={sc.checkLabel}>Sözleşmeyi okudum ve kabul ediyorum</Text>
          </Pressable>

          <TextInput
            style={sc.input}
            placeholder="Notunuz (odak ve imleç korunmalı)"
            placeholderTextColor="#9A93A5"
            value={note}
            onChangeText={setNote}
          />

          <Pressable
            style={[sc.button, { backgroundColor: primary }]}
            onPress={() => Alert.alert('Onay', 'Sözleşme onaylandı')}
          >
            <Text style={sc.buttonText}>Onayla</Text>
          </Pressable>
        </Section>

        {/* 4 ----------------------------------------------------------- */}
        <Section
          title="Seçim menüsü (opsiyonel)"
          subtitle="Host'un seçilebilir yaptığı metinde sistem menüsüne 'İşaret Dili' eklenir."
        >
          <Text style={sc.body} selectable>
            Bu metni seçin ve açılan menüden İşaret Dili'ni seçin. Bu, SDK'da
            kalan tek native parçadır.
          </Text>
          <TextInput
            style={sc.input}
            defaultValue="Seçilebilir bir giriş alanı"
            placeholderTextColor="#9A93A5"
          />
        </Section>

        {/* 5 ----------------------------------------------------------- */}
        <Section
          title="Programatik çeviri"
          subtitle="Host kendi arayüzünden çeviri başlatır; dokunma gerekmez."
        >
          <View style={sc.chipRow}>
            {[
              'Merhaba, hoş geldiniz!',
              'Yardıma ihtiyacınız var mı?',
              'İşleminiz tamamlandı.',
            ].map((phrase) => (
              <Chip
                key={phrase}
                label={phrase}
                onPress={() => void translate(phrase)}
              />
            ))}
          </View>
        </Section>

        {/* 6 ----------------------------------------------------------- */}
        <Section
          title="Hassas veri koruması"
          subtitle="Kişisel veri hiçbir zaman çeviri servisine gitmez."
        >
          <SignLanguageSensitive text="Ahmet Yılmaz">
            <Text style={sc.body}>
              Hesap sahibi: Ahmet Yılmaz — host tarafından işaretlendi.
            </Text>
          </SignLanguageSensitive>

          <Text style={sc.body}>
            Kart numarası 4242 4242 4242 4242 otomatik olarak yakalanır.
            Bu cümle reddedilir, paragrafın geri kalanı çevrilmeye devam eder.
          </Text>

          <Chip
            label="Engellenen metni çevirmeyi dene"
            onPress={() => void translate('Kart: 4242 4242 4242 4242')}
          />
        </Section>

        {/* 7 ----------------------------------------------------------- */}
        <Section
          title="Kişiselleştirme"
          subtitle="Dil ve tema, player'a ve kontrollere anında uygulanır."
        >
          <View style={sc.chipRow}>
            {(['tr', 'en', 'ar'] as const).map((code) => (
              <Pressable
                key={code}
                style={[sc.chip, language === code && sc.chipOn]}
                onPress={() => {
                  setLanguage(code);
                  controller.setLanguage(code);
                }}
              >
                <Text style={[sc.chipText, language === code && sc.chipTextOn]}>
                  {code.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={sc.chipRow}>
            {[PRIMARY, '#1B6C4A', '#B3261E', '#111111'].map((color) => (
              <Pressable
                key={color}
                onPress={() => {
                  setPrimary(color);
                  controller.setTheme({ primaryColor: color });
                }}
                style={[
                  sc.swatch,
                  { backgroundColor: color },
                  primary === color && sc.swatchOn,
                ]}
              />
            ))}
          </View>
        </Section>

        {/* 8 ----------------------------------------------------------- */}
        <Section
          title="Canlı olaylar"
          subtitle="Controller'ın olay akışı, geldiği sırayla."
        >
          {events.length === 0 ? (
            <Text style={sc.empty}>Henüz olay yok.</Text>
          ) : (
            events.map((line, index) => (
              <Text key={`${line}-${index}`} style={sc.event} numberOfLines={1}>
                {line}
              </Text>
            ))
          )}
        </Section>

        <Pressable
          style={[sc.button, { backgroundColor: primary }]}
          onPress={onOpenDemos}
        >
          <Text style={sc.buttonText}>Demo ekranlarını aç ›</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

const sc = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F5FA' },
  content: { padding: 16, paddingBottom: 160 },
  h1: { fontSize: 28, fontWeight: '700', color: '#1C1B1F' },
  lede: { fontSize: 15, color: '#49454F', marginTop: 6, marginBottom: 20 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1C1B1F' },
  cardSubtitle: { fontSize: 13, color: '#79747E', marginTop: 4, marginBottom: 12 },
  body: { fontSize: 15, lineHeight: 22, color: '#1C1B1F', marginBottom: 12 },
  optIn: {
    fontSize: 14,
    lineHeight: 20,
    color: '#49454F',
    fontStyle: 'italic',
  },
  clauseNo: { fontSize: 15, fontWeight: '700', color: '#1C1B1F', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { marginLeft: 12, fontSize: 15, color: '#1C1B1F' },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#79747E',
  },
  boxOn: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  checkLabel: { marginLeft: 12, flex: 1, fontSize: 15, color: '#1C1B1F' },
  input: {
    borderWidth: 1,
    borderColor: '#E5E0EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1C1B1F',
    marginBottom: 12,
  },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#E5E0EB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 8,
  },
  chipOn: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { fontSize: 14, color: '#1C1B1F' },
  chipTextOn: { color: '#FFFFFF' },
  swatch: { width: 36, height: 36, borderRadius: 18, marginRight: 4 },
  swatchOn: { borderWidth: 3, borderColor: '#1C1B1F' },
  empty: { fontSize: 14, color: '#79747E' },
  event: { fontSize: 12, color: '#49454F', fontFamily: 'Menlo', marginTop: 2 },
});


// ---------------------------------------------------------------------------
// Demo screens for recording videos — realistic, content-rich app designs so
// the sticky sign-language button and tap-to-translate can be shown in context.
// ---------------------------------------------------------------------------

// Horizontal pager: the control panel is page 0 ("first screen"); a button on
// it jumps to the demo designs, and swiping sideways returns to the panel.
// No navigation library needed.
const RootPager = () => {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const goTo = (index: number) =>
    scrollRef.current?.scrollTo({ x: width * index, animated: true });
  const goHome = () => goTo(0);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      style={demo.root}
    >
      <View style={{ width }}>
        <ShowcaseScreen onOpenDemos={() => goTo(1)} />
      </View>
      <View style={{ width }}>
        <NewsScreen onBack={goHome} />
      </View>
      <View style={{ width }}>
        <ProductScreen onBack={goHome} />
      </View>
      <View style={{ width }}>
        <TechStoreScreen onBack={goHome} />
      </View>
      <View style={{ width }}>
        <SettingsScreen onBack={goHome} />
      </View>
    </ScrollView>
  );
};

// Small "back to panel" chip shown in each demo screen's app bar.
const BackChip = ({ onBack }: { onBack: () => void }) => (
  <TouchableOpacity
    onPress={onBack}
    style={demo.backChip}
    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
  >
    <Text style={demo.backChipText}>‹ Panel</Text>
  </TouchableOpacity>
);

// --- Demo 1: News / article reader -----------------------------------------
const NEWS_LIST = [
  {
    emoji: '🌍',
    tag: 'Dünya',
    title: 'İklim zirvesinde tarihi anlaşma imzalandı',
    snippet:
      'Ülkeler karbon emisyonlarını azaltmak için ortak bir yol haritası üzerinde uzlaştı.',
  },
  {
    emoji: '🏛️',
    tag: 'Kültür',
    title: 'Antik kentte yeni kazı çalışmaları başladı',
    snippet:
      'Arkeologlar bölgede iki bin yıllık bir mozaik gün yüzüne çıkardı.',
  },
  {
    emoji: '⚽',
    tag: 'Spor',
    title: 'Milli takım hazırlık maçını farklı kazandı',
    snippet:
      'Genç kadro sahadaki performansıyla taraftarların beğenisini topladı.',
  },
];

const NewsScreen = ({ onBack }: { onBack: () => void }) => {
  return (
    <SafeAreaView style={demo.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={demo.appBar}>
        <View style={demo.appBarLeft}>
          <BackChip onBack={onBack} />
          <Text style={demo.appBarBrand}>Günce</Text>
        </View>
        <Text style={demo.appBarDate}>2 Temmuz</Text>
      </View>

      <ScrollView contentContainerStyle={demo.scroll}>
        {/* Featured article */}
        <View style={demo.hero}>
          <Text style={demo.heroEmoji}>🧑‍🔬</Text>
        </View>

        <View style={demo.tagRow}>
          <View style={demo.tag}>
            <Text style={demo.tagText}>Bilim</Text>
          </View>
          <Text style={demo.readTime}>4 dk okuma</Text>
        </View>

        <Text style={demo.articleTitle} selectable>
          Araştırmacılar işitme engelliler için yeni bir iletişim teknolojisi
          geliştirdi
        </Text>

        <Text style={demo.byline} selectable>
          Ayşe Yılmaz · Teknoloji Editörü
        </Text>

        <Text style={demo.paragraph} selectable>
          Yeni geliştirilen sistem, yazılı metinleri gerçek zamanlı olarak
          işaret diline çevirerek günlük iletişimi çok daha erişilebilir hale
          getiriyor. Uzmanlara göre bu teknoloji, kamu hizmetlerinden eğitime
          kadar pek çok alanda kullanılabilir.
        </Text>

        <Text style={demo.paragraph} selectable>
          Ekip, uygulamanın en büyük avantajının kullanım kolaylığı olduğunu
          belirtiyor. Kullanıcılar ekrandaki herhangi bir yazıya dokunarak
          saniyeler içinde işaret dili karşılığını görebiliyor.
        </Text>

        <Text style={demo.paragraph} selectable>
          Proje ekibi önümüzdeki aylarda desteklenen dil sayısını artırmayı ve
          uygulamayı daha fazla cihazda erişilebilir kılmayı planlıyor.
        </Text>

        {/* More news */}
        <Text style={demo.sectionTitle}>Daha Fazla Haber</Text>

        {NEWS_LIST.map((item, index) => (
          <View key={index} style={demo.newsCard}>
            <View style={demo.newsThumb}>
              <Text style={demo.newsThumbEmoji}>{item.emoji}</Text>
            </View>
            <View style={demo.newsBody}>
              <Text style={demo.newsTag}>{item.tag}</Text>
              <Text style={demo.newsTitle} selectable numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={demo.newsSnippet} selectable numberOfLines={2}>
                {item.snippet}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

// --- Demo 2: E-commerce product detail -------------------------------------
const ProductScreen = ({ onBack }: { onBack: () => void }) => {
  const [size, setSize] = useState('M');

  return (
    <SafeAreaView style={demo.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={demo.appBar}>
        <View style={demo.appBarLeft}>
          <BackChip onBack={onBack} />
          <Text style={demo.appBarBrand}>Mağaza</Text>
        </View>
        <Text style={demo.appBarDate}>🛒 2</Text>
      </View>

      <ScrollView contentContainerStyle={demo.scroll}>
        <View style={demo.productImage}>
          <Text style={demo.productEmoji}>🧥</Text>
        </View>

        <Text style={demo.productBrand} selectable>
          Nord Outdoor
        </Text>
        <Text style={demo.productName} selectable>
          Su Geçirmez Kışlık Mont
        </Text>

        <View style={demo.priceRow}>
          <Text style={demo.price} selectable>
            2.499 ₺
          </Text>
          <Text style={demo.oldPrice} selectable>
            3.200 ₺
          </Text>
          <View style={demo.discountBadge}>
            <Text style={demo.discountText}>%22 indirim</Text>
          </View>
        </View>

        <Text style={demo.rating} selectable>
          ⭐ 4.8 · 320 değerlendirme
        </Text>

        <Text style={demo.blockTitle}>Beden Seçin</Text>
        <View style={demo.sizeRow}>
          {['S', 'M', 'L', 'XL'].map((s) => {
            const activeSize = size === s;
            return (
              <TouchableOpacity
                key={s}
                style={[demo.sizeChip, activeSize && demo.sizeChipActive]}
                onPress={() => setSize(s)}
              >
                <Text
                  style={[demo.sizeText, activeSize && demo.sizeTextActive]}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={demo.blockTitle}>Ürün Açıklaması</Text>
        <Text style={demo.paragraph} selectable>
          Soğuk ve yağmurlu havalar için tasarlanan bu mont, su geçirmez dış
          yüzeyi ve yumuşak iç astarıyla gün boyu sıcak kalmanızı sağlar.
        </Text>
        <Text style={demo.paragraph} selectable>
          Ayarlanabilir kapüşonu ve fermuarlı cepleriyle hem şehir hayatında hem
          de doğa yürüyüşlerinde rahatlıkla kullanabilirsiniz.
        </Text>

        <View style={demo.featureList}>
          <Text style={demo.feature} selectable>
            • Su ve rüzgar geçirmez kumaş
          </Text>
          <Text style={demo.feature} selectable>
            • Çıkarılabilir kapüşon
          </Text>
          <Text style={demo.feature} selectable>
            • Makinede yıkanabilir
          </Text>
        </View>
      </ScrollView>

      <View style={demo.buyBar}>
        <TouchableOpacity style={demo.buyButton} activeOpacity={0.85}>
          <Text style={demo.buyButtonText}>Sepete Ekle</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// --- Demo 3: Technology store ----------------------------------------------
const TECH_CATEGORIES = ['Tümü', 'Telefon', 'Bilgisayar', 'Ses', 'Giyilebilir'];

const TECH_PRODUCTS = [
  { emoji: '📱', name: 'Aurora X5 Akıllı Telefon', price: '32.999 ₺', tag: 'Yeni' },
  { emoji: '💻', name: 'Vertex Pro 14 Dizüstü', price: '54.500 ₺', tag: '' },
  { emoji: '🎧', name: 'SoundWave ANC Kulaklık', price: '4.299 ₺', tag: 'Çok satan' },
  { emoji: '⌚', name: 'Pulse Fit Akıllı Saat', price: '6.750 ₺', tag: '' },
  { emoji: '📷', name: 'OptiShot 4K Kamera', price: '18.900 ₺', tag: '' },
  { emoji: '🎮', name: 'NovaPlay Oyun Konsolu', price: '21.499 ₺', tag: 'İndirim' },
];

const TechStoreScreen = ({ onBack }: { onBack: () => void }) => {
  const [category, setCategory] = useState('Tümü');

  return (
    <SafeAreaView style={demo.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={demo.appBar}>
        <View style={demo.appBarLeft}>
          <BackChip onBack={onBack} />
          <Text style={demo.appBarBrand}>TeknoMarket</Text>
        </View>
        <Text style={demo.appBarDate}>🛒 1</Text>
      </View>

      <ScrollView contentContainerStyle={demo.scroll}>
        {/* Search */}
        <View style={demo.search}>
          <Text style={demo.searchIcon}>🔍</Text>
          <Text style={demo.searchPlaceholder}>Ürün, marka veya kategori ara</Text>
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={demo.categoryRow}
          contentContainerStyle={demo.categoryContent}
        >
          {TECH_CATEGORIES.map((c) => {
            const activeCat = category === c;
            return (
              <TouchableOpacity
                key={c}
                style={[demo.categoryChip, activeCat && demo.categoryChipActive]}
                onPress={() => setCategory(c)}
              >
                <Text
                  style={[demo.categoryText, activeCat && demo.categoryTextActive]}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Featured banner */}
        <View style={demo.banner}>
          <View style={demo.bannerText}>
            <Text style={demo.bannerTitle} selectable>
              Yaz Teknoloji Günleri
            </Text>
            <Text style={demo.bannerSubtitle} selectable>
              Seçili elektronik ürünlerde 5.000 ₺'ye varan indirim fırsatı.
            </Text>
          </View>
          <Text style={demo.bannerEmoji}>⚡</Text>
        </View>

        <Text style={demo.sectionTitle}>Öne Çıkan Ürünler</Text>

        {/* Product grid */}
        <View style={demo.grid}>
          {TECH_PRODUCTS.map((p, index) => (
            <View key={index} style={demo.prodCard}>
              <View style={demo.prodImage}>
                <Text style={demo.prodEmoji}>{p.emoji}</Text>
                {p.tag ? (
                  <View style={demo.prodTag}>
                    <Text style={demo.prodTagText}>{p.tag}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={demo.prodName} selectable numberOfLines={2}>
                {p.name}
              </Text>
              <Text style={demo.prodPrice} selectable>
                {p.price}
              </Text>
            </View>
          ))}
        </View>

        <Text style={demo.sectionTitle}>Neden TeknoMarket?</Text>
        <Text style={demo.paragraph} selectable>
          Aynı gün kargo, iki yıl resmi garanti ve 14 gün içinde koşulsuz iade
          imkânıyla en yeni teknoloji ürünlerine güvenle sahip olun.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

// --- Demo 4: Settings + first-run spotlight onboarding ---------------------
type Rect = { x: number; y: number; w: number; h: number };
type TourStep = {
  title: string;
  text: string;
  rect?: Rect;
  interactive?: boolean;
};

// Coach-mark overlay: dims the screen with four bands around the highlighted
// rect (no dependency needed), draws a ring, and shows a tooltip with controls.
const Spotlight = ({
  steps,
  index,
  onNext,
  onPrev,
  onSkip,
}: {
  steps: TourStep[];
  index: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) => {
  const { height } = useWindowDimensions();
  const step = steps[index];
  if (!step) return null;

  const p = 8;
  const r = step.rect;
  const hx = r ? Math.max(0, r.x - p) : 0;
  const hy = r ? Math.max(0, r.y - p) : 0;
  const hw = r ? r.w + p * 2 : 0;
  const hh = r ? r.h + p * 2 : 0;
  const below = !r || hy + hh < height * 0.58;
  const isLast = index === steps.length - 1;

  return (
    <View style={StyleSheet.absoluteFill}>
      {r ? (
        <>
          {/* Four dark bands block touches around the highlighted target */}
          <Pressable
            style={[demo.spotBand, { top: 0, left: 0, right: 0, height: hy }]}
            onPress={() => {}}
          />
          <Pressable
            style={[demo.spotBand, { top: hy + hh, left: 0, right: 0, bottom: 0 }]}
            onPress={() => {}}
          />
          <Pressable
            style={[demo.spotBand, { top: hy, left: 0, width: hx, height: hh }]}
            onPress={() => {}}
          />
          <Pressable
            style={[
              demo.spotBand,
              { top: hy, left: hx + hw, right: 0, height: hh },
            ]}
            onPress={() => {}}
          />
          {/* Non-interactive steps also block the target; the interactive step
              leaves it open so the tap reaches the real element underneath. */}
          {!step.interactive && (
            <Pressable
              style={{ position: 'absolute', top: hy, left: hx, width: hw, height: hh }}
              onPress={() => {}}
            />
          )}
          <View
            style={[demo.spotRing, { top: hy, left: hx, width: hw, height: hh }]}
            pointerEvents="none"
          />
        </>
      ) : (
        <Pressable style={[StyleSheet.absoluteFill, demo.spotBand]} onPress={() => {}} />
      )}

      <View
        style={[
          demo.tooltip,
          below ? { top: hy + hh + 16 } : { bottom: height - hy + 16 },
        ]}
      >
        <Text style={demo.tooltipStep}>
          {index + 1} / {steps.length}
        </Text>
        <Text style={demo.tooltipTitle}>{step.title}</Text>
        <Text style={demo.tooltipText}>{step.text}</Text>

        <View style={demo.dots}>
          {steps.map((_, i) => (
            <View key={i} style={[demo.dot, i === index && demo.dotActive]} />
          ))}
        </View>

        <View style={demo.tooltipButtons}>
          <TouchableOpacity onPress={onSkip} hitSlop={8}>
            <Text style={demo.skipText}>Atla</Text>
          </TouchableOpacity>
          <View style={demo.tooltipRight}>
            {index > 0 && (
              <TouchableOpacity style={demo.secondaryBtn} onPress={onPrev}>
                <Text style={demo.secondaryBtnText}>Geri</Text>
              </TouchableOpacity>
            )}
            {step.interactive ? (
              <Text style={demo.tapHint}>👆 İşaretli yazıya dokunun</Text>
            ) : (
              <TouchableOpacity style={demo.primaryBtn} onPress={onNext}>
                <Text style={demo.primaryBtnText}>{isLast ? 'Bitti' : 'İleri'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const LANGS = ['Türkçe', 'English', 'Deutsch'];

const SAMPLE_TEXT = 'İyi günler! Size nasıl yardımcı olabilirim?';

const SettingsScreen = ({ onBack }: { onBack: () => void }) => {
  const { state, enable, disable, translate } = useSignLanguageContext();
  const enabled = state.isEnabled;
  const { width, height } = useWindowDimensions();

  const toggleRef = useRef<any>(null);
  const sampleRef = useRef<any>(null);
  const langRef = useRef<any>(null);

  const [rects, setRects] = useState<Record<string, Rect>>({});
  const [step, setStep] = useState(-1);
  const [langIndex, setLangIndex] = useState(0);
  const hasSeenTour = useRef(false);

  const measureAll = () => {
    const grab = (ref: React.MutableRefObject<any>, key: string) =>
      ref.current?.measureInWindow?.((x: number, y: number, w: number, h: number) =>
        setRects((prev) => ({ ...prev, [key]: { x, y, w, h } })),
      );
    grab(toggleRef, 'toggle');
    grab(sampleRef, 'sample');
    grab(langRef, 'lang');
  };

  // The sticky floating button rests flush on the right edge, vertically centered.
  const floatingRect: Rect = {
    x: width - 44,
    y: Math.round(height / 2 - 22),
    w: 44,
    h: 44,
  };

  const steps: TourStep[] = [
    {
      rect: rects.toggle,
      title: 'İşaret Dili Desteği',
      text: 'Bu anahtarla işaret dili desteğini istediğiniz zaman açıp kapatabilirsiniz.',
    },
    {
      rect: floatingRect,
      title: 'Her Yerde Yanınızda',
      text: 'Bu yüzen buton tüm sayfalarda size eşlik eder. Dokununca çeviri modunu açar; sürükleyip ekran kenarına yapıştırabilirsiniz.',
    },
    {
      rect: rects.lang,
      title: 'Dilinizi Seçin',
      text: 'Çevirinin yapılacağı dili buradan değiştirebilirsiniz.',
    },
    {
      rect: rects.sample,
      title: 'Hadi Deneyelim!',
      text: 'Şimdi sıra sizde: işaretli yazıya dokunun ve işaret dili çevirisini birlikte görelim.',
      interactive: true,
    },
  ];

  // The one interactive step lets the user actually try the SDK once.
  const isInteractiveStep = (s: number) => steps[s]?.interactive === true;

  const onSampleTap = () => {
    translate(SAMPLE_TEXT).catch(() => {});
    // If we're on the "try it" step, tapping the text completes the tour.
    setStep((s) =>
      isInteractiveStep(s) ? (s >= steps.length - 1 ? -1 : s + 1) : s,
    );
  };

  const launchTour = () => {
    if (!enabled) enable();
    // Wait a frame so the layout (and floating button) is in place before measuring.
    setTimeout(() => {
      measureAll();
      setStep(0);
    }, 80);
  };

  const onToggle = (value: boolean) => {
    if (value) {
      enable();
      if (!hasSeenTour.current) {
        hasSeenTour.current = true;
        launchTour();
      }
    } else {
      disable();
      setStep(-1);
    }
  };

  const next = () => setStep((s) => (s >= steps.length - 1 ? -1 : s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));
  const skip = () => setStep(-1);

  return (
    <SafeAreaView style={demo.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={demo.appBar}>
        <View style={demo.appBarLeft}>
          <BackChip onBack={onBack} />
          <Text style={demo.appBarBrand}>Ayarlar</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={demo.scroll}>
        {/* Hero */}
        <View style={demo.setHero}>
          <Text style={demo.setHeroEmoji}>🤟</Text>
          <Text style={demo.setHeroTitle} selectable>
            İşaret Dili Erişilebilirliği
          </Text>
          <Text style={demo.setHeroText} selectable>
            Uygulamadaki yazıları tek dokunuşla işaret diline çevirin. Aşağıdaki
            anahtarı açtığınızda size kısa bir tanıtım göstereceğiz.
          </Text>
        </View>

        {/* Toggle */}
        <View style={demo.setCard}>
          <View ref={toggleRef} collapsable={false} style={demo.setRow}>
            <View style={demo.setRowText}>
              <Text style={demo.setRowTitle}>İşaret Dili Desteği</Text>
              <Text style={demo.setRowSub}>
                {enabled ? 'Açık' : 'Kapalı'}
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={onToggle}
              trackColor={{ false: '#D3D8DE', true: ACCENT }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={demo.setDivider} />

          {/* Language */}
          <TouchableOpacity
            ref={langRef}
            style={demo.setRow}
            onPress={() => setLangIndex((i) => (i + 1) % LANGS.length)}
          >
            <View style={demo.setRowText}>
              <Text style={demo.setRowTitle}>Çeviri Dili</Text>
              <Text style={demo.setRowSub}>Dokunarak değiştirin</Text>
            </View>
            <Text style={demo.setRowValue}>{LANGS[langIndex]} ›</Text>
          </TouchableOpacity>
        </View>

        {/* Sample text to try tap-to-translate on */}
        <Text style={demo.setSectionTitle}>Deneyin</Text>
        <TouchableOpacity
          ref={sampleRef}
          style={demo.setSample}
          activeOpacity={0.7}
          onPress={onSampleTap}
        >
          <Text style={demo.setSampleText} selectable>
            {SAMPLE_TEXT}
          </Text>
          <Text style={demo.setSampleHint}>İşaret diline çevirmek için dokun</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={demo.replayButton}
          onPress={launchTour}
          activeOpacity={0.85}
        >
          <Text style={demo.replayButtonText}>▶ Tanıtımı Tekrar İzle</Text>
        </TouchableOpacity>
      </ScrollView>

      {step >= 0 && (
        <Spotlight
          steps={steps}
          index={step}
          onNext={next}
          onPrev={prev}
          onSkip={skip}
        />
      )}
    </SafeAreaView>
  );
};

// The demo screens keep their own accent; the SDK's purple is the theme.
const ACCENT = '#6750A4';

const demo = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  scroll: { padding: 16, paddingBottom: 40 },

  // App bar
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF3',
  },
  appBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  appBarBrand: { fontSize: 22, fontWeight: '800', color: '#1C1B1F' },
  appBarDate: { fontSize: 13, color: '#8A8F98' },
  backChip: {
    backgroundColor: '#EEF6F1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  backChipText: { color: ACCENT, fontSize: 13, fontWeight: '700' },

  // News
  hero: {
    height: 180,
    borderRadius: 16,
    backgroundColor: '#E7F3EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroEmoji: { fontSize: 72 },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tag: {
    backgroundColor: ACCENT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  readTime: { fontSize: 12, color: '#8A8F98' },
  articleTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1C1B1F',
    lineHeight: 32,
    marginBottom: 8,
  },
  byline: { fontSize: 13, color: '#8A8F98', marginBottom: 16 },
  paragraph: {
    fontSize: 16,
    color: '#353141',
    lineHeight: 26,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1B1F',
    marginTop: 8,
    marginBottom: 12,
  },
  newsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  newsThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F0F2F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  newsThumbEmoji: { fontSize: 30 },
  newsBody: { flex: 1 },
  newsTag: { fontSize: 12, color: ACCENT, fontWeight: '700', marginBottom: 2 },
  newsTitle: { fontSize: 15, fontWeight: '700', color: '#1C1B1F' },
  newsSnippet: { fontSize: 13, color: '#6B7078', marginTop: 2 },

  // Product
  productImage: {
    height: 260,
    borderRadius: 16,
    backgroundColor: '#EEF1F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  productEmoji: { fontSize: 110 },
  productBrand: { fontSize: 13, color: ACCENT, fontWeight: '700' },
  productName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1B1F',
    marginTop: 2,
    marginBottom: 10,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  price: { fontSize: 22, fontWeight: '800', color: '#1C1B1F' },
  oldPrice: {
    fontSize: 15,
    color: '#A0A5AD',
    textDecorationLine: 'line-through',
    marginLeft: 10,
  },
  discountBadge: {
    backgroundColor: '#FDE7E7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 10,
  },
  discountText: { color: '#D14343', fontSize: 12, fontWeight: '700' },
  rating: { fontSize: 14, color: '#6B7078', marginBottom: 18 },
  blockTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1B1F',
    marginBottom: 10,
    marginTop: 6,
  },
  sizeRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  sizeChip: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDE1E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeChipActive: { borderColor: ACCENT, backgroundColor: '#E7F3EC' },
  sizeText: { fontSize: 15, fontWeight: '700', color: '#6B7078' },
  sizeTextActive: { color: ACCENT },
  featureList: { marginTop: 4 },
  feature: { fontSize: 15, color: '#353141', lineHeight: 26 },
  buyBar: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#ECEFF3',
  },
  buyButton: {
    backgroundColor: ACCENT,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buyButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  // Tech store
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E8ED',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchPlaceholder: { fontSize: 14, color: '#9AA0A8' },
  categoryRow: { marginBottom: 18 },
  categoryContent: { gap: 8, paddingRight: 8 },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E8ED',
  },
  categoryChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  categoryText: { fontSize: 14, color: '#6B7078', fontWeight: '600' },
  categoryTextActive: { color: '#FFFFFF' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12303F',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  bannerText: { flex: 1, paddingRight: 12 },
  bannerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  bannerSubtitle: {
    color: '#C7D3DA',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  bannerEmoji: { fontSize: 44 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  prodCard: { width: '48%', marginBottom: 16 },
  prodImage: {
    height: 120,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECEFF3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  prodEmoji: { fontSize: 52 },
  prodTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: ACCENT,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  prodTagText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  prodName: { fontSize: 14, color: '#1C1B1F', fontWeight: '600', lineHeight: 19 },
  prodPrice: { fontSize: 15, color: ACCENT, fontWeight: '800', marginTop: 4 },

  // Settings
  setHero: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ECEFF3',
  },
  setHeroEmoji: { fontSize: 48, marginBottom: 8 },
  setHeroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1C1B1F',
    marginBottom: 6,
    textAlign: 'center',
  },
  setHeroText: {
    fontSize: 14,
    color: '#6B7078',
    lineHeight: 21,
    textAlign: 'center',
  },
  setCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#ECEFF3',
    marginBottom: 20,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  setRowText: { flex: 1, paddingRight: 12 },
  setRowTitle: { fontSize: 16, fontWeight: '700', color: '#1C1B1F' },
  setRowSub: { fontSize: 13, color: '#8A8F98', marginTop: 2 },
  setRowValue: { fontSize: 15, color: ACCENT, fontWeight: '700' },
  setDivider: { height: 1, backgroundColor: '#F0F2F5' },
  setSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#8A8F98',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  setSample: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECEFF3',
    marginBottom: 20,
  },
  setSampleText: { fontSize: 17, color: '#1C1B1F', lineHeight: 26 },
  setSampleHint: { fontSize: 12, color: ACCENT, fontWeight: '600', marginTop: 8 },
  replayButton: {
    borderWidth: 1.5,
    borderColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  replayButtonText: { color: ACCENT, fontSize: 15, fontWeight: '700' },

  // Spotlight overlay
  spotBand: { position: 'absolute', backgroundColor: 'rgba(15, 23, 32, 0.82)' },
  spotRing: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: ACCENT,
    borderRadius: 14,
    backgroundColor: 'transparent',
  },
  tooltip: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  tooltipStep: { fontSize: 12, fontWeight: '700', color: ACCENT, marginBottom: 4 },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1B1F',
    marginBottom: 6,
  },
  tooltipText: { fontSize: 14, color: '#49454F', lineHeight: 21 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 14, marginBottom: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#DDE1E6' },
  dotActive: { backgroundColor: ACCENT, width: 18 },
  tooltipButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tooltipRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skipText: { fontSize: 14, color: '#8A8F98', fontWeight: '600' },
  secondaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F0F2F5',
  },
  secondaryBtnText: { fontSize: 14, color: '#49454F', fontWeight: '700' },
  primaryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: ACCENT,
  },
  primaryBtnText: { fontSize: 14, color: '#FFFFFF', fontWeight: '700' },
  tapHint: { fontSize: 13, color: ACCENT, fontWeight: '700' },
});

export default App;
