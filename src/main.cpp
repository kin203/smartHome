/* Home IoT - UI giống trước + RFID điều khiển cửa (servo) only + tăng nhạy TP223
   - OLED I2C SDA=23, SCL=22
   - DHT22 = 17
   - RAIN = 32
   - GAS(MQ2) = 27 (ADC)
   - TOUCH TP223 = 25 (digital) -- software sampling để tăng "nhạy"
   - RFID: SS=5, RST=21, SCK=18, MISO=19, MOSI=13
   - BUZZER = 12
   - SERVO = 14 (5V nguồn riêng; GND chung)
   - WiFi/NTP/Weather tương tự code ban đầu
   - Chức năng: màn hình giống bản trước (WiFi, time, weather, DHT, Rain/Gas),
     chỉ mở cửa bằng RFID hợp lệ. Touch chỉ đổi màn hình, độ nhạy tăng bằng cấu hình sampling.
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

#include <MFRC522.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_GFX.h>
#include "DHT.h"
#include <ESP32Servo.h>

// ====== WiFi ======
const char* ssid = "NK203";
const char* password = "12345678a@";

// ====== OLED ======
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define OLED_SDA 23
#define OLED_SCL 22
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ====== DHT ======
#define DHTPIN 17
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// ====== sensors/actuators pins ======
#define RAIN_PIN 32
#define GAS_PIN 27
#define TOUCH_PIN 25
#define BUZZER_PIN 12
#define SERVO_PIN 14

// ====== RFID SPI pins (no conflict) ======
#define RST_PIN 21
#define SS_PIN 5
#define SCK_PIN 18
#define MISO_PIN 19
#define MOSI_PIN 13
MFRC522 mfrc(SS_PIN, RST_PIN);

// ====== Time & Weather ======
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 7 * 3600, 60000); // GMT+7
String city = "Hanoi";
String weatherMain = "--";
String temperature = "--";
String weatherIcon = "";
unsigned long lastWeatherUpdate = 0;
const unsigned long weatherUpdateInterval = 10 * 60 * 1000; // 10 min

// ====== whitelist (4-byte UID) ======
const uint8_t whitelist[][4] = {
  {0xB1, 0xD7, 0x7F, 0x05}
};
const size_t whitelistCount = sizeof(whitelist) / sizeof(whitelist[0]);

// ====== servo config ======
Servo myServo;
const int SERVO_OPEN_US = 1800;
const int SERVO_CLOSED_US = 1000;
const unsigned long SERVO_OPEN_MS = 5000;
enum ServoState {CLOSED, OPENING, OPEN, CLOSING};
ServoState servoState = CLOSED;
unsigned long servoStateMillis = 0;

// ====== timings & states ======
unsigned long lastDhtMillis = 0;
const unsigned long DHT_INTERVAL = 2000;
unsigned long lastSensorDisplayMillis = 0;
const unsigned long SENSOR_DISPLAY_INTERVAL = 1000;
unsigned long lastReadMillis = 0;
unsigned long repeatDelay = 4000; // RFID debounce

// ====== sensor values ======
float lastTemp = NAN;
float lastHum = NAN;
int gasRaw = 0;
int rainState = HIGH;

// ====== UI ======
int screenIndex = 0; // 0 main,1 dht,2 rain/gas
bool lastTouchState = false;

// ====== Touch sensitivity (software sampling) ======
// Tăng độ nhạy: giảm TOUCH_THRESHOLD (số lần HIGH trong TOUCH_SAMPLES cần đạt -> nhỏ hơn = nhạy hơn)
const int TOUCH_SAMPLES = 8;        // số mẫu đọc nhanh
const int TOUCH_THRESHOLD = 2;     // nếu >= threshold mẫu là touch (giảm = nhạy hơn)
const unsigned long TOUCH_SAMPLE_INTERVAL_MS = 6; // tổng khoảng thời gian lấy mẫu (ms)

// ====== helpers ======
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
bool isWhitelisted(MFRC522::Uid &uid) {
  if (uid.size < 4) return false;
  for (size_t i = 0; i < whitelistCount; ++i) {
    bool ok = true;
    for (int j = 0; j < 4; ++j) {
      if (whitelist[i][j] != uid.uidByte[j]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}
void beep(bool ok) {
  pinMode(BUZZER_PIN, OUTPUT);
  if (ok) {
    digitalWrite(BUZZER_PIN, HIGH); delay(80); digitalWrite(BUZZER_PIN, LOW); delay(80);
    digitalWrite(BUZZER_PIN, HIGH); delay(80); digitalWrite(BUZZER_PIN, LOW);
  } else {
    digitalWrite(BUZZER_PIN, HIGH); delay(300); digitalWrite(BUZZER_PIN, LOW);
  }
}

// ====== display screens (mimic previous UI) ======
void showMainScreen() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  // WiFi status
  display.setCursor(0,0);
  display.printf("%s", WiFi.status() == WL_CONNECTED ? ssid : "No WiFi");

  // weather + temp
  display.setCursor(0,12);
  display.print(weatherIcon);
  display.print(" ");
  display.print(temperature);
  display.print("C  ");
  if (weatherMain.length() > 10) display.print(weatherMain.substring(0,10));
  else display.print(weatherMain);

  // DHT
  display.setCursor(0,28);
  if (isnan(lastTemp) || isnan(lastHum)) display.println("Temp/Humi: --");
  else display.printf("T:%.1fC H:%.0f%%", lastTemp, lastHum);

  // time
  display.setTextSize(2);
  String timeStr = timeClient.getFormattedTime();
  int16_t x1,y1; uint16_t w,h;
  display.getTextBounds(timeStr, 0, 0, &x1, &y1, &w, &h);
  display.setCursor((SCREEN_WIDTH - w) / 2, 44);
  display.print(timeStr);

  display.display();
}
void showDHTScreen() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0,0);
  display.println("TEMP / HUMIDITY");
  display.setCursor(0,20);
  if (isnan(lastTemp) || isnan(lastHum)) {
    display.println("Sensor Error!");
  } else {
    display.printf("Temp: %.1f C\n", lastTemp);
    display.printf("Humi: %.1f %%", lastHum);
  }
  display.display();
}
void showRainGasScreen() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0,0);
  display.println("RAIN / GAS STATUS");
  display.setCursor(0,20);
  display.printf("Rain: %s\n", rainState == LOW ? "Detected" : "None");
  display.printf("Gas: %s", gasRaw < 2000 ? "Normal" : "ALERT"); // crude threshold
  display.display();
}
void showUidScreen(const String &uidStr, bool ok) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0,0);
  display.println("RFID");
  display.setTextSize(2);
  display.setCursor(0,18);
  display.println(uidStr);
  display.setTextSize(1);
  display.setCursor(0,52);
  display.println(ok ? "Access: ALLOWED" : "Access: DENIED");
  display.display();
}

// ====== weather fetch ======
void getWeather() {
  if (WiFi.status() != WL_CONNECTED) return;
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url = "https://wttr.in/" + city + "?format=j1";
  if (http.begin(client, url)) {
    int httpCode = http.GET();
    if (httpCode == 200) {
      String payload = http.getString();
      StaticJsonDocument<2048> doc;
      DeserializationError err = deserializeJson(doc, payload);
      if (!err) {
        JsonObject current = doc["current_condition"][0].as<JsonObject>();
        temperature = String((const char*) current["temp_C"]);
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

// ====== touch sampling to increase sensitivity ======
bool readTouchHigh() {
  // sample TOUCH_SAMPLES times quickly, count HIGHs
  int countHigh = 0;
  unsigned long start = millis();
  for (int i = 0; i < TOUCH_SAMPLES; ++i) {
    if (digitalRead(TOUCH_PIN) == HIGH) countHigh++;
    delay(TOUCH_SAMPLE_INTERVAL_MS / TOUCH_SAMPLES);
  }
  return (countHigh >= TOUCH_THRESHOLD);
}

// ====== servo state machine ======
void servoTransition(ServoState newState) {
  if (servoState == newState) return;
  servoState = newState;
  servoStateMillis = millis();
  switch (servoState) {
    case OPENING:
      if (!myServo.attached()) myServo.attach(SERVO_PIN);
      myServo.writeMicroseconds(SERVO_OPEN_US);
      break;
    case OPEN:
      // hold
      break;
    case CLOSING:
      myServo.writeMicroseconds(SERVO_CLOSED_US);
      break;
    case CLOSED:
      if (myServo.attached()) myServo.detach();
      break;
  }
}

// ====== setup ======
void setup() {
  Serial.begin(115200);
  delay(50);

  // pins
  pinMode(RAIN_PIN, INPUT);
  pinMode(TOUCH_PIN, INPUT);
  pinMode(BUZZER_PIN, INPUT);

  // OLED
  Wire.begin(OLED_SDA, OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED not found!");
    while (true) delay(1000);
  }
  display.clearDisplay();
  display.display();

  // sensors
  dht.begin();

  // WiFi connect (non-blocking-ish)
  WiFi.begin(ssid, password);
  int to = 0;
  while (WiFi.status() != WL_CONNECTED && to < 30) {
    delay(500);
    to++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connected");
  } else {
    Serial.println("WiFi fail");
  }
  timeClient.begin();
  if (WiFi.status() == WL_CONNECTED) timeClient.update();
  getWeather();

  // RFID init (custom SPI pins)
  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);
  mfrc.PCD_Init();
  Serial.println("MFRC522 ready");

  // Servo: DO NOT attach at setup to avoid inrush at boot (brownout risk)
  servoState = CLOSED;

  // initial display
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0,0);
  display.println("Booting...");
  display.display();
  delay(500);
  showMainScreen();
}

// ====== loop ======
void loop() {
  unsigned long now = millis();

  // update time & weather periodically
  timeClient.update();
  if (WiFi.status() == WL_CONNECTED && now - lastWeatherUpdate > weatherUpdateInterval) {
    getWeather();
  }

  // sensors periodic
  if (now - lastDhtMillis >= DHT_INTERVAL) {
    lastDhtMillis = now;
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t) && !isnan(h)) { lastTemp = t; lastHum = h; }
    gasRaw = analogRead(GAS_PIN);
    rainState = digitalRead(RAIN_PIN);
  }

  // touch sampling for screen change (edge detect)
  bool touchNow = readTouchHigh();
  if (touchNow && !lastTouchState) {
    screenIndex = (screenIndex + 1) % 3;
    // small debounce
    delay(120);
  }
  lastTouchState = touchNow;

  // update display periodically (keeps original layout/time)
  if (now - lastSensorDisplayMillis >= SENSOR_DISPLAY_INTERVAL) {
    lastSensorDisplayMillis = now;
    switch (screenIndex) {
      case 0: showMainScreen(); break;
      case 1: showDHTScreen(); break;
      case 2: showRainGasScreen(); break;
    }
  }

  // servo state machine non-blocking
  if (servoState == OPENING) {
    servoState = OPEN;
    servoStateMillis = now;
  } else if (servoState == OPEN) {
    if (now - servoStateMillis >= SERVO_OPEN_MS) {
      servoTransition(CLOSING);
      servoStateMillis = now;
    }
  } else if (servoState == CLOSING) {
    if (now - servoStateMillis >= 700) {
      servoTransition(CLOSED);
    }
  }

  // RFID reading -> only RFID controls servo
  if (mfrc.PICC_IsNewCardPresent() && mfrc.PICC_ReadCardSerial()) {
    if (now - lastReadMillis >= repeatDelay) {
      lastReadMillis = now;
      String uidStr = uidToString(mfrc.uid);
      bool ok = isWhitelisted(mfrc.uid);
      Serial.printf("Card: %s => %s\n", uidStr.c_str(), ok ? "ALLOWED" : "DENIED");
      showUidScreen(uidStr, ok);
      if (ok) {
        beep(true);
        // attach -> open -> will auto-close
        if (!myServo.attached()) myServo.attach(SERVO_PIN);
        delay(40);
        servoTransition(OPENING);
      } else {
        beep(false);
      }
    }
    mfrc.PICC_HaltA();
    mfrc.PCD_StopCrypto1();
    delay(40);
  }

  delay(10); // keep loop responsive
}
