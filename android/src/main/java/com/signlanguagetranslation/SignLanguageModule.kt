package com.signlanguagetranslation

import android.graphics.Point
import android.os.Build
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.widget.TextView
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.common.ViewUtil
import com.signlanguagetranslation.textselection.CustomActionModeCallback

/**
 * The whole native surface of the SDK on Android.
 *
 * v2 moved the player, the translation flow, the API client and tap
 * classification into TypeScript, shared with iOS. What is left here is the one
 * thing JavaScript genuinely cannot do: add a "Sign Language" item to the
 * platform's text-selection action mode.
 *
 * Two things the v1 module did are deliberately gone:
 *
 *  - The `Handler` loop that re-walked the entire view hierarchy every 2000 ms,
 *    reinstalling callbacks on every pass and never stopping, even after
 *    `disable()`.
 *  - The per-view tap `GestureDetector`. Tap-to-translate is now classified in
 *    JavaScript against the React tree, which is both cheaper and able to tell
 *    a button's label from its box.
 */
class SignLanguageModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var enabled = false
    private var language = "tr"
    private var listenerCount = 0

    override fun getName(): String = NAME

    /** Only the language matters here: it localizes the menu item's title. */
    @ReactMethod
    fun configure(language: String) {
        this.language = language
    }

    @ReactMethod
    fun setEnabled(enabled: Boolean) {
        this.enabled = enabled
        if (enabled) {
            reactApplicationContext.runOnUiQueueThread { attachToVisibleText() }
        }
    }

    /**
     * Opt one view subtree into the selection menu.
     *
     * Hosts that render text through a custom view can call this; the common
     * case is handled by [setEnabled], which sweeps the current screen once.
     */
    @ReactMethod
    fun enableTextSelectionForView(viewTag: Int) {
        reactApplicationContext.runOnUiQueueThread {
            // Resolved through UIManagerHelper rather than UIManagerModule:
            // the latter exists only on the old architecture, so on the new one
            // it returns null and this would silently do nothing.
            val view = try {
                UIManagerHelper
                    .getUIManager(reactApplicationContext, ViewUtil.getUIManagerType(viewTag))
                    ?.resolveView(viewTag)
            } catch (error: Exception) {
                null
            }
            if (view != null) attach(view)
        }
    }

    /**
     * The system-bar insets that actually cover the app's content, in dp.
     *
     * The SDK's floating surfaces keep themselves inside the reachable area,
     * and on Android that area cannot be guessed: since targetSdk 35 the window
     * is edge-to-edge by default, so the navigation bar overlaps the content
     * the app lays out, while an older or opted-out app gets a window that
     * already stops above it. Guessing either way is wrong on the other.
     *
     * So this reports the *overlap*, not the raw inset: how far each system bar
     * reaches into the content view, which is zero when the window already
     * excludes it. Resolves `null` when there is no attached window to measure,
     * and the caller falls back to its own estimate.
     */
    @ReactMethod
    fun getSafeAreaInsets(promise: Promise) {
        reactApplicationContext.runOnUiQueueThread {
            promise.resolve(
                try {
                    contentInsets()
                } catch (error: Exception) {
                    null
                }
            )
        }
    }

    private fun contentInsets(): WritableMap? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return null

        val activity = reactApplicationContext.currentActivity ?: return null
        // The decor view, not the content view: React Native's window
        // dimensions describe the *window*, and an inset only means something
        // measured in the same space as the layout it is applied to. The
        // content view can be inset by a further amount the app never sees,
        // which would leave the reported overlap short of the real bar.
        val decor = activity.window?.decorView ?: return null
        val windowInsets = decor.rootWindowInsets ?: return null

        val barLeft: Int
        val barTop: Int
        val barRight: Int
        val barBottom: Int
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // The cutout counts too: a landscape notch eats into the same edge
            // a card would otherwise be flush against.
            val bars = windowInsets.getInsets(
                WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout()
            )
            barLeft = bars.left
            barTop = bars.top
            barRight = bars.right
            barBottom = bars.bottom
        } else {
            @Suppress("DEPRECATION")
            barLeft = windowInsets.systemWindowInsetLeft
            @Suppress("DEPRECATION")
            barTop = windowInsets.systemWindowInsetTop
            @Suppress("DEPRECATION")
            barRight = windowInsets.systemWindowInsetRight
            @Suppress("DEPRECATION")
            barBottom = windowInsets.systemWindowInsetBottom
        }

        val displayWidth: Int
        val displayHeight: Int
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val bounds = activity.windowManager.currentWindowMetrics.bounds
            displayWidth = bounds.width()
            displayHeight = bounds.height()
        } else {
            val size = Point()
            @Suppress("DEPRECATION")
            activity.windowManager.defaultDisplay.getRealSize(size)
            displayWidth = size.x
            displayHeight = size.y
        }

        // Where the window sits on the display. Whatever lies between its edges
        // and the display's is already outside the app's layout, and pays for
        // that much of the bar — which is exactly what a window that is not
        // edge-to-edge does, and why its overlap comes out zero.
        val location = IntArray(2)
        decor.getLocationOnScreen(location)
        val outsideLeft = location[0]
        val outsideTop = location[1]
        val outsideRight = displayWidth - (location[0] + decor.width)
        val outsideBottom = displayHeight - (location[1] + decor.height)

        val density = decor.resources.displayMetrics.density
        fun overlap(bar: Int, outside: Int): Double =
            (maxOf(0, bar - maxOf(0, outside)) / density).toDouble()

        return Arguments.createMap().apply {
            putDouble("top", overlap(barTop, outsideTop))
            putDouble("bottom", overlap(barBottom, outsideBottom))
            putDouble("left", overlap(barLeft, outsideLeft))
            putDouble("right", overlap(barRight, outsideRight))
        }
    }

    /** Required by NativeEventEmitter. */
    @ReactMethod
    fun addListener(eventType: String) {
        listenerCount += 1
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        listenerCount = maxOf(0, listenerCount - count)
    }

    private fun attachToVisibleText() {
        // Called explicitly rather than as `currentActivity`: React Native
        // converted this class to Kotlin, so the Java synthetic property no
        // longer exists, and the inherited accessor is deprecated in favour of
        // going through the context.
        val activity = reactApplicationContext.currentActivity ?: return
        val root = activity.findViewById<View>(android.R.id.content) ?: return
        attach(root)
    }

    /**
     * Install the action-mode callback on every [TextView] in a subtree.
     *
     * Note this does **not** make text selectable. v1 wrapped the app in a
     * selection layer, which broke normal interaction; selection-based
     * translation is offered only where the host already made text selectable.
     */
    private fun attach(view: View) {
        if (view is TextView) {
            if (view.isTextSelectable) {
                view.customSelectionActionModeCallback =
                    CustomActionModeCallback(view, menuTitle()) { text -> emitSelection(text) }
            }
            return
        }
        if (view is ViewGroup) {
            for (index in 0 until view.childCount) attach(view.getChildAt(index))
        }
    }

    private fun menuTitle(): String = when (language) {
        "ar" -> "لغة الإشارة"
        "tr" -> "İşaret Dili"
        else -> "Sign Language"
    }

    private fun emitSelection(text: String) {
        if (!enabled || text.isBlank() || listenerCount == 0) return

        val payload: WritableMap = Arguments.createMap().apply { putString("text", text) }
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("onTextSelected", payload)
    }

    companion object {
        const val NAME = "SignLanguageTranslation"
    }
}
