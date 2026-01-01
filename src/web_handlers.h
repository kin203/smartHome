
// ===== Web Server Handlers =====
// CORS helper
void setCORS() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

void handleScan() {
  setCORS();
  StaticJsonDocument<200> doc;
  doc["id"] = "esp32-smart-home";
  doc["name"] = "Smart Home Hub";
  doc["type"] = "Hub";
  doc["mac"] = deviceMac; // Add MAC address for manual scan/add
  doc["ip"] = WiFi.localIP().toString();
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleStatus() {
  setCORS();
  StaticJsonDocument<512> doc;
  
  // Sensor data
  doc["temperature"] = isnan(lastTemp) ? 0 : lastTemp;
  doc["humidity"] = isnan(lastHum) ? 0 : lastHum;
  doc["gas"] = gasRaw;
  doc["gasAlert"] = (gasRaw > 2000);
  doc["rain"] = (rainState == LOW) ? "detected" : "none";
  
  // Actuator states
  if (servoState == SERVO_CLOSED) {
    doc["door"] = "closed";
  } else if (servoState == SERVO_OPEN || servoState == SERVO_OPENING) {
    doc["door"] = "open";
  } else {
    doc["door"] = "closing";
  }
  
  // Display info
  doc["screen"] = screenIndex; // 0=main, 1=DHT, 2=Rain/Gas
  doc["wifi"] = WiFi.RSSI();
  doc["time"] = timeClient.getFormattedTime();
  
  // LED states (3 LEDs total)
  doc["relay1"] = led1State;
  doc["relay2"] = led2State;
  doc["relay3"] = led3State;
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleControl() {
  setCORS();
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"Body missing\"}");
    return;
  }
  
  String body = server.arg("plain");
  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, body);
  
  if (error) {
    server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
    return;
  }
  
  String device = doc["device"];
  String action = doc["action"];
  
  if (device == "door" || device == "servo") {
    if (action == "open") {
      unsigned long now = millis();
      // Same logic as RFID: if already open, extend timer; otherwise open
      if (servoState == SERVO_OPEN || servoState == SERVO_OPENING) {
        // Already open, reset timer to extend open period
        servoStateMillis = now;
        server.send(200, "application/json", "{\"status\":\"extended\"}");
      } else {
        // Not open: attach & open
        if (!servoRight.attached()) servoRight.attach(SERVO_RIGHT_PIN);
        if (!servoLeft.attached()) servoLeft.attach(SERVO_LEFT_PIN);
        delay(40);
        servoTransition(SERVO_OPENING);
        // Log door open event
        sendAccessLog("DOOR_OPEN", true);
        server.send(200, "application/json", "{\"status\":\"opening\"}");
      }
    } else if (action == "close") {
      servoTransition(SERVO_CLOSING);
      // Log door close event
      sendAccessLog("DOOR_CLOSE", true);
      server.send(200, "application/json", "{\"status\":\"closing\"}");
    } else {
      server.send(400, "application/json", "{\"error\":\"Invalid action. Use 'open' or 'close'\"}");
    }
  } else if (device == "buzzer" || device == "alarm") {
    if (action == "beep") {
      beep(true); // success beep
      server.send(200, "application/json", "{\"status\":\"beeped\"}");
    } else if (action == "alert") {
      beep(false); // alert beep
      server.send(200, "application/json", "{\"status\":\"alerted\"}");
    } else {
      server.send(400, "application/json", "{\"error\":\"Invalid action. Use 'beep' or 'alert'\"}");
    }
  } else if (device == "screen" || device == "display") {
    int screen = doc["value"] | 0;
    if (screen >= 0 && screen <= 2) {
      screenIndex = screen;
      server.send(200, "application/json", "{\"status\":\"screen changed\"}");
    } else {
      server.send(400, "application/json", "{\"error\":\"Invalid screen. Use 0 (main), 1 (DHT), or 2 (Rain/Gas)\"}");
    }
  } else if (device == "relay" || device == "light") {
    int channel = doc["channel"]; // 1-4
    String state = doc["action"]; // "on" or "off"
    
    Serial.printf("Relay control: channel=%d, action=%s\n", channel, state.c_str());
    
    if (channel < 1 || channel > 4) {
      server.send(400, "application/json", "{\"error\":\"Invalid channel. Use 1-4\"}");
      return;
    }
    
    bool newState = (state == "on");
    int pin;
    
    switch(channel) {
      case 1: led1State = newState; pin = LED1_PIN; break;
      case 2: led2State = newState; pin = LED2_PIN; break;
      case 3: led3State = newState; pin = LED3_PIN; break;
      default:
        server.send(400, "application/json", "{\"error\":\"Invalid channel (only 1-3)\"}");
        return;
    }
    
    // Active-HIGH: HIGH=ON, LOW=OFF
    digitalWrite(pin, newState ? HIGH : LOW);
    Serial.printf("LED %d set to %s (GPIO %d = %s)\n", channel, newState ? "ON" : "OFF", pin, newState ? "HIGH" : "LOW");
    server.send(200, "application/json", "{\"status\":\"led updated\"}");
  } else {
    server.send(400, "application/json", "{\"error\":\"Unknown device. Use 'door', 'buzzer', 'screen', or 'relay'\"}");
  }
}


// ===== OTA Handlers =====
void handleOTA() {
  setCORS();
  /*
    Simple HTML form for OTA update.
    The form POSTs to /update with enctype="multipart/form-data"
  */
  String html = "<!DOCTYPE html><html><head><title>OTA Update</title>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<style>body{font-family:sans-serif;text-align:center;padding:50px;}";
  html += "form{display:inline-block;padding:20px;border:1px solid #ccc;border-radius:10px;}";
  html += "input{margin:10px;display:block;width:100%;}";
  html += "button{padding:10px 20px;background:#007bff;color:white;border:none;border-radius:5px;cursor:pointer;}";
  html += "</style></head><body>";
  html += "<h1>Firmware Update</h1>";
  html += "<form method='POST' action='/update' enctype='multipart/form-data'>";
  html += "<input type='file' name='update'>";
  html += "<button type='submit'>Update</button>";
  html += "</form>";
  html += "</body></html>";
  
  server.send(200, "text/html", html);
}

void handleOTAUpload() {
  HTTPUpload& upload = server.upload();
  
  if (upload.status == UPLOAD_FILE_START) {
    Serial.printf("Update: %s\n", upload.filename.c_str());
    if (!Update.begin(UPDATE_SIZE_UNKNOWN)) { // Start with max available size
      Update.printError(Serial);
    }
  } else if (upload.status == UPLOAD_FILE_WRITE) {
    // Flashing firmware to ESP
    if (Update.write(upload.buf, upload.currentSize) != upload.currentSize) {
      Update.printError(Serial);
    }
  } else if (upload.status == UPLOAD_FILE_END) {
    if (Update.end(true)) { // true to set the size to the current progress
      Serial.printf("Update Success: %u\nRebooting...\n", upload.totalSize);
    } else {
      Update.printError(Serial);
    }
  }
}
