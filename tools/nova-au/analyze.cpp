#include "Comparison.hpp"
#include <iostream>
#include <iomanip>
#include <filesystem>
static void measurement(const nova::Measurement& m){std::cout<<"{\"samplePeak\":"<<m.peak<<",\"rms\":"<<m.rms<<",\"rmsDbFS\":"<<nova::db(m.rms)<<",\"samplePeakDbFS\":"<<nova::db(m.peak)<<",\"clippedSamples\":"<<m.clipped<<",\"bands\":["<<m.bands[0]<<","<<m.bands[1]<<","<<m.bands[2]<<"],\"lufsMeasured\":false,\"truePeakMeasured\":false}";}
int main(int argc,char** argv){try{
 if(argc!=5)throw std::runtime_error("engine INPUT.f32 SAMPLE_RATE NEW_OUTPUT_DIRECTORY INSTRUCTION");double sr=std::stod(argv[2]);std::ifstream in(argv[1],std::ios::binary|std::ios::ate);auto size=in.tellg();if(size<=0||size>nova::Capture::capacity*8||size%8)throw std::runtime_error("bounded stereo float input required");in.seekg(0);std::vector<float> data(size_t(size)/4);in.read((char*)data.data(),size);if(!in.good())throw std::runtime_error("input read failed");auto m=nova::measure(data.data(),data.size()/2,sr);if(!m.valid)throw std::runtime_error(m.status);
 auto p=nova::proposeMeasured({"external-explicit-project","external-explicit-track","offline",true},{0,0,0,0},argv[4],m);auto c=nova::compare(data.data(),data.size()/2,sr,2,0,p);if(!std::filesystem::create_directory(argv[3]))throw std::runtime_error("output directory must be new");
 std::cout<<std::setprecision(10)<<"{\"audioAnalyzed\":true,\"modelInference\":false,\"frames\":"<<data.size()/2<<",\"sampleRate\":"<<sr<<",\"input\":";measurement(m);std::cout<<",\"renders\":[";
 for(unsigned k=0;k<4;++k){std::string label=k?std::string(1,char('A'+k-1)):"original";nova::writeWave(std::string(argv[3])+"/"+label+".wav",c.audio[k],sr);nova::writeWave(std::string(argv[3])+"/"+label+"-rms-matched.wav",c.audio[k],sr,c.matching[k]);if(k)std::cout<<",";std::cout<<"{\"label\":\""<<label<<"\",\"matchingGain\":"<<c.matching[k]<<",\"measurement\":";measurement(c.measurements[k]);std::cout<<",\"settings\":[";auto v=k?p.choices[k-1]:std::array<float,4>{0,0,0,1};for(unsigned i=0;i<4;++i){if(i)std::cout<<",";std::cout<<v[i];}std::cout<<"]}";}std::cout<<"]}\n";
 }catch(const std::exception& e){std::cerr<<e.what()<<"\n";return 1;}}
