
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
  
  // Relay states
  doc["relay1"] = relay1State;
  doc["relay2"] = relay2State;
  doc["relay3"] = relay3State;
  doc["relay4"] = relay4State;
  
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
        if (!myServo.attached()) myServo.attach(SERVO_PIN);
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
      case 1: relay1State = newState; pin = RELAY1_PIN; break;
      case 2: relay2State = newState; pin = RELAY2_PIN; break;
      case 3: relay3State = newState; pin = RELAY3_PIN; break;
      case 4: relay4State = newState; pin = RELAY4_PIN; break;
    }
    
    // Active-HIGH relay: HIGH=ON, LOW=OFF
    digitalWrite(pin, newState ? HIGH : LOW);
    Serial.printf("Relay %d set to %s (pin %d = %s)\n", channel, newState ? "ON" : "OFF", pin, newState ? "HIGH" : "LOW");
    server.send(200, "application/json", "{\"status\":\"relay updated\"}");
  } else {
    server.send(400, "application/json", "{\"error\":\"Unknown device. Use 'door', 'buzzer', 'screen', or 'relay'\"}");
  }
}

