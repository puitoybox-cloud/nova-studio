#import <Cocoa/Cocoa.h>
#import "WholeSongController.h"
#import <CommonCrypto/CommonDigest.h>
#import <AudioUnit/AUCocoaUIView.h>
#import <AudioToolbox/AudioToolbox.h>
#import <AudioToolbox/AudioUnitUtilities.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
static NSString* params(id a){if(![a isKindOfClass:NSArray.class]||[a count]!=4)return @"—";return [NSString stringWithFormat:@"%.2f dB / %.2f dB / %.2f dB / %@",[a[0] floatValue],[a[1] floatValue],[a[2] floatValue],a[3]];}
static NSString* choices(id a){if(![a isKindOfClass:NSArray.class]||[a count]!=3)return @"—";return [NSString stringWithFormat:@"A: %@\nB: %@\nC: %@",params(a[0]),params(a[1]),params(a[2])];}
static NSString* measurement(id m){if(![m isKindOfClass:NSDictionary.class])return @"未測定";NSArray* b=m[@"bandPowerFractions"];if(b.count!=3)return @"未測定";return [NSString stringWithFormat:@"%@ / Peak %.2f dBFS / RMS %.2f dBFS / 低 %.2f%% 中 %.2f%% 高 %.2f%%",m[@"status"],[m[@"samplePeakDbFS"]doubleValue],[m[@"rmsDbFS"]doubleValue],[b[0]doubleValue]*100,[b[1]doubleValue]*100,[b[2]doubleValue]*100];}
static NSString* processingText(id p){if(![p isKindOfClass:NSArray.class]||[p count]!=13)return @"—";return [NSString stringWithFormat:@"EQ %@: L %.0f / M %.0f Hz %.2f dB Q %.2f / H %.0f Hz; Comp %@: Th %.1f dB, %.1f:1, A %.1f/R %.1f ms, Knee %.1f, Makeup %.1f dB",p[0],[p[1]floatValue],[p[3]floatValue],[p[4]floatValue],[p[5]floatValue],[p[2]floatValue],p[6],[p[7]floatValue],[p[8]floatValue],[p[9]floatValue],[p[10]floatValue],[p[11]floatValue],[p[12]floatValue]];}
static const AudioUnitPropertyID Command=64000, Snapshot=64001;
@interface NovaMixView : NSView
@property AudioUnit unit;
@property BOOL fieldsInitialized;
@property NSTextField *projectField,*trackField,*instruction,*report,*sourceField,*targetLufs;
@property NSPopUpButton *tracks,*targetKind;
@property NSDictionary* manifest;
@property NSDictionary* state;
@property NSString* offlineSummary;
@property NSTimer* refresh;
@property NovaWholeSongController* wholeController;
@property NSURL *wholeRequest,*wholePython;
@property NSDictionary* wholeReply;
@property BOOL wholePreparing;
@property NSUInteger wholeGeneration;
@property NSPopUpButton *wholeChoice,*wholeRole;
@property NSTextField *audioVersion,*peakCeiling;
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
 if((self=[super initWithFrame:NSMakeRect(0,0,700,900)])){
  self.unit=unit;self.wholeController=[NovaWholeSongController new];[self field:@"NOVA Mix — ステレオ Gain / EQ（音源選択とは別機能）" y:14 editable:NO];
  [self button:@"handoff JSONを開く" x:16 y:48 action:@selector(importFile:) tag:0];
  self.targetKind=[[NSPopUpButton alloc]initWithFrame:NSMakeRect(180,48,150,28) pullsDown:NO];[self.targetKind addItemsWithTitles:@[@"Track",@"Bus",@"Stereo Out"]];[self addSubview:self.targetKind];
  self.sourceField=[[NSTextField alloc]initWithFrame:NSMakeRect(344,48,340,26)];self.sourceField.placeholderString=@"実際の音源・録音元（手動確認）";[self addSubview:self.sourceField];
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
  [self button:@"全曲結果を照合" x:520 y:346 action:@selector(wholeSong:) tag:0];
  [self button:@"2秒音声取得に同意" x:16 y:388 action:@selector(capture:) tag:0];
  [self button:@"比較WAVを保存" x:180 y:388 action:@selector(compare:) tag:0];
  self.targetLufs=[[NSTextField alloc]initWithFrame:NSMakeRect(344,390,70,26)];self.targetLufs.stringValue=@"-14";[self addSubview:self.targetLufs];[self button:@"LUFSでMaster候補" x:424 y:388 action:@selector(master:) tag:0];
  self.audioVersion=[[NSTextField alloc]initWithFrame:NSMakeRect(16,434,210,26)];self.audioVersion.placeholderString=@"音源/プリセット/音声 revision ID";[self addSubview:self.audioVersion];
  self.wholeRole=[[NSPopUpButton alloc]initWithFrame:NSMakeRect(240,434,150,26) pullsDown:NO];[self.wholeRole addItemsWithTitles:@[@"unspecified",@"piano",@"strings",@"bass",@"drums",@"vocal"]];[self addSubview:self.wholeRole];
  self.peakCeiling=[[NSTextField alloc]initWithFrame:NSMakeRect(410,434,70,26)];self.peakCeiling.stringValue=@"-1";[self addSubview:self.peakCeiling];
  [self button:@"WAV全曲解析開始" x:16 y:468 action:@selector(startWhole:) tag:0];
  [self button:@"requestを再開/照合" x:180 y:468 action:@selector(resumeWhole:) tag:0];
  [self button:@"全曲処理を停止" x:344 y:468 action:@selector(stopWhole:) tag:0];
  self.wholeChoice=[[NSPopUpButton alloc]initWithFrame:NSMakeRect(520,468,150,26) pullsDown:NO];[self.wholeChoice addItemsWithTitles:@[@"A",@"B",@"C"]];[self addSubview:self.wholeChoice];
  [self button:@"全曲案をAUへ承認" x:16 y:506 action:@selector(applyWhole:) tag:0];
  [self button:@"完成WAV採用承認" x:180 y:506 action:@selector(adoptWhole:) tag:0];
  [self button:@"WAV採用Undo承認" x:344 y:506 action:@selector(undoWhole:) tag:0];
  [self button:@"比較フォルダを開く" x:520 y:506 action:@selector(revealWhole:) tag:0];
  [self field:@"全曲: 明示選択Python3/FFmpeg必要。右欄True Peak上限dBTP。信号解析提案・学習AIなし" y:542 editable:NO];
  NSScrollView* scroll=[[NSScrollView alloc]initWithFrame:NSMakeRect(16,578,668,306)];scroll.hasVerticalScroller=YES;self.report=[NSTextField wrappingLabelWithString:@""];self.report.frame=NSMakeRect(0,0,648,900);self.report.font=[NSFont systemFontOfSize:11];scroll.documentView=self.report;[self addSubview:scroll];
  [self update:nil];__weak NovaMixView* weakSelf=self;
  self.refresh=[NSTimer scheduledTimerWithTimeInterval:1 repeats:YES block:^(NSTimer*){[weakSelf update:nil];}];
 }return self;
}
- (void)dealloc{[self.refresh invalidate];[self.wholeController cancel];}
- (void)update:(id)sender{
 CFDictionaryRef d=nullptr;UInt32 size=sizeof(d);OSStatus e=AudioUnitGetProperty(self.unit,Snapshot,kAudioUnitScope_Global,0,&d,&size);
 if(e||!d){self.report.stringValue=[NSString stringWithFormat:@"状態読取エラー %d",(int)e];return;}
 self.state=CFBridgingRelease(d);NSDictionary* b=self.state[@"binding"];
 if(!self.fieldsInitialized){self.sourceField.stringValue=b[@"inputSource"]?:@"user-confirmed AU input";NSUInteger index=[@[@"track",@"bus",@"stereo-out"]indexOfObject:b[@"targetKind"]?:@"track"];if(index!=NSNotFound)[self.targetKind selectItemAtIndex:index];self.fieldsInitialized=YES;}
 if(!self.projectField.stringValue.length)self.projectField.stringValue=b[@"projectId"]?:@"";
 if(!self.trackField.stringValue.length)self.trackField.stringValue=b[@"trackId"]?:@"";
 self.report.stringValue=[NSString stringWithFormat:@"%@\n対象: %@ / %@\nAU instance: %@ / 確認 %@\n現在 [Gain, Low, High, Bypass]: %@\n変更前: %@\n提案 A/B/C: %@\n%@\n外部送信・外部AU操作なし。48 kHz取得区間のLUFS/4x True Peak推定。ライブ取得は全曲・Limiter未対応。\n入力: %@\n出力: %@\n取得状態 %@ / 完了 %@",self.state[@"status"],b[@"projectId"],b[@"trackId"],b[@"instanceId"],b[@"confirmed"],params(self.state[@"current"]),params(self.state[@"before"]),choices(self.state[@"choices"]),self.state[@"reason"]?:@"",measurement(self.state[@"analysis"][@"input"]),measurement(self.state[@"analysis"][@"output"]),self.state[@"analysis"][@"captureState"],self.state[@"analysis"][@"complete"]];
 NSMutableString* detail=[NSMutableString stringWithFormat:@"\nGR %.2f dB / %@",[self.state[@"gainReductionDb"]doubleValue],processingText(self.state[@"processing"])];unsigned k=0;for(id row in self.state[@"processingChoices"])[detail appendFormat:@"\n%c %@",'A'+k++,processingText(row)];for(NSString* side in @[@"input",@"output"]){id m=self.state[@"analysis"][side];if([m[@"lufsMeasured"]boolValue])[detail appendFormat:@"\n%@ %.2f LUFS / %.2f dBTP推定（取得区間）",side,[m[@"integratedLufsExcerpt"]doubleValue],[m[@"truePeakEstimateDbTP"]doubleValue]];}self.report.stringValue=[self.report.stringValue stringByAppendingString:detail];if(self.offlineSummary)self.report.stringValue=[self.report.stringValue stringByAppendingFormat:@"\n%@",self.offlineSummary];
}
- (void)send:(NSMutableDictionary*)command{
 NSDictionary* b=self.state[@"binding"]?:@{};command[@"projectId"]=self.projectField.stringValue;command[@"trackId"]=self.trackField.stringValue;command[@"instanceId"]=b[@"instanceId"]?:@"";
 NSString* chosenKind=@[@"track",@"bus",@"stereo-out"][[self.targetKind indexOfSelectedItem]];NSString* chosenSource=self.sourceField.stringValue.length?self.sourceField.stringValue:@"user-confirmed AU input";
 if(![command[@"operation"] isEqual:@"bind"]&&[b[@"confirmed"]boolValue]&&(![chosenKind isEqual:b[@"targetKind"]]||![chosenSource isEqual:b[@"inputSource"]])){self.report.stringValue=@"入力元またはTrack/Bus/Stereo Out指定が変わりました。対象を再確認してください。";return;}
 if([command[@"operation"] isEqual:@"bind"]){command[@"targetKind"]=@[@"track",@"bus",@"stereo-out"][[self.targetKind indexOfSelectedItem]];command[@"inputSource"]=self.sourceField.stringValue;NSInteger index=[self.tracks indexOfSelectedItem];command[@"role"]=self.wholeRole.titleOfSelectedItem; if(index>=0&&index<[self.manifest[@"tracks"]count])command[@"role"]=self.manifest[@"tracks"][index][@"role"]?:@"unspecified";}

 NSArray* before=self.state[@"current"];NSArray* beforeProcessing=self.state[@"processing"];CFDictionaryRef d=(__bridge CFDictionaryRef)command;OSStatus e=AudioUnitSetProperty(self.unit,Command,kAudioUnitScope_Global,0,&d,sizeof(d));
 [self update:nil];if(!e){for(UInt32 i=0;i<4;++i){if(![before[i] isEqual:self.state[@"current"][i]]){AudioUnitParameter p={self.unit,i,kAudioUnitScope_Global,0};AUParameterListenerNotify(nullptr,nullptr,&p);}}}
 if(!e){for(UInt32 i=0;i<13;++i)if(![beforeProcessing[i]isEqual:self.state[@"processing"][i]]){AudioUnitParameter p={self.unit,i+4,kAudioUnitScope_Global,0};AUParameterListenerNotify(nullptr,nullptr,&p);}}
 if(e)self.report.stringValue=[self.report.stringValue stringByAppendingFormat:@"\n操作を停止 (%d)：対象・現在値・承認を再確認",(int)e];
}
- (NSURL*)chooseWholeFile:(NSString*)message wav:(BOOL)wav{
 NSOpenPanel* p=[NSOpenPanel openPanel];p.message=message;p.allowsMultipleSelection=NO;if(wav)p.allowedContentTypes=@[UTTypeWAV];return [p runModal]==NSModalResponseOK?p.URL:nil;
}
- (NSURL*)wholeResources{return [NSBundle bundleForClass:self.class].resourceURL;}
- (BOOL)wholeTargetMatches:(NSDictionary*)q{
 [self update:nil];NSDictionary* b=self.state[@"binding"];
 return [b[@"confirmed"]boolValue]&&[q[@"projectId"]isEqual:b[@"projectId"]]&&[q[@"trackId"]isEqual:b[@"trackId"]]&&[q[@"instanceId"]isEqual:b[@"instanceId"]]&&[q[@"kind"]isEqual:b[@"targetKind"]]&&[q[@"inputSource"]isEqual:b[@"inputSource"]]&&[q[@"role"]isEqual:b[@"role"]]&&[self.projectField.stringValue isEqual:b[@"projectId"]]&&[self.trackField.stringValue isEqual:b[@"trackId"]]&&[self.sourceField.stringValue isEqual:b[@"inputSource"]]&&[@[@"track",@"bus",@"stereo-out"][self.targetKind.indexOfSelectedItem]isEqual:b[@"targetKind"]];
}
- (void)runWhole:(NSString*)operation choice:(NSString*)choice after:(void (^)(NSDictionary*))after{
 if(!self.wholeRequest||!self.wholePython){self.offlineSummary=@"先に全曲WAVとruntimeを選択してください";return;}
 self.offlineSummary=@"全曲処理/ハッシュ検証中。音声再生スレッドとは別処理";[self update:nil];
 __weak NovaMixView* weakSelf=self;
 [self.wholeController execute:operation request:self.wholeRequest python:self.wholePython resources:self.wholeResources choice:choice completion:^(NSDictionary* reply,NSString* error){
  NovaMixView* view=weakSelf;if(!view)return;
  if(error){view.wholeReply=nil;view.offlineSummary=error;[view update:nil];return;}
  view.wholeReply=reply;NSMutableString* text=[NSMutableString stringWithFormat:@"全曲検証成功 / source SHA %@ / %@\n信号解析ルール提案（学習AIなし）。AU設定は承認待ち。offline追加Gain/ピーク制御はAU未対応。",reply[@"request"][@"sourceWavSha256"],reply[@"request"][@"audioVersion"]];
  for(id row in reply[@"renders"])[text appendFormat:@"\n%@: %.2f LUFS / %.2f dBTP推定 / EQ+Gain %@ / %@ / 追加Gain %.2f dB / TP補正 %.2f dB / %@",row[@"label"],[row[@"measurement"][@"integratedLufs"]doubleValue],[row[@"measurement"][@"truePeakEstimateDbTP"]doubleValue],params(row[@"values"]),processingText(row[@"processing"]),[row[@"finalGainDb"]doubleValue],[row[@"postTruePeakAttenuationDb"]doubleValue],row[@"reason"]];
  view.offlineSummary=text;if(after)after(reply);[view update:nil];
 }];
}
- (void)startWhole:(id)sender{
 if(self.wholeController.busy||self.wholePreparing)return;[self update:nil];NSDictionary* b=[self.state[@"binding"]copy];
 if(![b[@"confirmed"]boolValue]||!self.audioVersion.stringValue.length){self.offlineSummary=@"対象を確認し、音源/プリセット/音声revision IDを入力してください";return;}
 NSURL* wav=[self chooseWholeFile:@"このAUの挿入先をLogicで書き出したWAVを選択（Track/Bus/Stereo Outを手動確認）" wav:YES];if(!wav)return;
 NSURL* python=[self chooseWholeFile:@"使用するローカルPython3実行ファイルを明示選択（ダウンロードなし）" wav:NO];if(!python)return;
 NSURL* ffmpeg=[self chooseWholeFile:@"使用するローカルFFmpeg実行ファイルを明示選択（ダウンロードなし）" wav:NO];if(!ffmpeg)return;
 NSOpenPanel* parent=[NSOpenPanel openPanel];parent.message=@"比較WAVを保存する親フォルダ（新規専用フォルダを作成）";parent.canChooseDirectories=YES;parent.canChooseFiles=NO;if([parent runModal]!=NSModalResponseOK)return;
 NSURL* folder=[parent.URL URLByAppendingPathComponent:[@"NOVA-whole-" stringByAppendingString:NSUUID.UUID.UUIDString] isDirectory:YES];
 if(![NSFileManager.defaultManager createDirectoryAtURL:folder withIntermediateDirectories:NO attributes:nil error:nil])return;
 NSURL* resources=self.wholeResources;NSURL* engine=[resources URLByAppendingPathComponent:@"../MacOS/nova-whole-song"];
 NSMutableDictionary* q=[@{@"format":@"nova-au-whole-request-v1",@"projectId":b[@"projectId"],@"trackId":b[@"trackId"],@"instanceId":b[@"instanceId"],@"inputSource":b[@"inputSource"],@"role":b[@"role"],@"kind":b[@"targetKind"],@"confirmed":@YES,@"audioVersion":self.audioVersion.stringValue,@"settingsToken":self.state[@"settingsToken"],@"instruction":self.instruction.stringValue,@"targetLufs":@(self.targetLufs.doubleValue),@"ceilingDbTP":@(self.peakCeiling.doubleValue),@"sourceWav":wav.path,@"engine":engine.path,@"ffmpeg":ffmpeg.path,@"output":[folder URLByAppendingPathComponent:@"audio"].path}mutableCopy];
 self.wholeRequest=[folder URLByAppendingPathComponent:@"request.json"];self.wholePython=python;self.wholeReply=nil;
 // Hash large source on a worker, never on audio/main callbacks.
 NSURL* request=self.wholeRequest;self.wholePreparing=YES;NSUInteger generation=++self.wholeGeneration;
 dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED,0), ^{
  for(NSString* key in @[@"sourceWav",@"engine",@"ffmpeg"]){NSString* hash=NovaFileSHA256([NSURL fileURLWithPath:q[key]]);if(hash)q[[key stringByAppendingString:@"Sha256"]]=hash;}
  q[@"pythonSha256"]=NovaFileSHA256(python)?:@"";q[@"pipelineSha256"]=NovaFileSHA256([resources URLByAppendingPathComponent:@"whole-song.py"])?:@"";
  NSData* data=[NSJSONSerialization dataWithJSONObject:q options:NSJSONWritingPrettyPrinted error:nil];BOOL written=[data writeToURL:request atomically:YES];
  dispatch_async(dispatch_get_main_queue(), ^{self.wholePreparing=NO;if(generation!=self.wholeGeneration)return;if(!written){self.offlineSummary=@"request保存失敗";return;}[self runWhole:@"run" choice:nil after:nil];});
 });
}
- (void)resumeWhole:(id)sender{
 if(self.wholeController.busy||self.wholePreparing)return;
 NSURL* request=[self chooseWholeFile:@"保存したrequest.jsonを選択。再Open後のAU適用には新たな全曲解析が必要" wav:NO];if(!request)return;
 NSURL* python=[self chooseWholeFile:@"request作成時と同じPython実行ファイルを選択" wav:NO];if(!python)return;
 // Explicit external executable confirmation on reopen; do not trust a JSON path as permission to execute.
 NSURL* ffmpeg=[self chooseWholeFile:@"request作成時と同じFFmpeg実行ファイルを選択" wav:NO];if(!ffmpeg)return;
 NSNumber* size;[request getResourceValue:&size forKey:NSURLFileSizeKey error:nil];if(!size||size.unsignedLongLongValue>4*1024*1024)return;
 NSDictionary* q=[NSJSONSerialization JSONObjectWithData:[NSData dataWithContentsOfURL:request] options:0 error:nil];if(![q[@"ffmpeg"]isEqual:ffmpeg.path]){self.offlineSummary=@"FFmpegパス不一致";return;}
 self.wholeRequest=request;self.wholePython=python;self.wholeReply=nil;[self runWhole:@"resume" choice:nil after:nil];
}
- (void)stopWhole:(id)sender{++self.wholeGeneration;[self.wholeController cancel];self.offlineSummary=@"全曲処理を停止中。完了前の候補は採用できません";}
- (void)applyWhole:(id)sender{
 if(!self.wholeReply||self.wholeController.busy)return;NSInteger index=self.wholeChoice.indexOfSelectedItem;id row=self.wholeReply[@"renders"][index+1];
 NSAlert* alert=[NSAlert new];alert.messageText=@"全曲実測案の共有パラメータだけをこのNOVA AUへ適用しますか？";alert.informativeText=[NSString stringWithFormat:@"現在 %@\n新値 %@\n現在 %@\n新値 %@\nオフライン追加Gain・Lookahead・TP補正は反映されません。適用後にLogicを再出力して全曲再測定してください。",params(self.state[@"current"]),params(row[@"values"]),processingText(self.state[@"processing"]),processingText(row[@"processing"])];[alert addButtonWithTitle:@"承認・適用"];[alert addButtonWithTitle:@"戻る"];if(alert.runModal!=NSAlertFirstButtonReturn)return;
 [self runWhole:@"verify" choice:nil after:^(NSDictionary* reply){
  if(![self wholeTargetMatches:reply[@"request"]]){self.offlineSummary=@"曲/Track/音源/挿入先/AUが変わりました。再解析してください";return;}
  [self send:[@{@"operation":@"apply-whole-song",@"approved":@YES,@"choice":@(index),@"result":reply}mutableCopy]];
  // Read back every public parameter, independent of snapshot dictionary.
  NSMutableArray* actual=[NSMutableArray array];for(UInt32 i=0;i<17;++i){AudioUnitParameterValue value=0;OSStatus e=AudioUnitGetParameter(self.unit,i,kAudioUnitScope_Global,0,&value);[actual addObject:e?@"read-error":@(value)];}
  self.offlineSummary=[self.offlineSummary stringByAppendingFormat:@"\nAU公開パラメータ再取得: %@（成功判定は上の操作statusを確認）",actual];
 }];
}
- (void)adoptWhole:(id)sender{if(self.wholeReply)[self runWhole:@"adopt" choice:self.wholeChoice.titleOfSelectedItem after:nil];}
- (void)undoWhole:(id)sender{if(self.wholeReply)[self runWhole:@"undo" choice:nil after:nil];}
- (void)revealWhole:(id)sender{NSString* path=self.wholeReply[@"request"][@"output"];if(path)[NSWorkspace.sharedWorkspace openURL:[NSURL fileURLWithPath:path]];}
- (void)wholeSong:(id)sender{
 NSOpenPanel* panel=[NSOpenPanel openPanel];panel.allowedContentTypes=@[UTTypeJSON];panel.allowsMultipleSelection=NO;if([panel runModal]!=NSModalResponseOK)return;
 NSNumber* size;[panel.URL getResourceValue:&size forKey:NSURLFileSizeKey error:nil];if(!size||size.unsignedLongLongValue>4*1024*1024){self.offlineSummary=@"全曲manifestは4 MiB以下が必要です";return;}
 NSData* manifestData=[NSData dataWithContentsOfURL:panel.URL options:NSDataReadingMappedIfSafe error:nil];if(!manifestData||manifestData.length>4*1024*1024){self.offlineSummary=@"全曲manifestを読み込めません";return;}
 NSDictionary* m=[NSJSONSerialization JSONObjectWithData:manifestData options:0 error:nil];
 if(![m isKindOfClass:NSDictionary.class]||![m[@"format"]isEqual:@"nova-whole-song-v1"]||![m[@"complete"]isEqual:@YES]||![m[@"status"]isEqual:@"complete"]||![m[@"identity"]isKindOfClass:NSDictionary.class]||![m[@"artifacts"]isKindOfClass:NSDictionary.class]||![m[@"renders"]isKindOfClass:NSArray.class]||[m[@"renders"]count]!=4||[m[@"artifacts"]count]>64){self.offlineSummary=@"全曲完了manifestではありません";return;}
 for(NSString* required in @[@"original.wav",@"A.wav",@"B.wav",@"C.wav",@"source.f32"]){if(![m[@"artifacts"][required]isKindOfClass:NSString.class]){self.offlineSummary=@"全曲成果物の一覧が不完全です";return;}}
 unsigned expectedLabel=0;for(id row in m[@"renders"]){if(![row isKindOfClass:NSDictionary.class]||![row[@"label"]isEqual:@[@"original",@"A",@"B",@"C"][expectedLabel++]]||![row[@"measurement"]isKindOfClass:NSDictionary.class]){self.offlineSummary=@"全曲計測の形式が不正です";return;}for(NSString* key in @[@"integratedLufs",@"truePeakEstimateDbTP",@"frames"]){if(![row[@"measurement"][key]isKindOfClass:NSNumber.class]){self.offlineSummary=@"全曲計測の数値が不正です";return;}}}
 NSDictionary* identity=m[@"identity"];NSDictionary* binding=self.state[@"binding"];
 if(![binding[@"confirmed"]boolValue]||![identity[@"projectId"]isEqual:binding[@"projectId"]]||![identity[@"trackId"]isEqual:binding[@"trackId"]]||![identity[@"kind"]isEqual:binding[@"targetKind"]]){self.offlineSummary=@"全曲結果の曲・Track・処理位置が確認済み対象と一致しません";return;}
 NSURL* directory=panel.URL.URLByDeletingLastPathComponent;self.offlineSummary=@"全曲比較ファイルのSHA256を照合中（ライブAU設定は変更しません）";
 NSString* project=[binding[@"projectId"]copy];NSString* track=[binding[@"trackId"]copy];
 dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED,0), ^{
  BOOL valid=YES;NSRegularExpression* hex=[NSRegularExpression regularExpressionWithPattern:@"^[a-f0-9]{64}$" options:0 error:nil];
  for(id name in m[@"artifacts"]){id expected=m[@"artifacts"][name];if(![name isKindOfClass:NSString.class]||![name isEqual:[name lastPathComponent]]||![expected isKindOfClass:NSString.class]||![hex numberOfMatchesInString:expected options:0 range:NSMakeRange(0,[expected length])]){valid=NO;break;}
   NSInputStream* stream=[NSInputStream inputStreamWithURL:[directory URLByAppendingPathComponent:name]];[stream open];CC_SHA256_CTX context;CC_SHA256_Init(&context);uint8_t buffer[65536];NSInteger count;while((count=[stream read:buffer maxLength:sizeof(buffer)])>0)CC_SHA256_Update(&context,buffer,(CC_LONG)count);[stream close];if(count<0){valid=NO;break;}uint8_t digest[CC_SHA256_DIGEST_LENGTH];CC_SHA256_Final(digest,&context);NSMutableString* actual=[NSMutableString string];for(unsigned j=0;j<sizeof(digest);++j)[actual appendFormat:@"%02x",digest[j]];if(![actual isEqual:expected]){valid=NO;break;}
  }
  NSMutableString* summary=[NSMutableString stringWithFormat:@"全曲SHA256照合 %@ / audioVersion %@ / source SHA %@\nオフライン結果。ライブAUのLimiter・Gainや他社AUへの自動適用なし。",valid?@"成功":@"失敗",identity[@"audioVersion"],identity[@"sourceWavSha256"]];
  if(valid)for(id row in m[@"renders"]){if(![row isKindOfClass:NSDictionary.class]||![row[@"measurement"]isKindOfClass:NSDictionary.class]){valid=NO;break;}NSDictionary* measured=row[@"measurement"];[summary appendFormat:@"\n%@: %.2f LUFS / %.2f dBTP推定 / %@ frames",row[@"label"],[measured[@"integratedLufs"]doubleValue],[measured[@"truePeakEstimateDbTP"]doubleValue],measured[@"frames"]];}
  dispatch_async(dispatch_get_main_queue(), ^{if(![self.state[@"binding"][@"projectId"]isEqual:project]||![self.state[@"binding"][@"trackId"]isEqual:track])self.offlineSummary=@"照合中に対象が変わりました。再照合してください";else self.offlineSummary=valid?summary:@"全曲比較ファイルの照合失敗。採用しないでください";[self update:nil];});
 });
}
- (void)compare:(id)s{NSOpenPanel* p=[NSOpenPanel openPanel];p.canChooseDirectories=YES;p.canChooseFiles=NO;p.allowsMultipleSelection=NO;if([p runModal]==NSModalResponseOK)[self send:[@{@"operation":@"compare",@"approved":@YES,@"directory":p.URL.path}mutableCopy]];}
- (void)capture:(id)s{[self send:[@{@"operation":@"capture",@"consent":@YES}mutableCopy]];}
- (void)bind:(id)s{[self send:[@{@"operation":@"bind",@"confirmed":@YES}mutableCopy]];}
- (void)master:(id)s{[self send:[@{@"operation":@"preview",@"instruction":@"マスタリングして",@"targetLufs":@(self.targetLufs.doubleValue)}mutableCopy]];}
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
