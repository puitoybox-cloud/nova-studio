#import <Foundation/Foundation.h>
#import <AudioToolbox/AudioToolbox.h>
#include <dlfcn.h>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <vector>
#include <fstream>
#include <thread>
static void check(bool v,const char* m){if(!v){fprintf(stderr,"FAIL: %s\n",m);exit(1);}}
static void ok(OSStatus s,const char* m){if(s){fprintf(stderr,"FAIL %s: %d\n",m,(int)s);exit(1);}}
struct Source{double sr=48000,hz=1000,amplitude=.1;uint64_t frame=0;};
static OSStatus input(void* ref,AudioUnitRenderActionFlags*,const AudioTimeStamp*,UInt32,UInt32 n,AudioBufferList* b){
 auto& s=*(Source*)ref;for(unsigned c=0;c<b->mNumberBuffers;++c){auto* p=(float*)b->mBuffers[c].mData;if(!p)return kAudio_ParamError;for(unsigned f=0;f<n;++f)p[f]=s.amplitude*std::sin(2*3.141592653589793*s.hz*(s.frame+f)/s.sr);}s.frame+=n;return noErr;
}
static NSDictionary* snapshot(AudioUnit u){CFDictionaryRef d=nullptr;UInt32 n=sizeof(d);ok(AudioUnitGetProperty(u,64001,0,0,&d,&n),"snapshot");return CFBridgingRelease(d);}
static OSStatus command(AudioUnit u,NSDictionary* d){CFDictionaryRef cf=(__bridge CFDictionaryRef)d;return AudioUnitSetProperty(u,64000,0,0,&cf,sizeof(cf));}
static NSMutableDictionary* cmd(AudioUnit u,NSString* op){NSMutableDictionary* d=[snapshot(u)[@"binding"]mutableCopy];d[@"operation"]=op;return d;}
static void configure(AudioUnit u,Source* source,double sr,unsigned buffer){
 AudioStreamBasicDescription f={};f.mSampleRate=sr;f.mFormatID=kAudioFormatLinearPCM;f.mFormatFlags=AudioFormatFlags(kAudioFormatFlagsNativeFloatPacked)|AudioFormatFlags(kAudioFormatFlagIsNonInterleaved);f.mBytesPerPacket=4;f.mFramesPerPacket=1;f.mBytesPerFrame=4;f.mChannelsPerFrame=2;f.mBitsPerChannel=32;
 ok(AudioUnitSetProperty(u,kAudioUnitProperty_StreamFormat,kAudioUnitScope_Input,0,&f,sizeof(f)),"input format");ok(AudioUnitSetProperty(u,kAudioUnitProperty_StreamFormat,kAudioUnitScope_Output,0,&f,sizeof(f)),"output format");
 UInt32 max=4096;ok(AudioUnitSetProperty(u,kAudioUnitProperty_MaximumFramesPerSlice,0,0,&max,sizeof(max)),"max frames");
 source->sr=sr;source->frame=0;AURenderCallbackStruct cb{input,source};ok(AudioUnitSetProperty(u,kAudioUnitProperty_SetRenderCallback,kAudioUnitScope_Input,0,&cb,sizeof(cb)),"input callback");ok(AudioUnitInitialize(u),"initialize");
}
static std::vector<float> render(AudioUnit u,unsigned count,unsigned block){
 static uint64_t clock=0;
 std::vector<float> out;struct Stereo{UInt32 n;AudioBuffer b[2];} buffers;
 std::vector<float> l(block),r(block);for(unsigned pos=0;pos<count;pos+=block){unsigned n=std::min(block,count-pos);buffers.n=2;buffers.b[0]={1,n*4,l.data()};buffers.b[1]={1,n*4,r.data()};AudioTimeStamp t={};t.mSampleTime=clock;clock+=n;t.mFlags=kAudioTimeStampSampleTimeValid;AudioUnitRenderActionFlags flags=0;
  ok(AudioUnitRender(u,&flags,&t,0,n,(AudioBufferList*)&buffers),"actual AU render");for(unsigned f=0;f<n;++f){check(std::isfinite(l[f])&&std::abs(l[f])<=.981,"finite bounded output");check(l[f]==r[f],"stereo identical source");out.push_back(l[f]);}}
 return out;
}
static double rms(const std::vector<float>& a){double x=0;for(size_t i=a.size()/2;i<a.size();++i)x+=a[i]*a[i];return std::sqrt(x/(a.size()-a.size()/2));}
static void wav(const char* path,const std::vector<float>& a){std::ofstream o(path,std::ios::binary);auto u16=[&](uint16_t n){o.write((char*)&n,2);};auto u32=[&](uint32_t n){o.write((char*)&n,4);};o.write("RIFF",4);u32(36+a.size()*8);o.write("WAVEfmt ",8);u32(16);u16(3);u16(2);u32(48000);u32(48000*8);u16(8);u16(32);o.write("data",4);u32(a.size()*8);for(float v:a){o.write((char*)&v,4);o.write((char*)&v,4);}check(o.good(),"WAV written");}
int main(int argc,char** argv){@autoreleasepool{
 check(argc==3,"host BINARY OUTPUT_PREFIX");void* lib=dlopen(argv[1],RTLD_NOW|RTLD_LOCAL);if(!lib){fprintf(stderr,"%s\n",dlerror());return 1;}
 auto factory=(AudioComponentFactoryFunction)dlsym(lib,"NovaMixFactory");check(factory,"factory symbol");AudioComponentDescription desc={'aufx','NvMx','NvSt',0,0};auto c=AudioComponentRegister(&desc,CFSTR("NOVA: Mix"),256,factory);check(c,"register actual AU binary");
 AudioUnit a=nullptr,b=nullptr;ok(AudioComponentInstanceNew(c,&a),"create a");ok(AudioComponentInstanceNew(c,&b),"create b");check(![snapshot(a)[@"binding"][@"instanceId"] isEqual:snapshot(b)[@"binding"][@"instanceId"]],"distinct instance IDs");
 Source source;std::vector<float> flat,changed;
 for(double sr:{22050.,44100.,48000.,96000.,192000.})for(unsigned block:{32u,256u,2048u}){
  configure(a,&source,sr,block);source.hz=1000;ok(AudioUnitSetParameter(a,0,0,0,0,0),"flat gain");ok(AudioUnitSetParameter(a,2,0,0,0,0),"flat EQ");flat=render(a,65536,block);
  ok(AudioUnitSetParameter(a,0,0,0,-6,0),"gain -6");changed=render(a,65536,block);double gain=20*log10(rms(changed)/rms(flat));check(std::abs(gain+6)<.04,"measured gain -6 dB");
  ok(AudioUnitSetParameter(a,0,0,0,0,0),"gain reset");source.hz=10000;flat=render(a,65536,block);ok(AudioUnitSetParameter(a,2,0,0,-6,0),"high EQ");changed=render(a,65536,block);double eq=20*log10(rms(changed)/rms(flat));check(eq < -1.5,"measured high EQ attenuation");
  printf("AU sr=%.0f frames=%u gain=%.5f dB high=%.5f dB\n",sr,block,gain,eq);ok(AudioUnitSetParameter(a,2,0,0,0,0),"high reset");source.hz=80;flat=render(a,65536,block);ok(AudioUnitSetParameter(a,1,0,0,-6,0),"low EQ");changed=render(a,65536,block);check(20*log10(rms(changed)/rms(flat))<-3,"measured low EQ");ok(AudioUnitSetParameter(a,1,0,0,0,0),"low reset");
  UInt32 bypass=1;ok(AudioUnitSetProperty(a,kAudioUnitProperty_BypassEffect,0,0,&bypass,sizeof(bypass)),"host bypass on");changed=render(a,65536,block);check(std::abs(rms(changed)/rms(flat)-1)<.02,"bypass audio");UInt32 read=0,sz=sizeof(read);ok(AudioUnitGetProperty(a,kAudioUnitProperty_BypassEffect,0,0,&read,&sz),"read bypass");check(read==1,"bypass property matches");bypass=0;ok(AudioUnitSetProperty(a,kAudioUnitProperty_BypassEffect,0,0,&bypass,sizeof(bypass)),"host bypass off");
  ok(AudioUnitUninitialize(a),"uninitialize");
 }
 check(AudioUnitSetParameter(a,0,0,0,NAN,0)!=noErr,"reject NaN");check(AudioUnitSetParameter(a,0,0,0,7,0)!=noErr,"reject range");
 ok(command(a,@{@"operation":@"bind",@"projectId":@"song-1",@"trackId":@"piano-1",@"confirmed":@YES}),"bind explicit Track");
 ok(AudioUnitSetParameter(a,0,0,0,0,0),"reset gain");ok(AudioUnitSetParameter(a,2,0,0,0,0),"reset eq");auto d=cmd(a,@"preview");d[@"instruction"]=@"ピアノを柔らかくして";ok(command(a,d),"Japanese preview");check([snapshot(a)[@"current"][2]floatValue]==0,"preview does not apply");
 ok(AudioUnitSetParameter(a,0,0,0,1,0),"host automation after preview");auto stale=cmd(a,@"apply");stale[@"approved"]=@YES;stale[@"choice"]=@1;check(command(a,stale)!=noErr,"reject stale proposal after automation");ok(AudioUnitSetParameter(a,0,0,0,0,0),"return baseline");
 d=cmd(a,@"apply");d[@"choice"]=@1;check(command(a,d)!=noErr,"approval required");d[@"approved"]=@YES;d[@"instanceId"]=@"wrong-instance";check(command(a,d)!=noErr,"reject wrong AU instance");d[@"instanceId"]=snapshot(a)[@"binding"][@"instanceId"];ok(command(a,d),"approved B applies");check([snapshot(a)[@"current"][2]floatValue]==-2,"actual parameter changed");check([snapshot(b)[@"current"][2]floatValue]==0,"instances isolated");
 configure(a,&source,48000,256);source.hz=10000;auto processed=render(a,96000,256);std::string path=std::string(argv[2])+"-approved.wav";wav(path.c_str(),processed);
 d=cmd(a,@"undo");d[@"approved"]=@YES;ok(command(a,d),"approved undo");check([snapshot(a)[@"current"][2]floatValue]==0,"undo restores");
 ok(AudioUnitSetParameter(a,0,0,0,-3,0),"non-default gain before save");ok(AudioUnitSetParameter(a,2,0,0,-2,0),"non-default EQ before save");
 source.amplitude=0;auto silence=render(a,65536,256);check(rms(silence)<1e-8,"silence settles");source.amplitude=100;render(a,65536,256);source.amplitude=NAN;render(a,65536,256);source.amplitude=.1;
 // Concurrent host automation must not stop or corrupt the real render path.
 std::thread automation([&]{for(unsigned i=0;i<10000;++i)ok(AudioUnitSetParameter(a,0,0,0,i%2?-3:0,0),"concurrent host automation");});
 render(a,96000,256);automation.join();ok(AudioUnitSetParameter(a,0,0,0,-3,0),"restore save target");
 AUPreset named{-1,CFSTR("NOVA CI Preset")};ok(AudioUnitSetProperty(a,kAudioUnitProperty_PresentPreset,0,0,&named,sizeof(named)),"host preset name");
 CFPropertyListRef saved=nullptr;UInt32 size=sizeof(saved);ok(AudioUnitGetProperty(a,kAudioUnitProperty_ClassInfo,0,0,&saved,&size),"host state save");
 check([((__bridge NSDictionary*)saved)[@"name"] isEqual:@"NOVA CI Preset"],"preset name retained in class state");
 ok(AudioUnitSetProperty(b,kAudioUnitProperty_ClassInfo,0,0,&saved,sizeof(saved)),"new AU restore");CFRelease(saved);check([snapshot(b)[@"current"][0]floatValue]==-3&&[snapshot(b)[@"current"][2]floatValue]==-2,"non-default gain/EQ survive restore");check(![snapshot(b)[@"binding"][@"confirmed"]boolValue],"restored binding needs re-confirmation");

 // Actual AU input capture -> control-thread FFT -> measured candidates -> actual render/Undo.
 for(unsigned id=0;id<4;++id)ok(AudioUnitSetParameter(a,id,0,0,0,0),"analysis baseline");
 source.hz=10000;source.frame=0;source.amplitude=.2;ok(AudioUnitReset(a,0,0),"analysis reset");
 d=cmd(a,@"capture");check(command(a,d)!=noErr,"capture consent required");d[@"consent"]=@YES;ok(command(a,d),"explicit capture consent");
 render(a,96000,256);NSDictionary* analysis=snapshot(a);check([analysis[@"audioAnalyzed"]boolValue],"actual input analyzed");check([analysis[@"analysis"][@"input"][@"bandPowerFractions"][2]doubleValue]>.99,"actual FFT high band");
 check(std::abs([analysis[@"analysis"][@"input"][@"rms"]doubleValue]-.2/sqrt(2))<.00001,"actual RMS");
 d=cmd(a,@"preview");d[@"instruction"]=@"全体の音を自然に整えて";ok(command(a,d),"measured Japanese preview");NSDictionary* proposal=snapshot(a);check([proposal[@"proposalAudioAnalyzed"]boolValue],"proposal really measured");NSArray* settings=proposal[@"choices"];
 d=cmd(a,@"compare");d[@"approved"]=@YES;d[@"directory"]=[NSString stringWithUTF8String:argv[2]].stringByDeletingLastPathComponent;ok(command(a,d),"actual capture offline comparison WAVs");
 d=cmd(a,@"apply");d[@"approved"]=@YES;d[@"choice"]=@1;ok(command(a,d),"measured B applies to real AU");check([snapshot(a)[@"current"]isEqual:settings[1]],"measured actual AU values");
 d=cmd(a,@"capture");d[@"consent"]=@YES;ok(command(a,d),"post-apply capture");source.frame=0;auto measuredB=render(a,96000,256);NSDictionary* after=snapshot(a);check([after[@"audioAnalyzed"]boolValue],"post-apply remeasurement");check([after[@"analysis"][@"output"][@"rms"]doubleValue]<[after[@"analysis"][@"input"][@"rms"]doubleValue],"actual output reduced");
 wav((std::string(argv[2])+"-measured-B.wav").c_str(),measuredB);

 CFPropertyListRef measuredSaved=nullptr;UInt32 measuredSize=sizeof(measuredSaved);ok(AudioUnitGetProperty(a,kAudioUnitProperty_ClassInfo,0,0,&measuredSaved,&measuredSize),"measured state save");ok(AudioUnitSetProperty(b,kAudioUnitProperty_ClassInfo,0,0,&measuredSaved,sizeof(measuredSaved)),"measured history restore");CFRelease(measuredSaved);check([snapshot(b)[@"history"]count]>0&&[snapshot(b)[@"undoCount"]unsignedIntValue]>0,"bounded measurements and undo persisted");
 ok(command(b,@{@"operation":@"bind",@"projectId":@"song-1",@"trackId":@"piano-1",@"confirmed":@YES}),"restored target reconfirmation");auto restoredUndo=cmd(b,@"undo");restoredUndo[@"approved"]=@YES;ok(command(b,restoredUndo),"restored undo after reconfirmation");check([snapshot(b)[@"current"][2]floatValue]==0,"restored undo actual parameter");
 source.amplitude=3;auto stopped=render(a,4096,256);check([snapshot(a)[@"safetyStopped"]boolValue],"measured safety level stop");for(float v:stopped)check(v==0,"safety stop mutes output");source.amplitude=.2;
 d=cmd(a,@"undo");d[@"approved"]=@YES;ok(command(a,d),"measured undo");check([snapshot(a)[@"current"][2]floatValue]==0,"measured undo value");
 // A/B/C rendered through the actual AU factory with identical source start/reset.
 NSMutableArray* actualRows=[NSMutableArray array];std::vector<std::vector<float>> actualAudio;
 double common=1;
 for(unsigned k=0;k<4;++k){for(unsigned id=0;id<4;++id)ok(AudioUnitSetParameter(a,id,0,0,k?[settings[k-1][id]floatValue]:0,0),"actual audition parameters");source.frame=0;ok(AudioUnitReset(a,0,0),"same audition start");auto audio=render(a,96000,256);double level=rms(audio);common=std::min(common,level);actualAudio.push_back(audio);[actualRows addObject:@{@"choice":@(k),@"rmsLastHalf":@(level),@"settings":k?settings[k-1]:@[@0,@0,@0,@0]}];}
 for(unsigned k=0;k<4;++k){std::string label=k?std::string(1,char('A'+k-1)):"original";wav((std::string(argv[2])+"-"+label+".wav").c_str(),actualAudio[k]);double factor=common/rms(actualAudio[k]);for(float& v:actualAudio[k])v*=factor;wav((std::string(argv[2])+"-"+label+"-rms-matched.wav").c_str(),actualAudio[k]);}
 NSData* report=[NSJSONSerialization dataWithJSONObject:@{@"inputCapture":analysis,@"proposal":proposal,@"postApply":after,@"actualAURenders":actualRows,@"source":@"deterministic 10 kHz signal through real AU; not Logic or an instrument"} options:NSJSONWritingPrettyPrinted error:nil];check([report writeToFile:[[NSString stringWithUTF8String:argv[2]]stringByAppendingString:@"-analysis.json"] atomically:YES],"AU measured evidence saved");
 source.hz=80;for(unsigned id=0;id<4;++id)ok(AudioUnitSetParameter(a,id,0,0,0,0),"low baseline");ok(AudioUnitReset(a,0,0),"low reset");d=cmd(a,@"capture");d[@"consent"]=@YES;ok(command(a,d),"low capture");render(a,96000,2048);check([snapshot(a)[@"analysis"][@"input"][@"bandPowerFractions"][0]doubleValue]>.99,"actual low FFT");d=cmd(a,@"preview");d[@"instruction"]=@"全体の音を自然に整えて";ok(command(a,d),"low measured preview");check(![snapshot(a)[@"choices"]isEqual:settings],"different actual audio different candidates");
 ok(AudioUnitUninitialize(a),"stop");ok(AudioComponentInstanceDispose(a),"destroy a");ok(AudioComponentInstanceDispose(b),"destroy b");
 puts("Actual AU binary host, stereo, Gain/EQ, Japanese approval/Undo, isolation and state tests PASS. Logic not tested.");
 // Keep the code loaded until process exit: component registry owns its factory pointer.
}}
