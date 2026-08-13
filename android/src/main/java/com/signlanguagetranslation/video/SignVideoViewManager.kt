package com.signlanguagetranslation.video

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

/**
 * Exposes {@link SignVideoView} to JavaScript.
 *
 * An ordinary view manager, not a code-generated Fabric component: the new
 * architecture mounts these through the same `ViewManagerRegistry` the old one
 * uses, so a single class serves both. That matters because the SDK supports
 * React Native 0.72 through 0.83, and a generated component would not run on the
 * older, pre-Fabric end of that range.
 */
class SignVideoViewManager : SimpleViewManager<SignVideoView>() {

    override fun getName(): String = NAME

    override fun createViewInstance(reactContext: ThemedReactContext): SignVideoView =
        SignVideoView(reactContext)

    @ReactProp(name = "uri")
    fun setUri(view: SignVideoView, value: String?) = view.setUri(value)

    @ReactProp(name = "paused")
    fun setPaused(view: SignVideoView, value: Boolean) = view.setPaused(value)

    @ReactProp(name = "repeats")
    fun setRepeats(view: SignVideoView, value: Boolean) = view.setRepeats(value)

    @ReactProp(name = "muted")
    fun setMuted(view: SignVideoView, value: Boolean) = view.setMuted(value)

    @ReactProp(name = "rate")
    fun setRate(view: SignVideoView, value: Float) = view.setRate(value)

    @ReactProp(name = "resizeMode")
    fun setResizeMode(view: SignVideoView, value: String?) = view.setResizeMode(value)

    /** Runs once per commit, after every prop setter. */
    override fun onAfterUpdateTransaction(view: SignVideoView) {
        super.onAfterUpdateTransaction(view)
        view.commit()
    }

    override fun onDropViewInstance(view: SignVideoView) {
        view.dispose()
        super.onDropViewInstance(view)
    }

    /**
     * The `top*` names are what native dispatches; `registrationName` is the
     * prop JavaScript passes. Prefixed so they cannot collide with the core
     * `onLoad`/`onError` in a merged view-config table.
     */
    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> = mapOf(
        SignVideoEvent.LOAD to mapOf("registrationName" to "onSignVideoLoad"),
        SignVideoEvent.END to mapOf("registrationName" to "onSignVideoEnd"),
        SignVideoEvent.ERROR to mapOf("registrationName" to "onSignVideoError"),
    )

    companion object {
        const val NAME = "SignVideoView"
    }
}
