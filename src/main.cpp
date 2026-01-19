/* Home IoT - Final firmware
   - UI & boot sequence like your original sketch (WiFi, NTP, weather, boot progress)
   - Sensors: DHT22(27), Rain(17), MQ2 ADC(34), Light Sensor(33), Touch TP223(25)
   - OLED I2C SDA=23, SCL=22 (display layout same as original)
   - RFID MFRC522 on custom SPI pins (SS=5,RST=21,SCK=18,MISO=19,MOSI=13)
   - Buzzer = 12
   - Servos: 
     * Gate Right Wing SG90 = 16 (5V separate supply; GND common)
     * Gate Left Wing SG90 = 14 (5V separate supply; GND common)
     * Rain Cover SG90 = 4 (auto-opens 90° when rain detected)
   - Lights (controlled via MOSFET/Relay):
     * LED1 = 32 (via MOSFET A3400 gate, init LOW on boot)
     * LED2 = 15
     * LED3 = 22
   - Behavior:
     * RFID valid -> open servo; keep door open for 5000 ms after the *last* valid scan
     * repeatDelay between accepted scans = 2000 ms
     * if scanned again during open period, reset timer (extend open)
     * Rain detected -> rain cover opens 90° clockwise automatically
     * Touch button -> toggle LED1 on/off
*/

#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <WebServer.h>

#include <WebServer.h>
#include <WiFiManager.h>
#include <Preferences.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h> // Re-added for MQTT
// #include "ble_provisioning.h"  // Disabled: WiFiManager only

WebServer server(80);
Preferences preferences;
WiFiClientSecure espClient; // Change to Secure Client for SSL
PubSubClient mqttClient(espClient);
// BLEProvisioning bleProvisioning;  // Disabled

// Global Backend URL Buffer (Loaded from Flash)
// Global Backend URL Buffer (Loaded from Flash)
char backend_url[128] = "https://smarthome-hpcn.onrender.com"; // Render Backend
bool shouldSaveConfig = false;

// MQTT Settings (HiveMQ Cloud)
const char* mqtt_server = "678449c3ad964efd8f7099eb6f54a138.s1.eu.hivemq.cloud";
const int mqtt_port = 8883; // SSL Port
const char* mqtt_user = "nk203";
const char* mqtt_pass = "Nk2032003@";

// Callback notifying us of need to save config
void saveConfigCallback () {
  Serial.println("Should save config");
  shouldSaveConfig = true;
}

#include <Adafruit_SSD1306.h>
#include <Adafruit_GFX.h>
#include "DHT.h"
#include <MFRC522.h>
#include <ESP32Servo.h>

unsigned long lastMqttPublish = 0; // Timer for MQTT report

// ===== WiFi =====
const char* ssid = "NK203";
const char* password = "12345678a@";

// ===== Backend API =====
// ===== Backend API =====
// backend_url is now dynamic
String deviceMac = ""; // Will be set from ESP32 MAC address
const char* firmwareVersion = "1.5.0 wifi-manager"; // Firmware version
bool deviceRegistered = false; // Flag to track registration status

// ===== OLED =====
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define OLED_SDA 23
#define OLED_SCL 22
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ===== DHT22 =====
#define DHTPIN 27         // DHT22 temperature & humidity sensor
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// ===== Sensors / pins =====
#define RAIN_PIN 17       // Cảm biến mưa (digital)
#define LIGHT_PIN 34      // Cảm biến ánh sáng (analog) - chuyển từ 33
#define GAS_PIN 35        // Cảm biến gas MQ2 (analog)
#define TOUCH_PIN 25      // Touch button - toggle LED3 (GPIO 15)
#define SWITCH2_PIN 33    // Switch 2 - toggle LED2 (GPIO 26)
#define SWITCH3_PIN 39    // Switch 3 (VN) - toggle LED1 (GPIO 32)
#define BUZZER_PIN 12
#define BOOT_PIN 0        // Built-in BOOT button for factory reset

// ===== RFID SPI pins (no conflict) =====
#define RST_PIN 21
#define SS_PIN 5
#define SCK_PIN 18
#define MISO_PIN 19
#define MOSI_PIN 13
MFRC522 mfrc(SS_PIN, RST_PIN);

// ===== Servo =====
// Gate servos (2 wings) - SWAPPED pins
#define SERVO_RIGHT_PIN 16  // Right gate wing (updated)
#define SERVO_LEFT_PIN 14   // Left gate wing (updated)
Servo servoRight;
Servo servoLeft;
// Servo directions (cửa phải đảo ngược)
const int SERVO_RIGHT_OPEN_US = 1800;   // Cửa phải: đảo ngược (open)
const int SERVO_RIGHT_CLOSED_US = 1000; // Cửa phải: đảo ngược (closed)
const int SERVO_LEFT_OPEN_US = 1000;    // Cửa trái: bình thường (open)
const int SERVO_LEFT_CLOSED_US = 1800;  // Cửa trái: bình thường (closed)
const unsigned long SERVO_OPEN_MS = 5000; // keep open 5s

// Rain cover servo (Giàn phơi)
#define SERVO_RAIN_PIN 4   // GPIO 4
Servo servoRain;
const int RAIN_COVER_OPEN_US = 544;    // 0 degrees (Reversed)
const int RAIN_COVER_CLOSED_US = 1500; // 90 degrees (Reversed)
bool rainCoverIsOpen = false;

// ===== LEDs (điều khiển đèn) =====
#define LED1_PIN 32    // LED 1 - qua MOSFET A3400 gate
#define LED2_PIN 26    // LED 2
#define LED3_PIN 15    // LED 3
#define LED_AUTO_PIN 2 // LED Auto (Light Sensor control)
bool led1State = false;  // Controlled by TOUCH_PIN (GPIO 25)
bool led2State = false;  // Controlled by SWITCH2_PIN (GPIO 33)
bool led3State = false;  // Controlled by SWITCH3_PIN (VN/39)
bool isAutoMode = true;  // Default to Auto Mode
bool autoLightState = false; // Current state of Auto Light (GPIO 2)

// ===== Time =====
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 7 * 3600, 60000); // GMT+7
// Weather API removed to eliminate blocking HTTPS calls

// ===== Whitelist (4-byte UID) =====
const uint8_t whitelist[][4] = {
  {0xB1, 0xD7, 0x7F, 0x05}
};
const size_t whitelistCount = sizeof(whitelist) / sizeof(whitelist[0]);

// ===== Timers & state =====
unsigned long lastDhtMillis = 0;
const unsigned long DHT_INTERVAL = 2000;
unsigned long lastSensorDisplayMillis = 0;
const unsigned long SENSOR_DISPLAY_INTERVAL = 1000;

unsigned long lastReadMillis = 0;
const unsigned long repeatDelay = 2000; // 2s between accepted RFID reads

// Servo state machine
enum ServoState { SERVO_CLOSED, SERVO_OPENING, SERVO_OPEN, SERVO_CLOSING };
ServoState servoState = SERVO_CLOSED;
unsigned long servoStateMillis = 0;

// Sensor values
float lastTemp = NAN;
float lastHum = NAN;
int gasRaw = 0;
const int GAS_THRESHOLD = 800; // Threshold for gas alarm
int rainState = HIGH;

// Backend connection status
bool backendOnline = true;
unsigned long lastBackendCheck = 0;
const unsigned long BACKEND_CHECK_INTERVAL = 5000; // Check every 5s
int consecutiveFailures = 0;
const int MAX_FAILURES_BEFORE_OFFLINE = 2;

// UI & touch (touch now controls LED1, not screen switching)
int screenMode = 0; // 0=Auto, 1=Screen1, 2=Screen2
bool lastTouch = LOW;
int lightRaw = 0;    // Light sensor reading

// Touch sampling to increase sensitivity (TP223)
const int TOUCH_SAMPLES = 8;
const int TOUCH_THRESHOLD = 2;
const unsigned long TOUCH_SAMPLE_INTERVAL_MS = 6;

// Display State for non-blocking UI
bool showingResult = false;
unsigned long resultStartMillis = 0;
const unsigned long RESULT_DISPLAY_DURATION = 2000;
unsigned long lastButtonPress = 0; // Global debounce timer

// ===== Helpers =====
String hexByte(uint8_t b) {
  String s = String(b, HEX);
  if (s.length() == 1) s = "0" + s;
  s.toUpperCase();
  return s;
}
String uidToString(MFRC522::Uid &uid) {
  String s = "";
  for (byte i = 0; i < uid.size; i++) {
    if (i) s += ":";
    s += hexByte(uid.uidByte[i]);
  }
  return s;
}

// Check card authorization via backend API
bool isWhitelisted(String cardUID) {
  if (WiFi.status() != WL_CONNECTED || deviceMac.length() == 0) {
    Serial.println("⚠️ Cannot check card: WiFi disconnected or MAC not set");
    backendOnline = false;
    return false;
  }

  WiFiClient* clientPtr;
  WiFiClientSecure secureClient;
  WiFiClient localClient;
  
  String urlStr = String(backend_url);
  if (urlStr.startsWith("https")) {
     secureClient.setInsecure();
     clientPtr = &secureClient;
  } else {
     clientPtr = &localClient;
  }

  HTTPClient http;
  String url = urlStr + "/api/rfid-cards/check";
  // http.begin(*clientPtr, url); // For newer ESP32 cores
  http.begin(url); // Auto handles protocol in newer HTTPClient, but let's verify
  
  http.setTimeout(2000); // Reduced timeout to 2s
  http.addHeader("Content-Type", "application/json");
  JsonDocument doc;
  doc["deviceMac"] = deviceMac;
  doc["cardUID"] = cardUID;

  String jsonBody;
  serializeJson(doc, jsonBody);

  int httpCode = http.POST(jsonBody);
  bool authorized = false;

  if (httpCode == 200) {
    JsonDocument response;
    DeserializationError error = deserializeJson(response, http.getString());
    if (!error) {
      authorized = response["authorized"];
      Serial.printf("Card check: %s -> %s\n", cardUID.c_str(), authorized ? "AUTHORIZED" : "DENIED");
      consecutiveFailures = 0;
      backendOnline = true;
    }
  } else {
    Serial.printf("❌ Card check failed: HTTP %d\n", httpCode);
    consecutiveFailures++;
    if (consecutiveFailures >= MAX_FAILURES_BEFORE_OFFLINE) {
      backendOnline = false;
    }
  }

  http.end();
  return authorized;
}

// Send Status via MQTT (Periodic)
void sendMqttStatus() {
  if (!mqttClient.connected()) return;

  JsonDocument doc;
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  
  if (isnan(t)) t = 0;
  if (isnan(h)) h = 0;

  doc["temp"] = t;
  doc["hum"] = h;
  doc["gas"] = analogRead(GAS_PIN);
  doc["rain"] = digitalRead(RAIN_PIN);
  doc["light"] = analogRead(LIGHT_PIN);
  doc["autoMode"] = isAutoMode;      // Chế độ Auto (True/False)
  doc["autoLight"] = autoLightState; // Trạng thái Đèn (On/Off)
  doc["screen"] = screenMode;
  
  // Status logic
  if (servoState == SERVO_CLOSED) doc["door"] = "closed";
  else doc["door"] = "open";

  doc["led1"] = led1State ? "on" : "off";
  doc["led2"] = led2State ? "on" : "off";
  doc["led3"] = led3State ? "on" : "off";

  String payload;
  serializeJson(doc, payload);
  
  String topic = "device/status/" + deviceMac;
  mqttClient.publish(topic.c_str(), payload.c_str());
  // Serial.println("📡 Status Sent: " + payload);
}

// Active Buzzer (Simple HIGH/LOW)
void beep(bool ok) {
  pinMode(BUZZER_PIN, OUTPUT);
  if (ok) {
    digitalWrite(BUZZER_PIN, HIGH); delay(100); digitalWrite(BUZZER_PIN, LOW); delay(50);
    digitalWrite(BUZZER_PIN, HIGH); delay(100); digitalWrite(BUZZER_PIN, LOW);
  } else {
    digitalWrite(BUZZER_PIN, HIGH); delay(500); digitalWrite(BUZZER_PIN, LOW);
  }
}

// Send access log to backend
void sendAccessLog(String cardUID, bool accessGranted) {
  if (WiFi.status() != WL_CONNECTED || deviceMac.length() == 0) {
    Serial.println("⚠️ Cannot send log: WiFi disconnected or MAC not set");
    return;
  }

  HTTPClient http;
  String url = String(backend_url) + "/api/access-logs";
  http.begin(url);
  http.setTimeout(2000); // Reduced timeout to 2s
  http.addHeader("Content-Type", "application/json");
  JsonDocument doc;
  doc["deviceMac"] = deviceMac;
  doc["cardUID"] = cardUID;
  doc["accessGranted"] = accessGranted;
  // Backend will auto-generate timestamp with Date.now()

  String jsonBody;
  serializeJson(doc, jsonBody);

  int httpCode = http.POST(jsonBody);
  if (httpCode > 0) {
    Serial.printf("✅ Access log sent: %d\n", httpCode);
  } else {
    Serial.printf("❌ Access log failed: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();
}

// Function to register device (extracted for retry logic)
void registerDeviceToBackend() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(backend_url) + "/api/devices/register";
  http.begin(url);
  http.setTimeout(2000); // 2 second timeout
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["mac"] = deviceMac;
  doc["ip"] = WiFi.localIP().toString();
  doc["name"] = "ESP32-" + deviceMac.substring(deviceMac.length() - 8);
  doc["firmwareVersion"] = firmwareVersion;

  String jsonBody;
  serializeJson(doc, jsonBody);

  int httpCode = http.POST(jsonBody);
  if (httpCode > 0) {
    Serial.printf("✅ Device registered successfully: %d\n", httpCode);
    deviceRegistered = true;
    backendOnline = true;
  } else {
    Serial.printf("⚠️ Device registration failed: %s (Code: %d)\n", http.errorToString(httpCode).c_str(), httpCode);
    backendOnline = false;
  }
  http.end();
}

// ===== Display functions (Redesigned) =====
int currentScreenId = 0;
unsigned long lastScreenSwitch = 0;
const unsigned long SCREEN_CYCLE_INTERVAL = 10000; // 10 seconds

// TAB 1: General Info (WiFi, IP, Time, Outdoor Weather)
void drawScreen1() {
  display.clearDisplay();
  
  // Header: WiFi & IP
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  if (WiFi.status() == WL_CONNECTED) {
    display.printf("WiFi: %s", ssid);
    display.setCursor(0, 10);
    display.printf("IP: %s", WiFi.localIP().toString().c_str());
  } else {
    display.println("WiFi: Disconnected");
  }

  // Large Time
  display.setTextSize(2);
  String timeStr = timeClient.getFormattedTime();
  // Center time
  int16_t x1, y1; uint16_t w, h;
  display.getTextBounds(timeStr, 0, 0, &x1, &y1, &w, &h);
  display.setCursor((SCREEN_WIDTH - w) / 2, 25);
  display.print(timeStr);

  // Footer: WiFi Status (weather removed)
  display.setTextSize(1);
  display.setCursor(0, 50);
  display.printf("WiFi: %s", WiFi.status() == WL_CONNECTED ? "OK" : "ERR");
  
  // Page indicator (1/2)
  display.drawRect(SCREEN_WIDTH-10, SCREEN_HEIGHT-2, 4, 2, SSD1306_WHITE); // dot 1 active
  display.fillRect(SCREEN_WIDTH-10, SCREEN_HEIGHT-2, 4, 2, SSD1306_WHITE);
  display.drawRect(SCREEN_WIDTH-5, SCREEN_HEIGHT-2, 4, 2, SSD1306_WHITE); // dot 2 empty

  display.display();
}

// TAB 2: Home Status (Indoor Temp/Hum, 4 Lights)
void drawScreen2() {
  display.clearDisplay();

  // Header: Indoor Environment
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("[ INDOOR STATUS ]");

  // DHT Values
  display.setCursor(0, 15);
  if (isnan(lastTemp) || isnan(lastHum)) {
    display.println("Sensor Error!");
  } else {
    display.printf("Temp: %.1fC  Hum: %.0f%%", lastTemp, lastHum);
  }

  // Lights Status Grid
  // L1  L2
  // L3  Auto
  int yBase = 35;
  
  // Light 1
  display.setCursor(0, yBase);
  display.printf("L1:%s", led1State ? "ON" : "OFF");
  
  // Light 2
  display.setCursor(64, yBase);
  display.printf("L2:%s", led2State ? "ON" : "OFF");

  // Light 3
  display.setCursor(0, yBase + 12);
  display.printf("L3:%s", led3State ? "ON" : "OFF");

  // Light Auto
  display.setCursor(64, yBase + 12);
  display.printf("Au:%s", autoLightState ? "ON" : "OFF");

  // Page indicator (2/2)
  display.drawRect(SCREEN_WIDTH-10, SCREEN_HEIGHT-2, 4, 2, SSD1306_WHITE); // dot 1 empty
  display.fillRect(SCREEN_WIDTH-5, SCREEN_HEIGHT-2, 4, 2, SSD1306_WHITE);  // dot 2 active

  display.display();
}

// Main Display Manager
void showMainScreen() {
  if (screenMode == 0) { // Auto Cycling
    unsigned long now = millis();
    if (now - lastScreenSwitch > SCREEN_CYCLE_INTERVAL) {
      currentScreenId = (currentScreenId + 1) % 2;
      lastScreenSwitch = now;
    }
    if (currentScreenId == 0) drawScreen1();
    else drawScreen2();
  } else if (screenMode == 1) { // Fixed Screen 1
    drawScreen1();
  } else if (screenMode == 2) { // Fixed Screen 2
    drawScreen2();
  }
}

void showDHTScreen() { /* kept for compatibility but effectively unused */ }
void showRainGasScreen() { /* kept for compatibility */ }

void showUidScreen(const String &uidStr, bool ok) {
  // Override cycling to show RFID result for 3 seconds
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("RFID SCAN RESULT");
  display.setTextSize(2);
  display.setCursor(0, 20);
  display.println(uidStr);
  display.setTextSize(1);
  display.setCursor(0, 50);
  display.println(ok ? "ACCESS GRANTED" : "ACCESS DENIED");
  display.display();
  
  // Non-blocking timer
  showingResult = true;
  resultStartMillis = millis();
}

// ===== MQTT Callback =====
// MQTT functions moved below servoTransition to fix scope error
// Weather API removed - was causing 2-5s blocking on HTTPS calls

// ===== Touch increased sensitivity (sampling) =====
bool sampleTouchHigh() {
  int countHigh = 0;
  for (int i = 0; i < TOUCH_SAMPLES; ++i) {
    if (digitalRead(TOUCH_PIN) == HIGH) countHigh++;
    delay(TOUCH_SAMPLE_INTERVAL_MS / TOUCH_SAMPLES);
  }
  return (countHigh >= TOUCH_THRESHOLD);
}

// ===== Servo state machine helpers =====
void servoSetOpen() {
  if (!servoRight.attached()) servoRight.attach(SERVO_RIGHT_PIN);
  if (!servoLeft.attached()) servoLeft.attach(SERVO_LEFT_PIN);
  servoRight.writeMicroseconds(SERVO_RIGHT_OPEN_US);  // Cửa phải
  servoLeft.writeMicroseconds(SERVO_LEFT_OPEN_US);    // Cửa trái
  Serial.printf("🚪 Gate OPEN: Right=%dus, Left=%dus\n", SERVO_RIGHT_OPEN_US, SERVO_LEFT_OPEN_US);
}
void servoSetClose() {
  if (!servoRight.attached()) servoRight.attach(SERVO_RIGHT_PIN);
  if (!servoLeft.attached()) servoLeft.attach(SERVO_LEFT_PIN);
  servoRight.writeMicroseconds(SERVO_RIGHT_CLOSED_US);  // Cửa phải
  servoLeft.writeMicroseconds(SERVO_LEFT_CLOSED_US);    // Cửa trái
  Serial.printf("🚪 Gate CLOSE: Right=%dus, Left=%dus\n", SERVO_RIGHT_CLOSED_US, SERVO_LEFT_CLOSED_US);
}

// Rain cover servo control
void rainCoverOpen() {
  if (!servoRain.attached()) servoRain.attach(SERVO_RAIN_PIN);
  servoRain.writeMicroseconds(RAIN_COVER_OPEN_US);
  rainCoverIsOpen = true;
  Serial.println("☂️ Rain cover opened (90°)");
}
void rainCoverClose() {
  if (!servoRain.attached()) servoRain.attach(SERVO_RAIN_PIN);
  servoRain.writeMicroseconds(RAIN_COVER_CLOSED_US);
  rainCoverIsOpen = false;
  Serial.println("☂️ Rain cover closed (0°)");
}

// transition handler (non-blocking state machine uses servoState & servoStateMillis)
void servoTransition(ServoState newState) {
  if (servoState == newState) return;
  servoState = newState;
  servoStateMillis = millis();
  sendMqttStatus(); // Immediate report
  switch (servoState) {
    case SERVO_OPENING:
      servoSetOpen();
      break;
    case SERVO_OPEN:
      // holding; timer managed in loop
      break;
    case SERVO_CLOSING:
      servoSetClose();
      break;
    case SERVO_CLOSED:
      // detach to reduce jitter and idle current
      if (servoRight.attached()) servoRight.detach();
      if (servoLeft.attached()) servoLeft.detach();
      break;
  }
}

// ===== MQTT Callback (Moved here) =====
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("📡 MQTT Msg ["); Serial.print(topic); Serial.print("] ");
  
  String msg = "";
  for (unsigned int i = 0; i < length; i++) {
    msg += (char)payload[i];
  }
  Serial.println(msg);

  JsonDocument doc; // Fixed: Use JsonDocument instead of StaticJsonDocument
  DeserializationError error = deserializeJson(doc, msg);

  if (error) {
    Serial.print("❌ MQTT JSON Error: ");
    Serial.println(error.c_str());
    return;
  }

  String device = doc["device"];
  String action = doc["action"];

  if (device == "buzzer") {
    // Handle Beep
    if (action == "beep" || action == "alert") beep(false);
  } 
  
  // LED / LIGHT / RELAY
  else if (device == "door") {
    if (action == "open") {
      if (!servoRight.attached()) servoRight.attach(SERVO_RIGHT_PIN);
      if (!servoLeft.attached()) servoLeft.attach(SERVO_LEFT_PIN);
      delay(40);
      servoTransition(SERVO_OPENING);
      sendAccessLog("DOOR_OPEN_REMOTE", true);
    } else if (action == "close") {
      servoTransition(SERVO_CLOSING);
    }
  } 
  
  else if (device == "relay" || device == "light") {
      int channel = doc["channel"];
      // If channel is missing, maybe it's in value? or default to 1?
      // Check if "value" is present for dimming? No, just on/off
      String valStr = doc["value"];
      bool valBool = doc["value"];
      bool newState = (action == "on" || action == "true" || valStr == "on" || valBool == true);
      
      int pin = -1;
      if(channel == 1) { led1State = newState; pin = LED1_PIN; }
      else if(channel == 2) { led2State = newState; pin = LED2_PIN; }
      else if(channel == 3) { led3State = newState; pin = LED3_PIN; }
      
      if(pin != -1) {
          digitalWrite(pin, newState ? HIGH : LOW);
          Serial.printf("💡 Light Ch%d: %s\n", channel, newState ? "ON" : "OFF");
      }
  } 
  
  else if (device == "auto_light") {
      // Flexible logic
      String act = doc["action"];
      String val = doc["value"];
      
      // Case 1: Standard Toggle (from simplified UI)
      if (act == "on" || act == "true") {
          isAutoMode = true; // Enable Auto Mode
      } else if (act == "off" || act == "false") {
          isAutoMode = false; // Disable Auto Mode (Manual)
      } 
      // Case 2: Explicit Mode Set
      else if (act == "set_mode") {
          isAutoMode = (val == "auto");
      }
      // Case 3: Manual Control (Turn light on/off when in Manual)
      else if (act == "turn" || act == "manual") {
          // If Manual, allow control
          if (!isAutoMode) {
             bool state = (val == "on" || val == "true");
             autoLightState = state;
             digitalWrite(LED_AUTO_PIN, autoLightState ? HIGH : LOW);
          }
      }
      Serial.printf("🤖 AutoMode: %s, Light: %s\n", isAutoMode?"ON":"OFF", autoLightState?"ON":"OFF");
  } 
  
  else if (device == "screen" || device == "display") {
      int val = doc["value"] | 0;
      if (val >= 0 && val <= 2) {
        screenMode = val;
      }
  }
  
  sendMqttStatus(); // Immediate report
}

// ===== MQTT Reconnect (Moved here) =====
void reconnectMQTT() {
  if (mqttClient.connected()) return;
  
  Serial.print("📡 Connecting to MQTT...");
  String clientId = "ESP32Client-";
  clientId += String(random(0xffff), HEX);
  
  // Attempt to connect
  if (mqttClient.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
    Serial.println("connected");
    // Subscribe to ONE topic with wildcard for this device
    String subTopic = "cmd/" + deviceMac;
    mqttClient.subscribe(subTopic.c_str());
    Serial.println("Subscribed to: " + subTopic);
    
    // Send Online Status immediately
  }
}

// ===== Setup (boot progress like original) =====
void drawProgress(int percent, const String &text = "") {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Booting system...");
  display.drawRect(10, 25, 108, 10, SSD1306_WHITE);
  display.fillRect(10, 25, percent * 108 / 100, 10, SSD1306_WHITE);
  display.setCursor(10, 40);
  display.printf("%3d%% %s", percent, text.c_str());
  display.display();
}

#include <Update.h>
#include "web_handlers.h"

void setup() {
  Serial.begin(115200);

  pinMode(RAIN_PIN, INPUT);
  pinMode(TOUCH_PIN, INPUT);           // TTP223 Touch: Active HIGH (GPIO 25)
  pinMode(SWITCH2_PIN, INPUT_PULLUP);  // Mechanical Switch: Active LOW (GPIO 33)
  pinMode(SWITCH3_PIN, INPUT);         // TTP223 Touch: Active HIGH (GPIO 39/VN) - No Resistor needed
  pinMode(SWITCH3_PIN, INPUT);         // TTP223 Touch: Active HIGH (GPIO 39/VN) - No Resistor needed
  pinMode(BUZZER_PIN, OUTPUT);         // Critical Fix: Must be OUTPUT
  digitalWrite(BUZZER_PIN, LOW);       // Ensure buzzer off at boot
  pinMode(BOOT_PIN, INPUT_PULLUP);     // Init Boot button
  
  // Init LED pins (3 LEDs total)
  pinMode(LED1_PIN, OUTPUT);
  digitalWrite(LED1_PIN, LOW);  // CRITICAL: Set LOW immediately for MOSFET safety
  pinMode(LED2_PIN, OUTPUT);
  digitalWrite(LED2_PIN, LOW);
  pinMode(LED3_PIN, OUTPUT);
  digitalWrite(LED3_PIN, LOW);
  pinMode(LED_AUTO_PIN, OUTPUT);
  digitalWrite(LED_AUTO_PIN, LOW);
  
  led1State = false;
  led2State = false;
  led3State = false;

  // OLED with fast I2C
  Wire.begin(OLED_SDA, OLED_SCL);
  Wire.setClock(400000); // 400kHz Fast Mode - reduces display lag
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("❌ OLED not found!");
    while (true);
  }
  display.clearDisplay();
  display.display();

  // Boot UI
  drawProgress(0, "Booting...");
  delay(200);

  // Get MAC address as unique device identifier
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  deviceMac = "";
  for (int i = 0; i < 6; i++) {
    if (i > 0) deviceMac += ":";
    if (mac[i] < 0x10) deviceMac += "0"; // Add leading zero for single-digit hex
    deviceMac += String(mac[i], HEX);
  }
  deviceMac.toUpperCase();
  Serial.printf("📱 Device MAC: %s\n", deviceMac.c_str());
  Serial.printf("ℹ️ Firmware Version: %s\n", firmwareVersion);

  drawProgress(10, "Init modules");
  delay(300);
  // init sensors
  dht.begin();
  
  // Load backend URL from preferences
  preferences.begin("smarthome", false);
  String savedUrl = preferences.getString("backend_url", "");
  if (savedUrl.length() > 0) {
    savedUrl.toCharArray(backend_url, 128);
    Serial.println("Loaded Backend URL: " + savedUrl);
  }
  
  // WiFiManager Setup
  WiFiManager wm;
  wm.setSaveConfigCallback(saveConfigCallback);
  
  // Custom param for backend URL
  WiFiManagerParameter custom_backend_url("backend", "Backend URL", backend_url, 128);
  wm.addParameter(&custom_backend_url);
  
  drawProgress(20, "Connect WiFi...");
  
  // AutoConnect (starts AP if fail)
  if (!wm.autoConnect("SmartHome-Setup")) {
     Serial.println("failed to connect and hit timeout");
     delay(1000);
     ESP.restart();
  }

  // Save updated config if changed
  if (shouldSaveConfig) {
      strcpy(backend_url, custom_backend_url.getValue());
      preferences.putString("backend_url", backend_url);
      Serial.println("Saved Backend URL: " + String(backend_url));
  }
  preferences.end();

  if (WiFi.status() == WL_CONNECTED) {
    drawProgress(50, "WiFi OK");
    Serial.println("✅ WiFi connected! " + WiFi.localIP().toString());
  } else {
    drawProgress(50, "WiFi FAIL");
  }
  delay(400);

  // Weather removed - was causing lag

  // Auto-register device with backend
  if (WiFi.status() == WL_CONNECTED) {
    drawProgress(90, "Registering...");
    registerDeviceToBackend();
    
    // MQTT Init
  espClient.setInsecure(); // Skip certificate validation
  mqttClient.setServer(mqtt_server, mqtt_port);
  mqttClient.setCallback(mqttCallback);
    reconnectMQTT();
    
    if (!deviceRegistered) {
      Serial.println("⚠️ Initial registration failed, will retry in loop");
    }
  }

  drawProgress(100, "Done");
  display.clearDisplay();
  display.setCursor(25, 25);
  display.setTextSize(2);
  display.println("READY!");
  display.display();
  delay(700);

  // RFID init
  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);
  mfrc.PCD_Init();
  Serial.println("✅ MFRC522 ready.");

  // Servo: do NOT attach at setup (avoid brownout)
  servoState = SERVO_CLOSED;

  // show main
  showMainScreen();
  lastDhtMillis = 0;
  lastSensorDisplayMillis = 0;
  // lastWeatherUpdate removed with weather code


  // Web Server
  server.on("/scan", HTTP_GET, handleScan);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/control", HTTP_POST, handleControl);

  // OTA Updates
  server.on("/update", HTTP_GET, handleOTA);
  server.on("/update", HTTP_POST, []() {
    server.send(200, "text/plain", (Update.hasError()) ? "FAIL" : "OK");
    delay(1000);
    ESP.restart();
  }, handleOTAUpload);
  
  // CORS preflight handler for OPTIONS requests
  server.onNotFound([](){
    if (server.method() == HTTP_OPTIONS) {
      setCORS();
      server.send(200, "text/plain", "");
    } else {
      server.send(404, "application/json", "{\"error\":\"Not found\"}");
    }
  });
  
  server.begin();
  Serial.println("✅ HTTP server started");
}

// ===== Loop =====
void loop() {
  server.handleClient();
  unsigned long now = millis();

  // MQTT Loop - CRITICAL for receiving commands
  if (WiFi.status() == WL_CONNECTED) {
      if (!mqttClient.connected()) {
          static unsigned long lastMqttRetry = 0;
          if (millis() - lastMqttRetry > 5000) {
              lastMqttRetry = millis();
              reconnectMQTT();
          }
      } else {
          mqttClient.loop();
          if (now - lastMqttPublish > 2000) { // Update every 2s
            lastMqttPublish = now;
            sendMqttStatus();
          }
      }
  }

  // update NTP (non-blocking with interval check)
  static unsigned long lastNtpUpdate = 0;
  if (now - lastNtpUpdate >= 60000) { // Update every 60 seconds
    timeClient.update();
    lastNtpUpdate = now;
  }

  // Retry registration if not yet registered (every 15 seconds)
  static unsigned long lastRegRetry = 0;
  if (!deviceRegistered && WiFi.status() == WL_CONNECTED && (now - lastRegRetry > 15000)) {
    Serial.println("🔄 Retrying device registration...");
    registerDeviceToBackend();
    lastRegRetry = now;
  }

  // Weather API removed
  // if (WiFi.status() == WL_CONNECTED && (now - lastWeatherUpdate > weatherUpdateInterval)) {
  //   getWeather();
  // }

  // read sensors periodically
  if (now - lastDhtMillis >= DHT_INTERVAL) {
    lastDhtMillis = now;
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t) && !isnan(h)) { lastTemp = t; lastHum = h; }
    gasRaw = analogRead(GAS_PIN);      // GPIO34 (analog)
    lightRaw = analogRead(LIGHT_PIN);  // GPIO33 (analog)
    
    // Rain detection
    int newRainState = digitalRead(RAIN_PIN);  // GPIO17
    if (newRainState != rainState) {
      rainState = newRainState;
      if (rainState == LOW) rainCoverOpen();
      else rainCoverClose();
    }
    
    // Auto Light Control for LED_AUTO_PIN (GPIO 2)
    // Logic INVERTED: High analog > 3000 = Dark -> ON, Low < 1500 = Bright -> OFF
    if (isAutoMode) {
      if (lightRaw > 3000) {
        autoLightState = true;
      } else if (lightRaw < 1500) {
        autoLightState = false;
      }
      digitalWrite(LED_AUTO_PIN, autoLightState ? HIGH : LOW);
    } else {
      // Manual Mode: autoLightState is set via API
      digitalWrite(LED_AUTO_PIN, autoLightState ? HIGH : LOW);
    }
  }

  // ===== Factory Reset Check (Hold BOOT > 5s) =====
  static unsigned long bootPressStart = 0;
  if (digitalRead(BOOT_PIN) == LOW) {
    if (bootPressStart == 0) bootPressStart = millis();
    if (millis() - bootPressStart > 5000) {
      // Factory Reset
      Serial.println("⚠️ Factory Reset Initiated!");
      display.clearDisplay();
      display.setCursor(10, 20);
      display.println("RESETTING...");
      display.display();
      beep(false); // Long beep
      
      WiFiManager wm;
      wm.resetSettings();
      
      preferences.begin("smarthome", false);
      preferences.clear();
      preferences.end();
      
      delay(1000);
      ESP.restart();
    }
  } else {
    bootPressStart = 0;
  }
    // Gas Alarm Logic
    if (gasRaw > GAS_THRESHOLD) {
      static unsigned long lastGasBeep = 0;
      if (now - lastGasBeep > 500) { // Beep every 0.5 second
        lastGasBeep = now;
        Serial.printf("⚠️ GAS ALERT! Level: %d\n", gasRaw);
        beep(false); // Alert beep (300ms)
      }
    }
    
  // handle switches for LED toggles
  
  // SW1: TOUCH_PIN (GPIO 25) -> Now controls LED3 (Swap)
  bool touchNow = digitalRead(TOUCH_PIN) == HIGH;
  if (touchNow && !lastTouch && (now - lastButtonPress > 200)) {
    led3State = !led3State;
    digitalWrite(LED3_PIN, led3State ? HIGH : LOW);
    Serial.printf("💡 LED3 toggled via Touch(25): %s\n", led3State ? "ON" : "OFF");
    lastButtonPress = now;
  }
  lastTouch = touchNow;

  // SW2: SWITCH2_PIN (GPIO 33) -> Now controls LED2 (GPIO 26)
  static bool lastSw2 = HIGH;
  bool sw2Now = digitalRead(SWITCH2_PIN); 
  if (sw2Now == LOW && lastSw2 == HIGH && (now - lastButtonPress > 200)) { // Falling edge
    led2State = !led2State;
    digitalWrite(LED2_PIN, led2State ? HIGH : LOW);
    Serial.printf("💡 LED2 toggled via Switch(33): %s\n", led2State ? "ON" : "OFF");
    lastButtonPress = now;
  }
  lastSw2 = sw2Now;

  // SW3: SWITCH3_PIN (VN/GPIO 39) -> Controls LED1 (GPIO 32)
  static bool lastSw3 = LOW;
  bool sw3Now = digitalRead(SWITCH3_PIN) == HIGH; // TTP223 Active HIGH
  if (sw3Now && !lastSw3 && (now - lastButtonPress > 200)) { // Rising edge
    led1State = !led1State;
    digitalWrite(LED1_PIN, led1State ? HIGH : LOW);
    Serial.printf("💡 LED1 toggled via Switch(VN/39): %s\n", led1State ? "ON" : "OFF");
    lastButtonPress = now;
  }
  lastSw3 = sw3Now;

  // Update display (cycling logic) - Handle Result Screen priority
  if (showingResult) {
    if (now - resultStartMillis > RESULT_DISPLAY_DURATION) {
      showingResult = false;
      showMainScreen(); // Return to standard screens
    }
  } else {
    if (now - lastSensorDisplayMillis >= SENSOR_DISPLAY_INTERVAL) {
      lastSensorDisplayMillis = now;
      showMainScreen();
    }
  }


  // Servo state machine: OPENING -> OPEN -> auto-close only after SERVO_OPEN_MS from last valid access
  if (servoState == SERVO_OPENING) {
    // opening, immediately enter OPEN and set timer
    servoState = SERVO_OPEN;
    servoStateMillis = now;
  } else if (servoState == SERVO_OPEN) {
    // if time since last scan (servoStateMillis updated on each valid scan) exceeds open ms -> close
    if (now - servoStateMillis >= SERVO_OPEN_MS) {
      servoTransition(SERVO_CLOSING);
      // Log auto-close event
      sendAccessLog("DOOR_AUTO_CLOSE", true);
      // set closing start time to now to measure motion
      servoStateMillis = now;
    }
  } else if (servoState == SERVO_CLOSING) {
    // after physical move time -> CLOSED
    if (now - servoStateMillis >= 700) {
      servoTransition(SERVO_CLOSED);
    }
  }

  // RFID reading: control servo; accepted scans must be >= repeatDelay apart
  if (mfrc.PICC_IsNewCardPresent() && mfrc.PICC_ReadCardSerial()) {
    // always consume card, but only accept if enough time passed from last accepted read
    unsigned long between = now - lastReadMillis;
    String uidStr = uidToString(mfrc.uid);
    bool ok = isWhitelisted(uidStr);


    if (between >= repeatDelay && ok) {
      // accepted valid access
      lastReadMillis = now;
      Serial.printf("Card UID: %s -> ALLOWED\n", uidStr.c_str());
      showUidScreen(uidStr, true);
      beep(true);
      sendAccessLog(uidStr, true); // Log to backend

      // If already open or opening, reset timer to extend open period
      if (servoState == SERVO_OPEN || servoState == SERVO_OPENING) {
        // reset timer to extend
        servoStateMillis = now;
      } else {
        // not open: attach & open
        if (!servoRight.attached()) servoRight.attach(SERVO_RIGHT_PIN);
        if (!servoLeft.attached()) servoLeft.attach(SERVO_LEFT_PIN);
        delay(40); // allow servo to attach/stabilize
        servoTransition(SERVO_OPENING);
        // Log door open after RFID access
        sendAccessLog("DOOR_OPEN (RFID)", true);
      }
    } else {
      // either denied or too-frequent
      if (!ok) {
        Serial.printf("Card UID: %s -> DENIED\n", uidStr.c_str());
        showUidScreen(uidStr, false);
        beep(false);
        sendAccessLog(uidStr, false); // Log denied access
      } else {
        // too-frequent attempt — ignore but can show briefly
        Serial.printf("Card UID: %s -> IGNORED (repeat too fast)\n", uidStr.c_str());
      }
    }

    // Important cleanup for MFRC522
    mfrc.PICC_HaltA();
    mfrc.PCD_StopCrypto1();
    delay(30); // tiny non-blocking pause
  }

  delay(10); // keep loop responsive
}