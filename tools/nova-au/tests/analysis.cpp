#include "../Comparison.hpp"
#include <cassert>
#include <chrono>
#include <iostream>
#include <thread>
std::vector<float> tone(double rate,double hz,double amplitude){std::vector<float> a(unsigned(rate)*4);for(unsigned i=0;i<a.size()/2;++i)a[2*i]=a[2*i+1]=amplitude*std::sin(2*3.141592653589793*hz*i/rate);return a;}
int main(){
 nova::Binding binding{"song","explicit-track","instance",true};
 for(double rate:{22050.,24000.,44100.,48000.,96000.,192000.}){
  auto low=tone(rate,80,.1),high=tone(rate,10000,.2);auto l=nova::measure(low.data(),low.size()/2,rate),h=nova::measure(high.data(),high.size()/2,rate);
  assert(l.valid&&h.valid&&l.bands[0]>.99&&h.bands[2]>.99);assert(std::abs(l.rms-.1/std::sqrt(2))<1e-5);assert(std::abs(h.peak-.2)<.001);
  auto a=nova::proposeMeasured(binding,{0,0,0,0},"全体の音を自然に整えて",l),b=nova::proposeMeasured(binding,{0,0,0,0},"全体の音を自然に整えて",h);assert(a.choices!=b.choices&&a.audioAnalyzed);
  for(auto request:{"ピアノをもっと温かくして","ストリングスの高音を柔らかくして","ボーカルをもう少し前に出して","低音が強すぎるので調整して","全体の音を自然に整えて"}){auto p=nova::proposeMeasured(binding,{0,0,0,0},request,h);for(auto v:p.choices)for(unsigned i=0;i<4;++i)assert(nova::valid(i,v[i]));}
  auto comparison=nova::compare(high.data(),high.size()/2,rate,2,0,b);double matched=-1;for(unsigned k=0;k<4;++k){auto v=comparison.audio[k];for(float& x:v)x*=comparison.matching[k];auto m=nova::measure(v.data(),v.size()/2,rate);if(matched<0)matched=m.rms;assert(std::abs(m.rms-matched)<1e-7);assert(comparison.matching[k]<=1);}
  bool bad=false;try{nova::compare(low.data(),low.size()/2,rate,2,0,b);}catch(...){bad=true;}assert(bad);
  for(unsigned block:{32u,256u,2048u}){nova::Capture c;assert(c.arm());unsigned pos=0;while(pos<high.size()/2){unsigned n=std::min(block,unsigned(high.size()/2)-pos);std::vector<float> lch(n),rch(n);for(unsigned i=0;i<n;++i)lch[i]=rch[i]=high[(pos+i)*2];unsigned captured=c.input(lch.data(),rch.data(),n,rate,0);assert(!c.arm());c.output(lch.data(),rch.data(),captured);pos+=n;}assert(c.state.load()==3&&c.frames==unsigned(rate)*2);auto m=nova::measure(c.samples.data(),c.frames,rate,4);assert(m.hash==h.hash);}
  std::cout<<"sr="<<rate<<" lowRms="<<l.rms<<" highRms="<<h.rms<<" lowFraction="<<l.bands[0]<<" highFraction="<<h.bands[2]<<" lowB="<<a.choices[1][1]<<" highB="<<b.choices[1][2]<<"\n";
 }
 auto x=tone(48000,1000,1.2);auto m=nova::measure(x.data(),x.size()/2,48000);assert(m.clipped>0);x[0]=NAN;assert(!nova::measure(x.data(),x.size()/2,48000).valid);std::fill(x.begin(),x.end(),0);assert(nova::measure(x.data(),x.size()/2,48000).status=="silence");assert(nova::measure(x.data(),100,48000).status=="too-short");
 nova::Capture c;auto t=tone(48000,1000,.1);assert(c.arm());std::thread producer([&]{for(unsigned pos=0;pos<96000;pos+=256){unsigned n=std::min(256u,96000-pos);auto k=c.input(t.data()+pos,t.data()+pos,n,48000,0);c.output(t.data()+pos,t.data()+pos,k);}});while(c.state.load(std::memory_order_acquire)!=3)std::this_thread::yield();producer.join();assert(c.frames==96000);
 std::cout<<"Analysis, bounded capture, identity, sample rates, measured proposals and RMS matching PASS\n";
}
