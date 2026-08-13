import Foundation
import React

/**
 Exposes `SignVideoView` to JavaScript.

 An ordinary `RCTViewManager`, not a Fabric component: the new architecture
 discovers registered view managers by class name and mounts them through its
 interop layer, so one class serves both architectures. That matters because the
 SDK supports React Native 0.72 through 0.83, and a code-generated component
 would not run on the older, pre-Fabric end of that range.

 The class name is load-bearing. React derives the component name by stripping
 `Manager`, so `SignVideoViewManager` must produce exactly `SignVideoView` — the
 name `requireNativeComponent` asks for.
 */
@objc(SignVideoViewManager)
class SignVideoViewManager: RCTViewManager {

    override func view() -> UIView! {
        SignVideoView()
    }

    override static func requiresMainQueueSetup() -> Bool {
        true
    }
}
