// ios/SignLanguageTranslation/TextSelection/GlobalTextSelectionSwizzler.swift

import ObjectiveC
import UIKit

// Helper function to safely try KVC without crashing
func catchObjCException<T>(_ block: () -> T?) -> T? {
    var result: T?
    let success = tryObjCBlock {
        result = block()
    }
    return success ? result : nil
}

@inline(__always)
func tryObjCBlock(_ block: () -> Void) -> Bool {
    let success = true
    autoreleasepool {
        block()
    }
    return success
}

/// This class uses method swizzling to inject "Sign Language" menu item
/// into ALL UITextView and UITextField instances in the app automatically.
/// Users don't need to use any special components - the SDK works with native texts.
@objc public class GlobalTextSelectionSwizzler: NSObject {

    private static var hasSwizzled = false
    private static var viewObserver: AnyObject?

    /// Call this once during SDK initialization to enable global text selection menu
    @objc public static func enableGlobalSignLanguageMenu() {
        guard !hasSwizzled else { return }
        hasSwizzled = true

        NSLog("[SignLanguageSDK] 🚀 Enabling global sign language menu...")

        swizzleUITextView()
        swizzleRCTTextView()  // Add React Native Text support (Old Architecture)
        swizzleRCTParagraphComponentView()  // Add React Native Text support (New Architecture/Fabric)
        setupGlobalMenuItems()
        startObservingViews()

        // Make existing views selectable
        DispatchQueue.main.async {
            makeAllTextViewsSelectable()
        }

        NSLog("[SignLanguageSDK] ✅ Global sign language menu enabled!")
    }

    private static func setupGlobalMenuItems() {
        // Setup immediately
        setupMenuItemsSync()

        // Also setup on main queue to ensure UI is ready
        DispatchQueue.main.async {
            setupMenuItemsSync()
        }

        // Setup again after a small delay to catch any race conditions
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            setupMenuItemsSync()
        }
    }

    private static func setupMenuItemsSync() {
        let menuController = UIMenuController.shared

        // Use NSSelectorFromString to ensure consistent selector
        let signLanguageSelector = NSSelectorFromString("signLanguageTranslateAction:")

        let signLanguageItem = UIMenuItem(
            title: TextSelectionManager.shared.getMenuTitle(),
            action: signLanguageSelector
        )

        // Keep existing menu items and add our custom one
        var existingItems = menuController.menuItems ?? []
        existingItems.removeAll { $0.action == signLanguageSelector }
        existingItems.append(signLanguageItem)
        menuController.menuItems = existingItems
    }

    // MARK: - View Observer for Auto-Selectable

    private static var scanTimer: Timer?
    private static var processedViewIds = Set<ObjectIdentifier>()

    private static func startObservingViews() {
        // Observe window changes to make new text views selectable
        NotificationCenter.default.addObserver(
            forName: UIWindow.didBecomeKeyNotification,
            object: nil,
            queue: .main
        ) { _ in
            scanAllViewsForText()
            setupMenuItemsSync()
        }

        // Observe scene activation (iOS 13+)
        if #available(iOS 13.0, *) {
            NotificationCenter.default.addObserver(
                forName: UIScene.didActivateNotification,
                object: nil,
                queue: .main
            ) { _ in
                scanAllViewsForText()
                setupMenuItemsSync()
            }
        }

        // Observe when menu is about to show - ensure our item is there
        NotificationCenter.default.addObserver(
            forName: UIMenuController.willShowMenuNotification,
            object: nil,
            queue: .main
        ) { _ in
            setupMenuItemsSync()
        }

        // Fast periodic scan for new views (every 0.5 seconds)
        scanTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
            scanAllViewsForText()
        }

        // Initial scan
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            scanAllViewsForText()
        }
    }

    /// Scan all windows for text views
    @objc public static func scanAllViewsForText() {
        guard let windows = getWindows() else {
            NSLog("[SignLanguageSDK] ⚠️ No windows found!")
            return
        }

        var foundCount = 0
        for window in windows {
            foundCount += countTextViews(window)
            scanViewForText(window)
        }
        if foundCount > 0 {
            NSLog(
                "[SignLanguageSDK] 📊 Found %d text views in %d windows", foundCount, windows.count)
        }
    }

    /// Count text views in hierarchy
    private static func countTextViews(_ view: UIView) -> Int {
        let className = String(describing: type(of: view))
        var count = 0

        if className.contains("ParagraphComponentView") || className == "RCTParagraphComponentView"
            || className == "RCTTextView"
        {
            count = 1
        }

        for subview in view.subviews {
            count += countTextViews(subview)
        }

        return count
    }

    /// Scan a view and its subviews for text components
    private static func scanViewForText(_ view: UIView) {
        // Check class name for React Native text components
        let className = String(describing: type(of: view))

        // Handle RCTParagraphComponentView (New Architecture/Fabric)
        if className.contains("ParagraphComponentView") || className == "RCTParagraphComponentView"
        {
            addSignLanguageGestureToParagraphView(view)
        }

        // Handle RCTTextView (Old Architecture)
        if className == "RCTTextView" {
            addSignLanguageGestureToRCTTextView(view)
        }

        // Handle standard UILabel
        if let label = view as? UILabel, label.text?.isEmpty == false {
            addSignLanguageGestureToLabel(label)
        }

        // Recurse into subviews
        for subview in view.subviews {
            scanViewForText(subview)
        }
    }

    /// Add gesture to RCTParagraphComponentView
    private static func addSignLanguageGestureToParagraphView(_ view: UIView) {
        let gestureName = "SignLanguageParagraphGesture"

        // Check if already has our gesture
        if let gestures = view.gestureRecognizers,
            gestures.contains(where: { $0.name == gestureName })
        {
            return
        }

        view.isUserInteractionEnabled = true

        let longPress = UILongPressGestureRecognizer(
            target: RCTParagraphComponentViewHandler.shared,
            action: #selector(RCTParagraphComponentViewHandler.handleParagraphLongPress(_:))
        )
        longPress.name = gestureName
        longPress.minimumPressDuration = 0.4
        longPress.cancelsTouchesInView = false
        longPress.delaysTouchesBegan = false
        view.addGestureRecognizer(longPress)

        NSLog("[SignLanguageSDK] ✅ Added gesture to RCTParagraphComponentView")
    }

    /// Add gesture to RCTTextView
    private static func addSignLanguageGestureToRCTTextView(_ view: UIView) {
        let gestureName = "SignLanguageRCTTextGesture"

        if let gestures = view.gestureRecognizers,
            gestures.contains(where: { $0.name == gestureName })
        {
            return
        }

        view.isUserInteractionEnabled = true

        let longPress = UILongPressGestureRecognizer(
            target: RCTTextViewHandler.shared,
            action: #selector(RCTTextViewHandler.handleRCTTextViewLongPress(_:))
        )
        longPress.name = gestureName
        longPress.minimumPressDuration = 0.4
        longPress.cancelsTouchesInView = false
        longPress.delaysTouchesBegan = false
        view.addGestureRecognizer(longPress)

        NSLog("[SignLanguageSDK] ✅ Added gesture to RCTTextView")
    }

    /// Add gesture to UILabel
    private static func addSignLanguageGestureToLabel(_ label: UILabel) {
        let gestureName = "SignLanguageLabelGesture"

        if let gestures = label.gestureRecognizers,
            gestures.contains(where: { $0.name == gestureName })
        {
            return
        }

        label.isUserInteractionEnabled = true

        let longPress = UILongPressGestureRecognizer(
            target: SignLanguageLabelHandler.shared,
            action: #selector(SignLanguageLabelHandler.handleLabelLongPress(_:))
        )
        longPress.name = gestureName
        longPress.minimumPressDuration = 0.4
        label.addGestureRecognizer(longPress)

        NSLog(
            "[SignLanguageSDK] ✅ Added gesture to UILabel: %@",
            label.text?.prefix(20).description ?? "nil")
    }

    /// Makes all UITextView instances in the app selectable (legacy method)
    @objc public static func makeAllTextViewsSelectable() {
        scanAllViewsForText()
    }

    private static func getWindows() -> [UIWindow]? {
        if #available(iOS 15.0, *) {
            return UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
        } else {
            return UIApplication.shared.windows
        }
    }

    private static func makeViewsSelectable(in view: UIView) {
        // Handle UITextView
        if let textView = view as? UITextView {
            if !textView.isEditable {
                textView.isSelectable = true
                textView.isUserInteractionEnabled = true
            }
        }

        // Handle UILabel - make it tappable for long press
        if let label = view as? UILabel {
            makeUILabelSelectable(label)
        }

        // Handle RCTTextView (React Native Text component - Old Architecture)
        let className = String(describing: type(of: view))
        if className == "RCTTextView" {
            makeRCTTextViewSelectable(view)
        }

        // Handle RCTParagraphComponentView (React Native Text component - New Architecture/Fabric)
        if className == "RCTParagraphComponentView" || className.contains("ParagraphComponentView")
        {
            makeRCTParagraphComponentViewSelectable(view)
        }

        // Recurse into subviews
        for subview in view.subviews {
            makeViewsSelectable(in: subview)
        }
    }

    /// Make RCTParagraphComponentView support Sign Language menu (New Architecture)
    private static func makeRCTParagraphComponentViewSelectable(_ view: UIView) {
        // Check if already has our gesture
        let existingGestures = view.gestureRecognizers ?? []
        let hasGesture = existingGestures.contains { $0.name == "SignLanguageParagraphPress" }

        if !hasGesture {
            view.isUserInteractionEnabled = true

            // Add long press gesture for showing Sign Language menu
            let longPress = UILongPressGestureRecognizer(
                target: RCTParagraphComponentViewHandler.shared,
                action: #selector(RCTParagraphComponentViewHandler.handleParagraphLongPress(_:))
            )
            longPress.name = "SignLanguageParagraphPress"
            longPress.minimumPressDuration = 0.5
            longPress.cancelsTouchesInView = false
            longPress.delaysTouchesBegan = false
            view.addGestureRecognizer(longPress)

        }
    }

    /// Make RCTTextView support Sign Language menu
    private static func makeRCTTextViewSelectable(_ view: UIView) {
        // Check if already has our gesture
        let existingGestures = view.gestureRecognizers ?? []
        let hasGesture = existingGestures.contains { $0.name == "SignLanguageRCTTextPress" }

        if !hasGesture {
            view.isUserInteractionEnabled = true

            // Add long press gesture for showing Sign Language menu
            let longPress = UILongPressGestureRecognizer(
                target: RCTTextViewHandler.shared,
                action: #selector(RCTTextViewHandler.handleRCTTextViewLongPress(_:))
            )
            longPress.name = "SignLanguageRCTTextPress"
            longPress.minimumPressDuration = 0.5
            longPress.cancelsTouchesInView = false
            longPress.delaysTouchesBegan = false
            view.addGestureRecognizer(longPress)
        }
    }

    private static func makeUILabelSelectable(_ label: UILabel) {
        // Check if already has our gesture
        let existingGestures = label.gestureRecognizers ?? []
        let hasGesture = existingGestures.contains { $0.name == "SignLanguageLabelPress" }

        if !hasGesture && label.text?.isEmpty == false {
            label.isUserInteractionEnabled = true

            let longPress = UILongPressGestureRecognizer(
                target: SignLanguageLabelHandler.shared,
                action: #selector(SignLanguageLabelHandler.handleLabelLongPress(_:))
            )
            longPress.name = "SignLanguageLabelPress"
            label.addGestureRecognizer(longPress)
        }
    }

    // MARK: - UITextView Swizzling

    private static func swizzleUITextView() {
        // Swizzle standard UITextView
        swizzleClass(UITextView.self)

        // Also try to swizzle React Native's text classes
        // RCTUITextView is what React Native uses for selectable Text
        if let rctUITextViewClass = NSClassFromString("RCTUITextView") as? UITextView.Type {
            swizzleClass(rctUITextViewClass)
        }

        // RCTTextView is also used in some RN versions
        if let rctTextViewClass = NSClassFromString("RCTTextView") {
            swizzleClassDynamic(rctTextViewClass)
        }

        // RCTMultilineTextInputView
        if let rctMultilineClass = NSClassFromString("RCTMultilineTextInputView")
            as? UITextView.Type
        {
            swizzleClass(rctMultilineClass)
        }
    }

    // MARK: - RCTTextView Swizzling (React Native 0.70+)

    /// Swizzle RCTTextView which is a UIView subclass (not UITextView) used in React Native
    /// This is needed because RCTTextView uses UIEditMenuInteraction on iOS 16+
    private static func swizzleRCTTextView() {
        guard let rctTextViewClass = NSClassFromString("RCTTextView") else {
            return
        }

        // Swizzle canPerformAction:withSender:
        let canPerformSelector = NSSelectorFromString("canPerformAction:withSender:")
        let swizzledCanPerformSelector = #selector(
            UIView.sl_rctTextView_canPerformAction(_:withSender:))

        if let originalMethod = class_getInstanceMethod(rctTextViewClass, canPerformSelector),
            let swizzledMethod = class_getInstanceMethod(UIView.self, swizzledCanPerformSelector)
        {

            // Add swizzled method to RCTTextView first
            let didAdd = class_addMethod(
                rctTextViewClass,
                swizzledCanPerformSelector,
                method_getImplementation(swizzledMethod),
                method_getTypeEncoding(swizzledMethod)
            )

            if didAdd,
                let newSwizzledMethod = class_getInstanceMethod(
                    rctTextViewClass, swizzledCanPerformSelector)
            {
                method_exchangeImplementations(originalMethod, newSwizzledMethod)
            }
        }

        // Add signLanguageTranslateAction: method to RCTTextView
        let signLanguageSelector = NSSelectorFromString("signLanguageTranslateAction:")
        let implementationSelector = #selector(
            UIView.sl_rctTextView_signLanguageTranslateAction(_:))

        if class_getInstanceMethod(rctTextViewClass, signLanguageSelector) == nil,
            let sourceMethod = class_getInstanceMethod(UIView.self, implementationSelector)
        {
            class_addMethod(
                rctTextViewClass,
                signLanguageSelector,
                method_getImplementation(sourceMethod),
                method_getTypeEncoding(sourceMethod)
            )
        }

        // iOS 16+ - Swizzle editMenuInteraction:menuForConfiguration:suggestedActions:
        if #available(iOS 16.0, *) {
            swizzleRCTTextViewEditMenu(rctTextViewClass)
        }
    }

    @available(iOS 16.0, *)
    private static func swizzleRCTTextViewEditMenu(_ rctTextViewClass: AnyClass) {
        // Swizzle UIEditMenuInteractionDelegate method
        let menuForConfigSelector = NSSelectorFromString(
            "editMenuInteraction:menuForConfiguration:suggestedActions:")
        let swizzledMenuSelector = #selector(
            UIView.sl_editMenuInteraction(_:menuForConfiguration:suggestedActions:))

        if let originalMethod = class_getInstanceMethod(rctTextViewClass, menuForConfigSelector),
            let swizzledMethod = class_getInstanceMethod(UIView.self, swizzledMenuSelector)
        {

            let didAdd = class_addMethod(
                rctTextViewClass,
                swizzledMenuSelector,
                method_getImplementation(swizzledMethod),
                method_getTypeEncoding(swizzledMethod)
            )

            if didAdd,
                let newSwizzledMethod = class_getInstanceMethod(
                    rctTextViewClass, swizzledMenuSelector)
            {
                method_exchangeImplementations(originalMethod, newSwizzledMethod)
            }
        }
    }

    // MARK: - RCTParagraphComponentView Swizzling (React Native 0.74+ New Architecture/Fabric)

    /// Swizzle RCTParagraphComponentView which is used in React Native New Architecture (Fabric)
    /// This is the text component used when New Architecture is enabled
    private static func swizzleRCTParagraphComponentView() {
        guard let paragraphClass = NSClassFromString("RCTParagraphComponentView") else {
            return
        }

        // Swizzle canPerformAction:withSender:
        let canPerformSelector = NSSelectorFromString("canPerformAction:withSender:")
        let swizzledCanPerformSelector = #selector(
            UIView.sl_paragraphComponentView_canPerformAction(_:withSender:))

        if let originalMethod = class_getInstanceMethod(paragraphClass, canPerformSelector),
            let swizzledMethod = class_getInstanceMethod(UIView.self, swizzledCanPerformSelector)
        {

            let didAdd = class_addMethod(
                paragraphClass,
                swizzledCanPerformSelector,
                method_getImplementation(swizzledMethod),
                method_getTypeEncoding(swizzledMethod)
            )

            if didAdd,
                let newSwizzledMethod = class_getInstanceMethod(
                    paragraphClass, swizzledCanPerformSelector)
            {
                method_exchangeImplementations(originalMethod, newSwizzledMethod)
            }
        }

        // Add signLanguageTranslateAction: method
        let signLanguageSelector = NSSelectorFromString("signLanguageTranslateAction:")
        let implementationSelector = #selector(
            UIView.sl_paragraphComponentView_signLanguageTranslateAction(_:))

        if class_getInstanceMethod(paragraphClass, signLanguageSelector) == nil,
            let sourceMethod = class_getInstanceMethod(UIView.self, implementationSelector)
        {
            class_addMethod(
                paragraphClass,
                signLanguageSelector,
                method_getImplementation(sourceMethod),
                method_getTypeEncoding(sourceMethod)
            )
        }

        // iOS 16+ - Swizzle editMenuInteraction:menuForConfiguration:suggestedActions:
        if #available(iOS 16.0, *) {
            swizzleRCTParagraphComponentViewEditMenu(paragraphClass)
        }
    }

    @available(iOS 16.0, *)
    private static func swizzleRCTParagraphComponentViewEditMenu(_ paragraphClass: AnyClass) {
        // Swizzle UIEditMenuInteractionDelegate method
        let menuForConfigSelector = NSSelectorFromString(
            "editMenuInteraction:menuForConfiguration:suggestedActions:")
        let swizzledMenuSelector = #selector(
            UIView.sl_paragraphComponentView_editMenuInteraction(
                _:menuForConfiguration:suggestedActions:))

        if let originalMethod = class_getInstanceMethod(paragraphClass, menuForConfigSelector),
            let swizzledMethod = class_getInstanceMethod(UIView.self, swizzledMenuSelector)
        {

            let didAdd = class_addMethod(
                paragraphClass,
                swizzledMenuSelector,
                method_getImplementation(swizzledMethod),
                method_getTypeEncoding(swizzledMethod)
            )

            if didAdd,
                let newSwizzledMethod = class_getInstanceMethod(
                    paragraphClass, swizzledMenuSelector)
            {
                method_exchangeImplementations(originalMethod, newSwizzledMethod)
            }
        }
    }

    private static func swizzleClass(_ cls: UITextView.Type) {
        let originalSelector = #selector(UITextView.canPerformAction(_:withSender:))
        let swizzledSelector = #selector(UITextView.sl_canPerformAction(_:withSender:))

        guard let originalMethod = class_getInstanceMethod(cls, originalSelector),
            let swizzledMethod = class_getInstanceMethod(cls, swizzledSelector)
        else {
            return
        }

        method_exchangeImplementations(originalMethod, swizzledMethod)
    }

    private static func swizzleClassDynamic(_ cls: AnyClass) {
        let originalSelector = #selector(UITextView.canPerformAction(_:withSender:))
        let swizzledSelector = #selector(UITextView.sl_canPerformAction(_:withSender:))

        guard let originalMethod = class_getInstanceMethod(cls, originalSelector),
            let swizzledMethod = class_getInstanceMethod(UITextView.self, swizzledSelector)
        else {
            return
        }

        // Add the swizzled method to the target class first
        let didAddMethod = class_addMethod(
            cls,
            swizzledSelector,
            method_getImplementation(swizzledMethod),
            method_getTypeEncoding(swizzledMethod)
        )

        if didAddMethod {
            if let newSwizzledMethod = class_getInstanceMethod(cls, swizzledSelector) {
                method_exchangeImplementations(originalMethod, newSwizzledMethod)
            }
        }

        // Also add signLanguageTranslateAction method to this class
        addSignLanguageActionMethod(to: cls)
    }

    private static func addSignLanguageActionMethod(to cls: AnyClass) {
        let actionSelector = NSSelectorFromString("signLanguageTranslateAction:")

        // Check if method already exists
        if class_getInstanceMethod(cls, actionSelector) != nil {
            return
        }

        // Get the implementation from UITextView
        guard let sourceMethod = class_getInstanceMethod(UITextView.self, actionSelector) else {
            return
        }

        class_addMethod(
            cls,
            actionSelector,
            method_getImplementation(sourceMethod),
            method_getTypeEncoding(sourceMethod)
        )
    }

    /// Update menu title (called when language changes)
    @objc public static func updateMenuTitle(_ title: String) {
        setupGlobalMenuItems()
    }
}

// MARK: - SignLanguageLabelHandler for UILabel Long Press

@objc class SignLanguageLabelHandler: NSObject {

    static let shared = SignLanguageLabelHandler()

    @objc func handleLabelLongPress(_ gesture: UILongPressGestureRecognizer) {
        guard gesture.state == .began,
            let label = gesture.view as? UILabel,
            let text = label.text,
            !text.isEmpty
        else { return }

        // Show action sheet
        guard let viewController = UIApplication.topViewController() else { return }

        let alertController = UIAlertController(
            title: nil,
            message: text,
            preferredStyle: .actionSheet
        )

        let signLanguageAction = UIAlertAction(
            title: TextSelectionManager.shared.getMenuTitle(),
            style: .default
        ) { _ in
            TextSelectionManager.shared.handleSelectedText(text)
        }

        let cancelAction = UIAlertAction(
            title: "İptal",
            style: .cancel
        )

        alertController.addAction(signLanguageAction)
        alertController.addAction(cancelAction)

        // iPad support
        if let popover = alertController.popoverPresentationController {
            popover.sourceView = label
            popover.sourceRect = label.bounds
        }

        viewController.present(alertController, animated: true)
    }
}

// MARK: - RCTTextViewHandler for React Native Text Long Press

@objc class RCTTextViewHandler: NSObject {

    static let shared = RCTTextViewHandler()

    @objc func handleRCTTextViewLongPress(_ gesture: UILongPressGestureRecognizer) {
        guard gesture.state == .began,
            let rctTextView = gesture.view
        else { return }

        // Get text from RCTTextView
        guard let text = getTextFromRCTTextView(rctTextView), !text.isEmpty else {
            return
        }

        // Show action sheet with Sign Language option
        guard let viewController = UIApplication.topViewController() else { return }

        let alertController = UIAlertController(
            title: nil,
            message: text.count > 100 ? String(text.prefix(100)) + "..." : text,
            preferredStyle: .actionSheet
        )

        let signLanguageAction = UIAlertAction(
            title: TextSelectionManager.shared.getMenuTitle(),
            style: .default
        ) { _ in
            TextSelectionManager.shared.handleSelectedText(text)
        }

        let copyAction = UIAlertAction(
            title: "Kopyala",
            style: .default
        ) { _ in
            UIPasteboard.general.string = text
        }

        let cancelAction = UIAlertAction(
            title: "İptal",
            style: .cancel
        )

        alertController.addAction(signLanguageAction)
        alertController.addAction(copyAction)
        alertController.addAction(cancelAction)

        // iPad support
        if let popover = alertController.popoverPresentationController {
            popover.sourceView = rctTextView
            popover.sourceRect = rctTextView.bounds
        }

        viewController.present(alertController, animated: true)
    }

    private func getTextFromRCTTextView(_ view: UIView) -> String? {
        // Method 1: Try to get _textStorage
        if let ivar = class_getInstanceVariable(type(of: view), "_textStorage"),
            let textStorage = object_getIvar(view, ivar) as? NSTextStorage
        {
            return textStorage.string
        }

        // Method 2: Try accessibilityLabel
        if let label = view.accessibilityLabel, !label.isEmpty {
            return label
        }

        // Method 3: Search subviews
        return findTextInSubviews(view)
    }

    private func findTextInSubviews(_ view: UIView) -> String? {
        if let label = view as? UILabel, let text = label.text, !text.isEmpty {
            return text
        }

        if let textView = view as? UITextView, let text = textView.text, !text.isEmpty {
            return text
        }

        for subview in view.subviews {
            if let text = findTextInSubviews(subview) {
                return text
            }
        }

        return nil
    }
}

// MARK: - RCTParagraphComponentViewHandler for React Native New Architecture

@objc class RCTParagraphComponentViewHandler: NSObject {

    static let shared = RCTParagraphComponentViewHandler()

    @objc func handleParagraphLongPress(_ gesture: UILongPressGestureRecognizer) {
        guard gesture.state == .began,
            let paragraphView = gesture.view
        else { return }

        // Get text from RCTParagraphComponentView
        guard let text = getTextFromParagraphView(paragraphView), !text.isEmpty else {
            return
        }

        // Show action sheet with Sign Language option
        guard let viewController = UIApplication.topViewController() else { return }

        let alertController = UIAlertController(
            title: nil,
            message: text.count > 100 ? String(text.prefix(100)) + "..." : text,
            preferredStyle: .actionSheet
        )

        let signLanguageAction = UIAlertAction(
            title: TextSelectionManager.shared.getMenuTitle(),
            style: .default
        ) { _ in
            TextSelectionManager.shared.handleSelectedText(text)
        }

        let copyAction = UIAlertAction(
            title: "Kopyala",
            style: .default
        ) { _ in
            UIPasteboard.general.string = text
        }

        let cancelAction = UIAlertAction(
            title: "İptal",
            style: .cancel
        )

        alertController.addAction(signLanguageAction)
        alertController.addAction(copyAction)
        alertController.addAction(cancelAction)

        // iPad support
        if let popover = alertController.popoverPresentationController {
            popover.sourceView = paragraphView
            popover.sourceRect = paragraphView.bounds
        }

        viewController.present(alertController, animated: true)
    }

    private func getTextFromParagraphView(_ view: UIView) -> String? {
        // Method 1: Try attributedText selector (RCTParagraphComponentView has this)
        let attributedTextSelector = NSSelectorFromString("attributedText")
        if view.responds(to: attributedTextSelector),
            let result = view.perform(attributedTextSelector),
            let attributedText = result.takeUnretainedValue() as? NSAttributedString
        {
            return attributedText.string
        }

        // Method 2: Try accessibilityLabel which contains the text
        if let label = view.accessibilityLabel, !label.isEmpty {
            return label
        }

        // Method 3: Look for contentView (RCTParagraphTextView)
        let contentViewSelector = NSSelectorFromString("contentView")
        if view.responds(to: contentViewSelector),
            let result = view.perform(contentViewSelector),
            let contentView = result.takeUnretainedValue() as? UIView
        {
            if let label = contentView.accessibilityLabel, !label.isEmpty {
                return label
            }
        }

        // Method 4: Search subviews for text
        return findTextInSubviews(view)
    }

    private func findTextInSubviews(_ view: UIView) -> String? {
        if let label = view as? UILabel, let text = label.text, !text.isEmpty {
            return text
        }

        if let textView = view as? UITextView, let text = textView.text, !text.isEmpty {
            return text
        }

        for subview in view.subviews {
            if let text = findTextInSubviews(subview) {
                return text
            }
        }

        return nil
    }
}

// MARK: - UITextView Extension for Swizzled Method

extension UITextView {

    // Selector for the menu item
    private static let signLanguageSelector = NSSelectorFromString("signLanguageTranslateAction:")

    // This is the action method that will be called when user taps "Sign Language" menu
    @objc func signLanguageTranslateAction(_ sender: Any?) {
        // Try to get selected text safely
        var selectedText: String?

        // First try safe method
        selectedText = getSelectedTextSafely()

        // Fallback: try to find any UITextView in the view hierarchy with selected text
        if selectedText == nil || selectedText?.isEmpty == true {
            if let window = self.window {
                selectedText = findSelectedTextInViewHierarchy(window)
            }
        }

        if let text = selectedText, !text.isEmpty {
            TextSelectionManager.shared.handleSelectedText(text)
        }
    }

    private func findSelectedTextInViewHierarchy(_ view: UIView) -> String? {
        // Check if this view is a UITextView with selected text
        if let textView = view as? UITextView,
            let selectedRange = textView.selectedTextRange,
            let text = textView.text(in: selectedRange),
            !text.isEmpty
        {
            return text
        }

        // Check subviews recursively
        for subview in view.subviews {
            if let text = findSelectedTextInViewHierarchy(subview) {
                return text
            }
        }

        return nil
    }

    @objc func sl_canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
        // Check if it's our sign language action
        let signLanguageAction = NSSelectorFromString("signLanguageTranslateAction:")

        if action == signLanguageAction {
            // Safely get selected text using Objective-C runtime
            if let selectedText = getSelectedTextSafely(), !selectedText.isEmpty {
                return true
            }
            // If we can't get selected text, still show menu and let action handle it
            return true
        }

        // Call original implementation (which is now swizzled)
        return sl_canPerformAction(action, withSender: sender)
    }

    /// Safely get selected text using Objective-C runtime to avoid crashes on non-UITextView classes
    private func getSelectedTextSafely() -> String? {
        // Method 1: Check if this is RCTTextView - it has a special way to get selected text
        let className = String(describing: type(of: self))

        if className.contains("RCTTextView") || className.contains("RCTUITextView") {
            // Try to get text from RCTTextView's backing text input
            if let text = getSelectedTextFromRCTTextView() {
                return text
            }
        }

        // Method 2: Try to get selectedTextRange if the class supports it
        let selectedTextRangeSelector = NSSelectorFromString("selectedTextRange")

        if self.responds(to: selectedTextRangeSelector) {
            // Use performSelector to safely call the method
            if let result = self.perform(selectedTextRangeSelector),
                let textRange = result.takeUnretainedValue() as? UITextRange
            {
                // Now try to get text in range
                let textInRangeSelector = NSSelectorFromString("textInRange:")
                if self.responds(to: textInRangeSelector) {
                    if let textResult = self.perform(textInRangeSelector, with: textRange),
                        let text = textResult.takeUnretainedValue() as? String
                    {
                        return text
                    }
                }
            }
        }

        // Method 3: For RCTTextView, try to access the backing text view in subviews
        if let backingTextView = findBackingTextView(in: self) {
            if let selectedRange = backingTextView.selectedTextRange,
                let text = backingTextView.text(in: selectedRange)
            {
                return text
            }
        }

        return nil
    }

    /// Get selected text from RCTTextView using its internal structure
    private func getSelectedTextFromRCTTextView() -> String? {
        // Get _textStorage which contains the full text
        var fullText: String?
        if let textStorage = getIvarValue(named: "_textStorage") as? NSTextStorage {
            fullText = textStorage.string
        }

        // Try to find selected range from various sources

        // Method 1: Check if there's a selection interaction
        if #available(iOS 17.0, *) {
            _ = self.interactions
        }

        // Method 2: Look for _highlightLayer which might indicate selection
        _ = getIvarValue(named: "_highlightLayer") as? CALayer

        // Method 3: Check for selectedRange method via Objective-C runtime
        let selectors = [
            "selectedRange", "_selectedRange", "selectionRange", "_selectionRange",
            "selectedTextRange", "_selectedTextRange", "currentSelectedRange",
        ]

        for selectorName in selectors {
            let selector = NSSelectorFromString(selectorName)
            if self.responds(to: selector) {
                _ = self.perform(selector)
            }
        }

        // Method 4: Check superclass methods
        var currentClass: AnyClass? = type(of: self)
        while let cls = currentClass {
            var methodCount: UInt32 = 0
            if let methods = class_copyMethodList(cls, &methodCount) {
                for i in 0..<Int(methodCount) {
                    _ = methods[i]
                }
                free(methods)
            }
            currentClass = class_getSuperclass(cls)
            if cls == UIView.self { break }
        }

        // Method 5: Access UIMenuController's target - it knows what was selected
        _ = UIMenuController.shared

        // Method 6: Check window's first responder for selection info
        _ = self.window?.value(forKey: "firstResponder") as? UIView

        // Method 7: Use UIPasteboard - if user selected text, they might copy it
        // Not ideal but fallback

        // Method 8: For React Native 0.73+, check textInputView
        let textInputSelectors = ["textInputView", "_textInputView", "backedTextInputView"]
        for selectorName in textInputSelectors {
            if let textInput = getPropertyValue(named: selectorName) as? UIView {
                // Check if it's a UITextView or UITextInput
                if let textView = textInput as? UITextView {
                    if let range = textView.selectedTextRange,
                        let text = textView.text(in: range),
                        !text.isEmpty
                    {
                        return text
                    }
                }
            }
        }

        // Last resort: If we can't find the selected range, return the full text
        // and let the user see the translation for all of it
        if let text = fullText, !text.isEmpty {
            return text
        }

        return nil
    }

    private func getPropertyValue(named name: String) -> Any? {
        let selector = NSSelectorFromString(name)
        if self.responds(to: selector) {
            return self.perform(selector)?.takeUnretainedValue()
        }
        return nil
    }

    private func getIvarValue(named name: String) -> Any? {
        guard let ivar = class_getInstanceVariable(type(of: self), name) else { return nil }
        return object_getIvar(self, ivar)
    }

    private func findSelectedTextInSubviews(_ view: UIView) -> String? {
        // Check if this is a UITextView with selected text
        if let textView = view as? UITextView {
            if let selectedRange = textView.selectedTextRange,
                let text = textView.text(in: selectedRange),
                !text.isEmpty
            {
                return text
            }
        }

        // Recursively check subviews
        for subview in view.subviews {
            if let text = findSelectedTextInSubviews(subview) {
                return text
            }
        }

        return nil
    }

    private func findBackingTextView(in view: UIView) -> UITextView? {
        // Check if this view is a UITextView
        if let textView = view as? UITextView {
            return textView
        }

        // Check subviews
        for subview in view.subviews {
            if let found = findBackingTextView(in: subview) {
                return found
            }
        }

        return nil
    }
}

// MARK: - UIView Extension for RCTTextView Support

extension UIView {

    /// Swizzled canPerformAction for RCTTextView
    @objc func sl_rctTextView_canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool
    {
        let signLanguageAction = NSSelectorFromString("signLanguageTranslateAction:")

        if action == signLanguageAction {
            // Always show Sign Language option for RCTTextView
            let className = String(describing: type(of: self))
            if className.contains("RCTTextView") {
                return true
            }
        }

        // Call original implementation (now swizzled)
        return sl_rctTextView_canPerformAction(action, withSender: sender)
    }

    /// Sign Language translate action for RCTTextView
    @objc func sl_rctTextView_signLanguageTranslateAction(_ sender: Any?) {
        // Get text from RCTTextView's _textStorage
        if let text = getRCTTextViewText() {
            TextSelectionManager.shared.handleSelectedText(text)
        }
    }

    /// Get text from RCTTextView using KVC
    private func getRCTTextViewText() -> String? {
        // Try to get _textStorage which contains the text
        let textStorageSelector = NSSelectorFromString("textStorage")

        // Method 1: Try _textStorage ivar directly
        if let textStorage = getIvarValueFromView(named: "_textStorage") as? NSTextStorage {
            return textStorage.string
        }

        // Method 2: Try via selector
        if self.responds(to: textStorageSelector),
            let result = self.perform(textStorageSelector),
            let textStorage = result.takeUnretainedValue() as? NSTextStorage
        {
            return textStorage.string
        }

        // Method 3: Try accessibilityLabel which usually contains the text
        if let label = self.accessibilityLabel, !label.isEmpty {
            return label
        }

        // Method 4: Search subviews for any text
        return findTextInSubviews(self)
    }

    private func getIvarValueFromView(named name: String) -> Any? {
        guard let ivar = class_getInstanceVariable(type(of: self), name) else { return nil }
        return object_getIvar(self, ivar)
    }

    private func findTextInSubviews(_ view: UIView) -> String? {
        // Check for UILabel
        if let label = view as? UILabel, let text = label.text, !text.isEmpty {
            return text
        }

        // Check for UITextView
        if let textView = view as? UITextView, let text = textView.text, !text.isEmpty {
            return text
        }

        // Recurse into subviews
        for subview in view.subviews {
            if let text = findTextInSubviews(subview) {
                return text
            }
        }

        return nil
    }

    /// iOS 16+ Edit Menu swizzled implementation for RCTTextView
    @available(iOS 16.0, *)
    @objc func sl_editMenuInteraction(
        _ interaction: UIEditMenuInteraction,
        menuForConfiguration configuration: UIEditMenuConfiguration,
        suggestedActions: [UIMenuElement]
    ) -> UIMenu? {
        // Create Sign Language action
        let signLanguageAction = UIAction(
            title: TextSelectionManager.shared.getMenuTitle(),
            image: UIImage(systemName: "hand.raised.fill")
        ) { [weak self] _ in
            self?.sl_rctTextView_signLanguageTranslateAction(nil)
        }

        // Get original menu by calling swizzled (original) implementation
        var menuElements: [UIMenuElement] = suggestedActions

        // Add our action at the beginning
        let signLanguageMenu = UIMenu(
            title: "", options: .displayInline, children: [signLanguageAction])
        menuElements.insert(signLanguageMenu, at: 0)

        return UIMenu(children: menuElements)
    }

    // MARK: - RCTParagraphComponentView Support (New Architecture/Fabric)

    /// Swizzled canPerformAction for RCTParagraphComponentView (Fabric)
    @objc func sl_paragraphComponentView_canPerformAction(
        _ action: Selector, withSender sender: Any?
    ) -> Bool {
        let signLanguageAction = NSSelectorFromString("signLanguageTranslateAction:")

        if action == signLanguageAction {
            let className = String(describing: type(of: self))
            if className.contains("RCTParagraphComponentView") {
                return true
            }
        }

        // Call original implementation (now swizzled)
        return sl_paragraphComponentView_canPerformAction(action, withSender: sender)
    }

    /// Sign Language translate action for RCTParagraphComponentView
    @objc func sl_paragraphComponentView_signLanguageTranslateAction(_ sender: Any?) {
        // Get text from RCTParagraphComponentView's attributedText
        if let text = getRCTParagraphComponentViewText() {
            TextSelectionManager.shared.handleSelectedText(text)
        }
    }

    /// Get text from RCTParagraphComponentView
    private func getRCTParagraphComponentViewText() -> String? {
        // Method 1: Try attributedText selector (available on RCTParagraphComponentView)
        let attributedTextSelector = NSSelectorFromString("attributedText")
        if self.responds(to: attributedTextSelector),
            let result = self.perform(attributedTextSelector),
            let attributedText = result.takeUnretainedValue() as? NSAttributedString
        {
            return attributedText.string
        }

        // Method 2: Try accessibilityLabel which contains the text
        if let label = self.accessibilityLabel, !label.isEmpty {
            return label
        }

        // Method 3: Try to get text from _textView subview
        if let textView = findContentView() {
            // Try accessibilityLabel of content view
            if let label = textView.accessibilityLabel, !label.isEmpty {
                return label
            }
        }

        // Method 4: Search in subviews
        return findTextInSubviews(self)
    }

    /// Find the content view (RCTParagraphTextView) inside RCTParagraphComponentView
    private func findContentView() -> UIView? {
        // RCTParagraphComponentView has a _textView (RCTParagraphTextView) as content view
        let contentViewSelector = NSSelectorFromString("contentView")
        if self.responds(to: contentViewSelector),
            let result = self.perform(contentViewSelector),
            let contentView = result.takeUnretainedValue() as? UIView
        {
            return contentView
        }

        // Fallback: first subview
        return self.subviews.first
    }

    /// iOS 16+ Edit Menu swizzled implementation for RCTParagraphComponentView
    @available(iOS 16.0, *)
    @objc func sl_paragraphComponentView_editMenuInteraction(
        _ interaction: UIEditMenuInteraction,
        menuForConfiguration configuration: UIEditMenuConfiguration,
        suggestedActions: [UIMenuElement]
    ) -> UIMenu? {
        // Create Sign Language action
        let signLanguageAction = UIAction(
            title: TextSelectionManager.shared.getMenuTitle(),
            image: UIImage(systemName: "hand.raised.fill")
        ) { [weak self] _ in
            self?.sl_paragraphComponentView_signLanguageTranslateAction(nil)
        }

        // Call original (swizzled) implementation to get original menu
        let originalMenu = sl_paragraphComponentView_editMenuInteraction(
            interaction, menuForConfiguration: configuration, suggestedActions: suggestedActions)

        // Create menu with Sign Language action added
        var menuElements: [UIMenuElement] = suggestedActions

        // Add our action at the beginning
        let signLanguageMenu = UIMenu(
            title: "", options: .displayInline, children: [signLanguageAction])
        menuElements.insert(signLanguageMenu, at: 0)

        return UIMenu(children: menuElements)
    }
}

// MARK: - UITextField Extension for Sign Language Action

extension UITextField {

    @objc func signLanguageTranslateAction(_ sender: Any?) {
        if let selectedRange = self.selectedTextRange,
            let selectedText = self.text(in: selectedRange),
            !selectedText.isEmpty
        {
            TextSelectionManager.shared.handleSelectedText(selectedText)
        }
    }
}

// MARK: - UIResponder Extension (fallback)

extension UIResponder {

    // Fallback method for responder chain
    @objc func sl_signLanguageTranslateAction(_ sender: Any?) {
        // Fallback - do nothing
    }
}
