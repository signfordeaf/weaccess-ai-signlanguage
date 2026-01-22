// android/src/main/java/com/signlanguagetranslation/SignLanguageModule.kt

package com.signlanguagetranslation

import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.signlanguagetranslation.bottomsheet.SignLanguageBottomSheet
import com.signlanguagetranslation.network.ApiService
import com.signlanguagetranslation.network.SignModel
import com.signlanguagetranslation.textselection.CustomActionModeCallback

class SignLanguageModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    LifecycleEventListener {

    companion object {
        const val NAME = "SignLanguageModule"
        private const val TAG = "SignLanguageModule"
    }

    private var config: SignLanguageConfig? = null
    private var apiService: ApiService? = null
    private var isModuleEnabled = false
    private var bottomSheet: SignLanguageBottomSheet? = null
    private var listenerCount = 0
    
    // Theme colors from React Native config
    private var themePrimaryColor: String = "#6750A4"
    private var themeTextColor: String = "#1C1B1F"

    init {
        reactContext.addLifecycleEventListener(this)
    }

    override fun getName(): String = NAME

    // MARK: - Configuration

    @ReactMethod
    fun configure(
        apiKey: String,
        apiUrl: String,
        language: String,
        fdid: String,
        tid: String,
        theme: ReadableMap,
        accessibility: ReadableMap,
        promise: Promise
    ) {
        try {
            // Parse theme colors
            if (theme.hasKey("primaryColor")) {
                themePrimaryColor = theme.getString("primaryColor") ?: "#6750A4"
            }
            if (theme.hasKey("textColor")) {
                themeTextColor = theme.getString("textColor") ?: "#1C1B1F"
            }
            
            Log.d(TAG, "Theme configured - primaryColor: $themePrimaryColor, textColor: $themeTextColor")
            
            config = SignLanguageConfig(
                apiKey = apiKey,
                apiUrl = apiUrl,
                language = Language.fromString(language),
                fdid = fdid,
                tid = tid,
                theme = SignLanguageTheme(
                    primaryColor = themePrimaryColor,
                    textColor = themeTextColor
                )
            )

            apiService = ApiService(config!!)
            
            Log.d(TAG, "SDK configured successfully. API URL: $apiUrl")
            
            // Automatically enable text selection after configuration
            isModuleEnabled = true
            UiThreadUtil.runOnUiThread {
                enableTextSelectionForCurrentActivity()
                startViewObserver()
            }

            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Configure error: ${e.message}", e)
            promise.reject("CONFIG_ERROR", e.message, e)
        }
    }
    
    // View observer to auto-enable new text views
    private var viewObserverRunnable: Runnable? = null
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())
    
    private fun startViewObserver() {
        viewObserverRunnable?.let { handler.removeCallbacks(it) }
        
        viewObserverRunnable = object : Runnable {
            override fun run() {
                if (isModuleEnabled) {
                    enableTextSelectionForCurrentActivity()
                    handler.postDelayed(this, 2000) // Check every 2 seconds
                }
            }
        }
        handler.postDelayed(viewObserverRunnable!!, 2000)
        Log.d(TAG, "View observer started")
    }

    // MARK: - Enable/Disable

    @ReactMethod
    fun enable() {
        isModuleEnabled = true
        UiThreadUtil.runOnUiThread {
            enableTextSelectionForCurrentActivity()
        }
    }

    @ReactMethod
    fun disable() {
        isModuleEnabled = false
    }

    @ReactMethod
    fun isEnabled(promise: Promise) {
        promise.resolve(isModuleEnabled)
    }

    // MARK: - Text Selection

    @ReactMethod
    fun enableTextSelectionForActivity() {
        UiThreadUtil.runOnUiThread {
            enableTextSelectionForCurrentActivity()
        }
    }

    @ReactMethod
    fun enableTextSelectionForView(viewTag: Int) {
        UiThreadUtil.runOnUiThread {
            val view = reactApplicationContext.currentActivity
                ?.findViewById<ViewGroup>(android.R.id.content)
                ?.findViewWithTag<View>(viewTag)

            view?.let { enableTextSelection(it) }
        }
    }

    private fun enableTextSelectionForCurrentActivity() {
        reactApplicationContext.currentActivity?.let { activity ->
            val rootView = activity.findViewById<View>(android.R.id.content)
            enableTextSelection(rootView)
        }
    }

    private fun enableTextSelection(view: View) {
        when (view) {
            is TextView -> {
                setupTextViewForSelection(view)
            }
            is EditText -> {
                setupEditTextForSelection(view)
            }
            is ViewGroup -> {
                for (i in 0 until view.childCount) {
                    enableTextSelection(view.getChildAt(i))
                }
            }
        }
    }

    private fun setupTextViewForSelection(textView: TextView) {
        textView.isFocusable = true
        textView.isFocusableInTouchMode = true
        textView.setTextIsSelectable(true)

        val callback = CustomActionModeCallback(
            menuTitle = getLocalizedMenuTitle(),
            onSignLanguageSelected = { selectedText ->
                onTextSelected(selectedText)
            }
        ) { tv ->
            val selectionStart = tv.selectionStart
            val selectionEnd = tv.selectionEnd
            if (selectionStart >= 0 && selectionEnd > selectionStart) {
                tv.text.subSequence(selectionStart, selectionEnd).toString()
            } else ""
        }
        callback.setTextView(textView)

        textView.customSelectionActionModeCallback = callback
    }

    private fun setupEditTextForSelection(editText: EditText) {
        editText.isFocusable = true
        editText.isFocusableInTouchMode = true
        editText.setTextIsSelectable(true)

        val callback = CustomActionModeCallback(
            menuTitle = getLocalizedMenuTitle(),
            onSignLanguageSelected = { selectedText ->
                onTextSelected(selectedText)
            }
        ) { tv ->
            val selectionStart = tv.selectionStart
            val selectionEnd = tv.selectionEnd
            if (selectionStart >= 0 && selectionEnd > selectionStart) {
                tv.text.subSequence(selectionStart, selectionEnd).toString()
            } else ""
        }
        callback.setTextView(editText)

        editText.customSelectionActionModeCallback = callback
    }

    private fun onTextSelected(text: String) {
        sendEvent("onTextSelected", Arguments.createMap().apply {
            putString("text", text)
        })

        // Show bottom sheet immediately with loading state, then translate
        // Ensure we're on UI thread
        UiThreadUtil.runOnUiThread {
            try {
                showBottomSheetWithLoading(text)
            } catch (e: Exception) {
                Log.e(TAG, "Error showing bottom sheet with loading: ${e.message}", e)
                val errorParams = Arguments.createMap().apply {
                    putString("error", e.message ?: "Unknown error")
                    putString("errorType", "THEME_ERROR")
                }
                sendEvent("onError", errorParams)
            }
        }
    }
    
    private fun showBottomSheetWithLoading(text: String) {
        val activity = reactApplicationContext.currentActivity as? AppCompatActivity ?: run {
            Log.e(TAG, "No activity available for bottom sheet")
            return
        }
        
        try {
            // Create bottom sheet without video URL (loading state)
            bottomSheet = SignLanguageBottomSheet.newInstance(
                videoUrl = "",
                text = text,
                businessName = getLocalizedBusinessName(),
                primaryColor = themePrimaryColor,
                textColor = themeTextColor
            )

            bottomSheet?.onDismissListener = {
                sendEvent("onBottomSheetClose", null)
            }

            bottomSheet?.onVideoStartListener = {
                sendEvent("onVideoStart", null)
            }

            bottomSheet?.onVideoEndListener = {
                sendEvent("onVideoEnd", null)
            }

            bottomSheet?.show(activity.supportFragmentManager, "sign_language_bottom_sheet")
            sendEvent("onBottomSheetOpen", null)
            
            // Start translation after showing bottom sheet
            translateTextForBottomSheet(text)
        } catch (e: Exception) {
            Log.e(TAG, "Error creating/showing bottom sheet with loading: ${e.message}", e)
            val errorParams = Arguments.createMap().apply {
                putString("error", e.message ?: "Unknown error")
                putString("errorType", "THEME_ERROR")
            }
            sendEvent("onError", errorParams)
        }
    }
    
    private fun translateTextForBottomSheet(text: String) {
        val service = apiService ?: run {
            Log.e(TAG, "SDK not configured")
            return
        }

        sendEvent("onTranslationStart", Arguments.createMap().apply {
            putString("text", text)
        })

        Thread {
            service.getSignVideo(text) { result, error ->
                if (error != null) {
                    UiThreadUtil.runOnUiThread {
                        sendEvent("onTranslationError", Arguments.createMap().apply {
                            putString("code", "API_ERROR")
                            putString("message", error.message ?: "Unknown error")
                        })
                    }
                    return@getSignVideo
                }

                result?.let { signModel ->
                    if (signModel.state == true) {
                        val videoUrl = signModel.videoUrl ?: ""
                        val secureVideoUrl = videoUrl.replace("http://", "https://")

                        UiThreadUtil.runOnUiThread {
                            sendEvent("onTranslationComplete", Arguments.createMap().apply {
                                putString("videoUrl", secureVideoUrl)
                                putString("text", text)
                            })

                            // Update bottom sheet with video URL
                            bottomSheet?.updateVideoUrl(secureVideoUrl)
                        }
                    } else {
                        UiThreadUtil.runOnUiThread {
                            sendEvent("onTranslationError", Arguments.createMap().apply {
                                putString("code", "API_ERROR")
                                putString("message", "Translation not ready")
                            })
                        }
                    }
                }
            }
        }.start()
    }

    // MARK: - Translation

    @ReactMethod
    fun translateText(text: String, promise: Promise) {
        translateTextInternal(text, promise)
    }

    private fun translateTextInternal(text: String, promise: Promise? = null) {
        val service = apiService ?: run {
            promise?.reject("CONFIG_ERROR", "SDK not configured")
            return
        }

        sendEvent("onTranslationStart", Arguments.createMap().apply {
            putString("text", text)
        })

        Thread {
            service.getSignVideo(text) { result, error ->
                if (error != null) {
                    UiThreadUtil.runOnUiThread {
                        sendEvent("onTranslationError", Arguments.createMap().apply {
                            putString("code", "API_ERROR")
                            putString("message", error.message ?: "Unknown error")
                        })
                        promise?.reject("API_ERROR", error.message, error)
                    }
                    return@getSignVideo
                }

                result?.let { signModel ->
                    if (signModel.state == true) {
                        val videoUrl = signModel.videoUrl ?: ""

                        UiThreadUtil.runOnUiThread {
                            sendEvent("onTranslationComplete", Arguments.createMap().apply {
                                putString("videoUrl", videoUrl)
                                putString("text", text)
                            })

                            showBottomSheetInternal(videoUrl, text)
                            promise?.resolve(Arguments.createMap().apply {
                                putString("videoUrl", videoUrl)
                            })
                        }
                    } else {
                        UiThreadUtil.runOnUiThread {
                            sendEvent("onTranslationError", Arguments.createMap().apply {
                                putString("code", "API_ERROR")
                                putString("message", "Translation not ready")
                            })
                            promise?.reject("API_ERROR", "Translation not ready")
                        }
                    }
                }
            }
        }.start()
    }

    @ReactMethod
    fun cancelTranslation() {
        apiService?.cancelRequest()
    }

    // MARK: - Bottom Sheet

    @ReactMethod
    fun showBottomSheet(videoUrl: String, text: String, promise: Promise?) {
        UiThreadUtil.runOnUiThread {
            try {
                showBottomSheetInternal(videoUrl, text)
                promise?.resolve(null)
            } catch (e: Exception) {
                Log.e(TAG, "Error showing bottom sheet: ${e.message}", e)
                promise?.reject("BOTTOM_SHEET_ERROR", "Failed to show bottom sheet: ${e.message}", e)
            }
        }
    }

    private fun showBottomSheetInternal(videoUrl: String, text: String) {
        val activity = reactApplicationContext.currentActivity as? AppCompatActivity ?: run {
            Log.e(TAG, "No activity available for bottom sheet")
            return
        }

        try {
            val secureVideoUrl = videoUrl.replace("http://", "https://")

            bottomSheet = SignLanguageBottomSheet.newInstance(
                videoUrl = secureVideoUrl,
                text = text,
                businessName = getLocalizedBusinessName(),
                primaryColor = themePrimaryColor,
                textColor = themeTextColor
            )

            bottomSheet?.onDismissListener = {
                sendEvent("onBottomSheetClose", null)
            }

            bottomSheet?.onVideoStartListener = {
                sendEvent("onVideoStart", null)
            }

            bottomSheet?.onVideoEndListener = {
                sendEvent("onVideoEnd", null)
            }

            bottomSheet?.show(activity.supportFragmentManager, "sign_language_bottom_sheet")

            sendEvent("onBottomSheetOpen", null)
        } catch (e: Exception) {
            Log.e(TAG, "Error creating/showing bottom sheet: ${e.message}", e)
            // Send error event to React Native
            val errorParams = Arguments.createMap().apply {
                putString("error", e.message ?: "Unknown error")
                putString("errorType", "THEME_ERROR")
            }
            sendEvent("onError", errorParams)
        }
    }

    @ReactMethod
    fun dismissBottomSheet() {
        UiThreadUtil.runOnUiThread {
            bottomSheet?.dismiss()
        }
    }

    @ReactMethod
    fun isBottomSheetVisible(promise: Promise) {
        promise.resolve(bottomSheet?.isVisible ?: false)
    }

    // MARK: - Events

    @ReactMethod
    fun addListener(eventType: String) {
        listenerCount++
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        listenerCount -= count
        if (listenerCount < 0) listenerCount = 0
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        if (listenerCount > 0) {
            try {
                reactApplicationContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(eventName, params)
            } catch (e: Exception) {
                Log.e(TAG, "Error sending event $eventName: ${e.message}")
            }
        }
    }

    // MARK: - Helpers

    private fun getLocalizedMenuTitle(): String {
        return when (config?.language) {
            Language.TURKISH -> "İşaret Dili"
            Language.ENGLISH -> "Sign Language"
            Language.ARABIC -> "لغة الإشارة"
            else -> "Sign Language"
        }
    }

    private fun getLocalizedBusinessName(): String {
        return when (config?.language) {
            Language.TURKISH -> "Engelsiz Çeviri"
            Language.ENGLISH -> "SignForDeaf"
            Language.ARABIC -> "لغة الإشارة"
            else -> "SignForDeaf"
        }
    }

    // MARK: - Lifecycle

    override fun onHostResume() {
        if (isModuleEnabled) {
            UiThreadUtil.runOnUiThread {
                enableTextSelectionForCurrentActivity()
            }
        }
    }

    override fun onHostPause() {}

    override fun onHostDestroy() {
        bottomSheet?.dismiss()
        apiService?.cancelRequest()
    }
}
