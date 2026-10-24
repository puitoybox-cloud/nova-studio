#include "WholeSong.hpp"
#include "Control.hpp"
#include <fstream>
#include <iostream>
#include <iomanip>
#include <filesystem>
int main(int argc,char** argv){try{
 if(argc<4)throw std::runtime_error("meter/plan/process INPUT.f32 RATE ...");std::string mode=argv[1];double sr=std::stod(argv[3]);nova::WholeMeter meter(sr);
 std::ifstream f(argv[2],std::ios::binary|std::ios::ate);auto bytes=f.tellg();if(!f||bytes<=0||bytes%8||bytes>sr*7200*8)throw std::runtime_error("invalid bounded stereo float32 input");uint64_t frames=uint64_t(bytes)/8;f.seekg(0);
 std::ofstream out; nova::Quality quality;std::array<float,4> values{};auto extra=nova::defaults();double gain=1;bool processing=mode=="process";
 if(processing){if(argc!=24)throw std::runtime_error("process INPUT RATE OUTPUT GAIN_DB CEILING_DB 4-values 13-processing-values");if(std::filesystem::exists(argv[4]))throw std::runtime_error("output already exists");out.open(argv[4],std::ios::binary);if(!out)throw std::runtime_error("output open failed");double gainDb=std::stod(argv[5]),ceilingDb=std::stod(argv[6]);if(!std::isfinite(gainDb)||gainDb< -24||gainDb>12||!std::isfinite(ceilingDb)||ceilingDb< -12.5||ceilingDb> -1)throw std::runtime_error("invalid gain/ceiling");gain=std::pow(10.,gainDb/20);for(unsigned i=0;i<4;++i){values[i]=std::stof(argv[7+i]);if(!nova::valid(i,values[i]))throw std::runtime_error("invalid original parameter");}for(unsigned i=0;i<13;++i){extra[i]=std::stof(argv[11+i]);if(!nova::extraValid(i,extra[i]))throw std::runtime_error("invalid processing parameter");}if(extra[0]!=1||values[3]!=0)throw std::runtime_error("offline quality chain must be enabled and not bypassed");quality.reset(extra);}
 else if(mode!="meter"&&mode!="plan")throw std::runtime_error("unknown mode");
 nova::Lookahead limiter(sr,processing?std::stod(argv[6]):-1);std::array<float,8192> buf;uint64_t written=0;
 auto emit=[&](std::array<float,2> x){if(written>=frames)return;meter.add(x[0],x[1]);out.write(reinterpret_cast<char*>(x.data()),8);++written;};
 while(f){f.read(reinterpret_cast<char*>(buf.data()),sizeof(buf));auto n=f.gcount()/4;for(int i=0;i<n;i+=2){double l=buf[i],r=buf[i+1];if(!std::isfinite(l)||!std::isfinite(r)||std::abs(l)>16||std::abs(r)>16)throw std::runtime_error("invalid audio sample");if(processing){quality.frame(sr,0,extra,values[1],values[2]);quality.process(l,r,sr);double g=gain*std::pow(10.,values[0]/20);l*=g;r*=g;std::array<float,2> x;if(limiter.push(l,r,x))emit(x);}else meter.add(l,r);}}
 if(processing){for(size_t j=0;j<limiter.delay;++j){std::array<float,2> x;if(limiter.push(0,0,x))emit(x);}out.close();if(!out||written!=frames)throw std::runtime_error("incomplete output");}
 if(meter.frames!=frames)throw std::runtime_error("incomplete meter");meter.finish();std::cout<<std::setprecision(15);
 if(mode=="plan"){if(argc!=7)throw std::runtime_error("plan INPUT RATE INSTRUCTION ROLE KIND");auto m=meter.proposalMeasurement();if(!m.valid)throw std::runtime_error("silence/short/invalid loudness cannot produce a plan");auto p=nova::proposeMeasured({"offline","explicit","offline",true,argv[5],argv[6]},values,argv[4],m);std::cout<<"{\"choices\":[";for(unsigned k=0;k<3;++k){if(k)std::cout<<",";std::cout<<"{\"values\":[";for(unsigned i=0;i<4;++i){if(i)std::cout<<",";std::cout<<p.choices[k][i];}std::cout<<"],\"processing\":[";for(unsigned i=0;i<13;++i){if(i)std::cout<<",";std::cout<<p.processingChoices[k][i];}std::cout<<"]}";}std::cout<<"],\"input\":";meter.json(std::cout);std::cout<<"}";}
 else {std::cout<<"{\"measurement\":";meter.json(std::cout);std::cout<<",\"minimumLimiterGain\":"<<limiter.minimumGain<<"}";}std::cout<<"\n";
 }catch(const std::exception& e){std::cerr<<e.what()<<"\n";return 1;}}
