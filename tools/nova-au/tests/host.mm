#import <Foundation/Foundation.h>
#import <AudioToolbox/AudioToolbox.h>
#include <dlfcn.h>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <vector>
#include <fstream>
static void check(bool v,const char* m){if(!v){fprintf(stderr,"FAIL: %s\n",m);exit(1);}}
static void ok(OSStatus s,const char* m){if(s){fprintf(stderr,"FAIL %s: %d\n",m,(int)s);exit(1);}}
struct Source{double sr=48000,hz=1000;uint64_t frame=0;};
static OSStatus input(void* ref,AudioUnitRenderActionFlags*,const AudioTimeStamp*,UInt32,UInt32 n,AudioBufferList* b){
 auto& s=*(Source*)ref;for(unsigned c=0;c<b->mNumberBuffers;++c){auto* p=(float*)b->mBuffers[c].mData;if(!p)return kAudio_ParamError;for(unsigned f=0;f<n;++f)p[f]=.1*std::sin(2*3.141592653589793*s.hz*(s.frame+f)/s.sr);}s.frame+=n;return noErr;
}
static NSDictionary* snapshot(AudioUnit u){CFDictionaryRef d=nullptr;UInt32 n=sizeof(d);ok(AudioUnitGetProperty(u,64001,0,0,&d,&n),"snapshot");return CFBridgingRelease(d);}
static OSStatus command(AudioUnit u,NSDictionary* d){CFDictionaryRef cf=(__bridge CFDictionaryRef)d;return AudioUnitSetProperty(u,64000,0,0,&cf,sizeof(cf));}
static NSMutableDictionary* cmd(AudioUnit u,NSString* op){NSMutableDictionary* d=[snapshot(u)[@"binding"]mutableCopy];d[@"operation"]=op;return d;}
static void configure(AudioUnit u,Source* source,double sr,unsigned buffer){
 AudioStreamBasicDescription f={};f.mSampleRate=sr;f.mFormatID=kAudioFormatLinearPCM;f.mFormatFlags=kAudioFormatFlagsNativeFloatPacked|kAudioFormatFlagIsNonInterleaved;f.mBytesPerPacket=4;f.mFramesPerPacket=1;f.mBytesPerFrame=4;f.mChannelsPerFrame=2;f.mBitsPerChannel=32;
 ok(AudioUnitSetProperty(u,kAudioUnitProperty_StreamFormat,kAudioUnitScope_Input,0,&f,sizeof(f)),"input format");ok(AudioUnitSetProperty(u,kAudioUnitProperty_StreamFormat,kAudioUnitScope_Output,0,&f,sizeof(f)),"output format");
 UInt32 max=4096;ok(AudioUnitSetProperty(u,kAudioUnitProperty_MaximumFramesPerSlice,0,0,&max,sizeof(max)),"max frames");
 source->sr=sr;source->frame=0;AURenderCallbackStruct cb{input,source};ok(AudioUnitSetProperty(u,kAudioUnitProperty_SetRenderCallback,kAudioUnitScope_Input,0,&cb,sizeof(cb)),"input callback");ok(AudioUnitInitialize(u),"initialize");
}
static std::vector<float> render(AudioUnit u,unsigned count,unsigned block){
 std::vector<float> out;struct Stereo{UInt32 n;AudioBuffer b[2];} buffers;
 std::vector<float> l(block),r(block);for(unsigned pos=0;pos<count;pos+=block){unsigned n=std::min(block,count-pos);buffers.n=2;buffers.b[0]={1,n*4,l.data()};buffers.b[1]={1,n*4,r.data()};AudioTimeStamp t={};t.mSampleTime=pos;t.mFlags=kAudioTimeStampSampleTimeValid;AudioUnitRenderActionFlags flags=0;
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
  printf("AU sr=%.0f frames=%u gain=%.5f dB high=%.5f dB\n",sr,block,gain,eq);ok(AudioUnitUninitialize(a),"uninitialize");
 }
 check(AudioUnitSetParameter(a,0,0,0,NAN,0)!=noErr,"reject NaN");check(AudioUnitSetParameter(a,0,0,0,7,0)!=noErr,"reject range");
 ok(command(a,@{@"operation":@"bind",@"projectId":@"song-1",@"trackId":@"piano-1",@"confirmed":@YES}),"bind explicit Track");
 ok(AudioUnitSetParameter(a,0,0,0,0,0),"reset gain");ok(AudioUnitSetParameter(a,2,0,0,0,0),"reset eq");auto d=cmd(a,@"preview");d[@"instruction"]=@"ピアノを柔らかくして";ok(command(a,d),"Japanese preview");check([snapshot(a)[@"current"][2]floatValue]==0,"preview does not apply");
 d=cmd(a,@"apply");d[@"choice"]=@1;check(command(a,d)!=noErr,"approval required");d[@"approved"]=@YES;ok(command(a,d),"approved B applies");check([snapshot(a)[@"current"][2]floatValue]==-2,"actual parameter changed");check([snapshot(b)[@"current"][2]floatValue]==0,"instances isolated");
 configure(a,&source,48000,256);source.hz=10000;auto processed=render(a,96000,256);std::string path=std::string(argv[2])+"-approved.wav";wav(path.c_str(),processed);
 d=cmd(a,@"undo");d[@"approved"]=@YES;ok(command(a,d),"approved undo");check([snapshot(a)[@"current"][2]floatValue]==0,"undo restores");
 CFPropertyListRef saved=nullptr;UInt32 size=sizeof(saved);ok(AudioUnitGetProperty(a,kAudioUnitProperty_ClassInfo,0,0,&saved,&size),"host state save");
 ok(AudioUnitSetProperty(b,kAudioUnitProperty_ClassInfo,0,0,&saved,sizeof(saved)),"new AU restore");CFRelease(saved);check(![snapshot(b)[@"binding"][@"confirmed"]boolValue],"restored binding needs re-confirmation");
 ok(AudioUnitUninitialize(a),"stop");ok(AudioComponentInstanceDispose(a),"destroy a");ok(AudioComponentInstanceDispose(b),"destroy b");
 puts("Actual AU binary host, stereo, Gain/EQ, Japanese approval/Undo, isolation and state tests PASS. Logic not tested.");
 // Keep the code loaded until process exit: component registry owns its factory pointer.
}}
