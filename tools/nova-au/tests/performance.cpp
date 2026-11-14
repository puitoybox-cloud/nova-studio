#include "../Analysis.hpp"
#include <chrono>
#include <iostream>
#include <vector>
int main(){
 for(bool quality:{false,true}){
 constexpr unsigned n=256,blocks=48000*120/n;nova::DSP d;auto extra=nova::defaults();extra[0]=quality;extra[6]=quality;d.reset(48000,{0,0,0,0},extra);nova::Capture c;c.arm();std::vector<float> l(n,.1),r(n,.1),a(n),b(n);auto start=std::chrono::steady_clock::now();
 for(unsigned block=0;block<blocks;++block){auto k=c.input(l.data(),r.data(),n,48000,0);d.process(l.data(),r.data(),a.data(),b.data(),n,{-3,-2,-1,0});c.output(a.data(),b.data(),k);}
 double elapsed=std::chrono::duration<double>(std::chrono::steady_clock::now()-start).count();std::cout<<"qualityChain="<<quality<<" simulatedAudioSeconds=120 wallSeconds="<<elapsed<<" wallTimeToAudioTimePercent="<<elapsed/120*100<<" fixedCaptureBytes="<<c.samples.size()*sizeof(float)<<" (not a host scheduling guarantee)\n";
 }
}
