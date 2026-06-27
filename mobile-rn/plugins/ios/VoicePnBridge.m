#import <React/RCTBridgeModule.h>
#import <Foundation/Foundation.h>

static NSString *const kVoipTokenKey = @"vsp.voipPushToken";
static NSString *const kPendingActionKey = @"vsp.pendingPushAction";
static NSString *const kPendingMetadataKey = @"vsp.pendingPushMetadata";

@interface VoicePnBridge : NSObject <RCTBridgeModule>
@end

@implementation VoicePnBridge

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_EXPORT_METHOD(getVoipToken:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  resolve([[NSUserDefaults standardUserDefaults] stringForKey:kVoipTokenKey]);
}

RCT_EXPORT_METHOD(getPendingPushAction:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  resolve(@{
    @"action": [[NSUserDefaults standardUserDefaults] stringForKey:kPendingActionKey] ?: [NSNull null],
    @"metadata": [[NSUserDefaults standardUserDefaults] stringForKey:kPendingMetadataKey] ?: [NSNull null],
  });
}

RCT_EXPORT_METHOD(clearPendingPushAction:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[NSUserDefaults standardUserDefaults] removeObjectForKey:kPendingActionKey];
  [[NSUserDefaults standardUserDefaults] removeObjectForKey:kPendingMetadataKey];
  resolve(@YES);
}

@end