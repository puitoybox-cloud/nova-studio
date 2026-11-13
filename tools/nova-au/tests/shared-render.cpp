#include "../SharedRender.hpp"
#include "../WholeSong.hpp"
#include <cassert>
#include <iostream>
#include <vector>
int main(){
 for(double sr:{44100.,48000.,96000.})for(unsigned block:{1u,17u,64u,128u,511u,512u,1024u,4096u})for(unsigned legacy:{0u,1u}){
  const unsigned n=unsigned(sr*1.1);std::vector<float> input(n*2),actual(n*2),expected(n*2),l(n),r(n),ol(n),orr(n);
  for(unsigned i=0;i<n;++i){l[i]=.6*std::sin(2*nova::pi*127*i/sr)+.4*std::sin(2*nova::pi*4097*i/sr);r[i]=.25*std::sin(2*nova::pi*733*i/sr);input[2*i]=l[i];input[2*i+1]=r[i];}
  auto initial=nova::decode(nova::encode({0,0,0,0}));auto target=nova::decode(nova::encode({-3,4,-2,0}));auto extra=nova::defaults();extra[0]=legacy;extra[6]=1;extra[4]=3;extra=nova::unpack(nova::pack(extra));
  nova::DSP live;live.reset(sr,initial,extra);nova::SharedRender offline;offline.reset(sr,initial,extra);
  // Automation and bypass changes occur at identical sample positions in both
  // paths; buffer grouping differs. This also tests continuous filter/envelope state.
  for(unsigned start=0;start<n;){unsigned stop=std::min(n,start+unsigned(sr/4));auto p=target;p[3]=start>=unsigned(sr*.5)?1:0;live.processing=extra;live.process(l.data()+start,r.data()+start,ol.data()+start,orr.data()+start,stop-start,p);
   for(unsigned at=start;at<stop;at+=block)offline.process(input.data()+2*at,actual.data()+2*at,std::min(block,stop-at),p,extra);start=stop;}
  nova::WholeMeter a(sr),b(sr);double maxError=0;for(unsigned i=0;i<n;++i){expected[2*i]=ol[i];expected[2*i+1]=orr[i];a.add(ol[i],orr[i]);b.add(actual[2*i],actual[2*i+1]);for(unsigned c=0;c<2;++c)maxError=std::max(maxError,std::abs(double(expected[2*i+c])-actual[2*i+c]));}a.finish();b.finish();
  assert(maxError==0);assert(a.peak==b.peak&&a.sum==b.sum&&a.integrated()==b.integrated()&&a.truePeak==b.truePeak);
  std::cout<<"{\"sampleRate\":"<<sr<<",\"block\":"<<block<<",\"modern\":"<<legacy<<",\"maxSampleError\":"<<maxError<<",\"peakDifference\":0,\"rmsDifference\":0,\"lufsDifference\":0}\n";
 }
}
