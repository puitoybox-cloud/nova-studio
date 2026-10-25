#import "WholeSongController.h"
#import <CommonCrypto/CommonDigest.h>
#import <Security/Security.h>
#include <signal.h>
#include <unistd.h>
#include <sys/stat.h>
NSString* NovaFileSHA256(NSURL* url){
 NSInputStream* stream=[NSInputStream inputStreamWithURL:url];[stream open];CC_SHA256_CTX context;CC_SHA256_Init(&context);uint8_t buffer[65536];NSInteger count;
 while((count=[stream read:buffer maxLength:sizeof(buffer)])>0)CC_SHA256_Update(&context,buffer,(CC_LONG)count);[stream close];if(count<0)return nil;
 uint8_t digest[CC_SHA256_DIGEST_LENGTH];CC_SHA256_Final(digest,&context);NSMutableString* hash=[NSMutableString string];for(unsigned i=0;i<sizeof(digest);++i)[hash appendFormat:@"%02x",digest[i]];return hash;
}
NSURL* NovaBundledPython(NSURL* resources){return [resources URLByAppendingPathComponent:@"Runtime/Python/bin/python3.12"];}
NSURL* NovaBundledFFmpeg(NSURL* resources){return [resources URLByAppendingPathComponent:@"Runtime/FFmpeg/bin/ffmpeg"];}
static BOOL NovaInside(NSURL* path,NSURL* root){return [path.URLByResolvingSymlinksInPath.path hasPrefix:[root.URLByResolvingSymlinksInPath.path stringByAppendingString:@"/"]];}
static void NovaVerifyRuntime(NSURL* resources){
 NSURL* bundle=[resources URLByAppendingPathComponent:@"../.."].URLByStandardizingPath;
 SecStaticCodeRef code=nullptr;
 OSStatus status=SecStaticCodeCreateWithPath((__bridge CFURLRef)bundle,kSecCSDefaultFlags,&code);
 if(status==errSecSuccess)status=SecStaticCodeCheckValidity(code,kSecCSStrictValidate|kSecCSCheckNestedCode,nullptr);
 if(code)CFRelease(code);if(status!=errSecSuccess)@throw @"配布物のコード署名/リソース照合失敗";
 NSURL* root=[resources URLByAppendingPathComponent:@"Runtime"];
 NSDictionary* m=[NSJSONSerialization JSONObjectWithData:[NSData dataWithContentsOfURL:[root URLByAppendingPathComponent:@"inventory.json"]]options:0 error:nil];
 if(![m[@"format"]isEqual:@"nova-contained-runtime-v1"]||![m[@"architecture"]isEqual:@"x86_64"]||![m[@"pythonVersion"]isEqual:@"3.12.15"]||![m[@"ffmpegVersion"]isEqual:@"7.1.1"]||![m[@"files"]isKindOfClass:NSArray.class])@throw @"同梱runtimeの欠落/バージョン不一致";
 NSMutableSet* names=[NSMutableSet set];
 for(NSDictionary* row in m[@"files"]){
  NSString* name=row[@"path"];if(![name isKindOfClass:NSString.class]||name.isAbsolutePath||[name.pathComponents containsObject:@".."]||[names containsObject:name])@throw @"runtime path不正";
  [names addObject:name];NSURL* url=[root URLByAppendingPathComponent:name];
  if(!NovaInside(url,root))@throw @"runtime path逸脱";
  NSNumber* link;[url getResourceValue:&link forKey:NSURLIsSymbolicLinkKey error:nil];
  if(row[@"symlink"]){NSString* target=[NSFileManager.defaultManager destinationOfSymbolicLinkAtPath:url.path error:nil];if(!link.boolValue||![target isEqual:row[@"symlink"]])@throw @"runtime symlink変更";}
  else if(link.boolValue||![NovaFileSHA256(url)isEqual:row[@"sha256"]])@throw @"同梱runtimeのSHA256照合失敗";
 }
 for(NSString* name in @[@"Python/bin/python3.12",@"FFmpeg/bin/ffmpeg",@"FFmpeg/bin/ffprobe"]){if(![names containsObject:name])@throw @"必須実行ファイルがありません";}
 NSDirectoryEnumerator* items=[NSFileManager.defaultManager enumeratorAtURL:root includingPropertiesForKeys:@[NSURLIsDirectoryKey]options:0 errorHandler:nil];
 for(NSURL* url in items){NSNumber* dir;[url getResourceValue:&dir forKey:NSURLIsDirectoryKey error:nil];if(dir.boolValue)continue;NSString* name=[url.path substringFromIndex:root.path.length+1];if(![name isEqual:@"inventory.json"]&&![names containsObject:name])@throw @"未登録runtimeファイル";}
}
@interface NovaWholeSongController ()
@property BOOL busy;
@property BOOL cancelled;
@property NSTask* task;
@end
@implementation NovaWholeSongController
- (void)cancel{
 @synchronized(self){self.cancelled=YES;NSTask* task=self.task;if(task.running){
  pid_t pid=task.processIdentifier;if(pid>0&&getpgid(pid)==pid)kill(-pid,SIGTERM);else [task terminate];
  // Helper creates its own session before starting an engine/FFmpeg child.
  // Escalate only while this exact NSTask still runs in its own process group.
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW,5*NSEC_PER_SEC),dispatch_get_main_queue(),^{@synchronized(self){pid_t pid=task.processIdentifier;if(task.running&&pid>0&&getpgid(pid)==pid)kill(-pid,SIGKILL);}});
 }}
}
- (void)execute:(NSString*)operation request:(NSURL*)request python:(NSURL*)python resources:(NSURL*)resources choice:(NSString*)choice completion:(void (^)(NSDictionary*, NSString*))completion{
 NSAssert(NSThread.isMainThread,@"control API requires main queue");
 if(self.busy){completion(nil,@"全曲処理中です。終了を待ってください");return;}self.busy=YES;self.cancelled=NO;
 dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED,0), ^{
  NSString* error=nil;NSDictionary* reply=nil;
  @try{
   // Verify every packaged stdlib/native file before Python starts. No external fallback.
   NovaVerifyRuntime(resources);
   if(![python.URLByResolvingSymlinksInPath.path isEqual:NovaBundledPython(resources).URLByResolvingSymlinksInPath.path])@throw @"同梱Python以外は起動できません";
   NSDictionary* inventory=[NSJSONSerialization JSONObjectWithData:[NSData dataWithContentsOfURL:[resources URLByAppendingPathComponent:@"whole-song-runtime.json"]] options:0 error:nil];
   NSArray<NSString*>* requiredScripts=@[@"whole-song.py",@"select-whole-song.py",@"au-whole-song.py",@"compare-sections.py",@"../MacOS/nova-whole-song"];
   if(![inventory isKindOfClass:NSDictionary.class]||inventory.count!=requiredScripts.count)@throw @"全曲runtime inventoryがありません";
   for(NSString* name in requiredScripts){NSString* hash=NovaFileSHA256([resources URLByAppendingPathComponent:name]);if(!hash||![hash isEqual:inventory[name]])@throw @"同梱runtimeのSHA256照合失敗";}
   NSNumber* requestLink;[request getResourceValue:&requestLink forKey:NSURLIsSymbolicLinkKey error:nil];if(requestLink.boolValue)@throw @"request symlinkは使用できません";
   NSNumber* size;[request getResourceValue:&size forKey:NSURLFileSizeKey error:nil];if(!size||size.unsignedLongLongValue>4*1024*1024)@throw @"requestのサイズが不正です";
   NSDictionary* q=[NSJSONSerialization JSONObjectWithData:[NSData dataWithContentsOfURL:request] options:0 error:nil];
   if(![q isKindOfClass:NSDictionary.class]||![NovaFileSHA256(python)isEqual:q[@"pythonSha256"]])@throw @"選択したPythonが変更されています";
   if(![q[@"engine"]isKindOfClass:NSString.class]||![[NSURL fileURLWithPath:q[@"engine"]].URLByResolvingSymlinksInPath.path isEqual:[resources URLByAppendingPathComponent:@"../MacOS/nova-whole-song"].URLByResolvingSymlinksInPath.path])@throw @"同梱engine以外は起動できません";
   if(![q[@"ffmpeg"]isEqual:NovaBundledFFmpeg(resources).path])@throw @"同梱FFmpeg以外は起動できません";
   NSURL* workspace=request.URLByDeletingLastPathComponent.URLByResolvingSymlinksInPath;
   NSURL* target=[NSURL fileURLWithPath:q[@"output"]];
   if(![target.URLByDeletingLastPathComponent.URLByResolvingSymlinksInPath.path isEqual:workspace.path])@throw @"承認済み作業領域以外には保存できません";
   NSURL* package=[resources URLByAppendingPathComponent:@"../.."];
   if(NovaInside(request,package)||NovaInside([NSURL fileURLWithPath:q[@"output"]],package))@throw @"署名済み配布物には保存できません";
   NSTask* task=[NSTask new];task.executableURL=python;
   NSMutableArray* args=[@[@"-I",@"-B",[resources URLByAppendingPathComponent:@"au-whole-song.py"].path,operation,request.path]mutableCopy];
   if(choice){[args addObjectsFromArray:@[@"--choice",choice,@"--approve"]];}else if([operation isEqual:@"undo"])[args addObject:@"--approve"];
   task.arguments=args;
   // No shell, Python import injection or inherited provider credentials.
   task.environment=@{@"PATH":@"/nonexistent",@"LANG":@"en_US.UTF-8"};
   NSString* job=NSUUID.UUID.UUIDString;
   NSURL* result=[request.URLByDeletingLastPathComponent URLByAppendingPathComponent:[@"bridge-reply-" stringByAppendingFormat:@"%@.json.partial",job]];
   NSURL* log=[request.URLByDeletingLastPathComponent URLByAppendingPathComponent:[@"bridge-error-" stringByAppendingFormat:@"%@.log",job]];
   [NSData.data writeToURL:result atomically:YES];[NSData.data writeToURL:log atomically:YES];
   NSFileHandle* output=[NSFileHandle fileHandleForWritingToURL:result error:nil];NSFileHandle* diagnostic=[NSFileHandle fileHandleForWritingToURL:log error:nil];if(!output||!diagnostic)@throw @"結果ファイルを作成できません";
   task.standardOutput=output;task.standardError=diagnostic;NSError* launchError;
   @synchronized(self){if(self.cancelled)@throw @"キャンセル済み";self.task=task;if(![task launchAndReturnError:&launchError])@throw launchError.localizedDescription;}
   // Timeout affects only this owned task/group, never a Logic render thread.
   dispatch_after(dispatch_time(DISPATCH_TIME_NOW,30*60*NSEC_PER_SEC),dispatch_get_main_queue(),^{@synchronized(self){if(self.task==task&&task.running)[self cancel];}});
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
