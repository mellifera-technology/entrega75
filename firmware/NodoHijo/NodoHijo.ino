/*
 MELLIFERA TECHNOLOGY — NODO HIJO ESP32
 Basado en NodoHijo (1).ipynb; PINOUT ORIGINAL NO CAMBIADO:
 DHT11 GPIO4, TCRT5000 GPIO26/27, MAX4466 GPIO34, TOUCH GPIO15,
 BUZZER GPIO13, BOOT GPIO0, I2C MPU6050 SDA21 SCL22.
 ESP32 Arduino Core 2.0.17 + ArduinoJson 6.x, DHT sensor library.
 Cada 20 minutos: DHT11, TCRT5000 60s, MPU6050. Cada hora: 10s microfono
 2048Hz, 1024 muestras/trama x20; RMS y banda 500-600 Hz.
 Buffer RTC de 72 horas (72 registros horarios), BLE con ACK por registro.
 */
#include <Arduino.h>
#include <Wire.h>
#include <DHT.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <ArduinoJson.h>
#include <esp_system.h>
#include <math.h>

#define DHTPIN 4
#define DHTTYPE DHT11
#define TCRT1_PIN 26
#define TCRT2_PIN 27
#define MIC_PIN 34
#define TOUCH_PIN 15
#define BUZZER_PIN 13
#define BOOT_BTN_PIN 0
#define I2C_SDA 21
#define I2C_SCL 22
#define WAKE_INTERVAL_MIN 20
#define TCRT_WINDOW_MS 60000UL
#define MIC_WINDOW_MS 10000UL
#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define BUFFER_HOURS 72
#define CRITICAL_TILT_DEG 15.0f
#define uS_TO_S_FACTOR 1000000ULL

DHT dht(DHTPIN,DHTTYPE);
Preferences prefs;
struct HourlyRecord {
 float temp,humidity,acousticEnergy,tiltAngle;
 uint64_t seq;
 uint32_t epoch;
 uint8_t activity,swarm,tilt,valid,noActivityStreak;
};
RTC_DATA_ATTR HourlyRecord ring[BUFFER_HOURS];
RTC_DATA_ATTR int ringCount=0;
RTC_DATA_ATTR uint32_t deviceEpoch=0;
RTC_DATA_ATTR int cycle=0;
RTC_DATA_ATTR float sumTemp=0,sumHumidity=0;
RTC_DATA_ATTR int validDht=0;
RTC_DATA_ATTR bool hourActivity=false;
RTC_DATA_ATTR bool sensorFault=false;
RTC_DATA_ATTR float latestTilt=0;
RTC_DATA_ATTR bool tiltPresent=false;
RTC_DATA_ATTR int inhibitCycles=0;
RTC_DATA_ATTR int noActivityWindows=0;

void buzz(unsigned ms){digitalWrite(BUZZER_PIN,HIGH);delay(ms);digitalWrite(BUZZER_PIN,LOW);}
void successBeep(){buzz(80);delay(80);buzz(80);}
String macAddress(){
 uint8_t m[6];esp_read_mac(m,ESP_MAC_WIFI_STA);
 char out[18];snprintf(out,sizeof(out),"%02X:%02X:%02X:%02X:%02X:%02X",m[0],m[1],m[2],m[3],m[4],m[5]);
 return String(out);
}

bool mpuRead(float& x,float& y,float& z){
 Wire.beginTransmission(0x68);Wire.write(0x3B);
 if(Wire.endTransmission(false)!=0)return false;
 if(Wire.requestFrom(0x68,(uint8_t)6,(uint8_t)true)!=6)return false;
 int16_t xi=(Wire.read()<<8)|Wire.read();
 int16_t yi=(Wire.read()<<8)|Wire.read();
 int16_t zi=(Wire.read()<<8)|Wire.read();
 x=xi;y=yi;z=zi;return true;
}
void setupMPU(){
 Wire.beginTransmission(0x68);Wire.write(0x6B);Wire.write(0x00);Wire.endTransmission(true);
 delay(100);
 if(prefs.isKey("base_x"))return;
 float sx=0,sy=0,sz=0;int n=0;
 for(int i=0;i<3;i++){
   float x,y,z;if(mpuRead(x,y,z)){sx+=x;sy+=y;sz+=z;n++;}delay(120);
 }
 if(n==3){prefs.putFloat("base_x",sx/3);prefs.putFloat("base_y",sy/3);prefs.putFloat("base_z",sz/3);}
}
bool calculateTilt(float& angle){
 if(!prefs.isKey("base_x"))return false;
 float x=0,y=0,z=0;int n=0;
 for(int i=0;i<3;i++){float a,b,c;if(mpuRead(a,b,c)){x+=a;y+=b;z+=c;n++;}delay(35);}
 if(n!=3)return false;
 x/=3;y/=3;z/=3;
 float bx=prefs.getFloat("base_x",0),by=prefs.getFloat("base_y",0),bz=prefs.getFloat("base_z",0);
 double m1=sqrt((double)x*x+(double)y*y+(double)z*z);
 double m2=sqrt((double)bx*bx+(double)by*by+(double)bz*bz);
 if(m1<1||m2<1)return false;
 double c=((double)x*bx+(double)y*by+(double)z*bz)/(m1*m2);
 angle=(float)(acos(fmax(-1.0,fmin(1.0,c)))*180.0/PI);
 return true;
}

// Medición 60 segundos; evita interpretar saturación óptica como tráfico real.
int readEntrances(){
 if(inhibitCycles>0){inhibitCycles--;return -1;}
 unsigned long start=millis(),activeMs=0,total=0;
 bool moved=false;
 while(millis()-start<TCRT_WINDOW_MS){
   bool low=(digitalRead(TCRT1_PIN)==LOW||digitalRead(TCRT2_PIN)==LOW);
   if(low){activeMs++;moved=true;}
   total++;delay(1);
 }
 if(total>0&&activeMs>total*0.92){inhibitCycles=3;return -1;}
 return moved?1:0;
}

// FFT radix-2 completa sobre 1024 muestras; 2048 Hz = resolución 2 Hz.
// Buffers estáticos: evitan desbordar el stack del ESP32.
static float fftReal[1024],fftImag[1024];
void fft1024(){
  const unsigned n=1024;
  // Orden bit-reversal.
  for(unsigned i=1,j=0;i<n;i++){
    unsigned bit=n>>1;
    for(;j&bit;bit>>=1)j^=bit;
    j^=bit;
    if(i<j){float t=fftReal[i];fftReal[i]=fftReal[j];fftReal[j]=t;
             t=fftImag[i];fftImag[i]=fftImag[j];fftImag[j]=t;}
  }
  for(unsigned len=2;len<=n;len<<=1){
    const float angle=-2.0f*PI/len;
    const float wlr=cosf(angle),wli=sinf(angle);
    for(unsigned i=0;i<n;i+=len){
      float wr=1,wi=0;
      for(unsigned j=0;j<len/2;j++){
        unsigned even=i+j,odd=even+len/2;
        float tr=wr*fftReal[odd]-wi*fftImag[odd];
        float ti=wr*fftImag[odd]+wi*fftReal[odd];
        float er=fftReal[even],ei=fftImag[even];
        fftReal[even]=er+tr;fftImag[even]=ei+ti;
        fftReal[odd]=er-tr;fftImag[odd]=ei-ti;
        float nwr=wr*wlr-wi*wli;
        wi=wr*wli+wi*wlr;wr=nwr;
      }
    }
  }
}
void readAcoustics(float& energy,bool& swarm){
  constexpr int N=1024;
  constexpr int SAMPLE_US=488; // 2048 Hz nominal
  unsigned long started=millis();
  double sumRMS2=0,sumBand2=0;
  unsigned frames=0;
  while(millis()-started<MIC_WINDOW_MS && frames<20){
    unsigned long deadline=micros();
    double mean=0;
    for(int i=0;i<N;i++){
      while((int32_t)(micros()-deadline)<0){}
      deadline+=SAMPLE_US;
      fftReal[i]=(float)analogRead(MIC_PIN);
      mean+=fftReal[i];
    }
    mean/=N;
    double rms2=0;
    for(int i=0;i<N;i++){
      float centered=fftReal[i]-(float)mean;
      rms2+=(double)centered*centered;
      // Ventana Hann para reducir fuga espectral.
      float hann=0.5f*(1.0f-cosf((2.0f*PI*i)/(N-1)));
      fftReal[i]=centered*hann;fftImag[i]=0;
    }
    rms2/=N;
    fft1024();
    // Bin 250-300 corresponde a 500-600 Hz a Fs=2048, N=1024.
    double bestBand=0;
    for(int k=250;k<=300;k++){
      double p=(double)fftReal[k]*fftReal[k]+(double)fftImag[k]*fftImag[k];
      if(p>bestBand)bestBand=p;
    }
    sumRMS2+=rms2;
    // Normalización RMS aproximada de una componente senoidal con ventana Hann.
    const double peakRms2=bestBand*8.0/(N*N);
    sumBand2+=peakRms2;
    frames++;
  }
  energy=frames?sqrt(sumRMS2/frames):NAN;
  // Umbral inicial, requiere calibración instrumental: no diagnostica enjambrazón.
  swarm=frames&&energy>5&&sqrt(sumBand2/frames)>0.30*energy;
}

class DiscoverMother:public BLEAdvertisedDeviceCallbacks{
public:
 String found;
 void onResult(BLEAdvertisedDevice d) override {
  if(d.getName()=="NODO_MADRE"){
    found=String(d.getAddress().toString().c_str());
    d.getScan()->stop();
  }
 }
};

bool writeBLE(const String& mother,const String& payload,const String& expected){
 BLEClient* client=BLEDevice::createClient();
 client->setMTU(517);
 bool success=false;
 if(client->connect(BLEAddress(mother.c_str()))){
   BLERemoteService* service=client->getService(BLEUUID(SERVICE_UUID));
   if(service){
     BLERemoteCharacteristic* c=service->getCharacteristic(BLEUUID(CHARACTERISTIC_UUID));
     if(c&&c->canWrite()&&c->canRead()){
       // Acota tamaño a un registro individual BLE; requiere MTU negociada >= payload+3.
       if(payload.length()<500){
         c->writeValue((uint8_t*)payload.c_str(),payload.length(),true);
         std::string ack=c->readValue();
         success=(String(ack.c_str())==expected);
       }
     }
   }
   client->disconnect();
 }
 delete client;
 return success;
}

void pairWithMother(){
 buzz(150);
 BLEDevice::init("");BLEDevice::setMTU(517);
 BLEScan* scan=BLEDevice::getScan();
 DiscoverMother* callback=new DiscoverMother();
 scan->setAdvertisedDeviceCallbacks(callback);scan->setActiveScan(true);
 scan->start(10,false);
 String address=callback->found;
 scan->clearResults();
 if(address.length()){
   StaticJsonDocument<180> doc;doc["tipo"]="pair";doc["MAC_HIJO"]=macAddress();
   String json;serializeJson(doc,json);
   if(writeBLE(address,json,"ACK:PAIR")){prefs.putString("motherMAC",address);successBeep();return;}
 }
 buzz(850);
}

bool sendPending(){
 String addr=prefs.getString("motherMAC","");
 if(addr.length()==0)return false;
 BLEDevice::init("");BLEDevice::setMTU(517);
 String mac=macAddress();
 int sent=0;
 for(int i=0;i<ringCount;i++){
   const HourlyRecord& r=ring[i];
   StaticJsonDocument<512> doc;
   doc["MAC_HIJO"]=mac;
   String event=mac+"-"+String(r.epoch,HEX)+"-"+String((uint32_t)(r.seq>>32),HEX)+"-"+String((uint32_t)r.seq,HEX);
   doc["EVENT_ID"]=event;
   if(!isnan(r.temp))doc["DHT11_T"]=r.temp;
   if(!isnan(r.humidity))doc["DHT11_H"]=r.humidity;
   doc["TCRT5000_ACT"]=r.activity?1:0;
   doc["TCRT5000_NO_ACT_STREAK"]=r.noActivityStreak;
   if(!isnan(r.acousticEnergy))doc["MAX4466_E"]=r.acousticEnergy;
   doc["MAX4466_SWARM_BAND"]=r.swarm?1:0;
   if(!isnan(r.tiltAngle))doc["MPU6050_DELTA_DEG"]=r.tiltAngle;
   doc["MPU6050_TILT"]=r.tilt?1:0;
   doc["segundos_atras"]=(ringCount-1-i)*3600UL;
   doc["is_valid"]=(r.valid!=0);
   String json;serializeJson(doc,json);
   if(!writeBLE(addr,json,String("ACK:")+event))break;
   sent++;
 }
 // Descartar SOLO registros realmente confirmados por la Madre.
 if(sent>0){
   for(int i=sent;i<ringCount;i++)ring[i-sent]=ring[i];
   ringCount-=sent;
 }
 return sent>0;
}
void pushRecord(const HourlyRecord& r){
 if(ringCount>=BUFFER_HOURS){
   for(int i=1;i<BUFFER_HOURS;i++)ring[i-1]=ring[i];
   ringCount=BUFFER_HOURS-1;
 }
 ring[ringCount++]=r;
}

void setup(){
 Serial.begin(115200);
 pinMode(BUZZER_PIN,OUTPUT);digitalWrite(BUZZER_PIN,LOW);
 pinMode(BOOT_BTN_PIN,INPUT_PULLUP);
 pinMode(TCRT1_PIN,INPUT);pinMode(TCRT2_PIN,INPUT);
 pinMode(MIC_PIN,INPUT);
 prefs.begin("mellifera",false);
 if(deviceEpoch==0)deviceEpoch=esp_random();
 if(digitalRead(BOOT_BTN_PIN)==LOW){
   deviceEpoch=esp_random();
   prefs.clear();ringCount=0;cycle=0;noActivityWindows=0;sumTemp=sumHumidity=0;validDht=0;
   buzz(900);delay(300);buzz(900);delay(1100);
 }
 Wire.begin(I2C_SDA,I2C_SCL);setupMPU();
 esp_sleep_wakeup_cause_t reason=esp_sleep_get_wakeup_cause();
 if(reason==ESP_SLEEP_WAKEUP_EXT0){
   pairWithMother();
 }else{
   dht.begin();delay(2100);
   float t=dht.readTemperature(),h=dht.readHumidity();
   if(isfinite(t)&&isfinite(h)&&t>=0&&t<=50&&h>=20&&h<=90){
     sumTemp+=t;sumHumidity+=h;validDht++;
   }else sensorFault=true;
   int activity=readEntrances();
   if(activity==1){hourActivity=true;noActivityWindows=0;}
   else if(activity==0){noActivityWindows=min(noActivityWindows+1,100);}
   else sensorFault=true;
   float a=0;
   if(calculateTilt(a)){latestTilt=a;tiltPresent=true;}
   else{sensorFault=true;tiltPresent=false;}
   cycle++;
   if(cycle>=3){
      float e=NAN;bool band=false;readAcoustics(e,band);
      HourlyRecord rec;
      rec.temp=validDht?sumTemp/validDht:NAN;
      rec.humidity=validDht?sumHumidity/validDht:NAN;
      rec.activity=hourActivity?1:0;
      rec.noActivityStreak=(uint8_t)noActivityWindows;
      rec.acousticEnergy=e;
      rec.swarm=band?1:0;
      rec.tiltAngle=tiltPresent?latestTilt:NAN;
      rec.tilt=tiltPresent&&latestTilt>=CRITICAL_TILT_DEG;
      rec.valid=(validDht>=1&&!sensorFault&&isfinite(e))?1:0;
      // NVS: evita EVENT_ID duplicado incluso después de quitar baterías.
      rec.epoch=deviceEpoch;
      rec.seq=prefs.getULong64("sequence",0)+1;
      prefs.putULong64("sequence",rec.seq);
      pushRecord(rec);
      cycle=0;sumTemp=sumHumidity=0;validDht=0;hourActivity=false;sensorFault=false;
      sendPending();
   }
 }
 esp_sleep_enable_timer_wakeup((uint64_t)WAKE_INTERVAL_MIN*60ULL*uS_TO_S_FACTOR);
 esp_sleep_enable_ext0_wakeup((gpio_num_t)TOUCH_PIN,1);
 esp_deep_sleep_start();
}
void loop(){}
