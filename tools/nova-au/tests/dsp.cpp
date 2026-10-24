#include "../Control.hpp"
#include <cassert>
#include <iostream>
#include <limits>
#include <vector>
double rms(const std::vector<float>& x){double s=0;for(auto v:x)s+=v*v;return std::sqrt(s/x.size());}
double render(double sr,double hz,std::array<float,4> p){
 nova::DSP d;d.reset(sr,p);std::vector<float> x(65536),y(x.size()),z(x.size());
 for(unsigned i=0;i<x.size();++i)x[i]=.1*std::sin(2*3.141592653589793*hz*i/sr);
 d.process(x.data(),x.data(),y.data(),z.data(),x.size(),p);assert(y==z);return rms(y)/rms(x);
}
int main(){
 for(double sr:{22050.,44100.,48000.,96000.,192000.}){
  auto flat=render(sr,1000,{0,0,0,0}),gain=render(sr,1000,{-6,0,0,0});assert(std::abs(flat-1)<1e-5);assert(std::abs(gain-std::pow(10,-6./20))<1e-5);
  auto high=render(sr,10000,{0,0,-6,0});auto low=render(sr,80,{0,-6,0,0});assert(high<.85&&low<.8);
  std::cout<<"sampleRate="<<sr<<" gainDb="<<20*std::log10(gain)<<" highDb="<<20*std::log10(high)<<" lowDb="<<20*std::log10(low)<<"\n";
 }
 nova::DSP d;d.reset(48000,{0,0,0,0});float x[]={std::numeric_limits<float>::quiet_NaN(),std::numeric_limits<float>::infinity(),100,-100,0};float y[5],z[5];d.process(x,x,y,z,5,{6,6,6,0});for(float v:y)assert(std::isfinite(v)&&std::abs(v)<=.98f);
 assert(!nova::valid(0,7)&&!nova::valid(1,-7)&&!nova::valid(2,NAN)&&!nova::valid(99,0));
 nova::Binding b{"song","track","instance",true};auto p=nova::propose(b,{0,0,0,0},"ピアノを柔らかくして");assert(p.choices[0][2]==-1&&p.choices[2][2]==-3);assert(nova::propose(b,{0,0,0,0},"ボーカルをもう少し前に出して").choices[2][0]==1.5);
 bool rejected=false;try{nova::propose({}, {0,0,0,0},"高音を少し抑えて");}catch(...){rejected=true;}assert(rejected);
 // Smoothing: no instantaneous gain jump on the first sample after a change.
 d.reset(48000,{0,0,0,0});std::vector<float> a(4096,.1),l(a.size()),r(a.size());d.process(a.data(),a.data(),l.data(),r.data(),a.size(),{-24,0,0,0});assert(std::abs(l[0]-.1)<.001);assert(l.back()<.01);
 std::cout<<"DSP and deterministic proposal checks PASS\n";
}
