#pragma once
#include "Analysis.hpp"
#include <deque>
#include <ostream>
namespace nova {
// Offline only. Memory is bounded by three seconds plus one energy value/100 ms.
// Maximum input duration is enforced by the caller (two hours).
struct WholeMeter {
 double rate; uint64_t frames=0,clipped=0; double peak=0,sum=0,windowSum=0,shortSum=0;
 unsigned window,hop,shortWindow,head=0; Biquad shelf,hp;
 std::vector<double> ring,blocks,shortBlocks; std::array<std::array<double,24>,2> history{};
 std::array<std::array<float,2048>,2> spectrum{}; std::array<double,3> bands{};
 explicit WholeMeter(double sr):rate(sr),window(std::llround(sr*.4)),hop(std::llround(sr*.1)),shortWindow(std::llround(sr*3)),ring(shortWindow){
  if(sr!=44100&&sr!=48000&&sr!=96000)throw std::runtime_error("whole-song rate must be 44100/48000/96000");
  // BS.1770 pre-filter bilinear design; preserve the existing 48-kHz coefficients.
  double k=std::tan(pi*1681.974450955533/sr),vh=std::pow(10.,3.999843853973347/20),vb=std::pow(vh,.4996667741545416),q=.7071752369554196,a=1+k/q+k*k;
  shelf.b0=(vh+vb*k/q+k*k)/a;shelf.b1=2*(k*k-vh)/a;shelf.b2=(vh-vb*k/q+k*k)/a;shelf.a1=2*(k*k-1)/a;shelf.a2=(1-k/q+k*k)/a;
  k=std::tan(pi*38.13547087602444/sr);q=.5003270373238773;a=1+k/q+k*k;
  hp.b0=1;hp.b1=-2;hp.b2=1;hp.a1=2*(k*k-1)/a;hp.a2=(1-k/q+k*k)/a;
  if(sr==48000){shelf.b0=1.53512485958697;shelf.b1=-2.69169618940638;shelf.b2=1.19839281085285;shelf.a1=-1.69065929318241;shelf.a2=.73248077421585;hp.a1=-1.99004745483398;hp.a2=.99007225036621;}
 }
 double truePeak=0;
 void peakFrame(double l,double r){
  // ITU Annex 2 four-phase FIR, same estimate as existing excerpt meter.
  static constexpr double fir[12][4]={
   {.001708984375,-.0291748046875,-.0189208984375,-.00830078125},{.010986328125,.029296875,.0330810546875,.014892578125},
   {-.0196533203125,-.0517578125,-.0582275390625,-.026611328125},{.033203125,.089111328125,.1015625,.047607421875},
   {-.0594482421875,-.16650390625,-.2003173828125,-.102294921875},{.1373291015625,.465087890625,.77978515625,.97216796875},
   {.97216796875,.77978515625,.465087890625,.1373291015625},{-.102294921875,-.2003173828125,-.16650390625,-.0594482421875},
   {.047607421875,.1015625,.089111328125,.033203125},{-.026611328125,-.0582275390625,-.0517578125,-.0196533203125},
   {.014892578125,.0330810546875,.029296875,.010986328125},{-.00830078125,-.0189208984375,-.0291748046875,.001708984375}};
  head=(head+11)%12;double input[2]={l,r};for(unsigned c=0;c<2;++c){history[c][head]=history[c][head+12]=input[c];truePeak=std::max(truePeak,std::abs(input[c]));for(unsigned p=0;p<4;++p){double y=0;for(unsigned j=0;j<12;++j)y+=history[c][head+j]*fir[j][p];truePeak=std::max(truePeak,std::abs(y));}}
 }
 void add(float l,float r){
  if(!std::isfinite(l)||!std::isfinite(r)||std::abs(l)>16||std::abs(r)>16)throw std::runtime_error("nonfinite or abnormal audio");
  if(frames>=uint64_t(rate*7200))throw std::runtime_error("two-hour bound exceeded");
  double x[2]={l,r},energy=0;for(unsigned c=0;c<2;++c){peak=std::max(peak,std::abs(x[c]));sum+=x[c]*x[c];clipped+=std::abs(x[c])>=1;double y=hp.tick(shelf.tick(x[c],c),c);energy+=y*y;spectrum[c][frames%2048]=x[c];}
  if(frames>=window)windowSum-=ring[(frames-window)%shortWindow];windowSum+=energy;shortSum+=energy-ring[frames%shortWindow];ring[frames%shortWindow]=energy;++frames;
  if(frames>=window&&(frames-window)%hop==0)blocks.push_back(std::max(0.,windowSum/window));
  if(frames>=shortWindow&&(frames-shortWindow)%hop==0)shortBlocks.push_back(std::max(0.,shortSum/shortWindow));
  if(frames>=2048&&frames%1024==0){std::array<std::complex<double>,2048> a;for(unsigned c=0;c<2;++c){for(unsigned j=0;j<2048;++j)a[j]=double(spectrum[c][(frames+j)%2048])*(.5-.5*std::cos(2*pi*j/2047));fft(a);for(unsigned j=1;j<=1024;++j){double hz=j*rate/2048;if(hz>=20)bands[hz<200?0:hz<4000?1:2]+=std::norm(a[j]);}}}
  peakFrame(l,r);
 }
 static double lu(double e){return e>0?-.691+10*std::log10(e):-160;}
 double integrated()const{double s=0;unsigned n=0;for(double e:blocks)if(lu(e)>-70){s+=e;++n;}if(!n)return -160;double gate=lu(s/n)-10;s=0;n=0;for(double e:blocks)if(lu(e)>-70&&lu(e)>gate){s+=e;++n;}return n?lu(s/n):-160;}
 void finish(){for(unsigned j=0;j<11;++j)peakFrame(0,0);}
 Measurement proposalMeasurement()const{Measurement m;m.valid=frames>=window&&integrated()>-70;m.rate=rate;m.peak=peak;m.rms=frames?std::sqrt(sum/(2*frames)):0;double total=bands[0]+bands[1]+bands[2];for(unsigned i=0;i<3;++i)m.bands[i]=total?bands[i]/total:0;return m;}
 void json(std::ostream& o)const{
  auto m=proposalMeasurement();std::vector<double> st;for(double e:shortBlocks)if(lu(e)>-70)st.push_back(lu(e));std::sort(st.begin(),st.end());double spread=st.empty()?0:st[size_t((st.size()-1)*.95)]-st[size_t((st.size()-1)*.1)];
  o<<"{\"complete\":true,\"frames\":"<<frames<<",\"sampleRate\":"<<rate<<",\"integratedLufs\":"<<integrated()<<",\"loudnessValid\":"<<(m.valid?"true":"false")<<",\"momentaryLufsLast400ms\":"<<(frames>=window?lu(std::max(0.,windowSum/window)):-160)<<",\"shortTermLufsLast3s\":"<<(frames>=shortWindow?lu(std::max(0.,shortSum/shortWindow)):-160)<<",\"shortTermValid\":"<<(frames>=shortWindow?"true":"false")<<",\"truePeakEstimateDbTP\":"<<db(truePeak)<<",\"samplePeakDbFS\":"<<db(peak)<<",\"rmsDbFS\":"<<db(m.rms)<<",\"crestDb\":"<<(m.rms>0?db(peak/m.rms):0)<<",\"shortTermPercentileSpreadDb\":"<<spread<<",\"clippedSamples\":"<<clipped<<",\"bands\":["<<m.bands[0]<<","<<m.bands[1]<<","<<m.bands[2]<<"]}";
 }
};
// Offline linked lookahead peak controller: finite future window, instantaneous
// safe attack and exponential release. It is not an oversampled true-peak limiter.
struct Lookahead {
 size_t delay;uint64_t at=0;double ceiling,release,gain=1,minimumGain=1;
 std::deque<std::pair<uint64_t,double>> maximum;std::deque<std::array<double,2>> audio;
 Lookahead(double sr,double dbtp,double ms=5,double releaseMs=100):delay(std::llround(sr*ms/1000)),ceiling(std::pow(10.,dbtp/20)),release(std::exp(-1/(sr*releaseMs/1000))){}
 bool push(double l,double r,std::array<float,2>& output){
  double p=std::max(std::abs(l),std::abs(r));while(!maximum.empty()&&maximum.back().second<=p)maximum.pop_back();maximum.push_back({at,p});audio.push_back({l,r});
  bool ready=at>=delay;if(ready){uint64_t first=at-delay;while(maximum.front().first<first)maximum.pop_front();double wanted=std::min(1.,ceiling/std::max(maximum.front().second,1e-20));gain=wanted<gain?wanted:std::min(wanted,1-(1-gain)*release);minimumGain=std::min(minimumGain,gain);auto x=audio.front();audio.pop_front();output={float(x[0]*gain),float(x[1]*gain)};}++at;return ready;
 }
};
}
