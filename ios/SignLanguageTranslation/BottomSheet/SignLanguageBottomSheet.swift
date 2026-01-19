// ios/SignLanguageTranslation/BottomSheet/SignLanguageBottomSheet.swift

import AVKit
import UIKit

class SignLanguageBottomSheet: UIViewController {

    // MARK: - Properties

    private var videoURL: String = ""
    private var displayText: String = ""
    private var displayTitle: String = "Engelsiz Çeviri"
    private var player: AVPlayer?
    private var playerLayer: AVPlayerLayer?
    private var isLoading: Bool = true
    private var marqueeTimer: Timer?

    var onDismiss: (() -> Void)?
    var onVideoStart: (() -> Void)?
    var onVideoEnd: (() -> Void)?

    // MARK: - Theme Colors

    private let primaryColor = UIColor(red: 0.4, green: 0.23, blue: 0.72, alpha: 1.0)  // #6750A4

    // MARK: - UI Components

    private lazy var headerView: UIView = {
        let view = UIView()
        view.backgroundColor = .white
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()

    private lazy var grabberView: UIView = {
        let view = UIView()
        view.backgroundColor = UIColor.lightGray.withAlphaComponent(0.5)
        view.layer.cornerRadius = 2.5
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()

    private lazy var logoImageView: LogoView = {
        let view = LogoView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.backgroundColor = .clear
        return view
    }()

    private lazy var titleLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 18, weight: .bold)
        label.textColor = primaryColor
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    private lazy var closeButton: UIButton = {
        let button = UIButton(type: .system)
        let config = UIImage.SymbolConfiguration(pointSize: 16, weight: .bold)
        button.setImage(UIImage(systemName: "xmark", withConfiguration: config), for: .normal)
        button.tintColor = primaryColor
        button.addTarget(self, action: #selector(closeButtonTapped), for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.accessibilityLabel = "Kapat"
        button.accessibilityHint = "İşaret dili çevirisini kapatmak için çift dokunun"
        return button
    }()

    private lazy var videoContainerView: UIView = {
        let view = UIView()
        view.backgroundColor = .white
        view.translatesAutoresizingMaskIntoConstraints = false
        view.layer.cornerRadius = 12
        view.clipsToBounds = true
        return view
    }()

    private lazy var textLabel: MarqueeLabel = {
        let label = MarqueeLabel()
        label.font = .systemFont(ofSize: 15, weight: .medium)
        label.textColor = primaryColor
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    private lazy var loadingIndicator: UIActivityIndicatorView = {
        let indicator = UIActivityIndicatorView(style: .large)
        indicator.color = primaryColor
        indicator.hidesWhenStopped = true
        indicator.translatesAutoresizingMaskIntoConstraints = false
        return indicator
    }()

    private lazy var errorView: UIView = {
        let view = UIView()
        view.backgroundColor = .clear
        view.isHidden = true
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()

    private lazy var errorLabel: UILabel = {
        let label = UILabel()
        label.text = "Video yüklenemedi"
        label.textColor = .darkGray
        label.font = .systemFont(ofSize: 14, weight: .medium)
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    private lazy var retryButton: UIButton = {
        let button = UIButton(type: .system)
        button.setTitle("Tekrar Dene", for: .normal)
        button.setTitleColor(.white, for: .normal)
        button.backgroundColor = primaryColor
        button.layer.cornerRadius = 8
        button.titleLabel?.font = .systemFont(ofSize: 14, weight: .semibold)
        button.addTarget(self, action: #selector(retryButtonTapped), for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        setupAccessibility()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        playerLayer?.frame = videoContainerView.bounds
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        player?.pause()

        if isBeingDismissed {
            onDismiss?()
        }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        player?.currentItem?.removeObserver(self, forKeyPath: "status")
    }

    // MARK: - Configuration

    func configure(videoURL: String = "", text: String, title: String = "Engelsiz Çeviri") {
        self.videoURL = videoURL
        self.displayText = text
        self.displayTitle = title
        self.isLoading = videoURL.isEmpty
    }

    func updateVideoURL(_ url: String) {
        self.videoURL = url
        self.isLoading = false
        setupVideoPlayer()
    }

    // MARK: - Setup

    private func setupUI() {
        view.backgroundColor = .white

        // Add grabber at top
        view.addSubview(grabberView)

        // Header
        view.addSubview(headerView)
        headerView.addSubview(logoImageView)
        headerView.addSubview(titleLabel)
        headerView.addSubview(closeButton)

        // Video container
        view.addSubview(videoContainerView)
        videoContainerView.addSubview(loadingIndicator)

        // Error view
        videoContainerView.addSubview(errorView)
        errorView.addSubview(errorLabel)
        errorView.addSubview(retryButton)

        // Text label
        view.addSubview(textLabel)

        // Set content
        titleLabel.text = displayTitle
        textLabel.text = displayText

        setupConstraints()

        // Show loading initially if no video URL
        if isLoading {
            loadingIndicator.startAnimating()
        } else {
            setupVideoPlayer()
        }
    }

    private func setupConstraints() {
        NSLayoutConstraint.activate([
            // Grabber
            grabberView.topAnchor.constraint(equalTo: view.topAnchor, constant: 8),
            grabberView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            grabberView.widthAnchor.constraint(equalToConstant: 40),
            grabberView.heightAnchor.constraint(equalToConstant: 5),

            // Header
            headerView.topAnchor.constraint(equalTo: grabberView.bottomAnchor, constant: 8),
            headerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            headerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            headerView.heightAnchor.constraint(equalToConstant: 50),

            // Logo
            logoImageView.leadingAnchor.constraint(equalTo: headerView.leadingAnchor, constant: 16),
            logoImageView.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),
            logoImageView.widthAnchor.constraint(equalToConstant: 30),
            logoImageView.heightAnchor.constraint(equalToConstant: 30),

            // Title
            titleLabel.centerXAnchor.constraint(equalTo: headerView.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),

            // Close Button
            closeButton.trailingAnchor.constraint(
                equalTo: headerView.trailingAnchor, constant: -16),
            closeButton.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),
            closeButton.widthAnchor.constraint(equalToConstant: 44),
            closeButton.heightAnchor.constraint(equalToConstant: 44),

            // Video Container
            videoContainerView.topAnchor.constraint(equalTo: headerView.bottomAnchor, constant: 12),
            videoContainerView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            videoContainerView.trailingAnchor.constraint(
                equalTo: view.trailingAnchor, constant: -16),
            videoContainerView.bottomAnchor.constraint(equalTo: textLabel.topAnchor, constant: -12),

            // Loading Indicator
            loadingIndicator.centerXAnchor.constraint(equalTo: videoContainerView.centerXAnchor),
            loadingIndicator.centerYAnchor.constraint(equalTo: videoContainerView.centerYAnchor),

            // Error View
            errorView.centerXAnchor.constraint(equalTo: videoContainerView.centerXAnchor),
            errorView.centerYAnchor.constraint(equalTo: videoContainerView.centerYAnchor),
            errorView.widthAnchor.constraint(equalToConstant: 200),

            errorLabel.topAnchor.constraint(equalTo: errorView.topAnchor),
            errorLabel.centerXAnchor.constraint(equalTo: errorView.centerXAnchor),

            retryButton.topAnchor.constraint(equalTo: errorLabel.bottomAnchor, constant: 12),
            retryButton.centerXAnchor.constraint(equalTo: errorView.centerXAnchor),
            retryButton.widthAnchor.constraint(equalToConstant: 120),
            retryButton.heightAnchor.constraint(equalToConstant: 36),
            retryButton.bottomAnchor.constraint(equalTo: errorView.bottomAnchor),

            // Text Label
            textLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            textLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            textLabel.bottomAnchor.constraint(
                equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
            textLabel.heightAnchor.constraint(greaterThanOrEqualToConstant: 30),
        ])
    }

    private func setupVideoPlayer() {
        print("[SignLanguageSDK] Setting up video player with URL: \(videoURL)")

        guard let url = URL(string: videoURL) else {
            print("[SignLanguageSDK] ERROR: Invalid video URL: \(videoURL)")
            showError()
            return
        }

        print("[SignLanguageSDK] Video URL is valid: \(url.absoluteString)")

        loadingIndicator.startAnimating()
        errorView.isHidden = true

        let playerItem = AVPlayerItem(url: url)
        player = AVPlayer(playerItem: playerItem)
        playerLayer = AVPlayerLayer(player: player)
        playerLayer?.videoGravity = .resizeAspect
        playerLayer?.frame = videoContainerView.bounds

        if let playerLayer = playerLayer {
            videoContainerView.layer.insertSublayer(playerLayer, at: 0)
        }

        // Observe when player is ready
        player?.currentItem?.addObserver(
            self,
            forKeyPath: "status",
            options: [.new],
            context: nil
        )

        // Observe for errors
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(playerDidFailToPlay(_:)),
            name: .AVPlayerItemFailedToPlayToEndTime,
            object: player?.currentItem
        )

        // Loop video
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(playerDidFinishPlaying),
            name: .AVPlayerItemDidPlayToEndTime,
            object: player?.currentItem
        )

        print("[SignLanguageSDK] Starting video playback...")
        player?.play()
    }

    @objc private func playerDidFailToPlay(_ notification: Notification) {
        if let error = notification.userInfo?[AVPlayerItemFailedToPlayToEndTimeErrorKey] as? Error {
            print("[SignLanguageSDK] ERROR: Video playback failed - \(error.localizedDescription)")
        }
        showError()
    }

    override func observeValue(
        forKeyPath keyPath: String?,
        of object: Any?,
        change: [NSKeyValueChangeKey: Any]?,
        context: UnsafeMutableRawPointer?
    ) {
        if keyPath == "status",
            let item = object as? AVPlayerItem
        {
            DispatchQueue.main.async { [weak self] in
                switch item.status {
                case .readyToPlay:
                    print("[SignLanguageSDK] Video ready to play!")
                    self?.loadingIndicator.stopAnimating()
                    self?.onVideoStart?()
                case .failed:
                    if let error = item.error {
                        print(
                            "[SignLanguageSDK] ERROR: Video failed to load - \(error.localizedDescription)"
                        )
                    } else {
                        print("[SignLanguageSDK] ERROR: Video failed to load - unknown error")
                    }
                    self?.loadingIndicator.stopAnimating()
                    self?.showError()
                case .unknown:
                    print("[SignLanguageSDK] Video status: unknown (still loading...)")
                @unknown default:
                    break
                }
            }
        }
    }

    private func setupAccessibility() {
        view.accessibilityViewIsModal = true

        videoContainerView.isAccessibilityElement = true
        videoContainerView.accessibilityLabel = "İşaret dili videosu oynatılıyor"
        videoContainerView.accessibilityTraits = .playsSound

        UIAccessibility.post(
            notification: .announcement,
            argument: "İşaret dili çevirisi hazır"
        )
    }

    // MARK: - Actions

    @objc private func closeButtonTapped() {
        onVideoEnd?()
        dismiss(animated: true)
    }

    @objc private func playerDidFinishPlaying() {
        player?.seek(to: .zero)
        player?.play()
    }

    @objc private func retryButtonTapped() {
        setupVideoPlayer()
    }

    private func showError() {
        loadingIndicator.stopAnimating()
        errorView.isHidden = false
    }
}

// MARK: - Presentation Helper

extension SignLanguageBottomSheet {

    static func present(
        from viewController: UIViewController,
        videoURL: String = "",
        text: String,
        title: String = "Engelsiz Çeviri",
        onDismiss: (() -> Void)? = nil
    ) -> SignLanguageBottomSheet {
        let bottomSheet = SignLanguageBottomSheet()
        bottomSheet.configure(videoURL: videoURL, text: text, title: title)
        bottomSheet.onDismiss = onDismiss

        if #available(iOS 15.0, *) {
            if let sheet = bottomSheet.sheetPresentationController {
                sheet.detents = [.medium(), .large()]
                sheet.prefersGrabberVisible = false  // We have our own grabber
                sheet.preferredCornerRadius = 20
            }
        }

        viewController.present(bottomSheet, animated: true)
        return bottomSheet
    }
}

// MARK: - MarqueeLabel

class MarqueeLabel: UIView {

    private let textLabel = UILabel()
    private var displayLink: CADisplayLink?
    private var scrollOffset: CGFloat = 0
    private var textWidth: CGFloat = 0
    private var containerWidth: CGFloat = 0
    private var isAnimating = false
    private let scrollSpeed: CGFloat = 30  // points per second
    private let pauseDuration: TimeInterval = 2.0
    private var pauseTimer: Timer?
    private var shouldAnimate = false

    var text: String? {
        didSet {
            textLabel.text = text
            setNeedsLayout()
        }
    }

    var font: UIFont = .systemFont(ofSize: 15, weight: .medium) {
        didSet {
            textLabel.font = font
            setNeedsLayout()
        }
    }

    var textColor: UIColor = .black {
        didSet {
            textLabel.textColor = textColor
        }
    }

    var textAlignment: NSTextAlignment = .center {
        didSet {
            textLabel.textAlignment = textAlignment
        }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupLabel()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupLabel()
    }

    private func setupLabel() {
        clipsToBounds = true
        textLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(textLabel)

        NSLayoutConstraint.activate([
            textLabel.centerYAnchor.constraint(equalTo: centerYAnchor),
            textLabel.heightAnchor.constraint(equalTo: heightAnchor),
        ])
    }

    override func layoutSubviews() {
        super.layoutSubviews()

        containerWidth = bounds.width
        textWidth = textLabel.intrinsicContentSize.width

        if textWidth > containerWidth {
            // Text is longer than container, enable scrolling
            shouldAnimate = true
            textLabel.frame = CGRect(x: 0, y: 0, width: textWidth, height: bounds.height)
            startAnimating()
        } else {
            // Text fits, center it
            shouldAnimate = false
            stopAnimating()
            textLabel.frame = CGRect(
                x: (containerWidth - textWidth) / 2, y: 0, width: textWidth, height: bounds.height)
        }
    }

    private func startAnimating() {
        guard shouldAnimate, !isAnimating else { return }
        isAnimating = true
        scrollOffset = 0

        // Start with a pause
        pauseTimer = Timer.scheduledTimer(withTimeInterval: pauseDuration, repeats: false) {
            [weak self] _ in
            self?.startScrolling()
        }
    }

    private func startScrolling() {
        displayLink?.invalidate()
        displayLink = CADisplayLink(target: self, selector: #selector(updateScroll))
        displayLink?.add(to: .main, forMode: .common)
    }

    @objc private func updateScroll() {
        guard shouldAnimate else { return }

        let delta = scrollSpeed / 60.0  // Assuming 60 fps
        scrollOffset += delta

        let maxOffset = textWidth - containerWidth + 20  // Add small padding

        if scrollOffset >= maxOffset {
            // Reached the end, pause and reset
            displayLink?.invalidate()
            displayLink = nil

            pauseTimer = Timer.scheduledTimer(withTimeInterval: pauseDuration, repeats: false) {
                [weak self] _ in
                self?.resetAndRestart()
            }
        } else {
            textLabel.frame.origin.x = -scrollOffset
        }
    }

    private func resetAndRestart() {
        scrollOffset = 0
        textLabel.frame.origin.x = 0

        // Pause at start before scrolling again
        pauseTimer = Timer.scheduledTimer(withTimeInterval: pauseDuration, repeats: false) {
            [weak self] _ in
            self?.startScrolling()
        }
    }

    private func stopAnimating() {
        isAnimating = false
        displayLink?.invalidate()
        displayLink = nil
        pauseTimer?.invalidate()
        pauseTimer = nil
        scrollOffset = 0
    }

    deinit {
        stopAnimating()
    }
}
