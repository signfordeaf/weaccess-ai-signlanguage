#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

/**
 * The bridge declaration for the SDK's one native responsibility: the
 * "Sign Language" text-selection menu item.
 *
 * Everything else — the player, the translation flow, the API client, tap
 * classification — is TypeScript in v2, shared with Android.
 */
@interface RCT_EXTERN_MODULE (SignLanguageTranslation, RCTEventEmitter)

RCT_EXTERN_METHOD(configure : (NSString *)language)
RCT_EXTERN_METHOD(setEnabled : (BOOL)enabled)
RCT_EXTERN_METHOD(enableTextSelectionForView : (nonnull NSNumber *)viewTag)

RCT_EXTERN_METHOD(getSafeAreaInsets
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)

@end
