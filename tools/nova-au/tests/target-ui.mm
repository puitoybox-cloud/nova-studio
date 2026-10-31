// Exercise the production native view against an uninstalled development AU.
#define main existingHostMain
#include "host.mm"
#undef main
#import <Cocoa/Cocoa.h>
#import <AudioUnit/AUCocoaUIView.h>
@interface NSView (TargetTest)
- (void)bind:(id)sender;
- (void)preview:(id)sender;
- (void)apply:(id)sender;
- (void)undo:(id)sender;
- (void)selectTrack:(id)sender;
- (void)reloadTracks;
- (void)update:(id)sender;
@end
int main(int argc,char** argv){@autoreleasepool{
 check(argc==2,"target-ui BUNDLE");[NSApplication sharedApplication];
 NSBundle* bundle=[NSBundle bundleWithPath:[NSString stringWithUTF8String:argv[1]]];NSError* error=nil;
 check([bundle loadAndReturnError:&error],"load production view");
 void* lib=dlopen(bundle.executablePath.UTF8String,RTLD_NOW|RTLD_LOCAL);check(lib,"binary");
 auto factory=(AudioComponentFactoryFunction)dlsym(lib,"NovaMixFactory");check(factory,"factory");
 AudioComponentDescription desc={'aufx','NvMx','NvSt',0,0};auto c=AudioComponentRegister(&desc,CFSTR("NOVA: Mix"),256,factory);
 AudioUnit unit=nullptr;ok(AudioComponentInstanceNew(c,&unit),"create unit");Source source;configure(unit,&source,48000,256);
 id<AUCocoaUIBase> vf=[NSClassFromString(@"NovaMixViewFactory")new];NSView* view=[vf uiViewForAudioUnit:unit withSize:NSMakeSize(700,900)];
 NSPopUpButton* menu=[view valueForKey:@"tracks"];check(!menu.enabled&&[menu.titleOfSelectedItem containsString:@"Logic自動検出なし"],"empty menu explains handoff-only selection");
 [view selectTrack:nil];check(![[view valueForKey:@"trackField"]stringValue].length,"placeholder cannot become an ID");
 [[view valueForKey:@"instruction"]setStringValue:@"音量を6dB下げて"];[view preview:nil];check(!snapshot(unit)[@"choices"],"unconfirmed preview blocked");
 [[view valueForKey:@"projectField"]setStringValue:@"partial"];[view bind:nil];check(![snapshot(unit)[@"binding"][@"confirmed"]boolValue],"partial IDs rejected");
 [[view valueForKey:@"projectField"]setStringValue:@""];
 [[view valueForKey:@"targetKind"]selectItemAtIndex:2];[view bind:nil];
 check([snapshot(unit)[@"binding"][@"confirmed"]boolValue],"Logic-only empty IDs confirm AU input");
 auto before=render(unit,96000,256);[view preview:nil];check([snapshot(unit)[@"choices"][2][0]floatValue]==-6,"numeric proposal without capture");
 check([snapshot(unit)[@"current"][0]floatValue]==0,"preview preserves Gain");NSButton* button=[NSButton new];button.tag=2;[view apply:button];
 auto after=render(unit,96000,256);check(std::abs(20*log10(rms(after)/rms(before))+6)<.04,"approved C renders -6dB");[view undo:nil];check([snapshot(unit)[@"current"][0]floatValue]==0,"Undo restores Gain");
 [view setValue:@{@"tracks":@[@{@"id":@"piano",@"name":@"Piano"},@{@"id":@"bass",@"name":@"Bass"}]} forKey:@"manifest"];
 [[view valueForKey:@"projectField"]setStringValue:@"studio-project"];[view reloadTracks];check(menu.enabled&&menu.numberOfItems==2,"handoff tracks enabled");
 [menu selectItemAtIndex:1];[view selectTrack:nil];check([[[view valueForKey:@"trackField"]stringValue]isEqual:@"bass"],"selected handoff ID");[view bind:nil];
 check([snapshot(unit)[@"binding"][@"projectId"]isEqual:@"studio-project"]&&[snapshot(unit)[@"binding"][@"trackId"]isEqual:@"bass"],"Studio explicit binding");
 [view setValue:@{@"tracks":@[]} forKey:@"manifest"];[view reloadTracks];[view selectTrack:nil];check(!menu.enabled&&[menu.titleOfSelectedItem containsString:@"ありません"],"empty handoff safe");
 [[view valueForKey:@"refresh"]invalidate];ok(AudioUnitUninitialize(unit),"stop");
 puts("PASS native target menu, local/Studio binding, partial-ID refusal, proposal, -6dB render, Undo; Logic unverified");
}}
