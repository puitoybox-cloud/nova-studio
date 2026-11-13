#pragma once
#include "Processing.hpp"
#include <vector>
namespace nova {
struct Loudness {bool valid=false;double integrated=-160,momentary=-160,shortTerm=-160,truePeak=0;bool shortTermValid=false;};
// Control thread only. Match Music Studio's 48 kHz K-weighting and
// normalized 4x Hann-windowed sinc peak estimate.
inline Loudness loudness(const float* data,unsigned frames,double sr,unsigned stride,unsigned offset){
 Loudness out;if(sr!=48000||frames<19200)return out;
 static const auto fir=[]{
  constexpr double pi=3.14159265358979323846;
  std::array<std::array<double,32>,4> phases{};
  for(unsigned phase=0;phase<4;++phase){
   double sum=0;
   for(unsigned j=0;j<32;++j){
    const double d=15.+phase/4.-j;
    phases[phase][j]=(d==0?1:std::sin(pi*d)/(pi*d))*(.5+.5*std::cos(pi*d/16));
    sum+=phases[phase][j];
   }
   for(auto& tap:phases[phase])tap/=sum;
  }
  return phases;
 }();
 Biquad shelf,highpass;shelf.b0=1.53512485958697;shelf.b1=-2.69169618940638;shelf.b2=1.19839281085285;shelf.a1=-1.69065929318241;shelf.a2=.73248077421585;
 highpass.b0=1;highpass.b1=-2;highpass.b2=1;highpass.a1=-1.99004745483398;highpass.a2=.99007225036621;
 std::vector<double> ring(144000),blocks;double sum=0,shortSum=0;std::array<std::array<double,64>,2> history{};unsigned head=0;
 auto peak=[&](unsigned i,bool flush){
  head=(head+31)%32;
  for(unsigned c=0;c<2;++c){
   const double x=flush?0:data[i*stride+offset+c];
   history[c][head]=history[c][head+32]=x;
   out.truePeak=std::max(out.truePeak,std::abs(x));
   for(const auto& phase:fir){
    double y=0;
    for(unsigned j=0;j<32;++j)y+=history[c][head+j]*phase[j];
    out.truePeak=std::max(out.truePeak,std::abs(y));
   }
  }
 };
 for(unsigned i=0;i<frames;++i){double energy=0;for(unsigned c=0;c<2;++c){double x=data[i*stride+offset+c];if(!std::isfinite(x))return {};double y=highpass.tick(shelf.tick(x,c),c);energy+=y*y;}
  if(i>=19200)sum-=ring[(i-19200)%144000];sum+=energy;shortSum+=energy-ring[i%144000];ring[i%144000]=energy;
  if(i+1>=19200&&(i+1-19200)%4800==0)blocks.push_back(std::max(0.,sum/19200));peak(i,false);
 }
 // Reflect the start and zero-extend the tail, matching the browser meter.
 for(unsigned at=0;at<16;++at)for(unsigned c=0;c<2;++c)for(const auto& phase:fir){
  double y=0;
  for(int j=0;j<32;++j)y+=data[std::abs(int(at)+j-15)*stride+offset+c]*phase[j];
  out.truePeak=std::max(out.truePeak,std::abs(y));
 }
 for(unsigned i=0;i<31;++i)peak(0,true);
 auto lu=[](double x){return x>0?-.691+10*std::log10(x):-160.;};
 double absoluteSum=0;unsigned absoluteCount=0;for(double x:blocks)if(lu(x)>-70){absoluteSum+=x;++absoluteCount;}
 if(!absoluteCount)return out;double relative=lu(absoluteSum/absoluteCount)-10,gatedSum=0;unsigned gatedCount=0;
 for(double x:blocks)if(lu(x)>-70&&lu(x)>relative){gatedSum+=x;++gatedCount;}if(!gatedCount)return out;
 out.valid=true;out.integrated=lu(gatedSum/gatedCount);out.momentary=lu(std::max(0.,sum/19200));out.shortTermValid=frames>=144000;if(out.shortTermValid)out.shortTerm=lu(std::max(0.,shortSum/144000));return out;
}
}
