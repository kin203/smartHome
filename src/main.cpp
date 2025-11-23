/* Home IoT - Final firmware
   - UI & boot sequence like your original sketch (WiFi, NTP, weather, boot progress)
   - Sensors: DHT22(17), Rain(32), MQ2 ADC(27), Touch TP223(25)
   - OLED I2C SDA=23, SCL=22 (display layout same as original)
   - RFID MFRC522 on custom SPI pins (SS=5,RST=21,SCK=18,MISO=19,MOSI=13)
   - Buzzer = 12
   - Servo SG90 = 14 (5V separate supply; GND common)
   - Behavior:
     * RFID valid -> open servo; keep door open for 5000 ms after the *last* valid scan
     * repeatDelay between accepted scans = 2000 ms
     * if scanned again during open period, reset timer (extend open)
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

WebServer server(80);


#include <Adafruit_SSD1306.h>
#include <Adafruit_GFX.h>
#include "DHT.h"
#include <MFRC522.h>
#include <ESP32Servo.h>

// ===== WiFi =====
const char* ssid = "NK203";
const char* password = "12345678a@";

// ===== Backend API =====
const char* backendURL = "http://192.168.100.53:5000"; // Change to your PC's IP
String deviceMac = ""; // Will be set from ESP32 MAC address
const char* firmwareVersion = "1.0.1"; // Firmware version

// ===== OLED =====
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define OLED_SDA 23
#define OLED_SCL 22
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ===== DHT22 =====
#define DHTPIN 17
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// ===== Sensors / pins =====
#define RAIN_PIN 32
#define GAS_PIN 27
#define TOUCH_PIN 25
#define BUZZER_PIN 12

// ===== RFID SPI pins (no conflict) =====
#define RST_PIN 21
#define SS_PIN 5
#define SCK_PIN 18
#define MISO_PIN 19
#define MOSI_PIN 13
MFRC522 mfrc(SS_PIN, RST_PIN);

// ===== Servo =====
#define SERVO_PIN 14
Servo myServo;
const int SERVO_OPEN_US = 1800;   // safer open
const int SERVO_CLOSED_US = 1000; // closed
const unsigned long SERVO_OPEN_MS = 5000; // keep open 5s

// ===== Relay 4 kênh (điều khiển đèn) =====
#define RELAY1_PIN 26  // Light 1
#define RELAY2_PIN 33  // Light 2
#define RELAY3_PIN 15  // Light 3
#define RELAY4_PIN 2   // Light 4
bool relay1State = false;
bool relay2State = false;
bool relay3State = false;
bool relay4State = false;

// ===== Time & Weather =====
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 7 * 3600, 60000); // GMT+7
String city = "Hanoi";
String weatherMain = "--";
String temperature = "--";
String weatherIcon = "";
unsigned long lastWeatherUpdate = 0;
const unsigned long weatherUpdateInterval = 10 * 60 * 1000; // 10 minutes

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
int rainState = HIGH;

// Backend connection status
bool backendOnline = true;
unsigned long lastBackendCheck = 0;
const unsigned long BACKEND_CHECK_INTERVAL = 5000; // Check every 5s
int consecutiveFailures = 0;
const int MAX_FAILURES_BEFORE_OFFLINE = 2;

// UI & touch
int screenIndex = 0; // 0 main, 1 DHT, 2 Rain/Gas
bool lastTouch = LOW;

// Touch sampling to increase sensitivity (TP223)
const int TOUCH_SAMPLES = 8;
const int TOUCH_THRESHOLD = 2;
const unsigned long TOUCH_SAMPLE_INTERVAL_MS = 6;

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

  HTTPClient http;
  String url = String(backendURL) + "/api/rfid-cards/check";
  http.begin(url);
  http.setTimeout(3000); // 3 second timeout to prevent hanging
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<128> doc;
  doc["deviceMac"] = deviceMac;
  doc["cardUID"] = cardUID;

  String jsonBody;
  serializeJson(doc, jsonBody);

  int httpCode = http.POST(jsonBody);
  bool authorized = false;

  if (httpCode == 200) {
    StaticJsonDocument<128> response;
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

// Send access log to backend
void sendAccessLog(String cardUID, bool accessGranted) {
  if (WiFi.status() != WL_CONNECTED || deviceMac.length() == 0) {
    Serial.println("⚠️ Cannot send log: WiFi disconnected or MAC not set");
    return;
  }

  HTTPClient http;
  String url = String(backendURL) + "/api/access-logs";
  http.begin(url);
  http.setTimeout(3000); // 3 second timeout to prevent hanging
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
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

// ===== Display functions (match original UI) =====
void showMainScreen() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  // ==== WiFi signal (4 bars) ====
  int rssi = WiFi.RSSI();
  int level = 0;
  if (rssi > -50) level = 3;
  else if (rssi > -70) level = 2;
  else if (rssi > -85) level = 1;
  else level = 0;

  // Vẽ 4 vạch ở góc trái trên
  for (int i = 0; i < 4; i++) {
    int x = 2 + i * 6;
    int h = (i + 1) * 3;            // chiều cao mỗi bar
    int y = 12 - h;                 // căn trái phía trên
    if (i <= level) display.fillRect(x, y, 4, h, SSD1306_WHITE);
    else display.drawRect(x, y, 4, h, SSD1306_WHITE);
  }

  // ==== WiFi SSID + IP (bên phải vạch) ====
  display.setCursor(30, 0);
  display.printf("%s", WiFi.status() == WL_CONNECTED ? ssid : "No WiFi");
  display.setCursor(30, 10);
  display.printf("%s", WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString().c_str() : "No IP");

  // ==== Server status warning ====
  if (!backendOnline) {
    display.setCursor(0, 20);
    display.print("Server Offline");
  } else {
    // ==== Weather + temp (giữ như trước) ====
    display.setCursor(0, 25);
    display.print(weatherIcon);
    display.print(" ");
    display.print(temperature);
    display.print("C  ");
    if (weatherMain.length() > 10) display.print(weatherMain.substring(0, 10));
    else display.print(weatherMain);
  }

  // ==== Time (giữ giữa dưới) ====
  display.setTextSize(2);
  String timeStr = timeClient.getFormattedTime();
  int16_t x1, y1; uint16_t w, h;
  display.getTextBounds(timeStr, 0, 0, &x1, &y1, &w, &h);
  display.setCursor((SCREEN_WIDTH - w) / 2, 46);
  display.print(timeStr);

  display.display();
}


void showDHTScreen() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("TEMP / HUMIDITY");

  if (isnan(lastTemp) || isnan(lastHum)) {
    display.setCursor(0, 20);
    display.println("Sensor Error!");
    Serial.println("❌ Cannot read DHT22!");
  } else {
    display.setCursor(0, 20);
    display.printf("Temp: %.1f C\n", lastTemp);
    display.printf("Humi: %.1f %%", lastHum);
  }
  display.display();
}
void showRainGasScreen() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("RAIN / GAS STATUS");
  display.setCursor(0, 20);
  display.printf("Rain: %s\n", rainState == LOW ? "Detected" : "None");
  display.setCursor(0, 35);
  display.printf("Gas: %s", gasRaw > 2000 ? "ALERT!" : "Normal");
  display.display();
}
void showUidScreen(const String &uidStr, bool ok) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("RFID");
  display.setTextSize(2);
  display.setCursor(0, 18);
  display.println(uidStr);
  display.setTextSize(1);
  display.setCursor(0, 52);
  display.println(ok ? "Access: ALLOWED" : "Access: DENIED");
  display.display();
}

// ===== Weather fetch (wttr.in) =====
void getWeather() {
  if (WiFi.status() != WL_CONNECTED) return;
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url = "https://wttr.in/" + city + "?format=j1";
  http.setTimeout(5000); // 5 second timeout for weather API
  if (http.begin(client, url)) {
    int httpCode = http.GET();
    if (httpCode == 200) {
      String payload = http.getString();
      StaticJsonDocument<2048> doc;
      DeserializationError error = deserializeJson(doc, payload);
      if (!error) {
        JsonObject current = doc["current_condition"][0].as<JsonObject>();
        temperature = String((const char*) current["temp_C"]);
        weatherMain = String((const char*) current["weatherDesc"][0]["value"]);
        String wm = weatherMain; wm.toLowerCase();
        if (wm.indexOf("rain") >= 0) weatherIcon = "R";
        else if (wm.indexOf("thunder") >= 0) weatherIcon = "T";
        else if (wm.indexOf("cloud") >= 0) weatherIcon = "C";
        else if (wm.indexOf("sun") >= 0 || wm.indexOf("clear") >= 0) weatherIcon = "S";
        else weatherIcon = "-";
      } else {
        Serial.print("❌ JSON error: ");
        Serial.println(error.c_str());
      }
    } else {
      Serial.printf("❌ HTTP Error: %d\n", httpCode);
    }
    http.end();
  } else {
    Serial.println("❌ HTTP begin fail");
  }
  lastWeatherUpdate = millis();
}

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
  if (!myServo.attached()) myServo.attach(SERVO_PIN);
  myServo.writeMicroseconds(SERVO_OPEN_US);
}
void servoSetClose() {
  if (!myServo.attached()) myServo.attach(SERVO_PIN);
  myServo.writeMicroseconds(SERVO_CLOSED_US);
}

// transition handler (non-blocking state machine uses servoState & servoStateMillis)
void servoTransition(ServoState newState) {
  if (servoState == newState) return;
  servoState = newState;
  servoStateMillis = millis();
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
      if (myServo.attached()) myServo.detach();
      break;
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

#include "web_handlers.h"

void setup() {

  Serial.begin(115200);

  pinMode(RAIN_PIN, INPUT);
  pinMode(TOUCH_PIN, INPUT);
  pinMode(BUZZER_PIN, INPUT);
  
  // Init relay pins (LOW = OFF for active-HIGH relay)
  pinMode(RELAY1_PIN, OUTPUT);
  pinMode(RELAY2_PIN, OUTPUT);
  pinMode(RELAY3_PIN, OUTPUT);
  pinMode(RELAY4_PIN, OUTPUT);
  digitalWrite(RELAY1_PIN, LOW);
  digitalWrite(RELAY2_PIN, LOW);
  digitalWrite(RELAY3_PIN, LOW);
  digitalWrite(RELAY4_PIN, LOW);

  // OLED
  Wire.begin(OLED_SDA, OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("❌ OLED not found!");
    while (true);
  }
  display.clearDisplay();
  display.display();

  // Boot UI
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Booting system...");
  display.display();
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

  int progress = 0;
  drawProgress(progress, "Init modules");
  delay(300);
  // init sensors
  dht.begin();
  progress = 10;

  // WiFi connect
  drawProgress(progress, "Connecting WiFi");
  WiFi.begin(ssid, password);
  int timeout = 0;
  while (WiFi.status() != WL_CONNECTED && timeout < 30) {
    delay(500);
    timeout++;
    progress = 10 + timeout * 2;
    if (progress > 50) progress = 50;
    drawProgress(progress, "Connecting WiFi");
  }
  if (WiFi.status() == WL_CONNECTED) {
    drawProgress(50, "WiFi OK");
    Serial.println("✅ WiFi connected!");
    Serial.println(WiFi.localIP());
  } else {
    drawProgress(50, "WiFi FAIL");
    Serial.println("⚠️ WiFi failed!");
  }
  delay(400);
  drawProgress(70, "Time OK");

  // Weather
  drawProgress(75, "Loading weather");
  if (WiFi.status() == WL_CONNECTED) getWeather();
  delay(600);
  drawProgress(100, "Done");
  delay(300);

  // Auto-register device with backend
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = String(backendURL) + "/api/devices/register";
    http.begin(url);
    http.setTimeout(5000); // 5 second timeout for registration
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
      Serial.printf("✅ Device registered: %d\n", httpCode);
    } else {
      Serial.printf("⚠️ Device registration failed: %d\n", httpCode);
    }
    http.end();
  }

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
  lastWeatherUpdate = millis();

  // Web Server
  server.on("/scan", HTTP_GET, handleScan);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/control", HTTP_POST, handleControl);
  
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


  // update NTP (non-blocking with interval check)
  static unsigned long lastNtpUpdate = 0;
  if (now - lastNtpUpdate >= 60000) { // Update every 60 seconds
    timeClient.update();
    lastNtpUpdate = now;
  }

  // update weather periodically
  if (WiFi.status() == WL_CONNECTED && (now - lastWeatherUpdate > weatherUpdateInterval)) {
    getWeather();
  }

  // read sensors periodically
  if (now - lastDhtMillis >= DHT_INTERVAL) {
    lastDhtMillis = now;
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t) && !isnan(h)) { lastTemp = t; lastHum = h; }
    gasRaw = analogRead(GAS_PIN);
    rainState = digitalRead(RAIN_PIN);
  }

  // handle touch for screen switching (simple debounce, no delays)
  bool touchNow = digitalRead(TOUCH_PIN) == HIGH;

  if (touchNow && !lastTouch) {
    screenIndex = (screenIndex + 1) % 3;
    // small debounce
    delay(120);
  }
  lastTouch = touchNow;

  // update display periodically (keep original layout/time)
  if (now - lastSensorDisplayMillis >= SENSOR_DISPLAY_INTERVAL) {
    lastSensorDisplayMillis = now;
    switch (screenIndex) {
      case 0: showMainScreen(); break;
      case 1: showDHTScreen(); break;
      case 2: showRainGasScreen(); break;
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
        if (!myServo.attached()) myServo.attach(SERVO_PIN);
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
