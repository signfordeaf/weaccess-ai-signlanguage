// ios/SignLanguageTranslation/TextSelection/TextSelectionManager.swift

import UIKit

protocol TextSelectionManagerDelegate: AnyObject {
    func didSelectText(_ text: String)
}

class TextSelectionManager: NSObject {
    
    static let shared = TextSelectionManager()
    
    weak var delegate: TextSelectionManagerDelegate?
    private var menuTitle: String = "Sign Language"
    private var isEnabled: Bool = false
    
    private override init() {
        super.init()
        setupGlobalMenuItems()
    }
    
    func configure(delegate: TextSelectionManagerDelegate, menuTitle: String) {
        self.delegate = delegate
        self.menuTitle = menuTitle
        self.isEnabled = true
        setupGlobalMenuItems()
    }
    
    func disable() {
        self.isEnabled = false
    }
    
    func getMenuTitle() -> String {
        return menuTitle
    }
    
    func isSelectionEnabled() -> Bool {
        return isEnabled
    }
    
    private func setupGlobalMenuItems() {
        // Add global menu item for text selection
        let menuController = UIMenuController.shared
        let signLanguageItem = UIMenuItem(
            title: menuTitle,
            action: NSSelectorFromString("signLanguageTranslateAction:")
        )
        menuController.menuItems = [signLanguageItem]
        print("[SignLanguageSDK] TextSelectionManager - Menu item setup with selector: signLanguageTranslateAction:")
    }
    
    func handleSelectedText(_ text: String) {
        print("[SignLanguageSDK] handleSelectedText called with: '\(text)'")
        print("[SignLanguageSDK] isEnabled: \(isEnabled), delegate exists: \(delegate != nil)")
        
        guard !text.isEmpty else {
            print("[SignLanguageSDK] ERROR: Text is empty!")
            return
        }
        
        if !isEnabled {
            print("[SignLanguageSDK] WARNING: SDK is not enabled, but proceeding anyway...")
        }
        
        guard let delegate = delegate else {
            print("[SignLanguageSDK] ERROR: No delegate set!")
            return
        }
        
        print("[SignLanguageSDK] Calling delegate.didSelectText...")
        delegate.didSelectText(text)
    }
}

// MARK: - UITextView Extension for Sign Language Menu

extension UITextView {
    
    private struct AssociatedKeys {
        static var signLanguageEnabled = "signLanguageEnabled"
    }
    
    var signLanguageEnabled: Bool {
        get {
            return objc_getAssociatedObject(self, &AssociatedKeys.signLanguageEnabled) as? Bool ?? false
        }
        set {
            objc_setAssociatedObject(self, &AssociatedKeys.signLanguageEnabled, newValue, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
        }
    }
    
    func enableSignLanguageMenu() {
        signLanguageEnabled = true
        isSelectable = true
    }
}

// MARK: - SelectableTextView for React Native

@objc(SelectableTextView)
class SelectableTextView: UITextView {
    
    private var signLanguageHandler: ((String) -> Void)?
    
    override init(frame: CGRect, textContainer: NSTextContainer?) {
        super.init(frame: frame, textContainer: textContainer)
        setupForSignLanguage()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupForSignLanguage()
    }
    
    private func setupForSignLanguage() {
        isSelectable = true
        isEditable = false
        isScrollEnabled = false
        textContainerInset = .zero
        textContainer.lineFragmentPadding = 0
        backgroundColor = .clear
        signLanguageEnabled = true
    }
    
    func setSignLanguageHandler(_ handler: @escaping (String) -> Void) {
        self.signLanguageHandler = handler
    }
    
    override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
        // Show sign language option in menu
        if action == #selector(signLanguageTranslate(_:)) {
            return TextSelectionManager.shared.isSelectionEnabled()
        }
        // Allow standard copy action
        if action == #selector(copy(_:)) {
            return true
        }
        return super.canPerformAction(action, withSender: sender)
    }
    
    @objc func signLanguageTranslate(_ sender: Any?) {
        guard let selectedRange = selectedTextRange,
              let selectedText = text(in: selectedRange),
              !selectedText.isEmpty else { return }
        
        if let handler = signLanguageHandler {
            handler(selectedText)
        } else {
            TextSelectionManager.shared.handleSelectedText(selectedText)
        }
    }
    
    // iOS 16+ Edit Menu - Removed override to fix availability error
    #if swift(>=5.7)
    @available(iOS 16.0, *)
    func setupBuildMenu(with builder: UIMenuBuilder) {
        super.buildMenu(with: builder)
        
        guard TextSelectionManager.shared.isSelectionEnabled() else { return }
        
        let signLanguageAction = UIAction(
            title: TextSelectionManager.shared.getMenuTitle(),
            image: nil
        ) { [weak self] _ in
            self?.performSignLanguageTranslation()
        }
        
        let signLanguageMenu = UIMenu(
            title: "",
            options: .displayInline,
            children: [signLanguageAction]
        )
        
        builder.insertSibling(signLanguageMenu, afterMenu: .standardEdit)
    }
    #endif
    
    private func performSignLanguageTranslation() {
        guard let selectedRange = selectedTextRange,
              let selectedText = text(in: selectedRange),
              !selectedText.isEmpty else { return }
        
        if let handler = signLanguageHandler {
            handler(selectedText)
        } else {
            TextSelectionManager.shared.handleSelectedText(selectedText)
        }
    }
}
