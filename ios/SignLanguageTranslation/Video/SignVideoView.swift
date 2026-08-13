import AVFoundation
import Foundation
import React
import UIKit

/**
 The SDK's video surface.

 The view's own layer *is* the `AVPlayerLayer`, so there is no frame to keep in
 sync by hand — the v1 code did that in `viewDidLayoutSubviews` and got a stale
 frame whenever layout ran without it.

 Every observer is held as a token that de-registers when it is replaced or when
 the view goes away. The v1 code added KVO and notification observers on every
 setup without ever removing them, which leaks and eventually crashes with
 "deallocated while key value observers were still registered".
 */
@objc(SignVideoView)
class SignVideoView: UIView {

    override class var layerClass: AnyClass { AVPlayerLayer.self }
    private var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }

    private var player: AVPlayer?

    private var statusObservation: NSKeyValueObservation?
    private var sizeObservation: NSKeyValueObservation?
    private var endObserver: NSObjectProtocol?

    private var currentURL: String?
    private var pendingURL: String?
    private var didReportSize = false

    // MARK: - Props

    @objc var onSignVideoLoad: RCTDirectEventBlock?
    @objc var onSignVideoEnd: RCTDirectEventBlock?
    @objc var onSignVideoError: RCTDirectEventBlock?

    @objc var uri: NSString? {
        didSet { pendingURL = uri as String? }
    }

    @objc var paused: Bool = false {
        didSet { applyPlayback() }
    }

    /// Named `repeats` because `repeat` is a Swift keyword.
    @objc var repeats: Bool = false

    @objc var muted: Bool = false {
        didSet { player?.isMuted = muted }
    }

    @objc var rate: NSNumber = 1 {
        didSet { applyPlayback() }
    }

    @objc var resizeMode: NSString = "contain" {
        didSet {
            switch resizeMode as String {
            case "cover": playerLayer.videoGravity = .resizeAspectFill
            case "stretch": playerLayer.videoGravity = .resize
            default: playerLayer.videoGravity = .resizeAspect
            }
        }
    }

    /**
     Called once per commit, after every prop has been set — on both the old and
     the new architecture.

     Rebuilding the item here rather than in `uri`'s setter means a new source
     starts with its speed, loop and paused state already correct.
     */
    override func didSetProps(_ changedProps: [String]) {
        guard pendingURL != currentURL else {
            applyPlayback()
            return
        }
        currentURL = pendingURL

        guard let raw = pendingURL, !raw.isEmpty, let url = URL(string: raw) else {
            teardownPlayer()
            return
        }

        let item = AVPlayerItem(url: url)
        didReportSize = false

        if let existing = player {
            existing.replaceCurrentItem(with: item)
        } else {
            let created = AVPlayer(playerItem: item)
            created.actionAtItemEnd = .none
            player = created
            playerLayer.player = created
        }

        player?.isMuted = muted
        observe(item)
        applyPlayback()
    }

    // MARK: - Playback

    private var desiredRate: Float {
        let value = rate.floatValue
        return value > 0 ? value : 1
    }

    private func applyPlayback() {
        guard let player else { return }
        if paused {
            player.pause()
        } else {
            // Assigning `rate` directly would start playback even while paused,
            // so speed is only ever applied through this call.
            player.playImmediately(atRate: desiredRate)
        }
    }

    // MARK: - Observation

    private func observe(_ item: AVPlayerItem) {
        // Assigning nil invalidates the previous registrations.
        statusObservation = nil
        sizeObservation = nil
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
            self.endObserver = nil
        }

        statusObservation = item.observe(\.status, options: [.new]) { [weak self] observed, _ in
            guard let self else { return }
            switch observed.status {
            case .readyToPlay: self.reportSize(of: observed)
            case .failed: self.reportError(observed.error)
            default: break
            }
        }

        // Some assets report their size only after becoming ready to play.
        sizeObservation = item.observe(\.presentationSize, options: [.new]) { [weak self] observed, _ in
            self?.reportSize(of: observed)
        }

        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            self?.handleEnd()
        }
    }

    /**
     Loop by seeking rather than with `AVPlayerLooper`.

     The controller expects an end event on *every* cycle, and a looper swallows
     them. The bundled idle clips already bake in their own reverse, so the loop
     point is a near-still frame and the seek is invisible.
     */
    private func handleEnd() {
        onSignVideoEnd?([:])
        guard repeats, let player else { return }

        player.seek(to: .zero, toleranceBefore: .zero, toleranceAfter: .zero)
        if !paused { player.playImmediately(atRate: desiredRate) }
    }

    /// `presentationSize` already accounts for a rotated clip's preferred
    /// transform, which `AVAssetTrack.naturalSize` does not.
    private func reportSize(of item: AVPlayerItem) {
        let size = item.presentationSize
        guard !didReportSize, size.width > 0, size.height > 0 else { return }
        didReportSize = true
        onSignVideoLoad?(["width": size.width, "height": size.height])
    }

    private func reportError(_ error: Error?) {
        onSignVideoError?([
            "code": "videoError",
            "message": error?.localizedDescription ?? "Video could not be played",
        ])
    }

    // MARK: - Teardown

    private func teardownPlayer() {
        statusObservation = nil
        sizeObservation = nil
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
            self.endObserver = nil
        }
        player?.pause()
        player?.replaceCurrentItem(with: nil)
        playerLayer.player = nil
        player = nil
    }

    override func removeFromSuperview() {
        teardownPlayer()
        super.removeFromSuperview()
    }

    deinit {
        // The observations de-register themselves, but the player must be told
        // to let go of its decoder.
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
        }
        player?.pause()
        player?.replaceCurrentItem(with: nil)
    }
}
