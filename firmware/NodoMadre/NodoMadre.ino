/*
 MELLIFERA TECHNOLOGY - NODO MADRE (ESP32 + SIM7670G)
 Basado en NodoMadre (1).ipynb, CELDA 1 = VERSION MAS RECIENTE.
 PINES ORIGINALES INTACTOS: TOUCH15 BUZZER13 SIM_RX26 SIM_TX27 SIM_EN4.
 Arduino ESP32 Core 2.0.17, ArduinoJson 6.x, librería ESP32 BLE clásica.
 Las credenciales del equipo nunca aparecen en el HTML; tampoco usa USER_ID.
 NO BORRA datos hasta obtener respuesta HTTP 2xx + {"ok":true} del servidor.
 */
#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>
#include <Preferences.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include "credenciales.h"

#define TOUCH_PIN 15
#define BUZZER_PIN 13
#define SIM_RX_PIN 26  // Version final de tu notebook; NO CAMBIAR
#define SIM_TX_PIN 27  // Version final de tu notebook; NO CAMBIAR
#define SIM_EN_PIN 4

#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define TRANSMIT_INTERVAL_MS (3UL * 60UL * 60UL * 1000UL)
#define PAIRING_WINDOW_MS 10000UL
// Activar solo para programar una placa totalmente nueva SIN datos. Luego volver a 0.
#define FORMAT_FRESH_FLASH 0
#define ENDPOINT "https://zvtljoaecgtdnzloksjo.supabase.co/functions/v1/mellifera-ingest"

static const char* PENDING="/pending.ndjson";
static const char* SENDING="/sending.ndjson";
HardwareSerial modem(2);
Preferences preferences;
BLECharacteristic* characteristic=nullptr;
SemaphoreHandle_t fsMutex=nullptr;
unsigned long lastSend=0, pairingStart=0;
bool pairing=false, touchLatched=false, fsReady=false;
uint32_t bootId=0;

void buzz(unsigned t){digitalWrite(BUZZER_PIN,HIGH);delay(t);digitalWrite(BUZZER_PIN,LOW);}
void successBeep(){buzz(80);delay(85);buzz(80);}
String normalizeMac(String s){s.toUpperCase();s.replace('-',':');return s;}

// Para no usar nombres de claves NVS > 15 caracteres, convertimos la MAC en índice corto.
String pairKey(String mac){
  // NVS admite nombres <=15 caracteres. 1 prefijo + 12 hex sin dos puntos.
  mac.replace(":","");mac.replace("-","");mac.toUpperCase();
  return String("m")+mac;
}

bool isPaired(const String& mac){return preferences.getBool(pairKey(mac).c_str(),false);}
void setPaired(const String& mac){preferences.putBool(pairKey(mac).c_str(),true);}

// Sólo devuelve ACK después de validar y guardar el JSON en LittleFS.
class ReceiveBLE:public BLECharacteristicCallbacks {
 void onWrite(BLECharacteristic* c) override {
   std::string value=c->getValue();
   if(value.empty())return;
   StaticJsonDocument<768> input;
   if(deserializeJson(input,value.data(),value.length())){c->setValue("NACK:JSON");return;}
   String mac=normalizeMac(String((const char*)(input["MAC_HIJO"]|"")));
   String event=String((const char*)(input["EVENT_ID"]|""));
   if(mac.length()!=17){c->setValue("NACK:MAC");return;}
   const String kind=String((const char*)(input["tipo"]|"medicion"));
   if(kind=="pair"){
     if(!pairing){c->setValue("NACK:PAIR_CLOSED");return;}
     setPaired(mac);pairing=false;successBeep();c->setValue("ACK:PAIR");return;
   }
   if(!isPaired(mac)){c->setValue("NACK:NOT_PAIRED");return;}
   if(event.isEmpty()){c->setValue("NACK:EVENT_ID");return;}
   if(!fsReady){c->setValue("NACK:FS");return;}
   if(xSemaphoreTake(fsMutex,pdMS_TO_TICKS(1800))!=pdTRUE){c->setValue("NACK:BUSY");return;}
   File f=LittleFS.open(PENDING,FILE_APPEND);
   bool ok=false;
   if(f){
      input.remove("tipo");
      input["_rx_millis"]=(uint32_t)millis();
      input["_boot_id"]=bootId;
      String line;serializeJson(input,line);
      ok=f.println(line)>0;
      f.flush();f.close();
   }
   xSemaphoreGive(fsMutex);
   c->setValue(ok?String("ACK:")+event:"NACK:FS_WRITE");
 }
};

class MotherServerEvents:public BLEServerCallbacks {
 void onDisconnect(BLEServer* s) override { BLEDevice::startAdvertising(); }
};
void setupBLE(){
 BLEDevice::init("NODO_MADRE");
 BLEDevice::setMTU(517);
 BLEServer* server=BLEDevice::createServer();
 server->setCallbacks(new MotherServerEvents());
 BLEService* service=server->createService(SERVICE_UUID);
 characteristic=service->createCharacteristic(CHARACTERISTIC_UUID,
   BLECharacteristic::PROPERTY_READ|BLECharacteristic::PROPERTY_WRITE);
 characteristic->setCallbacks(new ReceiveBLE());
 characteristic->setValue("READY");
 service->start();
 BLEAdvertising* advertising=BLEDevice::getAdvertising();
 advertising->addServiceUUID(SERVICE_UUID); advertising->setScanResponse(true);
 BLEDevice::startAdvertising();
}

// Envía AT y espera una marca textual real; se imprimen logs sin credenciales.
String readUntil(const String& marker,unsigned long timeout){
 String out;unsigned long start=millis();
 while(millis()-start<timeout){
   while(modem.available()){
     char c=(char)modem.read();
     if(out.length()<1500)out+=c; else out.remove(0,400);
     if(out.indexOf(marker)>=0)return out;
     if(out.indexOf("\r\nERROR\r\n")>=0)return out;
   }
   delay(5);
 }
 return out;
}
String at(const String& cmd,const String& marker="OK",unsigned long timeout=4000){
 while(modem.available())modem.read();
 modem.println(cmd);return readUntil(marker,timeout);
}
bool ok(const String& c,unsigned long t=4000){return at(c,"OK",t).indexOf("\r\nOK\r\n")>=0;}

bool connectLTE(){
 digitalWrite(SIM_EN_PIN,HIGH);delay(5500);
 modem.begin(115200,SERIAL_8N1,SIM_RX_PIN,SIM_TX_PIN);
 bool awake=false;
 for(int n=0;n<8;n++)if(ok("AT",2000)){awake=true;break;}else delay(900);
 if(!awake){Serial.println("[LTE] Modem sin respuesta AT; revisar alimentacion/PWRKEY");return false;}
 ok("ATE0");
 String sim=at("AT+CPIN?","OK",5000);
 if(sim.indexOf("READY")<0){
   String pin=String(MELLIFERA_SIM_PIN);
   if(pin.isEmpty()){Serial.println("[LTE] SIM bloqueada, ausente o requiere PIN");return false;}
   if(!ok(String("AT+CPIN=\"")+pin+"\"",15000))return false;
 }
 // No se fija operador: modem elige red permitida en roaming según SIM.
 ok("AT+COPS=0",15000);
 // AutoAPN: conservamos perfil aportado por operadora, salvo APN explícito.
 String apn=String(MELLIFERA_APN);
 if(!apn.isEmpty()){
   if(!ok(String("AT+CGDCONT=1,\"IP\",\"")+apn+"\""))return false;
 }else{
   String ctx=at("AT+CGDCONT?","OK",5000);
   Serial.println(String("[LTE] APN automatico/perfil de SIM: ")+(ctx.indexOf("+CGDCONT:")>=0?"detectado":"sin perfil, revisar APN"));
 }
 bool registered=false;
 unsigned long start=millis();
 while(millis()-start<90000){
   String reg=at("AT+CEREG?","OK",4000);
   if(reg.indexOf(",1")>=0||reg.indexOf(",5")>=0){registered=true;break;}
   delay(2000);
 }
 if(!registered){Serial.println("[LTE] Sin red LTE o roaming no habilitado");return false;}
 ok("AT+CGATT=1",12000);
 if(!ok("AT+CGACT=1,1",20000)){
   Serial.println("[LTE] PDP no activo: verificar APN y plan de datos");return false;
 }
 String addr=at("AT+CGPADDR=1","OK",6000);
 if(addr.indexOf("+CGPADDR:")<0){Serial.println("[LTE] Sin IP");return false;}
 Serial.println("[LTE] Red conectada");return true;
}
void disconnectLTE(){modem.println("AT+HTTPTERM");delay(80);modem.end();digitalWrite(SIM_EN_PIN,LOW);}

// HTTPS por comandos oficiales SIM767XX; SIN usar un servidor HTTP sin cifrar.
// Acepta exclusivamente {"ok":true} más código HTTP 2xx.
bool postHTTPS(const String& payload){
 if(!ok("AT+HTTPINIT",15000)){Serial.println("[HTTP] INIT fallo");return false;}
 // SNI imprescindible para Supabase y HTTPS con hostnames.
 ok("AT+CSSLCFG=\"enableSNI\",0,1");
 if(String(MELLIFERA_CA_FILE).length()) {
   if(!ok(String("AT+CSSLCFG=\"cacert\",0,\"")+MELLIFERA_CA_FILE+"\"") || !ok("AT+CSSLCFG=\"authmode\",0,1")) {
     ok("AT+HTTPTERM");return false;
   }
 }
 bool ready=ok(String("AT+HTTPPARA=\"URL\",\"")+ENDPOINT+"\"") &&
            ok("AT+HTTPPARA=\"CONTENT\",\"application/json\"");
 if(!ready){ok("AT+HTTPTERM");return false;}
 String prompt=at(String("AT+HTTPDATA=")+String(payload.length())+",20000","DOWNLOAD",6000);
 if(prompt.indexOf("DOWNLOAD")<0){ok("AT+HTTPTERM");return false;}
 modem.print(payload);  // El JSON contiene DEVICE_KEY; NO imprimir nunca en Serial.
 String written=readUntil("\r\nOK\r\n",22000);
 if(written.indexOf("\r\nOK\r\n")<0){ok("AT+HTTPTERM");return false;}
 String action=at("AT+HTTPACTION=1","+HTTPACTION:",125000);
 // La respuesta asincrona puede llegar en un fragmento posterior.
 if(action.indexOf("+HTTPACTION:")<0){ok("AT+HTTPTERM");return false;}
 int pos=action.indexOf("+HTTPACTION:");
 int method=-1,status=0,length=0;
 sscanf(action.c_str()+pos,"+HTTPACTION: %d,%d,%d",&method,&status,&length);
 // Si llegó la cabecera de la indicación incompleta, esperar el salto de línea.
 if(status==0){String tail=readUntil("\n",2500);action+=tail;sscanf(action.c_str()+pos,"+HTTPACTION: %d,%d,%d",&method,&status,&length);}
 Serial.printf("[HTTP] Estado %d / %d bytes\n",status,length);
 bool accepted=false;
 if(status>=200&&status<300){
    String body=at("AT+HTTPREAD","\r\nOK\r\n",12000);
    accepted=body.indexOf("\"ok\":true")>=0;
 }
 ok("AT+HTTPTERM",5000);
 return accepted;
}

bool sendLine(const String& line){
 StaticJsonDocument<1024> doc;
 if(deserializeJson(doc,line)){Serial.println("[QUEUE] JSON corrupto, conservado");return false;}
 uint32_t received=doc["_rx_millis"]|0;
 uint32_t oldBoot=doc["_boot_id"]|0;
 uint32_t age=doc["segundos_atras"]|0;
 if(oldBoot==bootId)age+=(uint32_t)(millis()-received)/1000UL;
 else doc["tiempo_aproximado_tras_reinicio"]=true; // No inventamos horas perdidas sin RTC absoluto.
 doc.remove("_rx_millis");doc.remove("_boot_id");
 doc["segundos_atras"]=age;
 doc["MOTHER_UID"]=MELLIFERA_MOTHER_UID;
 doc["DEVICE_KEY"]=MELLIFERA_DEVICE_KEY;
 String payload;serializeJson(doc,payload);
 return postHTTPS(payload);
}

bool sendQueue(){
 if(!fsReady)return false;
 if(xSemaphoreTake(fsMutex,pdMS_TO_TICKS(2500))!=pdTRUE)return false;
 // El BLE escribe en /pending mientras se transmite /sending.
 if(!LittleFS.exists(SENDING)&&LittleFS.exists(PENDING)){
    if(!LittleFS.rename(PENDING,SENDING)){
      xSemaphoreGive(fsMutex);return false;
    }
 }
 xSemaphoreGive(fsMutex);
 if(!LittleFS.exists(SENDING))return true;
 File file=LittleFS.open(SENDING,FILE_READ);if(!file)return false;
 if(!connectLTE()){file.close();disconnectLTE();return false;}
 bool allOkay=true;
 while(file.available()){
    String line=file.readStringUntil('\n');line.trim();
    if(line.length()==0)continue;
    if(!sendLine(line)){allOkay=false;break;}
 }
 file.close();disconnectLTE();
 // Sólo al confirmar TODO el archivo, borrarlo; EVENT_ID evita duplicar tras corte.
 if(allOkay){
    if(xSemaphoreTake(fsMutex,pdMS_TO_TICKS(2500))==pdTRUE){LittleFS.remove(SENDING);xSemaphoreGive(fsMutex);}
    Serial.println("[QUEUE] Envio confirmado, lote eliminado");
 }else Serial.println("[QUEUE] Error, datos retenidos para reintento");
 return allOkay;
}

void setup(){
 Serial.begin(115200);
 pinMode(TOUCH_PIN,INPUT);pinMode(BUZZER_PIN,OUTPUT);pinMode(SIM_EN_PIN,OUTPUT);
 digitalWrite(BUZZER_PIN,LOW);digitalWrite(SIM_EN_PIN,LOW);
 fsMutex=xSemaphoreCreateMutex();
 fsReady=LittleFS.begin(false); // NUNCA formatear automaticamente un buffer con mediciones.
#if FORMAT_FRESH_FLASH
 if(!fsReady)fsReady=LittleFS.begin(true); // Peligroso si la memoria tenia datos!
#endif
 if(!fsReady)Serial.println("[FS] Error de montaje: formatear SOLO si la memoria es nueva");
 preferences.begin("nodos_hijos",false);
 bootId=preferences.getUInt("boot_count",0)+1;preferences.putUInt("boot_count",bootId);
 setupBLE();lastSend=millis();
 Serial.println("[MELLIFERA] Nodo Madre listo, BLE activo, modem apagado");
}
void loop(){
 bool touch=digitalRead(TOUCH_PIN)==HIGH;
 if(touch&&!touchLatched&&!pairing){pairing=true;pairingStart=millis();buzz(160);Serial.println("[BLE] Emparejar: ventana 10 s");}
 touchLatched=touch;
 if(pairing&&(uint32_t)(millis()-pairingStart)>=PAIRING_WINDOW_MS){pairing=false;buzz(900);}
 if((uint32_t)(millis()-lastSend)>=TRANSMIT_INTERVAL_MS){
    lastSend=millis();sendQueue();
 }
 delay(30);
}
