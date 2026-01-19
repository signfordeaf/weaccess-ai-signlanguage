// ios/SignLanguageTranslation/TextSelection/GlobalTextSelectionSwizzler.swift

import UIKit
import ObjectiveC

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
    var success = true
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
        
        print("[SignLanguageSDK] Enabling global sign language menu...")
        
        swizzleUITextView()
        setupGlobalMenuItems()
        startObservingViews()
        
        // Make existing views selectable
        DispatchQueue.main.async {
            makeAllTextViewsSelectable()
        }
        
        print("[SignLanguageSDK] Global sign language menu enabled!")
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
        
        print("[SignLanguageSDK] Menu item '\(TextSelectionManager.shared.getMenuTitle())' added with selector: signLanguageTranslateAction:")
    }
    
    // MARK: - View Observer for Auto-Selectable
    
    private static func startObservingViews() {
        // Observe window changes to make new text views selectable
        NotificationCenter.default.addObserver(
            forName: UIWindow.didBecomeKeyNotification,
            object: nil,
            queue: .main
        ) { _ in
            makeAllTextViewsSelectable()
            setupMenuItemsSync() // Refresh menu items
        }
        
        // Observe scene activation (iOS 13+)
        if #available(iOS 13.0, *) {
            NotificationCenter.default.addObserver(
                forName: UIScene.didActivateNotification,
                object: nil,
                queue: .main
            ) { _ in
                makeAllTextViewsSelectable()
                setupMenuItemsSync() // Refresh menu items
            }
        }
        
        // Observe when menu is about to show - ensure our item is there
        NotificationCenter.default.addObserver(
            forName: UIMenuController.willShowMenuNotification,
            object: nil,
            queue: .main
        ) { _ in
            setupMenuItemsSync() // Ensure menu item exists before showing
        }
        
        // Periodic check for new views (every 2 seconds)
        Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { _ in
            makeAllTextViewsSelectable()
        }
    }
    
    /// Makes all UITextView instances in the app selectable
    @objc public static func makeAllTextViewsSelectable() {
        guard let windows = getWindows() else { return }
        
        for window in windows {
            makeViewsSelectable(in: window)
        }
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
        
        // Recurse into subviews
        for subview in view.subviews {
            makeViewsSelectable(in: subview)
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
            print("[SignLanguageSDK] RCTUITextView swizzled successfully")
        }
        
        // RCTTextView is also used in some RN versions
        if let rctTextViewClass = NSClassFromString("RCTTextView") {
            swizzleClassDynamic(rctTextViewClass)
            print("[SignLanguageSDK] RCTTextView swizzled successfully")
        }
        
        // RCTMultilineTextInputView
        if let rctMultilineClass = NSClassFromString("RCTMultilineTextInputView") as? UITextView.Type {
            swizzleClass(rctMultilineClass)
            print("[SignLanguageSDK] RCTMultilineTextInputView swizzled successfully")
        }
        
        print("[SignLanguageSDK] UITextView swizzled successfully")
    }
    
    private static func swizzleClass(_ cls: UITextView.Type) {
        let originalSelector = #selector(UITextView.canPerformAction(_:withSender:))
        let swizzledSelector = #selector(UITextView.sl_canPerformAction(_:withSender:))
        
        guard let originalMethod = class_getInstanceMethod(cls, originalSelector),
              let swizzledMethod = class_getInstanceMethod(cls, swizzledSelector) else {
            print("[SignLanguageSDK] Failed to get methods for \(cls)")
            return
        }
        
        method_exchangeImplementations(originalMethod, swizzledMethod)
        print("[SignLanguageSDK] Swizzled \(cls)")
    }
    
    private static func swizzleClassDynamic(_ cls: AnyClass) {
        let originalSelector = #selector(UITextView.canPerformAction(_:withSender:))
        let swizzledSelector = #selector(UITextView.sl_canPerformAction(_:withSender:))
        
        guard let originalMethod = class_getInstanceMethod(cls, originalSelector),
              let swizzledMethod = class_getInstanceMethod(UITextView.self, swizzledSelector) else {
            print("[SignLanguageSDK] Failed to get methods for dynamic class \(cls)")
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
                print("[SignLanguageSDK] Dynamically swizzled \(cls)")
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
        print("[SignLanguageSDK] Added signLanguageTranslateAction to \(cls)")
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
              !text.isEmpty else { return }
        
        print("[SignLanguageSDK] Label long pressed with text: \(text)")
        
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

// MARK: - UITextView Extension for Swizzled Method

extension UITextView {
    
    // Selector for the menu item
    private static let signLanguageSelector = NSSelectorFromString("signLanguageTranslateAction:")
    
    // This is the action method that will be called when user taps "Sign Language" menu
    @objc func signLanguageTranslateAction(_ sender: Any?) {
        print("[SignLanguageSDK] signLanguageTranslateAction called on \(type(of: self))")
        
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
            print("[SignLanguageSDK] Selected text: \(text)")
            TextSelectionManager.shared.handleSelectedText(text)
        } else {
            print("[SignLanguageSDK] No text selected")
        }
    }
    
    private func findSelectedTextInViewHierarchy(_ view: UIView) -> String? {
        // Check if this view is a UITextView with selected text
        if let textView = view as? UITextView,
           let selectedRange = textView.selectedTextRange,
           let text = textView.text(in: selectedRange),
           !text.isEmpty {
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
                print("[SignLanguageSDK] canPerformAction: showing sign language menu for text: \(selectedText.prefix(20))...")
                return true
            }
            // If we can't get selected text, still show menu and let action handle it
            print("[SignLanguageSDK] canPerformAction: showing sign language menu (couldn't verify text)")
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
               let textRange = result.takeUnretainedValue() as? UITextRange {
                // Now try to get text in range
                let textInRangeSelector = NSSelectorFromString("textInRange:")
                if self.responds(to: textInRangeSelector) {
                    if let textResult = self.perform(textInRangeSelector, with: textRange),
                       let text = textResult.takeUnretainedValue() as? String {
                        return text
                    }
                }
            }
        }
        
        // Method 3: For RCTTextView, try to access the backing text view in subviews
        if let backingTextView = findBackingTextView(in: self) {
            if let selectedRange = backingTextView.selectedTextRange,
               let text = backingTextView.text(in: selectedRange) {
                return text
            }
        }
        
        return nil
    }
    
    /// Get selected text from RCTTextView using its internal structure
    private func getSelectedTextFromRCTTextView() -> String? {
        print("[SignLanguageSDK] === Exploring RCTTextView ===")
        print("[SignLanguageSDK] Class: \(type(of: self))")
        
        // Get _textStorage which contains the full text
        var fullText: String?
        if let textStorage = getIvarValue(named: "_textStorage") as? NSTextStorage {
            fullText = textStorage.string
            print("[SignLanguageSDK] Found _textStorage with text: \(fullText?.prefix(50) ?? "nil")...")
        }
        
        // Try to find selected range from various sources
        
        // Method 1: Check if there's a selection interaction
        if #available(iOS 17.0, *) {
            for interaction in self.interactions {
                print("[SignLanguageSDK] Interaction: \(type(of: interaction))")
            }
        }
        
        // Method 2: Look for _highlightLayer which might indicate selection
        if let highlightLayer = getIvarValue(named: "_highlightLayer") as? CALayer {
            print("[SignLanguageSDK] Found _highlightLayer: \(highlightLayer)")
            // The highlight layer bounds might give us clues about selection
        }
        
        // Method 3: Check for selectedRange method via Objective-C runtime
        let selectors = ["selectedRange", "_selectedRange", "selectionRange", "_selectionRange", 
                         "selectedTextRange", "_selectedTextRange", "currentSelectedRange"]
        
        for selectorName in selectors {
            let selector = NSSelectorFromString(selectorName)
            if self.responds(to: selector) {
                print("[SignLanguageSDK] Found selector: \(selectorName)")
                // Try to invoke it
                let result = self.perform(selector)
                if let rangeValue = result?.takeUnretainedValue() {
                    print("[SignLanguageSDK] \(selectorName) returned: \(rangeValue)")
                }
            }
        }
        
        // Method 4: Check superclass methods
        var currentClass: AnyClass? = type(of: self)
        while let cls = currentClass {
            var methodCount: UInt32 = 0
            if let methods = class_copyMethodList(cls, &methodCount) {
                for i in 0..<Int(methodCount) {
                    let method = methods[i]
                    let selector = method_getName(method)
                    let selectorName = NSStringFromSelector(selector)
                    if selectorName.lowercased().contains("select") || selectorName.lowercased().contains("range") {
                        print("[SignLanguageSDK] Method in \(cls): \(selectorName)")
                    }
                }
                free(methods)
            }
            currentClass = class_getSuperclass(cls)
            if cls == UIView.self { break }
        }
        
        // Method 5: Access UIMenuController's target - it knows what was selected
        let menuController = UIMenuController.shared
        print("[SignLanguageSDK] UIMenuController menuFrame: \(menuController.menuFrame)")
        
        // Method 6: Check window's first responder for selection info
        if let window = self.window, let firstResponder = window.value(forKey: "firstResponder") as? UIView {
            print("[SignLanguageSDK] First responder: \(type(of: firstResponder))")
        }
        
        // Method 7: Use UIPasteboard - if user selected text, they might copy it
        // Not ideal but fallback
        
        // Method 8: For React Native 0.73+, check textInputView
        let textInputSelectors = ["textInputView", "_textInputView", "backedTextInputView"]
        for selectorName in textInputSelectors {
            if let textInput = getPropertyValue(named: selectorName) as? UIView {
                print("[SignLanguageSDK] Found \(selectorName): \(type(of: textInput))")
                
                // Check if it's a UITextView or UITextInput
                if let textView = textInput as? UITextView {
                    if let range = textView.selectedTextRange,
                       let text = textView.text(in: range),
                       !text.isEmpty {
                        print("[SignLanguageSDK] Got selected text from \(selectorName): \(text)")
                        return text
                    }
                }
            }
        }
        
        // Last resort: If we can't find the selected range, return the full text
        // and let the user see the translation for all of it
        if let text = fullText, !text.isEmpty {
            print("[SignLanguageSDK] Could not find selection, using full text")
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
    
    private func printViewHierarchy(_ view: UIView, indent: Int) {
        let prefix = String(repeating: "  ", count: indent)
        print("[SignLanguageSDK] \(prefix)\(type(of: view))")
        
        // Check if it's a text-related view
        if let textView = view as? UITextView {
            print("[SignLanguageSDK] \(prefix)  -> UITextView found! text: \(textView.text?.prefix(30) ?? "nil")")
            if let range = textView.selectedTextRange, let selected = textView.text(in: range) {
                print("[SignLanguageSDK] \(prefix)  -> Selected: \(selected)")
            }
        }
        
        if let label = view as? UILabel {
            print("[SignLanguageSDK] \(prefix)  -> UILabel: \(label.text?.prefix(30) ?? "nil")")
        }
        
        // Print text-related properties via KVC
        for key in ["text", "attributedText"] {
            if view.responds(to: NSSelectorFromString(key)) {
                if let value = view.value(forKey: key) {
                    print("[SignLanguageSDK] \(prefix)  -> \(key): \(String(describing: value).prefix(50))")
                }
            }
        }
        
        for subview in view.subviews {
            printViewHierarchy(subview, indent: indent + 1)
        }
    }
    
    private func findSelectedTextInSubviews(_ view: UIView) -> String? {
        // Check if this is a UITextView with selected text
        if let textView = view as? UITextView {
            if let selectedRange = textView.selectedTextRange,
               let text = textView.text(in: selectedRange),
               !text.isEmpty {
                print("[SignLanguageSDK] Found UITextView with selected text: \(text)")
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

// MARK: - UITextField Extension for Sign Language Action

extension UITextField {
    
    @objc func signLanguageTranslateAction(_ sender: Any?) {
        print("[SignLanguageSDK] signLanguageTranslateAction called on UITextField")
        
        if let selectedRange = self.selectedTextRange,
           let selectedText = self.text(in: selectedRange),
           !selectedText.isEmpty {
            print("[SignLanguageSDK] Selected text: \(selectedText)")
            TextSelectionManager.shared.handleSelectedText(selectedText)
        }
    }
}

// MARK: - UIResponder Extension (fallback)

extension UIResponder {
    
    // Fallback method for responder chain
    @objc func sl_signLanguageTranslateAction(_ sender: Any?) {
        print("[SignLanguageSDK] sl_signLanguageTranslateAction called on UIResponder (fallback)")
    }
}
