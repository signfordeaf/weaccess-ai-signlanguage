#import <React/RCTViewManager.h>

/**
 * The bridge declaration for the video view.
 *
 * `RCT_EXTERN_MODULE` is used rather than `RCT_EXTERN_REMAP_MODULE` on purpose:
 * the remapping form sets an explicit JavaScript name, and the new
 * architecture's interop layer auto-discovers legacy view managers by deriving
 * the name from the *class*. Giving it an explicit name would make that lookup
 * miss, and the component would silently render as an empty box on Fabric.
 */
@interface RCT_EXTERN_MODULE (SignVideoViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(uri, NSString)
RCT_EXPORT_VIEW_PROPERTY(paused, BOOL)
RCT_EXPORT_VIEW_PROPERTY(repeats, BOOL)
RCT_EXPORT_VIEW_PROPERTY(muted, BOOL)
RCT_EXPORT_VIEW_PROPERTY(rate, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(resizeMode, NSString)

RCT_EXPORT_VIEW_PROPERTY(onSignVideoLoad, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onSignVideoEnd, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onSignVideoError, RCTDirectEventBlock)

@end
