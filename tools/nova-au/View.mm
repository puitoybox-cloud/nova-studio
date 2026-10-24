#import <Cocoa/Cocoa.h>
#import <AudioUnit/AUCocoaUIView.h>
#import <AudioToolbox/AudioToolbox.h>
#import <AudioToolbox/AudioUnitUtilities.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
static NSString* params(id a){if(![a isKindOfClass:NSArray.class]||[a count]!=4)return @"—";return [NSString stringWithFormat:@"%.2f dB / %.2f dB / %.2f dB / %@",[a[0] floatValue],[a[1] floatValue],[a[2] floatValue],a[3]];}
static NSString* choices(id a){if(![a isKindOfClass:NSArray.class]||[a count]!=3)return @"—";return [NSString stringWithFormat:@"A: %@\nB: %@\nC: %@",params(a[0]),params(a[1]),params(a[2])];}
static const AudioUnitPropertyID Command=64000, Snapshot=64001;
@interface NovaMixView : NSView
@property AudioUnit unit;
@property NSTextField *projectField,*trackField,*instruction,*report;
@property NSPopUpButton* tracks;
@property NSDictionary* manifest;
@property NSDictionary* state;
@property NSTimer* refresh;
@end
@implementation NovaMixView
- (BOOL)isFlipped{return YES;}
- (NSTextField*)field:(NSString*)s y:(CGFloat)y editable:(BOOL)e{
 NSTextField* f=e?[[NSTextField alloc]initWithFrame:NSMakeRect(16,y,668,26)]:[NSTextField labelWithString:s];
 f.frame=NSMakeRect(16,y,668,26);f.stringValue=s;[self addSubview:f];return f;
}
- (void)button:(NSString*)s x:(CGFloat)x y:(CGFloat)y action:(SEL)a tag:(NSInteger)t{
 NSButton* b=[NSButton buttonWithTitle:s target:self action:a];b.frame=NSMakeRect(x,y,150,30);b.tag=t;[self addSubview:b];
}
- (instancetype)initWithUnit:(AudioUnit)unit{
 if((self=[super initWithFrame:NSMakeRect(0,0,700,640)])){
  self.unit=unit;[self field:@"NOVA Mix — ステレオ Gain / EQ（音源選択とは別機能）" y:14 editable:NO];
  [self button:@"handoff JSONを開く" x:16 y:48 action:@selector(importFile:) tag:0];
  [self field:@"曲ID / Track IDを照合して対象を確認。Logic内部Track IDの自動取得なし" y:86 editable:NO];
  self.projectField=[self field:@"" y:116 editable:YES];self.projectField.placeholderString=@"Music Studio projectId";
  self.trackField=[self field:@"" y:148 editable:YES];self.trackField.placeholderString=@"Music Studio Track ID";
  self.tracks=[[NSPopUpButton alloc]initWithFrame:NSMakeRect(16,182,480,28) pullsDown:NO];self.tracks.target=self;self.tracks.action=@selector(selectTrack:);[self addSubview:self.tracks];
  [self button:@"対象を確認" x:520 y:182 action:@selector(bind:) tag:0];
  self.instruction=[self field:@"高音を少し抑えて" y:224 editable:YES];
  [self button:@"A/B/C候補を作る" x:16 y:262 action:@selector(preview:) tag:0];
  [self button:@"Aを承認・適用" x:16 y:304 action:@selector(apply:) tag:0];
  [self button:@"Bを承認・適用" x:180 y:304 action:@selector(apply:) tag:1];
  [self button:@"Cを承認・適用" x:344 y:304 action:@selector(apply:) tag:2];
  [self button:@"キャンセル" x:16 y:346 action:@selector(cancel:) tag:0];
  [self button:@"Undoを承認" x:180 y:346 action:@selector(undo:) tag:0];
  [self button:@"値を更新" x:344 y:346 action:@selector(update:) tag:0];
  self.report=[NSTextField wrappingLabelWithString:@""];self.report.frame=NSMakeRect(16,392,668,232);self.report.font=[NSFont systemFontOfSize:11];[self addSubview:self.report];
  [self update:nil];__weak NovaMixView* weakSelf=self;
  self.refresh=[NSTimer scheduledTimerWithTimeInterval:1 repeats:YES block:^(NSTimer*){[weakSelf update:nil];}];
 }return self;
}
- (void)dealloc{[self.refresh invalidate];}
- (void)update:(id)sender{
 CFDictionaryRef d=nullptr;UInt32 size=sizeof(d);OSStatus e=AudioUnitGetProperty(self.unit,Snapshot,kAudioUnitScope_Global,0,&d,&size);
 if(e||!d){self.report.stringValue=[NSString stringWithFormat:@"状態読取エラー %d",(int)e];return;}
 self.state=CFBridgingRelease(d);NSDictionary* b=self.state[@"binding"];
 if(!self.projectField.stringValue.length)self.projectField.stringValue=b[@"projectId"]?:@"";
 if(!self.trackField.stringValue.length)self.trackField.stringValue=b[@"trackId"]?:@"";
 self.report.stringValue=[NSString stringWithFormat:@"%@\n対象: %@ / %@\nAU instance: %@ / 確認 %@\n現在 [Gain, Low, High, Bypass]: %@\n変更前: %@\n提案 A/B/C: %@\n%@\n外部プラグイン操作なし。Mastering完成・音声解析済みの表示なし。",self.state[@"status"],b[@"projectId"],b[@"trackId"],b[@"instanceId"],b[@"confirmed"],params(self.state[@"current"]),params(self.state[@"before"]),choices(self.state[@"choices"]),self.state[@"reason"]?:@""];
}
- (void)send:(NSMutableDictionary*)command{
 NSDictionary* b=self.state[@"binding"]?:@{};command[@"projectId"]=self.projectField.stringValue;command[@"trackId"]=self.trackField.stringValue;command[@"instanceId"]=b[@"instanceId"]?:@"";
 NSArray* before=self.state[@"current"];CFDictionaryRef d=(__bridge CFDictionaryRef)command;OSStatus e=AudioUnitSetProperty(self.unit,Command,kAudioUnitScope_Global,0,&d,sizeof(d));
 [self update:nil];if(!e){for(UInt32 i=0;i<4;++i){if(![before[i] isEqual:self.state[@"current"][i]]){AudioUnitParameter p={self.unit,i,kAudioUnitScope_Global,0};AUParameterListenerNotify(nullptr,nullptr,&p);}}}
 if(e)self.report.stringValue=[self.report.stringValue stringByAppendingFormat:@"\n操作を停止 (%d)：対象・現在値・承認を再確認",(int)e];
}
- (void)bind:(id)s{[self send:[@{@"operation":@"bind",@"confirmed":@YES}mutableCopy]];}
- (void)preview:(id)s{[self send:[@{@"operation":@"preview",@"instruction":self.instruction.stringValue}mutableCopy]];}
- (void)apply:(NSButton*)s{[self send:[@{@"operation":@"apply",@"approved":@YES,@"choice":@(s.tag)}mutableCopy]];}
- (void)cancel:(id)s{[self send:[@{@"operation":@"cancel"}mutableCopy]];}
- (void)undo:(id)s{[self send:[@{@"operation":@"undo",@"approved":@YES}mutableCopy]];}
- (void)selectTrack:(id)s{NSDictionary* t=self.manifest[@"tracks"][[self.tracks indexOfSelectedItem]];self.trackField.stringValue=t[@"id"];}
- (void)importFile:(id)s{
 NSOpenPanel* panel=[NSOpenPanel openPanel];panel.allowedContentTypes=@[UTTypeJSON];panel.allowsMultipleSelection=NO;
 if([panel runModal]!=NSModalResponseOK)return;
 NSNumber* bytes;[panel.URL getResourceValue:&bytes forKey:NSURLFileSizeKey error:nil];if(!bytes||bytes.unsignedLongLongValue>16*1024*1024){self.report.stringValue=@"16 MiBを超えるJSONは読み込めません";return;}
 NSData* data=[NSData dataWithContentsOfURL:panel.URL];NSDictionary* m=data?[NSJSONSerialization JSONObjectWithData:data options:0 error:nil]:nil;
 if(![m isKindOfClass:NSDictionary.class]||![m[@"format"] isEqual:@"nova-logic-instrument-package-v1"]||![m[@"projectId"] isKindOfClass:NSString.class]||![m[@"tracks"] isKindOfClass:NSArray.class]){self.report.stringValue=@"PR #501形式のhandoff JSONではありません";return;}
 NSMutableSet* ids=[NSMutableSet set];for(id t in m[@"tracks"]){if(![t isKindOfClass:NSDictionary.class]||![t[@"id"] isKindOfClass:NSString.class]||[ids containsObject:t[@"id"]]){self.report.stringValue=@"Track IDが不明または重複しています";return;}[ids addObject:t[@"id"]];}
 // Registry status is evidence from Music Studio, not proof of installation on this Logic machine.
 self.manifest=m;self.projectField.stringValue=m[@"projectId"];[self.tracks removeAllItems];
 for(NSDictionary* t in m[@"tracks"])[self.tracks addItemWithTitle:[NSString stringWithFormat:@"%@ / ID %@ / ch %@",t[@"name"]?:@"",t[@"id"],t[@"channel"]?:@"?"]];
 if([m[@"tracks"] count])[self selectTrack:nil];self.report.stringValue=@"読み取り専用で読み込みました。Logicの挿入先とID・ch・音域を照合後、対象を確認してください。音源インストールの確認・切替は行いません。";
}
@end
@interface NovaMixViewFactory : NSObject <AUCocoaUIBase>
@end
@implementation NovaMixViewFactory
- (unsigned)interfaceVersion{return 0;}
- (NSString*)description{return @"NOVA Mix";}
- (NSView*)uiViewForAudioUnit:(AudioUnit)unit withSize:(NSSize)size{return [[NovaMixView alloc]initWithUnit:unit];}
@end
