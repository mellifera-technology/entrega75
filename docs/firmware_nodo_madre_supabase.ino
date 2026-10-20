/*
 * MELLIFERA TECHNOLOGY - NODO MADRE
 * ESP32 + SIM7670G
 *
 * Funciones implementadas:
 * - Servidor BLE siempre disponible para Nodos Hijo.
 * - Recepción de JSON, ACK y persistencia en LittleFS.
 * - Ventana de vinculación con TTP223 + buzzer + LEDs.
 * - Provisionamiento automático: el Nodo Madre obtiene el USER_ID oculto desde la web
 *   usando MOTHER_UID + API_KEY (el usuario no necesita conocerlo).
 * - Publicación celular cada 3 horas.
 * - Conservación de registros si no hay red o si el servidor no responde HTTP 2xx.
 * - Eliminación de los datos locales únicamente cuando el servidor confirma la recepción.
 *
 * Dependencias Arduino:
 *   - ESP32 Arduino Core
 *   - ArduinoJson 6.x
 *   - TinyGSM
 *   - ArduinoHttpClient
 *
 * Para SIM7670G se usa el perfil AT compatible SIM7600 de TinyGSM.
 */

#define TINY_GSM_MODEM_SIM7600
#define TINY_GSM_RX_BUFFER 1024

#include <Arduino.h>
#include <ArduinoJson.h>
#include <ArduinoHttpClient.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <LittleFS.h>
#include <Preferences.h>
#include <TinyGsmClient.h>
#include "secrets.h"

// --------------------------- PINOUT ELEGIDO ---------------------------
// Ajustar únicamente si la PCB final usa otro ruteo.
static constexpr int PIN_SIM_RX = 16;       // ESP32 RX <- TX SIM7670G
static constexpr int PIN_SIM_TX = 17;       // ESP32 TX -> RX SIM7670G
static constexpr int PIN_SIM_POWER = 23;    // MOSFET / EN de alimentación del módem
static constexpr int PIN_TOUCH = 32;        // TTP223
static constexpr int PIN_BUZZER = 25;
static constexpr int PIN_LED_GREEN = 26;
static constexpr int PIN_LED_YELLOW = 27;
static constexpr int PIN_LED_RED = 14;

static constexpr uint32_t MODEM_BAUD = 115200;
static constexpr uint32_t PAIR_WINDOW_MS = 10000UL;
static constexpr uint32_t UPLOAD_INTERVAL_MS = 3UL * 60UL * 60UL * 1000UL;
static constexpr uint32_t TOUCH_DEBOUNCE_MS = 600UL;

static const char *DATA_FILE = "/datos_acumulados.txt";
static const char *TEMP_FILE = "/datos_pendientes.tmp";
static const char *BACKUP_FILE = "/datos_acumulados.bak";
static const char *PAIRED_FILE = "/nodos_vinculados.txt";

// UUID propios del prototipo MELLIFERA.
static const char *SERVICE_UUID = "f5a5d101-4df6-4a6b-9c80-1d2c3e4f5001";
static const char *DATA_CHAR_UUID = "f5a5d102-4df6-4a6b-9c80-1d2c3e4f5001";

HardwareSerial SerialAT(2);
TinyGsm modem(SerialAT);
TinyGsmClientSecure gsmSecure(modem);
TinyGsmClient gsmPlain(modem);
Preferences prefs;

BLEServer *bleServer = nullptr;
BLECharacteristic *dataCharacteristic = nullptr;

String provisionedUserId;
uint32_t lastUploadMs = 0;
uint32_t pairStartedMs = 0;
uint32_t lastTouchMs = 0;
bool pairWindow = false;
bool storageReady = false;
uint32_t currentBootId = 0;

// ---------------------------------------------------------------------
// Feedback visual / acústico
// ---------------------------------------------------------------------
void setLeds(bool green, bool yellow, bool red) {
  digitalWrite(PIN_LED_GREEN, green ? HIGH : LOW);
  digitalWrite(PIN_LED_YELLOW, yellow ? HIGH : LOW);
  digitalWrite(PIN_LED_RED, red ? HIGH : LOW);
}

void beep(uint16_t durationMs) {
  digitalWrite(PIN_BUZZER, HIGH);
  delay(durationMs);
  digitalWrite(PIN_BUZZER, LOW);
}

void beepPairStart() { beep(100); }
void beepPairSuccess() { beep(80); delay(90); beep(80); }
void beepPairTimeout() { beep(650); }

void normalState() { setLeds(true, false, false); }
void busyState() { setLeds(false, true, false); }
void errorState() { setLeds(false, false, true); }

// ---------------------------------------------------------------------
// Persistencia de USER_ID oculto
// ---------------------------------------------------------------------
void loadProvisionedUserId() {
  prefs.begin("mellifera", true);
  provisionedUserId = prefs.getString("user_id", "");
  prefs.end();
}

void incrementBootId() {
  prefs.begin("mellifera", false);
  currentBootId = prefs.getUInt("boot_id", 0) + 1;
  prefs.putUInt("boot_id", currentBootId);
  prefs.end();
}

void saveProvisionedUserId(const String &userId) {
  prefs.begin("mellifera", false);
  prefs.putString("user_id", userId);
  prefs.end();
  provisionedUserId = userId;
}

// ---------------------------------------------------------------------
// LittleFS
// ---------------------------------------------------------------------
bool appendJsonLine(const String &line) {
  if (!storageReady) return false;
  File file = LittleFS.open(DATA_FILE, FILE_APPEND);
  if (!file) return false;
  bool ok = file.println(line) > 0;
  file.close();
  return ok;
}

size_t pendingBytes() {
  if (!storageReady || !LittleFS.exists(DATA_FILE)) return 0;
  File file = LittleFS.open(DATA_FILE, FILE_READ);
  if (!file) return 0;
  size_t size = file.size();
  file.close();
  return size;
}

String normalizeMacString(String mac) {
  mac.trim();
  mac.toUpperCase();
  mac.replace("-", ":");
  return mac;
}

bool isChildPaired(const String &mac) {
  if (!storageReady || !LittleFS.exists(PAIRED_FILE)) return false;
  File file = LittleFS.open(PAIRED_FILE, FILE_READ);
  if (!file) return false;
  while (file.available()) {
    String line = file.readStringUntil('\n');
    line.trim();
    if (line == mac) {
      file.close();
      return true;
    }
  }
  file.close();
  return false;
}

bool rememberPairedChild(const String &mac) {
  if (isChildPaired(mac)) return true;
  if (!storageReady) return false;
  File file = LittleFS.open(PAIRED_FILE, FILE_APPEND);
  if (!file) return false;
  bool ok = file.println(mac) > 0;
  file.close();
  return ok;
}

String makeEventId(const String &mac) {
  char randomPart[9];
  snprintf(randomPart, sizeof(randomPart), "%08lX", (unsigned long)esp_random());
  String compactMac = mac;
  compactMac.replace(":", "");
  return String(MELLIFERA_MOTHER_UID) + "-" + compactMac + "-" + String(currentBootId) + "-" + String(millis()) + "-" + String(randomPart);
}

void recoverBufferFiles() {
  if (!storageReady) return;

  // Si hubo un corte entre el renombre del archivo original y el del temporal,
  // recuperamos el backup. Reenviar registros ya aceptados es seguro por EVENT_ID.
  if (!LittleFS.exists(DATA_FILE) && LittleFS.exists(BACKUP_FILE)) {
    LittleFS.rename(BACKUP_FILE, DATA_FILE);
  } else if (LittleFS.exists(DATA_FILE) && LittleFS.exists(BACKUP_FILE)) {
    LittleFS.remove(BACKUP_FILE);
  }

  // Un temporal huérfano nunca reemplaza al archivo principal por sí solo.
  if (LittleFS.exists(TEMP_FILE) && LittleFS.exists(DATA_FILE)) {
    LittleFS.remove(TEMP_FILE);
  }
}

// ---------------------------------------------------------------------
// Recepción BLE
// ---------------------------------------------------------------------
bool validateAndNormalizeIncoming(const String &input, String &normalized, bool &newPair) {
  DynamicJsonDocument doc(2304);
  DeserializationError err = deserializeJson(doc, input);
  if (err || !doc.is<JsonObject>()) return false;

  JsonObject obj = doc.as<JsonObject>();
  if (!obj.containsKey("MAC_HIJO")) return false;

  String mac = normalizeMacString(String((const char *)(obj["MAC_HIJO"] | "")));
  if (!mac.length()) return false;
  obj["MAC_HIJO"] = mac;

  // El primer paquete de un MAC nuevo solo se acepta dentro de la ventana de
  // vinculación abierta con el TTP223. Luego el MAC queda persistido en LittleFS.
  newPair = false;
  if (!isChildPaired(mac)) {
    if (!pairWindow) return false;
    if (!rememberPairedChild(mac)) return false;
    newPair = true;
  }

  // USER_ID puede venir del Hijo como plantea el diseño. La Madre lo canoniza con
  // el valor obtenido de la plataforma, evitando que un dato incorrecto mezcle usuarios.
  if (provisionedUserId.length()) obj["USER_ID"] = provisionedUserId;
  obj["MOTHER_UID"] = MELLIFERA_MOTHER_UID;
  obj["_stored_millis"] = millis();
  obj["_boot_id"] = currentBootId;

  if (!obj.containsKey("EVENT_ID")) obj["EVENT_ID"] = makeEventId(mac);
  if (!obj.containsKey("segundos_atras")) obj["segundos_atras"] = 0;
  if (!obj.containsKey("is_valid")) obj["is_valid"] = true;

  normalized = "";
  serializeJson(obj, normalized);
  return true;
}

class DataCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    std::string raw = characteristic->getValue();
    if (raw.empty()) return;

    String input(raw.c_str());
    String normalized;
    bool newPair = false;
    bool valid = validateAndNormalizeIncoming(input, normalized, newPair);
    bool saved = valid && appendJsonLine(normalized);

    if (saved) {
      characteristic->setValue("OK");
      characteristic->notify();
      if (newPair) {
        pairWindow = false;
        beepPairSuccess();
      }
      normalState();
    } else {
      characteristic->setValue(pairWindow ? "ERR" : "NOT_PAIRED");
      characteristic->notify();
      errorState();
      delay(120);
      if (!pairWindow) normalState();
    }
  }
};

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *) override {}
  void onDisconnect(BLEServer *server) override {
    // El Nodo Madre debe quedar disponible de forma continua.
    delay(80);
    server->getAdvertising()->start();
  }
};

void setupBle() {
  BLEDevice::init("NODO_MADRE");
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());

  BLEService *service = bleServer->createService(SERVICE_UUID);
  dataCharacteristic = service->createCharacteristic(
    DATA_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE |
    BLECharacteristic::PROPERTY_WRITE_NR |
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_NOTIFY
  );
  dataCharacteristic->addDescriptor(new BLE2902());
  dataCharacteristic->setCallbacks(new DataCallbacks());
  dataCharacteristic->setValue("READY");
  service->start();

  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->setMinPreferred(0x06);
  advertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
}

void handlePairButton() {
  if (digitalRead(PIN_TOUCH) != HIGH) return;
  uint32_t now = millis();
  if (now - lastTouchMs < TOUCH_DEBOUNCE_MS) return;
  lastTouchMs = now;
  pairWindow = true;
  pairStartedMs = now;
  busyState();
  beepPairStart();
}

void updatePairWindow() {
  if (!pairWindow) return;
  if (millis() - pairStartedMs >= PAIR_WINDOW_MS) {
    pairWindow = false;
    beepPairTimeout();
    normalState();
  }
}

// ---------------------------------------------------------------------
// SIM7670G / red celular
// ---------------------------------------------------------------------
void modemPower(bool on) {
  digitalWrite(PIN_SIM_POWER, on ? HIGH : LOW);
  delay(on ? 1200 : 150);
}

bool connectCellular() {
  modemPower(true);
  busyState();
  SerialAT.begin(MODEM_BAUD, SERIAL_8N1, PIN_SIM_RX, PIN_SIM_TX);
  delay(300);

  if (!modem.restart()) {
    Serial.println("[MODEM] No respondió al restart");
    return false;
  }
  if (!modem.waitForNetwork(60000L)) {
    Serial.println("[MODEM] Sin red celular");
    return false;
  }
  if (!modem.gprsConnect(MELLIFERA_APN, MELLIFERA_APN_USER, MELLIFERA_APN_PASSWORD)) {
    Serial.println("[MODEM] No pudo abrir PDP/GPRS");
    return false;
  }
  return true;
}

void disconnectCellular() {
  if (modem.isGprsConnected()) modem.gprsDisconnect();
  SerialAT.flush();
  modemPower(false);
}

int postJson(const char *path, const String &json, String &responseBody) {
#if MELLIFERA_USE_TLS
  HttpClient http(gsmSecure, MELLIFERA_API_HOST, MELLIFERA_API_PORT);
#else
  HttpClient http(gsmPlain, MELLIFERA_API_HOST, MELLIFERA_API_PORT);
#endif
  http.connectionKeepAlive();
  http.beginRequest();
  http.post(path);
  http.sendHeader("Content-Type", "application/json");
  http.sendHeader("Accept", "application/json");
  http.sendHeader("x-mellifera-key", MELLIFERA_API_KEY);
  http.sendHeader("x-mellifera-mother", MELLIFERA_MOTHER_UID);
  http.sendHeader("Content-Length", json.length());
  http.beginBody();
  http.print(json);
  http.endRequest();

  int status = http.responseStatusCode();
  responseBody = http.responseBody();
  http.stop();
  return status;
}

bool provisionFromServer() {
  DynamicJsonDocument requestDoc(256);
  requestDoc["MOTHER_UID"] = MELLIFERA_MOTHER_UID;
  requestDoc["action"] = "provision";
  String payload;
  serializeJson(requestDoc, payload);

  String body;
  int status = postJson("/functions/v1/mellifera-ingest", payload, body);
  if (status < 200 || status >= 300) {
    Serial.printf("[PROVISION] HTTP %d %s\n", status, body.c_str());
    return false;
  }

  DynamicJsonDocument responseDoc(1024);
  if (deserializeJson(responseDoc, body)) return false;
  const char *userId = responseDoc["USER_ID"] | "";
  if (!strlen(userId)) return false;
  saveProvisionedUserId(String(userId));
  Serial.println("[PROVISION] Identidad interna del cliente configurada.");
  return true;
}

bool postStoredLine(const String &line) {
  DynamicJsonDocument doc(2304);
  if (deserializeJson(doc, line)) return false;
  JsonObject obj = doc.as<JsonObject>();

  uint32_t storedMs = obj["_stored_millis"] | millis();
  uint32_t storedBootId = obj["_boot_id"] | currentBootId;
  uint32_t secondsAgo = obj["segundos_atras"] | 0;
  if (storedBootId == currentBootId) {
    secondsAgo += (millis() - storedMs) / 1000UL;
  } else {
    // Tras un reinicio sin RTC no existe forma de reconstruir exactamente el tiempo
    // que transcurrió antes del corte. Se conserva la antigüedad aportada por el Hijo
    // y se agrega el tiempo del arranque actual; el backend deja trazabilidad del caso.
    secondsAgo += millis() / 1000UL;
    obj["timing_recovered_after_reboot"] = true;
  }
  obj["segundos_atras"] = secondsAgo;
  obj.remove("_stored_millis");
  obj.remove("_boot_id");
  obj["MOTHER_UID"] = MELLIFERA_MOTHER_UID;
  if (provisionedUserId.length()) obj["USER_ID"] = provisionedUserId;

  String payload;
  serializeJson(obj, payload);
  String response;
  int status = postJson("/functions/v1/mellifera-ingest", payload, response);
  Serial.printf("[UPLOAD] HTTP %d %s\n", status, response.c_str());
  return status >= 200 && status < 300;
}

bool transmitBufferedData() {
  if (!storageReady || !LittleFS.exists(DATA_FILE) || pendingBytes() == 0) return true;
  if (!connectCellular()) {
    disconnectCellular();
    errorState();
    return false;
  }

  if (!provisionedUserId.length() && !provisionFromServer()) {
    // El pedido puede todavía no haber sido activado. No se borra ningún dato.
    disconnectCellular();
    errorState();
    return false;
  }

  File input = LittleFS.open(DATA_FILE, FILE_READ);
  File pending = LittleFS.open(TEMP_FILE, FILE_WRITE);
  if (!input || !pending) {
    if (input) input.close();
    if (pending) pending.close();
    disconnectCellular();
    errorState();
    return false;
  }

  bool allOk = true;
  while (input.available()) {
    String line = input.readStringUntil('\n');
    line.trim();
    if (!line.length()) continue;
    if (!postStoredLine(line)) {
      allOk = false;
      pending.println(line);
    }
    delay(200);
  }
  input.close();
  pending.close();

  size_t remaining = 0;
  if (LittleFS.exists(TEMP_FILE)) {
    File check = LittleFS.open(TEMP_FILE, FILE_READ);
    remaining = check ? check.size() : 0;
    if (check) check.close();
  }

  if (remaining == 0) {
    // Todo confirmado por HTTP 2xx. EVENT_ID permite tolerar un corte antes del borrado.
    LittleFS.remove(TEMP_FILE);
    LittleFS.remove(DATA_FILE);
  } else {
    // Reemplazo con backup para priorizar no perder datos pendientes.
    LittleFS.remove(BACKUP_FILE);
    if (!LittleFS.rename(DATA_FILE, BACKUP_FILE)) {
      LittleFS.remove(TEMP_FILE);
      disconnectCellular();
      errorState();
      return false;
    }
    if (LittleFS.rename(TEMP_FILE, DATA_FILE)) {
      LittleFS.remove(BACKUP_FILE);
    } else {
      LittleFS.rename(BACKUP_FILE, DATA_FILE);
      disconnectCellular();
      errorState();
      return false;
    }
  }

  disconnectCellular();
  if (allOk) normalState(); else errorState();
  return allOk;
}

// ---------------------------------------------------------------------
// Arduino lifecycle
// ---------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(200);

  pinMode(PIN_SIM_POWER, OUTPUT);
  pinMode(PIN_TOUCH, INPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  digitalWrite(PIN_SIM_POWER, LOW);
  digitalWrite(PIN_BUZZER, LOW);

  storageReady = LittleFS.begin(true);
  if (!storageReady) {
    Serial.println("[FS] No se pudo montar LittleFS");
    errorState();
  } else {
    normalState();
  }

  recoverBufferFiles();
  loadProvisionedUserId();
  incrementBootId();
  setupBle();
  lastUploadMs = millis();
  Serial.printf("MELLIFERA Nodo Madre listo. Vinculados: %s\n", LittleFS.exists(PAIRED_FILE) ? "sí" : "ninguno");
}

void loop() {
  handlePairButton();
  updatePairWindow();

  uint32_t now = millis();
  if (now - lastUploadMs >= UPLOAD_INTERVAL_MS) {
    lastUploadMs = now;
    busyState();
    transmitBufferedData();
  }

  delay(25);
}
