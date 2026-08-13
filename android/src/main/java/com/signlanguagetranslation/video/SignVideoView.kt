package com.signlanguagetranslation.video

import android.content.ContentResolver
import android.graphics.Matrix
import android.net.Uri
import android.view.TextureView
import android.widget.FrameLayout
import androidx.media3.common.AudioAttributes
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.VideoSize
import androidx.media3.exoplayer.ExoPlayer
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper

/**
 * The SDK's video surface.
 *
 * A `TextureView` rather than media3's `PlayerView`, deliberately: `PlayerView`
 * is backed by a `SurfaceView`, which is composited in its own window and so
 * ignores the stage's rounded corners *and* draws over the mark badge and the
 * loading veil laid on top of it. A `TextureView` is an ordinary view in the
 * hierarchy, so it clips and layers like everything else. Skipping `media3-ui`
 * also avoids dragging in its AppCompat/Material theme requirements.
 */
class SignVideoView(private val reactContext: ThemedReactContext) :
    FrameLayout(reactContext), LifecycleEventListener {

    private val textureView = TextureView(reactContext).also {
        addView(it, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    }

    private var player: ExoPlayer? = null

    // Props, applied together once the commit settles.
    private var pendingUri: Uri? = null
    private var currentUri: Uri? = null
    private var paused = false
    private var repeats = false
    private var muted = false
    private var rate = 1f
    private var resizeMode = "contain"

    private var videoWidth = 0
    private var videoHeight = 0
    private var reportedSize = false

    init {
        reactContext.addLifecycleEventListener(this)
    }

    // -----------------------------------------------------------------------
    // Props
    // -----------------------------------------------------------------------

    fun setUri(raw: String?) {
        pendingUri = raw?.takeIf { it.isNotEmpty() }?.let { resolve(it) }
    }

    fun setPaused(value: Boolean) {
        paused = value
        player?.playWhenReady = !value
    }

    fun setRepeats(value: Boolean) {
        repeats = value
        player?.repeatMode =
            if (value) Player.REPEAT_MODE_ALL else Player.REPEAT_MODE_OFF
    }

    fun setMuted(value: Boolean) {
        muted = value
        player?.volume = if (value) 0f else 1f
    }

    fun setRate(value: Float) {
        rate = if (value > 0f) value else 1f
        // Pitch is pinned: this speeds up signing, it does not transpose audio.
        player?.playbackParameters = PlaybackParameters(rate, 1f)
    }

    fun setResizeMode(value: String?) {
        resizeMode = value ?: "contain"
        applyScale()
    }

    /**
     * Called once per commit, after every prop setter has run.
     *
     * The media item is rebuilt here rather than in `setUri` so a new source
     * arrives with its speed, loop and paused state already correct, instead of
     * briefly playing under the previous ones.
     */
    fun commit() {
        val next = pendingUri
        if (next == currentUri) return
        currentUri = next

        if (next == null) {
            release()
            return
        }

        val active = ensurePlayer()
        reportedSize = false
        active.setMediaItem(MediaItem.fromUri(next))
        active.repeatMode = if (repeats) Player.REPEAT_MODE_ALL else Player.REPEAT_MODE_OFF
        active.volume = if (muted) 0f else 1f
        active.playbackParameters = PlaybackParameters(rate, 1f)
        active.playWhenReady = !paused
        active.prepare()
    }

    // -----------------------------------------------------------------------
    // Player
    // -----------------------------------------------------------------------

    private fun ensurePlayer(): ExoPlayer =
        player ?: ExoPlayer.Builder(reactContext).build().also {
            // Never take audio focus: the idle clip is decorative and muted, and
            // ducking the host app's audio for it would be a bug.
            it.setAudioAttributes(AudioAttributes.DEFAULT, false)
            it.setVideoTextureView(textureView)
            it.addListener(listener)
            player = it
        }

    /**
     * Release the decoder.
     *
     * Android caps concurrent hardware decoders and this SDK holds two players
     * at once — the idle loop and the translation — so a missed release shows up
     * as a black stage after a few open/close cycles rather than as an error.
     */
    fun release() {
        player?.let {
            it.removeListener(listener)
            it.clearVideoSurface()
            it.release()
        }
        player = null
        currentUri = null
    }

    fun dispose() {
        reactContext.removeLifecycleEventListener(this)
        release()
    }

    override fun onHostPause() {
        player?.playWhenReady = false
    }

    override fun onHostResume() {
        player?.playWhenReady = !paused
    }

    override fun onHostDestroy() {
        // The activity can go away without React unmounting the tree.
        dispose()
    }

    private val listener = object : Player.Listener {
        override fun onPlaybackStateChanged(playbackState: Int) {
            // Only reached when looping is off; with REPEAT_MODE_ALL the player
            // never enters ENDED.
            if (playbackState == Player.STATE_ENDED) emit(SignVideoEvent.END, null)
        }

        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            // This is what "ended" means while looping, and the controller
            // expects one event per cycle.
            if (reason == Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT) {
                emit(SignVideoEvent.END, null)
            }
        }

        override fun onVideoSizeChanged(videoSize: VideoSize) {
            videoWidth = videoSize.width
            videoHeight = videoSize.height
            applyScale()

            if (reportedSize || videoWidth <= 0 || videoHeight <= 0) return
            reportedSize = true
            emit(
                SignVideoEvent.LOAD,
                Arguments.createMap().apply {
                    putInt("width", videoWidth)
                    putInt("height", videoHeight)
                }
            )
        }

        override fun onPlayerError(error: PlaybackException) {
            emit(
                SignVideoEvent.ERROR,
                Arguments.createMap().apply {
                    putString("code", error.errorCodeName)
                    putString("message", error.message ?: "")
                }
            )
        }
    }

    private fun emit(name: String, payload: WritableMap?) {
        UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)?.dispatchEvent(
            SignVideoEvent(UIManagerHelper.getSurfaceId(this), id, name, payload)
        )
    }

    // -----------------------------------------------------------------------
    // Layout
    // -----------------------------------------------------------------------

    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        super.onLayout(changed, l, t, r, b)
        applyScale()
    }

    /**
     * `TextureView` always stretches to fill, so `contain` and `cover` are a
     * transform on top of that rather than a property of the view.
     */
    private fun applyScale() {
        val vw = videoWidth
        val vh = videoHeight
        if (vw <= 0 || vh <= 0 || width == 0 || height == 0) return

        val scaleX: Float
        val scaleY: Float

        if (resizeMode == "stretch") {
            scaleX = 1f
            scaleY = 1f
        } else {
            val fitWidth = width.toFloat() / vw
            val fitHeight = height.toFloat() / vh
            val scale =
                if (resizeMode == "cover") maxOf(fitWidth, fitHeight)
                else minOf(fitWidth, fitHeight)
            scaleX = vw * scale / width
            scaleY = vh * scale / height
        }

        textureView.setTransform(
            Matrix().apply { setScale(scaleX, scaleY, width / 2f, height / 2f) }
        )
    }

    // -----------------------------------------------------------------------
    // Source resolution
    // -----------------------------------------------------------------------

    /**
     * Turn a source string into a `Uri`.
     *
     * Bundled clips arrive already resolved by JavaScript, which yields an http
     * URL from the dev server but, in a release build, a **schemeless**
     * identifier naming a `res/raw` entry. That second form is why this cannot
     * simply be `Uri.parse`.
     */
    private fun resolve(raw: String): Uri? {
        if (SCHEME.containsMatchIn(raw)) return Uri.parse(raw)

        val resources = reactContext.resources
        val packageName = reactContext.packageName
        var id = resources.getIdentifier(raw, "raw", packageName)
        if (id == 0) id = resources.getIdentifier(raw, "drawable", packageName)
        if (id == 0) return null

        return Uri.Builder()
            .scheme(ContentResolver.SCHEME_ANDROID_RESOURCE)
            .path(id.toString())
            .build()
    }

    private companion object {
        val SCHEME = Regex(
            "^(https?|rtsp|rtp|file|content|asset|android\\.resource)://",
            RegexOption.IGNORE_CASE
        )
    }
}
