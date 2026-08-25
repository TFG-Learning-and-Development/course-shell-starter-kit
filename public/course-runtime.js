(function (global) {
  "use strict";

  var api = null;
  var initialized = false;
  var finished = false;
  var sessionStartedAt = 0;
  var lessonStatus = "";
  var totalTime = "";

  function findApi(startWindow, includeOpener) {
    var current = startWindow;
    var attempts = 0;
    while (current && attempts < 50) {
      try {
        if (current.API) return current.API;
        if (!current.parent || current.parent === current) break;
        current = current.parent;
      } catch (_error) { break; }
      attempts += 1;
    }
    try {
      if (includeOpener !== false && global.opener && global.opener !== global) return findApi(global.opener, false);
    } catch (_error) { return null; }
    return null;
  }

  function call(method) {
    if (!api || typeof api[method] !== "function") return "false";
    try { return api[method].apply(api, Array.prototype.slice.call(arguments, 1)); }
    catch (_error) { return "false"; }
  }

  function formatTime(milliseconds) {
    var totalCentiseconds = Math.max(0, Math.floor(milliseconds / 10));
    var centiseconds = totalCentiseconds % 100;
    var totalSeconds = Math.floor(totalCentiseconds / 100);
    var seconds = totalSeconds % 60;
    var totalMinutes = Math.floor(totalSeconds / 60);
    var minutes = totalMinutes % 60;
    var hours = Math.min(Math.floor(totalMinutes / 60), 9999);
    return String(hours).padStart(4, "0") + ":" + String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0") + "." + String(centiseconds).padStart(2, "0");
  }

  function updateSessionTime() {
    if (!initialized || !sessionStartedAt) return false;
    return String(call("LMSSetValue", "cmi.core.session_time", formatTime(Date.now() - sessionStartedAt))).toLowerCase() === "true";
  }

  function initialize() {
    if (initialized) return true;
    api = findApi(global);
    if (!api || String(call("LMSInitialize", "")).toLowerCase() !== "true") return false;
    initialized = true;
    sessionStartedAt = Date.now();
    lessonStatus = String(call("LMSGetValue", "cmi.core.lesson_status") || "").toLowerCase();
    totalTime = String(call("LMSGetValue", "cmi.core.total_time") || "");
    if (!lessonStatus || lessonStatus === "not attempted" || lessonStatus === "unknown") {
      call("LMSSetValue", "cmi.core.lesson_status", "incomplete");
      lessonStatus = "incomplete";
      call("LMSCommit", "");
    }
    return true;
  }

  function setValue(element, value) {
    if (!initialize()) return false;
    try { return String(api.LMSSetValue(element, value)).toLowerCase() === "true"; }
    catch (_error) { return false; }
  }

  function commit() {
    if (!initialize()) return false;
    updateSessionTime();
    return String(call("LMSCommit", "")).toLowerCase() === "true";
  }

  function getLessonStatus() {
    if (!initialize()) return "";
    lessonStatus = String(call("LMSGetValue", "cmi.core.lesson_status") || lessonStatus).toLowerCase();
    return lessonStatus;
  }

  function getCompletionStatus() { return getLessonStatus(); }
  function getTotalTime() {
    if (!initialize()) return "";
    totalTime = String(call("LMSGetValue", "cmi.core.total_time") || totalTime);
    return totalTime;
  }
  function getSuspendData() {
    if (!initialize()) return "";
    return String(call("LMSGetValue", "cmi.suspend_data") || "");
  }
  function setSuspendData(value) {
    if (!setValue("cmi.suspend_data", String(value).slice(0, 4096))) return false;
    return commit();
  }
  function setCompleted() {
    if (!setValue("cmi.core.lesson_status", "completed")) return false;
    lessonStatus = "completed";
    setValue("cmi.core.exit", "");
    return commit();
  }
  function finish() {
    if (!initialized || finished) return true;
    updateSessionTime();
    call("LMSSetValue", "cmi.core.exit", lessonStatus === "completed" ? "" : "suspend");
    call("LMSCommit", "");
    var result = String(call("LMSFinish", "")).toLowerCase() === "true";
    finished = true;
    return result;
  }

  global.CourseSCORM = { initialize: initialize, getLessonStatus: getLessonStatus, getCompletionStatus: getCompletionStatus, getTotalTime: getTotalTime, getSuspendData: getSuspendData, setSuspendData: setSuspendData, setCompleted: setCompleted, commit: commit, finish: finish };
  initialize();
  global.addEventListener("pagehide", finish);
  global.addEventListener("beforeunload", finish);
})(window);
