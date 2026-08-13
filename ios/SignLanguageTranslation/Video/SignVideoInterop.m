#import <Foundation/Foundation.h>

/**
 * Registers the video view with the new architecture's legacy-interop layer.
 *
 * From React Native 0.74 this is unnecessary: the interop layer discovers
 * registered view managers on its own by class name. On 0.72 and 0.73 it does
 * not — it consults an allow-list — and an unregistered component renders as an
 * empty box with an "Unimplemented component" warning.
 *
 * So this adds our name to that list. Everything is resolved by string at
 * runtime, so the file needs no React headers, compiles as plain Objective-C,
 * and is a no-op both on the old architecture and from 0.74 onward.
 */
@interface SignVideoInterop : NSObject
@end

@implementation SignVideoInterop

+ (void)load
{
  // Deferred one runloop turn: with `use_frameworks!` the Fabric image may not
  // be loaded yet at +load time. This still runs long before a surface mounts.
  dispatch_async(dispatch_get_main_queue(), ^{
    Class interop = NSClassFromString(@"RCTLegacyViewManagerInteropComponentView");
    SEL selector = NSSelectorFromString(@"supportLegacyViewManagerWithName:");
    if ([interop respondsToSelector:selector]) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Warc-performSelector-leaks"
      [interop performSelector:selector withObject:@"SignVideoView"];
#pragma clang diagnostic pop
    }
  });
}

@end
