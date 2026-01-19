// ios/SignLanguageTranslation/SignLanguageConfig.swift

import Foundation

enum Language: String, CaseIterable {
    case turkish = "tr"
    case english = "en"
    case german = "de"
    case french = "fr"
    case spanish = "es"
    case arabic = "ar"
    
    init?(from string: String) {
        switch string.lowercased() {
        case "tr", "turkish":
            self = .turkish
        case "en", "english":
            self = .english
        case "de", "german":
            self = .german
        case "fr", "french":
            self = .french
        case "es", "spanish":
            self = .spanish
        case "ar", "arabic":
            self = .arabic
        default:
            self = .turkish
        }
    }
    
    var displayName: String {
        switch self {
        case .turkish: return "Türkçe"
        case .english: return "English"
        case .german: return "Deutsch"
        case .french: return "Français"
        case .spanish: return "Español"
        case .arabic: return "العربية"
        }
    }
    
    var menuTitle: String {
        switch self {
        case .turkish: return "İşaret Dili"
        case .english: return "Sign Language"
        case .german: return "Gebärdensprache"
        case .french: return "Langue des signes"
        case .spanish: return "Lengua de señas"
        case .arabic: return "لغة الإشارة"
        }
    }
    
    var businessName: String {
        switch self {
        case .turkish: return "Engelsiz Çeviri"
        default: return "SignForDeaf"
        }
    }
}

struct SignLanguageConfig {
    let apiKey: String
    let apiUrl: String
    let language: Language
    var fdid: String?
    var tid: String?
    var theme: SignLanguageTheme
    var accessibility: SignLanguageAccessibility
    
    init(
        apiKey: String,
        apiUrl: String,
        language: Language,
        fdid: String? = "16",
        tid: String? = "23",
        theme: SignLanguageTheme = SignLanguageTheme(),
        accessibility: SignLanguageAccessibility = SignLanguageAccessibility()
    ) {
        self.apiKey = apiKey
        self.apiUrl = apiUrl
        self.language = language
        self.fdid = fdid
        self.tid = tid
        self.theme = theme
        self.accessibility = accessibility
    }
}

struct SignLanguageTheme {
    var primaryColor: String
    var backgroundColor: String
    var textColor: String
    var bottomSheetBackgroundColor: String
    
    init(
        primaryColor: String = "#6750A4",
        backgroundColor: String = "#FFFFFF",
        textColor: String = "#1C1B1F",
        bottomSheetBackgroundColor: String = "#FFFFFF"
    ) {
        self.primaryColor = primaryColor
        self.backgroundColor = backgroundColor
        self.textColor = textColor
        self.bottomSheetBackgroundColor = bottomSheetBackgroundColor
    }
    
    static func from(dictionary: NSDictionary) -> SignLanguageTheme {
        return SignLanguageTheme(
            primaryColor: dictionary["primaryColor"] as? String ?? "#6750A4",
            backgroundColor: dictionary["backgroundColor"] as? String ?? "#FFFFFF",
            textColor: dictionary["textColor"] as? String ?? "#1C1B1F",
            bottomSheetBackgroundColor: dictionary["bottomSheetBackgroundColor"] as? String ?? "#FFFFFF"
        )
    }
}

struct SignLanguageAccessibility {
    var enabled: Bool
    var announceTranslations: Bool
    var highContrastMode: Bool
    
    init(
        enabled: Bool = true,
        announceTranslations: Bool = true,
        highContrastMode: Bool = false
    ) {
        self.enabled = enabled
        self.announceTranslations = announceTranslations
        self.highContrastMode = highContrastMode
    }
    
    static func from(dictionary: NSDictionary) -> SignLanguageAccessibility {
        return SignLanguageAccessibility(
            enabled: dictionary["enabled"] as? Bool ?? true,
            announceTranslations: dictionary["announceTranslations"] as? Bool ?? true,
            highContrastMode: dictionary["highContrastMode"] as? Bool ?? false
        )
    }
}
