// ios/SignLanguageTranslation/SignLanguageModule.m

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(SignLanguageModule, RCTEventEmitter)

RCT_EXTERN_METHOD(configure:(NSString *)apiKey
                  apiUrl:(NSString *)apiUrl
                  language:(NSString *)language
                  fdid:(NSString *)fdid
                  tid:(NSString *)tid
                  theme:(NSDictionary *)theme
                  accessibility:(NSDictionary *)accessibility
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(enable)
RCT_EXTERN_METHOD(disable)
RCT_EXTERN_METHOD(isEnabled:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(enableTextSelectionForActivity)
RCT_EXTERN_METHOD(enableTextSelectionForView:(nonnull NSNumber *)viewTag)

RCT_EXTERN_METHOD(translateText:(NSString *)text
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(cancelTranslation)

RCT_EXTERN_METHOD(showBottomSheet:(NSString *)videoUrl
                  text:(NSString *)text
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(dismissBottomSheet)
RCT_EXTERN_METHOD(isBottomSheetVisible:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
