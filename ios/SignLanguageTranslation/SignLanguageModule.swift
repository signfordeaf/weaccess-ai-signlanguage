// ios/SignLanguageTranslation/SignLanguageModule.swift

import Foundation
import React
import UIKit
import AVKit

@objc(SignLanguageModule)
class SignLanguageModule: RCTEventEmitter {
    
    // MARK: - Properties
    private var config: SignLanguageConfig?
    private var isModuleEnabled: Bool = false
    private var bottomSheet: SignLanguageBottomSheet?
    private var apiService: SignLanguageAPIService?
    
    private var hasListeners = false
    
    // MARK: - RCTEventEmitter Override
    
    override static func moduleName() -> String! {
        return "SignLanguageModule"
    }
    
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func supportedEvents() -> [String]! {
        return [
            "onTextSelected",
            "onTranslationStart",
            "onTranslationComplete",
            "onTranslationError",
            "onBottomSheetOpen",
            "onBottomSheetClose",
            "onVideoStart",
            "onVideoEnd"
        ]
    }
    
    override func startObserving() {
        hasListeners = true
    }
    
    override func stopObserving() {
        hasListeners = false
    }
    
    // MARK: - Configuration
    
    @objc(configure:apiUrl:language:fdid:tid:theme:accessibility:resolver:rejecter:)
    func configure(
        apiKey: String,
        apiUrl: String,
        language: String,
        fdid: String,
        tid: String,
        theme: NSDictionary,
        accessibility: NSDictionary,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        print("[SignLanguageSDK] Configure called with apiUrl: \(apiUrl)")
        
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            self.config = SignLanguageConfig(
                apiKey: apiKey,
                apiUrl: apiUrl,
                language: Language(from: language) ?? .turkish,
                fdid: fdid,
                tid: tid
            )
            
            self.apiService = SignLanguageAPIService(config: self.config!)
            self.isModuleEnabled = true
            
            // Initialize text selection manager
            TextSelectionManager.shared.configure(
                delegate: self,
                menuTitle: self.getLocalizedMenuTitle()
            )
            
            print("[SignLanguageSDK] TextSelectionManager configured with delegate")
            print("[SignLanguageSDK] Menu title: \(self.getLocalizedMenuTitle())")
            
            // Enable global sign language menu for ALL native text components
            // This uses method swizzling to inject menu item into UITextView/UITextField
            GlobalTextSelectionSwizzler.enableGlobalSignLanguageMenu()
            
            print("[SignLanguageSDK] SDK Configuration complete!")
            
            resolve(nil)
        }
    }
    
    // MARK: - Enable/Disable
    
    @objc(enable)
    func enable() {
        DispatchQueue.main.async { [weak self] in
            self?.isModuleEnabled = true
            self?.enableTextSelectionForCurrentActivity()
        }
    }
    
    @objc(disable)
    func disable() {
        DispatchQueue.main.async { [weak self] in
            self?.isModuleEnabled = false
            TextSelectionManager.shared.disable()
        }
    }
    
    @objc(isEnabled:rejecter:)
    func isEnabled(
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        resolve(isModuleEnabled)
    }
    
    // MARK: - Text Selection
    
    @objc(enableTextSelectionForActivity)
    func enableTextSelectionForCurrentActivity() {
        DispatchQueue.main.async { [weak self] in
            guard let viewController = UIApplication.topViewController() else { return }
            self?.enableTextSelection(in: viewController.view)
        }
    }
    
    @objc(enableTextSelectionForView:)
    func enableTextSelectionForView(_ viewTag: NSNumber) {
        DispatchQueue.main.async { [weak self] in
            guard let bridge = self?.bridge,
                  let view = bridge.uiManager.view(forReactTag: viewTag) else { return }
            self?.enableTextSelection(in: view)
        }
    }
    
    private func enableTextSelection(in view: UIView) {
        for subview in view.subviews {
            if let textView = subview as? UITextView {
                textView.isSelectable = true
                textView.signLanguageEnabled = true
            } else if let label = subview as? UILabel {
                // Enable user interaction for labels
                label.isUserInteractionEnabled = true
                // Add long press gesture for selection
                addLongPressGesture(to: label)
            }
            enableTextSelection(in: subview)
        }
    }
    
    private func addLongPressGesture(to label: UILabel) {
        let existingGestures = label.gestureRecognizers ?? []
        let hasSignLanguageGesture = existingGestures.contains { gesture in
            gesture.name == "SignLanguageLongPress"
        }
        
        if !hasSignLanguageGesture {
            let longPress = UILongPressGestureRecognizer(
                target: self,
                action: #selector(handleLabelLongPress(_:))
            )
            longPress.name = "SignLanguageLongPress"
            label.addGestureRecognizer(longPress)
        }
    }
    
    @objc private func handleLabelLongPress(_ gesture: UILongPressGestureRecognizer) {
        guard gesture.state == .began,
              let label = gesture.view as? UILabel,
              let text = label.text,
              !text.isEmpty else { return }
        
        // Show action sheet for text
        showTextSelectionMenu(for: text, from: label)
    }
    
    private func showTextSelectionMenu(for text: String, from view: UIView) {
        guard let viewController = UIApplication.topViewController() else { return }
        
        let alertController = UIAlertController(
            title: nil,
            message: text,
            preferredStyle: .actionSheet
        )
        
        let signLanguageAction = UIAlertAction(
            title: getLocalizedMenuTitle(),
            style: .default
        ) { [weak self] _ in
            self?.didSelectText(text)
        }
        
        let cancelAction = UIAlertAction(
            title: "İptal",
            style: .cancel
        )
        
        alertController.addAction(signLanguageAction)
        alertController.addAction(cancelAction)
        
        // iPad support
        if let popover = alertController.popoverPresentationController {
            popover.sourceView = view
            popover.sourceRect = view.bounds
        }
        
        viewController.present(alertController, animated: true)
    }
    
    // MARK: - Translation
    
    @objc(translateText:resolver:rejecter:)
    func translateText(
        text: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let apiService = apiService else {
            reject("CONFIG_ERROR", "SDK not configured", nil)
            return
        }
        
        if hasListeners {
            sendEvent(withName: "onTranslationStart", body: ["text": text])
        }
        
        apiService.getSignVideo(text: text) { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success(let signModel):
                    guard let videoUrl = self?.createVideoUrl(from: signModel) else {
                        if self?.hasListeners == true {
                            self?.sendEvent(withName: "onTranslationError",
                                           body: ["code": "VIDEO_ERROR", "message": "Invalid video URL"])
                        }
                        reject("VIDEO_ERROR", "Invalid video URL", nil)
                        return
                    }
                    
                    if self?.hasListeners == true {
                        self?.sendEvent(withName: "onTranslationComplete",
                                       body: ["videoUrl": videoUrl, "text": text])
                    }
                    self?.showBottomSheetInternal(videoUrl: videoUrl, text: text)
                    resolve(["videoUrl": videoUrl])
                    
                case .failure(let error):
                    if self?.hasListeners == true {
                        self?.sendEvent(withName: "onTranslationError",
                                       body: ["code": "API_ERROR", "message": error.localizedDescription])
                    }
                    reject("API_ERROR", error.localizedDescription, error)
                }
            }
        }
    }
    
    @objc(cancelTranslation)
    func cancelTranslation() {
        apiService?.cancelRequest()
    }
    
    // MARK: - Bottom Sheet
    
    @objc(showBottomSheet:text:resolver:rejecter:)
    func showBottomSheet(
        videoUrl: String,
        text: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        showBottomSheetInternal(videoUrl: videoUrl, text: text)
        resolve(nil)
    }
    
    private func showBottomSheetInternal(videoUrl: String, text: String) {
        DispatchQueue.main.async { [weak self] in
            guard let viewController = UIApplication.topViewController() else { return }
            
            let bottomSheet = SignLanguageBottomSheet()
            bottomSheet.configure(
                videoURL: videoUrl.replacingOccurrences(of: "http://", with: "https://"),
                text: text,
                title: self?.getLocalizedBusinessName() ?? "İşaret Dili"
            )
            bottomSheet.onDismiss = { [weak self] in
                if self?.hasListeners == true {
                    self?.sendEvent(withName: "onBottomSheetClose", body: nil)
                }
            }
            
            self?.bottomSheet = bottomSheet
            
            if #available(iOS 15.0, *) {
                if let sheet = bottomSheet.sheetPresentationController {
                    sheet.detents = [.medium(), .large()]
                    sheet.prefersGrabberVisible = true
                    sheet.preferredCornerRadius = 20
                }
            }
            
            viewController.present(bottomSheet, animated: true) { [weak self] in
                if self?.hasListeners == true {
                    self?.sendEvent(withName: "onBottomSheetOpen", body: nil)
                }
            }
        }
    }
    
    @objc(dismissBottomSheet)
    func dismissBottomSheet() {
        DispatchQueue.main.async { [weak self] in
            self?.bottomSheet?.dismiss(animated: true)
        }
    }
    
    @objc(isBottomSheetVisible:rejecter:)
    func isBottomSheetVisible(
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        resolve(bottomSheet?.isBeingPresented ?? false)
    }
    
    // MARK: - Helpers
    
    private func createVideoUrl(from model: SignModel) -> String? {
        guard let baseUrl = model.baseUrl, let name = model.name else { return nil }
        return "\(baseUrl)\(name)".replacingOccurrences(of: "http://", with: "https://")
    }
    
    private func getLocalizedMenuTitle() -> String {
        switch config?.language {
        case .turkish: return "İşaret Dili"
        case .english: return "Sign Language"
        case .arabic: return "لغة الإشارة"
        default: return "Sign Language"
        }
    }
    
    private func getLocalizedBusinessName() -> String {
        switch config?.language {
        case .turkish: return "Engelsiz Çeviri"
        case .english: return "SignForDeaf"
        case .arabic: return "لغة الإشارة"
        default: return "SignForDeaf"
        }
    }
}

// MARK: - TextSelectionManagerDelegate

extension SignLanguageModule: TextSelectionManagerDelegate {
    func didSelectText(_ text: String) {
        print("[SignLanguageSDK] didSelectText called with: '\(text)'")
        print("[SignLanguageSDK] hasListeners: \(hasListeners), isModuleEnabled: \(isModuleEnabled)")
        
        if hasListeners {
            sendEvent(withName: "onTextSelected", body: ["text": text])
            print("[SignLanguageSDK] Sent onTextSelected event")
        }
        
        // Show bottom sheet immediately with loading state
        print("[SignLanguageSDK] Opening bottom sheet with loading state...")
        showBottomSheetWithLoading(text: text)
    }
    
    private func showBottomSheetWithLoading(text: String) {
        DispatchQueue.main.async { [weak self] in
            guard let viewController = UIApplication.topViewController() else { return }
            guard let apiService = self?.apiService else {
                print("[SignLanguageSDK] ERROR: API service not configured")
                return
            }
            
            // Create and show bottom sheet immediately (loading state)
            let bottomSheet = SignLanguageBottomSheet()
            bottomSheet.configure(
                videoURL: "", // Empty URL - will show loading
                text: text,
                title: self?.getLocalizedBusinessName() ?? "İşaret Dili"
            )
            bottomSheet.onDismiss = { [weak self] in
                if self?.hasListeners == true {
                    self?.sendEvent(withName: "onBottomSheetClose", body: nil)
                }
            }
            
            self?.bottomSheet = bottomSheet
            
            if #available(iOS 15.0, *) {
                if let sheet = bottomSheet.sheetPresentationController {
                    sheet.detents = [.medium(), .large()]
                    sheet.prefersGrabberVisible = true
                    sheet.preferredCornerRadius = 20
                }
            }
            
            viewController.present(bottomSheet, animated: true) { [weak self] in
                if self?.hasListeners == true {
                    self?.sendEvent(withName: "onBottomSheetOpen", body: nil)
                }
                
                // Start translation after bottom sheet is presented
                self?.startTranslation(text: text, apiService: apiService, bottomSheet: bottomSheet)
            }
        }
    }
    
    private func startTranslation(text: String, apiService: SignLanguageAPIService, bottomSheet: SignLanguageBottomSheet) {
        if hasListeners {
            sendEvent(withName: "onTranslationStart", body: ["text": text])
        }
        
        print("[SignLanguageSDK] Starting translation...")
        
        apiService.getSignVideo(text: text) { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success(let signModel):
                    guard let videoUrl = self?.createVideoUrl(from: signModel) else {
                        if self?.hasListeners == true {
                            self?.sendEvent(withName: "onTranslationError",
                                           body: ["code": "VIDEO_ERROR", "message": "Invalid video URL"])
                        }
                        print("[SignLanguageSDK] Translation rejected: VIDEO_ERROR - Invalid video URL")
                        return
                    }
                    
                    if self?.hasListeners == true {
                        self?.sendEvent(withName: "onTranslationComplete",
                                       body: ["videoUrl": videoUrl, "text": text])
                    }
                    
                    // Update bottom sheet with video URL
                    let secureUrl = videoUrl.replacingOccurrences(of: "http://", with: "https://")
                    bottomSheet.updateVideoURL(secureUrl)
                    print("[SignLanguageSDK] Translation resolved: \(videoUrl)")
                    
                case .failure(let error):
                    if self?.hasListeners == true {
                        self?.sendEvent(withName: "onTranslationError",
                                       body: ["code": "API_ERROR", "message": error.localizedDescription])
                    }
                    print("[SignLanguageSDK] Translation rejected: API_ERROR - \(error.localizedDescription)")
                }
            }
        }
    }
}
