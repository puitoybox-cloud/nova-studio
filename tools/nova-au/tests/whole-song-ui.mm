// Test actual AU view's control action without automating Logic or granting Accessibility.
#define main existingHostMain
#include "host.mm"
#undef main
#import <Cocoa/Cocoa.h>
#import <CommonCrypto/CommonDigest.h>
#import <AudioUnit/AUCocoaUIView.h>
@interface NSView (NovaWholeTest)
- (void)runWhole:(NSString*)operation choice:(NSString*)choice after:(void (^)(NSDictionary*))after;
@end
static NSString* hashFile(NSString* p){NSData* d=[NSData dataWithContentsOfFile:p];check(d!=nil,"hash input exists");unsigned char bytes[CC_SHA256_DIGEST_LENGTH];CC_SHA256(d.bytes,(CC_LONG)d.length,bytes);NSMutableString* h=[NSMutableString string];for(unsigned i=0;i<sizeof(bytes);++i)[h appendFormat:@"%02x",bytes[i]];return h;}
int main(int argc,char** argv){@autoreleasepool{
 check(argc==5,"ui BUNDLE PYTHON FFMPEG OUTPUT");[NSApplication sharedApplication];
 NSString* bundlePath=[NSString stringWithUTF8String:argv[1]];NSBundle* bundle=[NSBundle bundleWithPath:bundlePath];NSError* err;check([bundle loadAndReturnError:&err],"load AU view bundle");
 void* lib=dlopen([bundle executablePath].UTF8String,RTLD_NOW|RTLD_LOCAL);check(lib,"open binary");auto factory=(AudioComponentFactoryFunction)dlsym(lib,"NovaMixFactory");check(factory,"factory");AudioComponentDescription desc={'aufx','NvMx','NvSt',0,0};auto c=AudioComponentRegister(&desc,CFSTR("NOVA: Mix"),256,factory);
 AudioUnit unit=nullptr,other=nullptr;ok(AudioComponentInstanceNew(c,&unit),"unit");ok(AudioComponentInstanceNew(c,&other),"other");Source source;configure(unit,&source,48000,256);
 ok(command(unit,@{@"operation":@"bind",@"projectId":@"ui-fixture",@"trackId":@"out",@"confirmed":@YES,@"role":@"piano",@"targetKind":@"stereo-out",@"inputSource":@"explicit development fixture; not Logic"}),"confirm target");
 NSString* output=[NSString stringWithUTF8String:argv[4]];check([NSFileManager.defaultManager createDirectoryAtPath:output withIntermediateDirectories:NO attributes:nil error:nil],"new folder");
 std::vector<float> audio(48000*30);for(size_t n=0;n<audio.size();++n)audio[n]=.1*std::sin(2*M_PI*997*n/48000);NSString* wavPath=[output stringByAppendingPathComponent:@"source.wav"];wav(wavPath.UTF8String,audio);
 NSString* python=[NSString stringWithUTF8String:argv[2]];NSString* ffmpeg=[NSString stringWithUTF8String:argv[3]];NSString* engine=[bundle.bundlePath stringByAppendingPathComponent:@"Contents/MacOS/nova-whole-song"];
 NSDictionary* s=snapshot(unit),*b=s[@"binding"];
 NSDictionary* q=@{@"format":@"nova-au-whole-request-v1",@"sourceKind":@"development-fixture",@"projectId":b[@"projectId"],@"trackId":b[@"trackId"],@"instanceId":b[@"instanceId"],@"inputSource":b[@"inputSource"],@"kind":b[@"targetKind"],@"role":b[@"role"],@"audioVersion":@"fixture-v1",@"settingsToken":s[@"settingsToken"],@"confirmed":@YES,@"instruction":@"全体の音を自然に整えて",@"targetLufs":@(-14),@"ceilingDbTP":@(-1),@"sourceWav":wavPath,@"sourceWavSha256":hashFile(wavPath),@"engine":engine,@"engineSha256":hashFile(engine),@"ffmpeg":ffmpeg,@"ffmpegSha256":hashFile(ffmpeg),@"pythonSha256":hashFile(python),@"pipelineSha256":hashFile([bundle.resourcePath stringByAppendingPathComponent:@"whole-song.py"]),@"output":[output stringByAppendingPathComponent:@"audio"]};
 NSString* request=[output stringByAppendingPathComponent:@"request.json"];check([[NSJSONSerialization dataWithJSONObject:q options:0 error:nil]writeToFile:request atomically:YES],"request");
 id<AUCocoaUIBase> factoryView=[NSClassFromString(@"NovaMixViewFactory")new];check(factoryView!=nil,"native view factory");
 NSView* view=[factoryView uiViewForAudioUnit:unit withSize:NSMakeSize(700,900)];check(view!=nil,"actual native AU view");
 [view setValue:[NSURL fileURLWithPath:request]forKey:@"wholeRequest"];[view setValue:[NSURL fileURLWithPath:python]forKey:@"wholePython"];
 __block BOOL complete=NO;__block NSDictionary* reply=nil;std::atomic<bool> stop{false};std::thread playback([&]{while(!stop.load()){render(unit,4096,256);std::this_thread::sleep_for(std::chrono::milliseconds(2));}});
 [view runWhole:@"run" choice:nil after:^(NSDictionary* r){reply=r;complete=YES;}];
 auto deadline=NSDate.date.timeIntervalSince1970+180;
 while(!complete&&NSDate.date.timeIntervalSince1970<deadline){[[NSRunLoop currentRunLoop]runUntilDate:[NSDate dateWithTimeIntervalSinceNow:.05]];if(![[[view valueForKey:@"wholeController"]valueForKey:@"busy"]boolValue])break;}
 stop.store(true);playback.join();if(!reply)fprintf(stderr,"%s\n",[[view valueForKey:@"offlineSummary"]description].UTF8String);check(complete&&reply!=nil,"AU view action launches whole-song pipeline");
 check([snapshot(unit)[@"current"]isEqual:s[@"current"]],"analysis does not apply settings");
 auto d=cmd(unit,@"apply-whole-song");d[@"result"]=reply;d[@"choice"]=@1;check(command(unit,d)!=noErr,"approval required");d[@"approved"]=@YES;
 auto wrong=[d mutableCopy];wrong[@"instanceId"]=snapshot(other)[@"binding"][@"instanceId"];check(command(other,wrong)!=noErr,"other AU refuses result");
 ok(command(unit,d),"approved full-song mapped settings");auto applied=snapshot(unit);check([applied[@"current"]isEqual:reply[@"renders"][2][@"values"]],"mapped values read back");
 for(unsigned i=0;i<17;++i){float v=0;ok(AudioUnitGetParameter(unit,i,0,0,&v),"public readback");NSNumber* expected=i<4?applied[@"current"][i]:applied[@"processing"][i-4];check(v==expected.floatValue,"all public values agree");}
 check(![[(NSArray*)applied[@"history"] lastObject][@"offlineLimiterApplied"]boolValue],"offline limiter never claimed live");
 auto capture=cmd(unit,@"capture");capture[@"consent"]=@YES;ok(command(unit,capture),"recapture after whole apply");render(unit,96000,256);check([snapshot(unit)[@"audioAnalyzed"]boolValue],"actual live remeasurement");
 CFPropertyListRef saved=nullptr;UInt32 bytes=sizeof(saved);ok(AudioUnitGetProperty(unit,kAudioUnitProperty_ClassInfo,0,0,&saved,&bytes),"save state");ok(AudioUnitSetProperty(other,kAudioUnitProperty_ClassInfo,0,0,&saved,sizeof(saved)),"restore separate AU");CFRelease(saved);check([snapshot(other)[@"current"]isEqual:applied[@"current"]],"state values retained");check(![snapshot(other)[@"binding"][@"confirmed"]boolValue],"restore cannot auto apply to other track");
 auto undo=cmd(unit,@"undo");undo[@"approved"]=@YES;ok(command(unit,undo),"whole undo");check([snapshot(unit)[@"current"]isEqual:s[@"current"]],"whole undo exact values");check(command(unit,d)!=noErr,"old result stale after apply undo");
 // Fresh request token then ABA host automation invalidates even identical current values.
 NSMutableDictionary* fresh=[reply mutableCopy],*fq=[q mutableCopy];fq[@"settingsToken"]=snapshot(unit)[@"settingsToken"];fresh[@"request"]=fq;d[@"result"]=fresh;ok(AudioUnitSetParameter(unit,0,0,0,1,0),"automation change");ok(AudioUnitSetParameter(unit,0,0,0,0,0),"automation returns");check(command(unit,d)!=noErr,"ABA automation rejected");
 NSDictionary* report=@{@"viewOperationWholeSong":@YES,@"logicHostVerified":@NO,@"sourceSha256":hashFile(wavPath),@"reply":reply,@"applied":applied,@"final":snapshot(unit)};check([[NSJSONSerialization dataWithJSONObject:report options:NSJSONWritingPrettyPrinted error:nil]writeToFile:[output stringByAppendingPathComponent:@"ui-evidence.json"]atomically:YES],"evidence");
 ok(AudioUnitUninitialize(unit),"stop"); // view/timer retains unit until process exit
 puts("AU native view control -> whole-song processing -> actual parameter readback/Undo/state PASS; Logic unverified");
}}
