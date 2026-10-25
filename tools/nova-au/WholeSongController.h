#import <Cocoa/Cocoa.h>
// Main/control queue API; never reachable from the audio render callback.
@interface NovaWholeSongController : NSObject
@property(readonly) BOOL busy;
- (void)execute:(NSString*)operation request:(NSURL*)request python:(NSURL*)python resources:(NSURL*)resources choice:(NSString*)choice completion:(void (^)(NSDictionary*, NSString*))completion;
- (void)cancel;
@end
NSString* NovaFileSHA256(NSURL* url);
