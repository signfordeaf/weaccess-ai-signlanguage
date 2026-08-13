package com.signlanguagetranslation.video

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event

/**
 * One event from the video view.
 *
 * Dispatched through the `EventDispatcher` rather than
 * `RCTEventEmitter.receiveEvent`: the older path does not reach the new
 * architecture's renderer, and on a bridgeless runtime it logs a soft exception
 * saying so. This class works on both.
 */
class SignVideoEvent(
    surfaceId: Int,
    viewId: Int,
    private val name: String,
    private val payload: WritableMap?,
) : Event<SignVideoEvent>(surfaceId, viewId) {

    override fun getEventName(): String = name

    /**
     * Never null, even for the payload-free `END` event.
     *
     * The old architecture's `Event.dispatch` treats a null here as a
     * programming error and throws — "you must return a valid, non-null value
     * from `getEventData`" — which took down the whole surface the first time a
     * video ended. Fabric tolerates it, so this only ever showed on Paper.
     */
    override fun getEventData(): WritableMap = payload ?: Arguments.createMap()

    companion object {
        const val LOAD = "topSignVideoLoad"
        const val END = "topSignVideoEnd"
        const val ERROR = "topSignVideoError"
    }
}
