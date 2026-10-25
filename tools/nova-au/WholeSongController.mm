#import "WholeSongController.h"
#import <CommonCrypto/CommonDigest.h>
NSString* NovaFileSHA256(NSURL* url){
 NSInputStream* stream=[NSInputStream inputStreamWithURL:url];[stream open];CC_SHA256_CTX context;CC_SHA256_Init(&context);uint8_t buffer[65536];NSInteger count;
 while((count=[stream read:buffer maxLength:sizeof(buffer)])>0)CC_SHA256_Update(&context,buffer,(CC_LONG)count);[stream close];if(count<0)return nil;
 uint8_t digest[CC_SHA256_DIGEST_LENGTH];CC_SHA256_Final(digest,&context);NSMutableString* hash=[NSMutableString string];for(unsigned i=0;i<sizeof(digest);++i)[hash appendFormat:@"%02x",digest[i]];return hash;
}
@interface NovaWholeSongController ()
@property BOOL busy;
@property BOOL cancelled;
@property NSTask* task;
@end
@implementation NovaWholeSongController
- (void)cancel{ @synchronized(self){self.cancelled=YES;if(self.task.running)[self.task terminate];} }
- (void)execute:(NSString*)operation request:(NSURL*)request python:(NSURL*)python resources:(NSURL*)resources choice:(NSString*)choice completion:(void (^)(NSDictionary*, NSString*))completion{
 NSAssert(NSThread.isMainThread,@"control API requires main queue");
 if(self.busy){completion(nil,@"全曲処理中です。終了を待ってください");return;}self.busy=YES;self.cancelled=NO;
 dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED,0), ^{
  NSString* error=nil;NSDictionary* reply=nil;
  @try{
   // Build manifest binds every bundled executable/script; external Python/FFmpeg are explicitly selected.
   NSDictionary* inventory=[NSJSONSerialization JSONObjectWithData:[NSData dataWithContentsOfURL:[resources URLByAppendingPathComponent:@"whole-song-runtime.json"]] options:0 error:nil];
   if(![inventory isKindOfClass:NSDictionary.class]||inventory.count!=4)@throw @"全曲runtime inventoryがありません";
   for(NSString* name in @[@"whole-song.py",@"select-whole-song.py",@"au-whole-song.py",@"../MacOS/nova-whole-song"]){NSString* hash=NovaFileSHA256([resources URLByAppendingPathComponent:name]);if(!hash||![hash isEqual:inventory[name]])@throw @"同梱runtimeのSHA256照合失敗";}
   NSNumber* size;[request getResourceValue:&size forKey:NSURLFileSizeKey error:nil];if(!size||size.unsignedLongLongValue>4*1024*1024)@throw @"requestのサイズが不正です";
   NSDictionary* q=[NSJSONSerialization JSONObjectWithData:[NSData dataWithContentsOfURL:request] options:0 error:nil];
   if(![q isKindOfClass:NSDictionary.class]||![NovaFileSHA256(python)isEqual:q[@"pythonSha256"]])@throw @"選択したPythonが変更されています";
   if(![q[@"engine"]isKindOfClass:NSString.class]||![[NSURL fileURLWithPath:q[@"engine"]].URLByResolvingSymlinksInPath.path isEqual:[resources URLByAppendingPathComponent:@"../MacOS/nova-whole-song"].URLByResolvingSymlinksInPath.path])@throw @"同梱engine以外は起動できません";
   NSTask* task=[NSTask new];task.executableURL=python;
   NSMutableArray* args=[@[@"-I",[resources URLByAppendingPathComponent:@"au-whole-song.py"].path,operation,request.path]mutableCopy];
   if(choice){[args addObjectsFromArray:@[@"--choice",choice,@"--approve"]];}else if([operation isEqual:@"undo"])[args addObject:@"--approve"];
   task.arguments=args;
   // No shell, Python import injection or inherited provider credentials.
   task.environment=@{@"PATH":@"/usr/bin:/bin",@"LANG":@"en_US.UTF-8"};
   NSURL* result=[request.URLByDeletingLastPathComponent URLByAppendingPathComponent:@"bridge-reply.json.partial"];
   NSURL* log=[request.URLByDeletingLastPathComponent URLByAppendingPathComponent:@"bridge-error.log"];
   [NSData.data writeToURL:result atomically:YES];[NSData.data writeToURL:log atomically:YES];
   NSFileHandle* output=[NSFileHandle fileHandleForWritingToURL:result error:nil];NSFileHandle* diagnostic=[NSFileHandle fileHandleForWritingToURL:log error:nil];if(!output||!diagnostic)@throw @"結果ファイルを作成できません";
   task.standardOutput=output;task.standardError=diagnostic;NSError* launchError;
   @synchronized(self){if(self.cancelled)@throw @"キャンセル済み";self.task=task;if(![task launchAndReturnError:&launchError])@throw launchError.localizedDescription;}
   [task waitUntilExit];[output closeFile];[diagnostic closeFile];
   if(self.cancelled)@throw @"全曲処理をキャンセルしました。元音声は保持されています";
   if(task.terminationStatus!=0)@throw [NSString stringWithFormat:@"全曲処理失敗 (%d)。%@を確認し、同じrequestで再試行してください",task.terminationStatus,log.path];
   NSNumber* bytes;[result getResourceValue:&bytes forKey:NSURLFileSizeKey error:nil];if(!bytes||bytes.unsignedLongLongValue>4*1024*1024)@throw @"全曲応答のサイズが不正です";
   reply=[NSJSONSerialization JSONObjectWithData:[NSData dataWithContentsOfURL:result] options:0 error:nil];if(![reply[@"format"]isEqual:@"nova-au-whole-reply-v1"])@throw @"全曲応答形式が不正です";
  }@catch(id e){error=[e isKindOfClass:NSString.class]?e:[e description];}
  dispatch_async(dispatch_get_main_queue(), ^{self.task=nil;self.busy=NO;completion(reply,error);});
 });
}
@end
