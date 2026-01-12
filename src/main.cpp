/* Home IoT - Firmware with WiFi Provisioning & MQTT Remote Control
   - WiFiManager for SoftAP configuration (SSID: SmartHome-Setup)
   - MQTT for Remote Command handling (Topic: cmd/DEVICE_MAC)
   - Sensors: DHT22, Rain, MQ2, Light, Touch
   - Actuators: Servos, Lights, Buzzer, OLED
   - Logic: RFID, Web Server, Auto Light, Rain Cover
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
#include <WiFiManager.h> // WiFi Configuration Portal
#include <PubSubClient.h> // MQTT Client

WebServer server(80);
WiFiClient espClient;
PubSubClient mqttClient(espClient);

#include <Adafruit_SSD1306.h>
#include <Adafruit_GFX.h>
#include "DHT.h"
#include <MFRC522.h>
#include <ESP32Servo.h>

// ===== CONFIGURATION =====
char backendIP[40] = "192.168.100.23"; // Default Backend IP, configurable via WiFiManager
char backendPort[6] = "5000";          // Default Backend HTTP Port

// Backend URLs constructed dynamically
String apiBaseURL; 
String mqttServer;
const int mqttPort = 1883;

String deviceMac = ""; // Set from ESP32 MAC
const char* firmwareVersion = "2.0.1 complete_refactor"; 
bool deviceRegistered = false; 

// ===== OLED =====
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define OLED_SDA 23
#define OLED_SCL 22
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ===== DHT22 =====
#define DHTPIN 27 
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// ===== Sensors / pins =====
#define RAIN_PIN 17       
#define LIGHT_PIN 34      
#define GAS_PIN 35        
#define TOUCH_PIN 25      
#define SWITCH2_PIN 33    
#define SWITCH3_PIN 39    
#define BUZZER_PIN 12

// ===== RFID =====
#define RST_PIN 21
#define SS_PIN 5
#define SCK_PIN 18
#define MISO_PIN 19
#define MOSI_PIN 13
MFRC522 mfrc(SS_PIN, RST_PIN);

// ===== Servo =====
#define SERVO_RIGHT_PIN 16  
#define SERVO_LEFT_PIN 14   
Servo servoRight;
Servo servoLeft;
const int SERVO_RIGHT_OPEN_US = 1800;   
const int SERVO_RIGHT_CLOSED_US = 1000; 
const int SERVO_LEFT_OPEN_US = 1000;    
const int SERVO_LEFT_CLOSED_US = 1800;  
const unsigned long SERVO_OPEN_MS = 5000; 

#define SERVO_RAIN_PIN 4   
Servo servoRain;
const int RAIN_COVER_OPEN_US = 544;    
const int RAIN_COVER_CLOSED_US = 1500; 
bool rainCoverIsOpen = false;

// ===== LEDs =====
#define LED1_PIN 32    
#define LED2_PIN 26    
#define LED3_PIN 15    
#define LED_AUTO_PIN 2 
bool led1State = false;  
bool led2State = false;  
bool led3State = false;  
bool isAutoMode = true;  
bool autoLightState = false; 

// ===== Time & Weather =====
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 7 * 3600, 60000); 
String city = "Hanoi";
String weatherMain = "--";
String temperature = "--";
String weatherHumidity = "--"; 
String weatherIcon = "";
unsigned long lastWeatherUpdate = 0;
const unsigned long weatherUpdateInterval = 10 * 60 * 1000; 

// ===== State Variables =====
unsigned long lastDhtMillis = 0;
const unsigned long DHT_INTERVAL = 2000;
unsigned long lastSensorDisplayMillis = 0;
const unsigned long SENSOR_DISPLAY_INTERVAL = 1000;
unsigned long lastReadMillis = 0;
const unsigned long repeatDelay = 2000; 

enum ServoState { SERVO_CLOSED, SERVO_OPENING, SERVO_OPEN, SERVO_CLOSING };
ServoState servoState = SERVO_CLOSED;
unsigned long servoStateMillis = 0;

float lastTemp = NAN;
float lastHum = NAN;
int gasRaw = 0;
const int GAS_THRESHOLD = 800; 
int rainState = HIGH;

bool backendOnline = true;
int consecutiveFailures = 0;
const int MAX_FAILURES_BEFORE_OFFLINE = 2;

int screenMode = 0; 
bool lastTouch = LOW;
int lightRaw = 0; 

// Touch sampling
const int TOUCH_SAMPLES = 8;
const int TOUCH_THRESHOLD = 2;
const unsigned long TOUCH_SAMPLE_INTERVAL_MS = 6;

// ===== Helper Functions Declarations =====
String hexByte(uint8_t b);
void beep(bool ok);
void registerDeviceToBackend();
void sendAccessLog(String cardUID, bool accessGranted);
bool isWhitelisted(String cardUID);

// ===== Helper Functions =====
String hexByte(uint8_t b) {
  String s = String(b, HEX);
  if (s.length() == 1) s = "0" + s;
  s.toUpperCase();
  return s;
}

void beep(bool ok) {
  pinMode(BUZZER_PIN, OUTPUT);
  if (ok) {
    digitalWrite(BUZZER_PIN, HIGH); delay(80); digitalWrite(BUZZER_PIN, LOW); delay(80);
    digitalWrite(BUZZER_PIN, HIGH); delay(80); digitalWrite(BUZZER_PIN, LOW);
  } else {
    digitalWrite(BUZZER_PIN, HIGH); delay(300); digitalWrite(BUZZER_PIN, LOW);
  }
  pinMode(BUZZER_PIN, INPUT);
}

// Function to register device (extracted for retry logic)
void registerDeviceToBackend() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = apiBaseURL + "/api/devices/register";
  http.begin(url);
  http.setTimeout(5000); // 5 second timeout
  http.addHeader("Content-Type", "application/json");

  JsonDocument doc;
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

// Check card authorization via backend API
bool isWhitelisted(String cardUID) {
  if (WiFi.status() != WL_CONNECTED || deviceMac.length() == 0) {
    Serial.println("⚠️ Cannot check card: WiFi disconnected or MAC not set");
    backendOnline = false;
    return false;
  }

  HTTPClient http;
  String url = apiBaseURL + "/api/rfid-cards/check";
  http.begin(url);
  http.setTimeout(3000); 
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

// Send access log to backend
void sendAccessLog(String cardUID, bool accessGranted) {
  if (WiFi.status() != WL_CONNECTED || deviceMac.length() == 0) {
    Serial.println("⚠️ Cannot send log: WiFi disconnected or MAC not set");
    return;
  }

  HTTPClient http;
  String url = apiBaseURL + "/api/access-logs";
  http.begin(url);
  http.setTimeout(3000); 
  http.addHeader("Content-Type", "application/json");

  JsonDocument doc;
  doc["deviceMac"] = deviceMac;
  doc["cardUID"] = cardUID;
  doc["accessGranted"] = accessGranted;

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

// ===== Servo Logic =====
void servoSetOpen() {
  if (!servoRight.attached()) servoRight.attach(SERVO_RIGHT_PIN);
  if (!servoLeft.attached()) servoLeft.attach(SERVO_LEFT_PIN);
  servoRight.writeMicroseconds(SERVO_RIGHT_OPEN_US);  
  servoLeft.writeMicroseconds(SERVO_LEFT_OPEN_US);    
  Serial.printf("🚪 Gate OPEN\n");
}
void servoSetClose() {
  if (!servoRight.attached()) servoRight.attach(SERVO_RIGHT_PIN);
  if (!servoLeft.attached()) servoLeft.attach(SERVO_LEFT_PIN);
  servoRight.writeMicroseconds(SERVO_RIGHT_CLOSED_US);  
  servoLeft.writeMicroseconds(SERVO_LEFT_CLOSED_US);    
  Serial.printf("🚪 Gate CLOSE\n");
}

void rainCoverOpen() {
  if (!servoRain.attached()) servoRain.attach(SERVO_RAIN_PIN);
  servoRain.writeMicroseconds(RAIN_COVER_OPEN_US);
  rainCoverIsOpen = true;
  Serial.println("☂️ Rain cover opened");
}
void rainCoverClose() {
  if (!servoRain.attached()) servoRain.attach(SERVO_RAIN_PIN);
  servoRain.writeMicroseconds(RAIN_COVER_CLOSED_US);
  rainCoverIsOpen = false;
  Serial.println("☂️ Rain cover closed");
}

void servoTransition(ServoState newState) {
  if (servoState == newState) return;
  servoState = newState;
  servoStateMillis = millis();
  switch (servoState) {
    case SERVO_OPENING: servoSetOpen(); break;
    case SERVO_CLOSING: servoSetClose(); break;
    case SERVO_CLOSED:
      if (servoRight.attached()) servoRight.detach();
      if (servoLeft.attached()) servoLeft.detach();
      break;
    default: break;
  }
}

// ===== Display Logic =====
int currentScreenId = 0;
unsigned long lastScreenSwitch = 0;

void drawScreen1() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  if (WiFi.status() == WL_CONNECTED) {
    display.printf("WiFi: %s", WiFi.SSID().c_str());
    display.setCursor(0, 10);
    display.printf("IP: %s", WiFi.localIP().toString().c_str());
  } else {
    display.println("WiFi: Disconnected");
  }

  display.setTextSize(2);
  String timeStr = timeClient.getFormattedTime();
  int16_t x1, y1; uint16_t w, h;
  display.getTextBounds(timeStr, 0, 0, &x1, &y1, &w, &h);
  display.setCursor((SCREEN_WIDTH - w) / 2, 25);
  display.print(timeStr);

  display.setTextSize(1);
  display.setCursor(0, 50);
  display.printf("Out: %s %sC | %s%%", weatherIcon.c_str(), temperature.c_str(), weatherHumidity.c_str());
  
  display.display();
}

void drawScreen2() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("[ INDOOR STATUS ]");

  display.setCursor(0, 15);
  if (isnan(lastTemp) || isnan(lastHum)) {
    display.println("Sensor Error!");
  } else {
    display.printf("Temp: %.1fC  Hum: %.0f%%", lastTemp, lastHum);
  }

  int yBase = 35;
  display.setCursor(0, yBase); display.printf("L1:%s", led1State ? "ON" : "OFF");
  display.setCursor(64, yBase); display.printf("L2:%s", led2State ? "ON" : "OFF");
  display.setCursor(0, yBase + 12); display.printf("L3:%s", led3State ? "ON" : "OFF");
  display.setCursor(64, yBase + 12); display.printf("Au:%s", autoLightState ? "ON" : "OFF");

  display.display();
}

void showMainScreen() {
  if (screenMode == 0) { 
    unsigned long now = millis();
    if (now - lastScreenSwitch > 10000) {
      currentScreenId = (currentScreenId + 1) % 2;
      lastScreenSwitch = now;
    }
    if (currentScreenId == 0) drawScreen1(); else drawScreen2();
  } else if (screenMode == 1) drawScreen1();
  else if (screenMode == 2) drawScreen2();
}

void showUidScreen(const String &uidStr, bool ok) {
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
  delay(2000); 
  lastScreenSwitch = millis(); 
}

// ===== Weather fetch (wttr.in) =====
void getWeather() {
  if (WiFi.status() != WL_CONNECTED) return;
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url = "https://wttr.in/" + city + "?format=j1";
  http.setTimeout(5000);
  if (http.begin(client, url)) {
    int httpCode = http.GET();
    if (httpCode == 200) {
      String payload = http.getString();
      JsonDocument doc;
      DeserializationError error = deserializeJson(doc, payload);
      if (!error) {
        JsonObject current = doc["current_condition"][0].as<JsonObject>();
        temperature = String((const char*) current["temp_C"]);
        weatherHumidity = String((const char*) current["humidity"]); 
        weatherMain = String((const char*) current["weatherDesc"][0]["value"]);
        String wm = weatherMain; wm.toLowerCase();
        if (wm.indexOf("rain") >= 0) weatherIcon = "R";
        else if (wm.indexOf("thunder") >= 0) weatherIcon = "T";
        else if (wm.indexOf("cloud") >= 0) weatherIcon = "C";
        else if (wm.indexOf("sun") >= 0 || wm.indexOf("clear") >= 0) weatherIcon = "S";
        else weatherIcon = "-";
      }
    }
    http.end();
  }
  lastWeatherUpdate = millis();
}

// ===== MQTT Logic =====
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (int i = 0; i < length; i++) message += (char)payload[i];
  Serial.printf("📥 MQTT Message [%s]: %s\n", topic, message.c_str());

  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, message);
  if (error) {
    Serial.println("❌ JSON parse failed");
    return;
  }

  String device = doc["device"];
  String action = doc["action"];

  // Handle Commands
  if (device == "door") {
    if (action == "open") {
      servoTransition(SERVO_OPENING);
      beep(true);
    } else if (action == "close") {
      servoTransition(SERVO_CLOSING);
    }
  } 
  else if (device == "relay") {
    int ch = doc["channel"];
    String val = doc["action"]; 
    bool state = (val == "on");
    if (ch == 1) { led1State = state; digitalWrite(LED1_PIN, state ? HIGH : LOW); }
    else if (ch == 2) { led2State = state; digitalWrite(LED2_PIN, state ? HIGH : LOW); }
    else if (ch == 3) { led3State = state; digitalWrite(LED3_PIN, state ? HIGH : LOW); }
  }
  else if (device == "buzzer") {
    if (action == "beep") beep(true);
    else if (action == "alert") beep(false);
  }
  else if (device == "screen") {
    screenMode = doc["value"];
    showMainScreen();
  }
  else if (device == "auto_light") {
     String mode = doc["value"]; // auto, manual
     if (action == "set_mode") {
        isAutoMode = (mode == "auto");
     }
  }
}

void reconnectMQTT() {
  if (WiFi.status() == WL_CONNECTED && !mqttClient.connected()) {
    Serial.print("Attempting MQTT connection...");
    String clientId = "ESP32Client-" + deviceMac;
    
    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("connected");
      String topic = "cmd/" + deviceMac;
      mqttClient.subscribe(topic.c_str());
      String statusTopic = "device/status/" + deviceMac;
      mqttClient.publish(statusTopic.c_str(), "online");
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" try again in 5 seconds");
    }
  }
}

// ===== HTTP Handlers (Included AFTER helper definitions) =====
#include "web_handlers.h" 

// ===== Setup & Loop =====
void setup() {
  Serial.begin(115200);

  // Pin Modes
  pinMode(RAIN_PIN, INPUT);
  pinMode(TOUCH_PIN, INPUT);           
  pinMode(SWITCH2_PIN, INPUT_PULLUP);  
  pinMode(SWITCH3_PIN, INPUT);        
  pinMode(BUZZER_PIN, INPUT);
  
  pinMode(LED1_PIN, OUTPUT); digitalWrite(LED1_PIN, LOW); 
  pinMode(LED2_PIN, OUTPUT); digitalWrite(LED2_PIN, LOW);
  pinMode(LED3_PIN, OUTPUT); digitalWrite(LED3_PIN, LOW);
  pinMode(LED_AUTO_PIN, OUTPUT); digitalWrite(LED_AUTO_PIN, LOW);

  // OLED Init
  Wire.begin(OLED_SDA, OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("❌ OLED not found");
    while(true);
  }
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(10, 20);
  display.println("Booting...");
  display.display();

  // Get MAC
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  for (int i=0; i<6; i++) {
    if (i>0) deviceMac += ":";
    if (mac[i]<0x10) deviceMac += "0";
    deviceMac += String(mac[i], HEX);
  }
  deviceMac.toUpperCase();
  Serial.println("MAC: " + deviceMac);

  // WiFiManager
  WiFiManager wifiManager;
  // Custom Parameter for Backend IP
  WiFiManagerParameter custom_backend_ip("backend", "Backend IP", backendIP, 40);
  wifiManager.addParameter(&custom_backend_ip);
  
  display.clearDisplay();
  display.setCursor(0,0);
  display.println("Connect to WiFi:");
  display.println("SmartHome-Setup");
  display.display();

  if (!wifiManager.autoConnect("SmartHome-Setup")) {
    ESP.restart();
  }

  // Save custom params
  strcpy(backendIP, custom_backend_ip.getValue());
  apiBaseURL = "http://" + String(backendIP) + ":" + String(backendPort);
  mqttServer = String(backendIP);

  Serial.println("✅ WiFi Connected");
  Serial.println("Backend: " + apiBaseURL);
  
  // MQTT Init
  mqttClient.setServer(mqttServer.c_str(), mqttPort);
  mqttClient.setCallback(mqttCallback);

  // REST Init
  server.on("/scan", HTTP_GET, handleScan);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/control", HTTP_POST, handleControl);
  server.on("/update", HTTP_GET, handleOTA);
  server.on("/update", HTTP_POST, []() {
    server.send(200, "text/plain", (Update.hasError()) ? "FAIL" : "OK");
    delay(1000);
    ESP.restart();
  }, handleOTAUpload);
  server.begin();

  // Hardware Init
  dht.begin();
  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);
  mfrc.PCD_Init();
  
  // Weather & Register
  timeClient.begin();
  // registerDeviceToBackend(); // Only calls once, will retry in loop
}

String uidToString(MFRC522::Uid &uid) {
  String s = "";
  for (byte i = 0; i < uid.size; i++) {
    if (i) s += ":";
    s += hexByte(uid.uidByte[i]);
  }
  return s;
}

void loop() {
  server.handleClient();
  
  // MQTT & NTP Maintenance
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      static unsigned long lastMqttRetry = 0;
      if (millis() - lastMqttRetry > 5000) {
        lastMqttRetry = millis();
        reconnectMQTT();
      }
    } else {
      mqttClient.loop();
    }
    timeClient.update();
  }

  unsigned long now = millis();
  
  // Retry Registration
  static unsigned long lastRegRetry = 0;
  if (!deviceRegistered && WiFi.status() == WL_CONNECTED && (now - lastRegRetry > 15000)) {
    registerDeviceToBackend();
    lastRegRetry = now;
  }

  // Weather polling
  if (WiFi.status() == WL_CONNECTED && (now - lastWeatherUpdate > weatherUpdateInterval)) {
    getWeather();
  }

  // Sensor Loop
  if (now - lastDhtMillis >= DHT_INTERVAL) {
    lastDhtMillis = now;
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t)) lastTemp = t; 
    if (!isnan(h)) lastHum = h;
    
    gasRaw = analogRead(GAS_PIN);
    lightRaw = analogRead(LIGHT_PIN);
    
    int newRainState = digitalRead(RAIN_PIN);
    if (newRainState != rainState) {
        rainState = newRainState;
        if (rainState == LOW) rainCoverOpen(); else rainCoverClose();
    }

    if (isAutoMode) {
        if (lightRaw > 3000) autoLightState = true;
        else if (lightRaw < 1500) autoLightState = false;
        digitalWrite(LED_AUTO_PIN, autoLightState ? HIGH : LOW);
    }
    
    // Gas Alarm
    if (gasRaw > GAS_THRESHOLD) {
      static unsigned long lastGasBeep = 0;
      if (now - lastGasBeep > 500) {
        lastGasBeep = now;
        beep(false);
      }
    }
  }

  // Touch & Switches
  // SW1: TOUCH_PIN (GPIO 25) -> Controls LED3 (Swap logic retained from before)
  // SW1: TOUCH_PIN (GPIO 25) -> Controls LED3 (Swap logic retained from before)
  static bool lastTouchVal = LOW;
  static unsigned long touchStart = 0;
  bool touchNow = digitalRead(TOUCH_PIN) == HIGH; 
  
  if (touchNow) {
    if (!lastTouchVal) touchStart = now; // Rising edge
    if (now - touchStart > 5000) { // Held for 5 seconds
       Serial.println("⚠️ Factory Reset Triggered!");
       beep(false); delay(200); beep(false); delay(200); beep(false);
       display.clearDisplay();
       display.setCursor(10,20); display.println("RESETTING..."); display.display();
       
       WiFiManager wm;
       wm.resetSettings();
       delay(1000);
       ESP.restart();
    }
  }

  if (!touchNow && lastTouchVal) { // Falling edge (Released)
     if (now - touchStart < 1000) { // Short press (< 1s)
         led3State = !led3State;
         digitalWrite(LED3_PIN, led3State ? HIGH : LOW);
         // delay(150); // Removed delay to improve responsiveness
     }
  }
  lastTouchVal = touchNow;

  // SW2: SWITCH2_PIN (GPIO 33) -> Controls LED2
  static bool lastSw2 = HIGH;
  bool sw2Now = digitalRead(SWITCH2_PIN); 
  if (sw2Now == LOW && lastSw2 == HIGH) { // Falling edge
    led2State = !led2State;
    digitalWrite(LED2_PIN, led2State ? HIGH : LOW);
    delay(150);
  }
  lastSw2 = sw2Now;
  
   // SW3 (GPIO 39) -> Controls LED1
  static bool lastSw3 = LOW;
  bool sw3Now = digitalRead(SWITCH3_PIN) == HIGH;
  if (sw3Now && !lastSw3) {
    led1State = !led1State;
    digitalWrite(LED1_PIN, led1State ? HIGH : LOW);
    delay(150);
  }
  lastSw3 = sw3Now;

  // RFID Logic (Restored!)
  if (now - lastReadMillis > repeatDelay) {
    if (mfrc.PICC_IsNewCardPresent() && mfrc.PICC_ReadCardSerial()) {
      String uid = uidToString(mfrc.uid);
      bool authorized = isWhitelisted(uid);
      
      showUidScreen(uid, authorized);
      
      if (authorized) {
        beep(true);
        servoTransition(SERVO_OPENING);
        sendAccessLog(uid, true);
      } else {
        beep(false);
        sendAccessLog(uid, false);
      }
      
      lastReadMillis = now;
      mfrc.PICC_HaltA();
      mfrc.PCD_StopCrypto1();
    }
  }

  // Display Update
  if (now - lastSensorDisplayMillis >= SENSOR_DISPLAY_INTERVAL) {
    lastSensorDisplayMillis = now;
    showMainScreen();
  }
  
  // Servo Handling
  if (servoState == SERVO_OPENING) {
      servoState = SERVO_OPEN; 
      servoStateMillis = now;
  } else if (servoState == SERVO_OPEN) {
      if (now - servoStateMillis > SERVO_OPEN_MS) {
          servoTransition(SERVO_CLOSING);
      }
  } else if (servoState == SERVO_CLOSING) {
       servoState = SERVO_CLOSED;
       servoTransition(SERVO_CLOSED);
  }
}
