#pragma once
#include "Processing.hpp"
#include <vector>
namespace nova {
struct Loudness {bool valid=false;double integrated=-160,momentary=-160,shortTerm=-160,truePeak=0;bool shortTermValid=false;};
// Control thread only. Exact 48 kHz coefficients and 4x/12-tap-per-phase FIR
// shared with Music Studio No.19. Other rates explicitly unmeasured.
inline Loudness loudness(const float* data,unsigned frames,double sr,unsigned stride,unsigned offset){
 Loudness out;if(sr!=48000||frames<19200)return out;
 constexpr double fir[12][4]={
    {.001708984375,-.0291748046875,-.0189208984375,-.00830078125},
    {.010986328125,.029296875,.0330810546875,.014892578125},
    {-.0196533203125,-.0517578125,-.0582275390625,-.026611328125},
    {.033203125,.089111328125,.1015625,.047607421875},
    {-.0594482421875,-.16650390625,-.2003173828125,-.102294921875},
    {.1373291015625,.465087890625,.77978515625,.97216796875},
    {.97216796875,.77978515625,.465087890625,.1373291015625},
    {-.102294921875,-.2003173828125,-.16650390625,-.0594482421875},
    {.047607421875,.1015625,.089111328125,.033203125},
    {-.026611328125,-.0582275390625,-.0517578125,-.0196533203125},
    {.014892578125,.0330810546875,.029296875,.010986328125},
    {-.00830078125,-.0189208984375,-.0291748046875,.001708984375}
  };
 Biquad shelf,highpass;shelf.b0=1.53512485958697;shelf.b1=-2.69169618940638;shelf.b2=1.19839281085285;shelf.a1=-1.69065929318241;shelf.a2=.73248077421585;
 highpass.b0=1;highpass.b1=-2;highpass.b2=1;highpass.a1=-1.99004745483398;highpass.a2=.99007225036621;
 std::vector<double> ring(144000),blocks;double sum=0,shortSum=0;std::array<std::array<double,12>,2> history{};unsigned head=0;
 auto peak=[&](unsigned i,bool flush){head=(head+11)%12;for(unsigned c=0;c<2;++c){double x=flush?0:data[i*stride+offset+c];history[c][head]=x;out.truePeak=std::max(out.truePeak,std::abs(x));for(unsigned phase=0;phase<4;++phase){double y=0;for(unsigned j=0;j<12;++j)y+=history[c][(head+j)%12]*fir[j][phase];out.truePeak=std::max(out.truePeak,std::abs(y));}}};
 for(unsigned i=0;i<frames;++i){double energy=0;for(unsigned c=0;c<2;++c){double x=data[i*stride+offset+c];if(!std::isfinite(x))return {};double y=highpass.tick(shelf.tick(x,c),c);energy+=y*y;}
  if(i>=19200)sum-=ring[(i-19200)%144000];sum+=energy;shortSum+=energy-ring[i%144000];ring[i%144000]=energy;
  if(i+1>=19200&&(i+1-19200)%4800==0)blocks.push_back(std::max(0.,sum/19200));peak(i,false);
 }
 for(unsigned i=0;i<11;++i)peak(0,true);
 auto lu=[](double x){return x>0?-.691+10*std::log10(x):-160.;};
 double absoluteSum=0;unsigned absoluteCount=0;for(double x:blocks)if(lu(x)>-70){absoluteSum+=x;++absoluteCount;}
 if(!absoluteCount)return out;double relative=lu(absoluteSum/absoluteCount)-10,gatedSum=0;unsigned gatedCount=0;
 for(double x:blocks)if(lu(x)>-70&&lu(x)>relative){gatedSum+=x;++gatedCount;}if(!gatedCount)return out;
 out.valid=true;out.integrated=lu(gatedSum/gatedCount);out.momentary=lu(std::max(0.,sum/19200));out.shortTermValid=frames>=144000;if(out.shortTermValid)out.shortTerm=lu(std::max(0.,shortSum/144000));return out;
}
}
