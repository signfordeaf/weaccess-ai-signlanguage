// ios/SignLanguageTranslation/Views/SignLanguageTextViewManager.m

#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(SignLanguageTextViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(content, NSString)
RCT_EXPORT_VIEW_PROPERTY(color, UIColor)
RCT_EXPORT_VIEW_PROPERTY(fontSize, NSNumber)

@end
