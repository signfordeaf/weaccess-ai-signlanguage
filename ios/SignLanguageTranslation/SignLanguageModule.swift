import Foundation
import UIKit
import React

/**
 The whole native surface of the SDK on iOS.

 v2 moved the player, the translation flow, the API client and tap
 classification into TypeScript, shared with Android. What is left is the one
 thing JavaScript cannot do: add a "Sign Language" item to the system's
 text-selection menu, for text the host app already made selectable.

 Three things the v1 module did are deliberately gone:

  - The 0.5 s `Timer` that walked every window's entire view hierarchy, attaching
    gesture recognisers, and which was never invalidated — not even by `disable()`.
  - The per-view tap and long-press recognisers. Tap-to-translate is now
    classified in JavaScript against the React tree, which is cheaper and can
    tell a button's label from its box.
  - The bottom sheet and its `AVPlayer`.

 What remains hooks exactly one class — `UITextView`, which is what backs React
 Native's selectable text on iOS — and only to offer a menu item.
 */
@objc(SignLanguageTranslation)
class SignLanguageModule: RCTEventEmitter {

    fileprivate static var isEnabled = false
    fileprivate static var language = "tr"
    fileprivate static weak var current: SignLanguageModule?

    private var hasListeners = false

    override init() {
        super.init()
        SignLanguageModule.current = self
    }

    // MARK: - RCTEventEmitter

    override static func requiresMainQueueSetup() -> Bool { true }

    override func supportedEvents() -> [String] { ["onTextSelected"] }

    override func startObserving() { hasListeners = true }
    override func stopObserving() { hasListeners = false }

    // MARK: - Bridge surface

    /// Only the language matters here: it localizes the menu item's title.
    @objc(configure:)
    func configure(_ language: String) {
        SignLanguageModule.language = language
        DispatchQueue.main.async { SelectionMenu.install() }
    }

    @objc(setEnabled:)
    func setEnabled(_ enabled: Bool) {
        SignLanguageModule.isEnabled = enabled
        DispatchQueue.main.async { SelectionMenu.install() }
    }

    /// Kept for API compatibility. Selection handling is global on iOS, so a
    /// per-view opt-in has nothing to do.
    @objc(enableTextSelectionForView:)
    func enableTextSelectionForView(_ viewTag: NSNumber) {}

    /**
     The key window's safe-area insets, in points.

     The SDK's floating surfaces keep themselves inside the reachable area, and
     the notch, the Dynamic Island and the home indicator are what define it.
     JavaScript can only guess at those from the screen size; the window knows.
     Resolves zeroes when there is no window yet, and the caller falls back to
     its own estimate.
     */
    @objc(getSafeAreaInsets:rejecter:)
    func getSafeAreaInsets(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async {
            guard let window = Self.keyWindow else {
                resolve(nil)
                return
            }
            let insets = window.safeAreaInsets
            resolve([
                "top": insets.top,
                "bottom": insets.bottom,
                "left": insets.left,
                "right": insets.right,
            ])
        }
    }

    private static var keyWindow: UIWindow? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }
    }

    // MARK: - Selection

    static var menuTitle: String {
        switch language {
        case "ar": return "لغة الإشارة"
        case "tr": return "İşaret Dili"
        default: return "Sign Language"
        }
    }

    static var enabled: Bool { isEnabled }

    /// Called by the swizzled action when the user picks the menu item.
    static func report(text: String) {
        guard isEnabled,
              !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let module = current,
              module.hasListeners
        else { return }

        module.sendEvent(withName: "onTextSelected", body: ["text": text])
    }
}

// MARK: - The menu item

/**
 Adds the item to the edit menu, and nothing else.

 The SDK must not force text to be selectable: v1 wrapped the app in a selection
 layer, which broke normal interaction. Selection-based translation is offered
 only where the host already made text selectable — and on iOS that is exactly
 where a `UITextView` exists.
 */
enum SelectionMenu {

    private static var installed = false

    static func install() {
        registerMenuItem()

        guard !installed else { return }
        installed = true

        // `UITextView` implements `canPerformAction(_:withSender:)` itself, so
        // exchanging here swaps that class's own implementation and leaves
        // every other responder alone.
        guard
            let original = class_getInstanceMethod(
                UITextView.self, #selector(UIResponder.canPerformAction(_:withSender:))),
            let replacement = class_getInstanceMethod(
                UITextView.self, #selector(UITextView.sl_canPerformAction(_:withSender:)))
        else { return }

        method_exchangeImplementations(original, replacement)
    }

    /// The item itself. Re-registered on each call so a language change lands.
    private static func registerMenuItem() {
        let item = UIMenuItem(
            title: SignLanguageModule.menuTitle,
            action: #selector(UITextView.sl_translate(_:))
        )
        let others = (UIMenuController.shared.menuItems ?? []).filter {
            $0.action != #selector(UITextView.sl_translate(_:))
        }
        UIMenuController.shared.menuItems = others + [item]
    }
}

extension UITextView {

    /// The action the menu item invokes.
    @objc func sl_translate(_ sender: Any?) {
        guard let text = sl_selectedText(), !text.isEmpty else { return }
        UIMenuController.shared.hideMenu()
        SignLanguageModule.report(text: text)
    }

    /// Swapped in for `canPerformAction`, to offer the item.
    ///
    /// The exchange means the call below reaches the original implementation,
    /// so every other menu item behaves exactly as it did.
    @objc func sl_canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
        if action == #selector(UITextView.sl_translate(_:)) {
            return SignLanguageModule.enabled && !(sl_selectedText() ?? "").isEmpty
        }
        return sl_canPerformAction(action, withSender: sender)
    }

    /// The current selection, if there is one.
    fileprivate func sl_selectedText() -> String? {
        guard let range = selectedTextRange, !range.isEmpty else { return nil }
        return text(in: range)
    }
}
