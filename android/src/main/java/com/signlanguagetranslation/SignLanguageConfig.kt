// android/src/main/java/com/signlanguagetranslation/SignLanguageConfig.kt

package com.signlanguagetranslation

data class SignLanguageConfig(
    val apiKey: String,
    val apiUrl: String,
    val language: Language,
    val fdid: String? = "16",
    val tid: String? = "23",
    val theme: SignLanguageTheme = SignLanguageTheme(),
    val accessibility: SignLanguageAccessibility = SignLanguageAccessibility()
)

enum class Language(val code: String) {
    TURKISH("tr"),
    ENGLISH("en"),
    GERMAN("de"),
    FRENCH("fr"),
    SPANISH("es"),
    ARABIC("ar");

    companion object {
        fun fromString(value: String): Language {
            return when (value.lowercase()) {
                "tr", "turkish" -> TURKISH
                "en", "english" -> ENGLISH
                "de", "german" -> GERMAN
                "fr", "french" -> FRENCH
                "es", "spanish" -> SPANISH
                "ar", "arabic" -> ARABIC
                else -> TURKISH
            }
        }
    }

    val displayName: String
        get() = when (this) {
            TURKISH -> "Türkçe"
            ENGLISH -> "English"
            GERMAN -> "Deutsch"
            FRENCH -> "Français"
            SPANISH -> "Español"
            ARABIC -> "العربية"
        }

    val menuTitle: String
        get() = when (this) {
            TURKISH -> "İşaret Dili"
            ENGLISH -> "Sign Language"
            GERMAN -> "Gebärdensprache"
            FRENCH -> "Langue des signes"
            SPANISH -> "Lengua de señas"
            ARABIC -> "لغة الإشارة"
        }

    val businessName: String
        get() = when (this) {
            TURKISH -> "Engelsiz Çeviri"
            else -> "SignForDeaf"
        }
}

data class SignLanguageTheme(
    val primaryColor: String = "#6750A4",
    val backgroundColor: String = "#FFFFFF",
    val textColor: String = "#1C1B1F",
    val bottomSheetBackgroundColor: String = "#FFFFFF"
)

data class SignLanguageAccessibility(
    val enabled: Boolean = true,
    val announceTranslations: Boolean = true,
    val highContrastMode: Boolean = false
)
