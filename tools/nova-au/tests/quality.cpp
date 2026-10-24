#include "../Comparison.hpp"
#include <cassert>
#include <iostream>
#include <random>
#include <filesystem>
static double rms(const std::vector<float>& a,unsigned start=0){double s=0;for(unsigned i=start;i<a.size();++i)s+=double(a[i])*a[i];return std::sqrt(s/(a.size()-start));}
static double response(double sr,double hz,std::array<float,4> core,nova::Processing extra){unsigned n=unsigned(sr)*2;nova::DSP d;d.reset(sr,core,extra);std::vector<float>x(n),y(n),z(n);for(unsigned i=0;i<n;++i)x[i]=.01*std::sin(2*nova::pi*hz*i/sr);d.process(x.data(),x.data(),y.data(),z.data(),n,core);assert(y==z);return 20*std::log10(rms(y,n/2)/rms(x,n/2));}
int main(int argc,char** argv){
 auto extra=nova::defaults();assert(extra[4]==0&&extra[12]==0);assert(nova::pack(nova::unpack(nova::pack(extra)))==nova::pack(extra));extra[0]=1;
 for(double sr:{22050.,44100.,48000.,96000.,192000.}){
  for(float g:{-6.f,6.f}){auto low=response(sr,30,{0,g,0,0},extra),high=response(sr,sr*.4,{0,0,g,0},extra);assert(std::abs(low-g)<.08&&std::abs(high-g)<.12);std::cout<<"EQ sr="<<sr<<" shelfGain="<<g<<" low30Hz="<<low<<" high="<<high<<"\n";}
  for(double q:{.25,1.,8.})for(float g:{-12.f,12.f}){extra[3]=1000;extra[4]=g;extra[5]=q;double db=response(sr,1000,{0,0,0,0},extra);assert(std::abs(db-g)<.002);std::cout<<"EQ sr="<<sr<<" midHz=1000 Q="<<q<<" gain="<<db<<"\n";}extra[4]=0;extra[5]=1;
 }
 // Modern EQ/mode/Compressor changes start with a smoothed first sample, not a jump.
 nova::DSP click;auto calm=nova::defaults();calm[0]=1;click.reset(48000,{0,0,0,0},calm);float steady[256],out[256],right[256];std::fill_n(steady,256,.1f);click.process(steady,steady,out,right,256,{0,0,0,0});float prior=out[255];click.processing[4]=12;click.processing[6]=1;click.processing[7]=-40;click.process(steady,steady,out,right,256,{0,6,6,0});assert(std::abs(out[0]-prior)<.001);std::cout<<"FirstSampleTransitionDelta="<<std::abs(out[0]-prior)<<"\n";
 // Steady DC isolates the linked peak detector and analytic static transfer, with EQ flat.
 extra[6]=1;extra[7]=-24;extra[8]=4;extra[9]=10;extra[10]=150;extra[11]=0;extra[12]=0;
 for(double inputDb:{-36.,-18.,-6.}){nova::DSP d;d.reset(48000,{0,0,0,0},extra);std::vector<float>x(96000,std::pow(10.,inputDb/20)),r(x.size()),a(x.size()),b(x.size());for(unsigned i=0;i<r.size();++i)r[i]=x[i]*.25;d.process(x.data(),r.data(),a.data(),b.data(),x.size(),{0,0,0,0});double reduction=20*std::log10(x.back()/a.back()),expected=nova::compressionDb(inputDb,-24,4,0);assert(std::abs(reduction-expected)<1e-4);assert(std::abs(b.back()/a.back()-.25)<1e-6);std::cout<<"Compressor input="<<inputDb<<" reduction="<<reduction<<" expected="<<expected<<"\n";}
 // Step response in gain-reduction dB: attack/release time constants explicitly measured.
 nova::DSP d;d.reset(48000,{0,0,0,0},extra);std::vector<float>x(48000,.5),a(x.size()),b(x.size());d.process(x.data(),x.data(),a.data(),b.data(),480,{0,0,0,0});double expected=nova::compressionDb(20*std::log10(.5),-24,4,0);assert(std::abs(d.quality.reduction/expected-(1-std::exp(-1)))<.002);std::cout<<"Attack10msFraction="<<d.quality.reduction/expected<<"\n";d.process(x.data(),x.data(),a.data(),b.data(),48000,{0,0,0,0});double before=d.quality.reduction;std::fill(x.begin(),x.end(),.0001);d.process(x.data(),x.data(),a.data(),b.data(),7200,{0,0,0,0});assert(std::abs(d.quality.reduction/before-std::exp(-1))<.002);std::cout<<"Release150msFraction="<<d.quality.reduction/before<<"\n";
 // Dynamic parameter extremes, arbitrary buffer boundaries, nonfinite input, independent state.
 std::mt19937 random(42);nova::DSP stress;stress.reset(96000,{0,0,0,0});std::vector<float> l(257,.1),r(257,-.2),ol(257),orr(257);for(unsigned block=0;block<1500;++block){for(unsigned i=0;i<nova::ExtraCount;++i)extra[i]=block%2?nova::extraMin[i]:nova::extraMax[i];extra[0]=1;stress.processing=extra;if(block%7==0)l[0]=NAN;else l[0]=.1;stress.process(l.data(),r.data(),ol.data(),orr.data(),1+random()%257,{6,6,6,0});for(float v:ol)assert(std::isfinite(v)&&std::abs(v)<=.981);}
 // Gate/FIR reference fixture, 48-kHz only, and actual same-input mastering WAVs.
 std::vector<float> stereo(96000*2);for(unsigned i=0;i<96000;++i)stereo[i*2]=stereo[i*2+1]=.1*std::sin(2*nova::pi*1000*i/48000.);auto m=nova::measure(stereo.data(),96000,48000);assert(m.loudness.valid&&!m.loudness.shortTermValid);assert(std::abs(m.loudness.integrated+20)<.1);assert(m.loudness.truePeak>=m.peak);assert(!nova::measure(stereo.data(),96000,44100).loudness.valid);
 nova::Binding binding{"fixture","stereo-out","quality",true};binding.kind="stereo-out";auto p=nova::proposeMaster(binding,{0,0,0,0},nova::defaults(),stereo.data(),96000,48000,2,0,-18);auto comparison=nova::compare(stereo.data(),96000,48000,2,0,p);std::cout<<"Master beforeLUFS="<<m.loudness.integrated<<" beforeTP="<<nova::db(m.loudness.truePeak)<<"\n";
 if(argc==2)std::filesystem::create_directories(argv[1]);
 for(unsigned k=0;k<4;++k){auto& v=comparison.audio[k];auto& result=comparison.measurements[k];assert(result.loudness.valid&&result.clipped==0);std::cout<<"Master "<<k<<" LUFS="<<result.loudness.integrated<<" dBTPestimate="<<nova::db(result.loudness.truePeak)<<"\n";if(argc==2){auto name=k?std::string(1,char('A'+k-1)):"original";nova::writeWave(std::string(argv[1])+"/master-"+name+".wav",v,48000);nova::writeWave(std::string(argv[1])+"/master-"+name+"-matched.wav",v,48000,comparison.matching[k]);}}
 std::cout<<"Quality EQ, static compression, timing, stereo link, stability and excerpt mastering PASS\n";
}
