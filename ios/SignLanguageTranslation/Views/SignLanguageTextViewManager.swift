// ios/SignLanguageTranslation/Views/SignLanguageTextViewManager.swift

import UIKit

@objc(SignLanguageTextViewManager)
class SignLanguageTextViewManager: RCTViewManager {
    
    override func view() -> UIView! {
        let textView = SignLanguageSelectableTextView()
        return textView
    }
    
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
}

// MARK: - SignLanguageSelectableTextView

class SignLanguageSelectableTextView: UITextView, UITextViewDelegate {
    
    // MARK: - Properties for React Native
    @objc var fontSize: NSNumber = 16 {
        didSet {
            font = UIFont.systemFont(ofSize: CGFloat(truncating: fontSize))
        }
    }
    
    // Content property for React Native (using different name to avoid conflict with UITextView.text)
    @objc var content: String? {
        didSet {
            text = content
            invalidateIntrinsicContentSize()
        }
    }
    
    // Color property with different name to avoid conflict
    @objc var color: UIColor? {
        didSet {
            textColor = color ?? .black
        }
    }
    
    override init(frame: CGRect, textContainer: NSTextContainer?) {
        super.init(frame: frame, textContainer: textContainer)
        setup()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }
    
    private func setup() {
        isSelectable = true
        isEditable = false
        isScrollEnabled = false
        isUserInteractionEnabled = true
        textContainerInset = .zero
        textContainer.lineFragmentPadding = 0
        backgroundColor = .clear
        font = UIFont.systemFont(ofSize: 16)
        delegate = self
        
        // Register for menu notifications
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(menuWillShow),
            name: UIMenuController.willShowMenuNotification,
            object: nil
        )
        
        // Add custom menu item
        setupCustomMenu()
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    private func setupCustomMenu() {
        // Use the same selector as GlobalTextSelectionSwizzler
        let signLanguageItem = UIMenuItem(
            title: TextSelectionManager.shared.getMenuTitle(),
            action: NSSelectorFromString("signLanguageTranslateAction:")
        )
        UIMenuController.shared.menuItems = [signLanguageItem]
        print("[SignLanguageSDK] SignLanguageSelectableTextView - Menu setup with selector: signLanguageTranslateAction:")
    }
    
    @objc private func menuWillShow(_ notification: Notification) {
        setupCustomMenu()
    }
    
    override var intrinsicContentSize: CGSize {
        let size = sizeThatFits(CGSize(width: bounds.width > 0 ? bounds.width : UIScreen.main.bounds.width, height: .greatestFiniteMagnitude))
        return CGSize(width: size.width, height: size.height)
    }
    
    override func layoutSubviews() {
        super.layoutSubviews()
        invalidateIntrinsicContentSize()
    }
    
    // MARK: - canPerformAction
    override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
        // Check if SDK is enabled
        let isEnabled = TextSelectionManager.shared.isSelectionEnabled()
        
        // Use NSSelectorFromString for consistent comparison
        let signLanguageAction = NSSelectorFromString("signLanguageTranslateAction:")
        
        print("[SignLanguageSDK] SignLanguageSelectableTextView.canPerformAction - action: \(action), signLanguageAction: \(signLanguageAction), isEnabled: \(isEnabled), hasSelection: \(hasSelection)")
        
        // Sign language action - check both possible selectors
        if action == signLanguageAction || action == #selector(signLanguageTranslateAction(_:)) {
            let result = isEnabled && hasSelection
            print("[SignLanguageSDK] signLanguageTranslateAction matched - returning \(result)")
            return result
        }
        
        // Copy action
        if action == #selector(copy(_:)) {
            return hasSelection
        }
        
        // Select all
        if action == #selector(selectAll(_:)) {
            return true
        }
        
        return false
    }
    
    private var hasSelection: Bool {
        if let range = selectedTextRange {
            return !range.isEmpty
        }
        return false
    }
    
    // MARK: - Sign Language Action
    // This method is called when user taps "İşaret Dili" in selection menu
    @objc override func signLanguageTranslateAction(_ sender: Any?) {
        guard let selectedRange = selectedTextRange,
              let selectedText = text(in: selectedRange),
              !selectedText.isEmpty else { 
            print("[SignLanguageSDK] signLanguageTranslateAction - no text selected")
            return 
        }
        
        print("[SignLanguageSDK] signLanguageTranslateAction called with text: \(selectedText)")
        TextSelectionManager.shared.handleSelectedText(selectedText)
    }
    
    // Keep old method name as alias for backward compatibility
    @objc func signLanguageTranslate(_ sender: Any?) {
        signLanguageTranslateAction(sender)
    }
}
