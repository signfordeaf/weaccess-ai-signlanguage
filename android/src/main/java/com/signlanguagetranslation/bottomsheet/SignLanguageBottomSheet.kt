// android/src/main/java/com/signlanguagetranslation/bottomsheet/SignLanguageBottomSheet.kt

package com.signlanguagetranslation.bottomsheet

import android.content.DialogInterface
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.signlanguagetranslation.R

class SignLanguageBottomSheet : BottomSheetDialogFragment() {

    companion object {
        private const val ARG_VIDEO_URL = "video_url"
        private const val ARG_TEXT = "text"
        private const val ARG_BUSINESS_NAME = "business_name"

        fun newInstance(
            videoUrl: String = "",
            text: String,
            businessName: String
        ): SignLanguageBottomSheet {
            return SignLanguageBottomSheet().apply {
                arguments = Bundle().apply {
                    putString(ARG_VIDEO_URL, videoUrl)
                    putString(ARG_TEXT, text)
                    putString(ARG_BUSINESS_NAME, businessName)
                }
            }
        }
    }

    private var player: ExoPlayer? = null
    private lateinit var playerView: PlayerView
    private lateinit var progressBar: ProgressBar
    private lateinit var titleTextView: TextView
    private lateinit var displayTextView: TextView
    private lateinit var closeButton: ImageButton
    private lateinit var logoImageView: ImageView
    private lateinit var errorView: View
    private lateinit var retryButton: View

    private var videoUrl: String = ""
    private var displayText: String = ""
    private var businessName: String = ""
    private var isWaitingForVideo: Boolean = true

    var onDismissListener: (() -> Unit)? = null
    var onVideoStartListener: (() -> Unit)? = null
    var onVideoEndListener: (() -> Unit)? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setStyle(STYLE_NORMAL, R.style.SignLanguageBottomSheetStyle)

        arguments?.let {
            videoUrl = it.getString(ARG_VIDEO_URL, "")
            displayText = it.getString(ARG_TEXT, "")
            businessName = it.getString(ARG_BUSINESS_NAME, "")
            isWaitingForVideo = videoUrl.isEmpty()
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.bottom_sheet_sign_language, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupViews(view)
        setupAccessibility()
        setupVideoPlayer()
        setupBottomSheetBehavior()
    }

    private fun setupViews(view: View) {
        playerView = view.findViewById(R.id.playerView)
        progressBar = view.findViewById(R.id.progressBar)
        titleTextView = view.findViewById(R.id.titleTextView)
        displayTextView = view.findViewById(R.id.displayTextView)
        closeButton = view.findViewById(R.id.closeButton)
        logoImageView = view.findViewById(R.id.logoImageView)
        errorView = view.findViewById(R.id.errorView)
        retryButton = view.findViewById(R.id.retryButton)

        titleTextView.text = businessName
        displayTextView.text = displayText

        // Enable marquee effect for long text
        displayTextView.isSelected = true
        displayTextView.isFocusable = true
        displayTextView.isFocusableInTouchMode = true
        
        // Request focus to start marquee
        displayTextView.post {
            displayTextView.requestFocus()
            displayTextView.isSelected = true
        }

        closeButton.setOnClickListener {
            onVideoEndListener?.invoke()
            dismiss()
        }

        retryButton.setOnClickListener {
            setupVideoPlayer()
        }
    }

    private fun setupAccessibility() {
        playerView.contentDescription = "İşaret dili videosu oynatılıyor"
        closeButton.contentDescription = "Kapat"

        view?.announceForAccessibility("İşaret dili çevirisi hazır")
    }

    private fun setupVideoPlayer() {
        // If waiting for video URL, show loading state
        if (videoUrl.isEmpty()) {
            progressBar.visibility = View.VISIBLE
            playerView.visibility = View.GONE
            errorView.visibility = View.GONE
            return
        }

        // Video URL available, prepare player
        progressBar.visibility = View.VISIBLE
        playerView.visibility = View.VISIBLE
        errorView.visibility = View.GONE

        player = ExoPlayer.Builder(requireContext()).build().apply {
            playerView.player = this

            val mediaItem = MediaItem.fromUri(videoUrl)
            setMediaItem(mediaItem)

            repeatMode = Player.REPEAT_MODE_ALL

            addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(playbackState: Int) {
                    when (playbackState) {
                        Player.STATE_READY -> {
                            progressBar.visibility = View.GONE
                            onVideoStartListener?.invoke()
                        }
                        Player.STATE_BUFFERING -> {
                            progressBar.visibility = View.VISIBLE
                        }
                        Player.STATE_ENDED -> {
                            // Handled by repeat mode
                        }
                        Player.STATE_IDLE -> {
                            // Initial state or error
                        }
                    }
                }

                override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                    progressBar.visibility = View.GONE
                    showError()
                }
            })

            prepare()
            playWhenReady = true
        }
    }
    
    fun updateVideoUrl(newVideoUrl: String) {
        videoUrl = newVideoUrl
        isWaitingForVideo = false
        
        if (isAdded && context != null) {
            setupVideoPlayer()
        }
    }

    private fun setupBottomSheetBehavior() {
        dialog?.setOnShowListener { dialogInterface ->
            val bottomSheetDialog = dialogInterface as? com.google.android.material.bottomsheet.BottomSheetDialog
            val bottomSheet = bottomSheetDialog?.findViewById<View>(com.google.android.material.R.id.design_bottom_sheet)

            bottomSheet?.let {
                val behavior = BottomSheetBehavior.from(it)
                
                // Calculate fixed height (half screen)
                val displayMetrics = resources.displayMetrics
                val halfScreenHeight = displayMetrics.heightPixels / 2
                
                // Set fixed height for bottom sheet
                it.layoutParams.height = halfScreenHeight
                it.requestLayout()
                
                // Configure behavior for smooth animation
                behavior.peekHeight = halfScreenHeight
                behavior.state = BottomSheetBehavior.STATE_COLLAPSED
                behavior.skipCollapsed = false
                behavior.isDraggable = true
                behavior.isFitToContents = false
                behavior.halfExpandedRatio = 0.5f
                
                // Smooth slide animation
                behavior.addBottomSheetCallback(object : BottomSheetBehavior.BottomSheetCallback() {
                    override fun onStateChanged(bottomSheet: View, newState: Int) {
                        if (newState == BottomSheetBehavior.STATE_HIDDEN) {
                            dismiss()
                        }
                    }
                    
                    override fun onSlide(bottomSheet: View, slideOffset: Float) {
                        // Smooth slide animation handled by system
                    }
                })
            }
        }
    }

    private fun showError() {
        progressBar.visibility = View.GONE
        errorView.visibility = View.VISIBLE
    }

    override fun onDismiss(dialog: DialogInterface) {
        super.onDismiss(dialog)
        onDismissListener?.invoke()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        player?.release()
        player = null
    }

    override fun onPause() {
        super.onPause()
        player?.pause()
    }

    override fun onResume() {
        super.onResume()
        player?.play()
    }
}
