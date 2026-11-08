type ScormApi = {
  LMSInitialize(value: string): string;
  LMSFinish(value: string): string;
  LMSGetValue(element: string): string;
  LMSSetValue(element: string, value: string): string;
  LMSCommit(value: string): string;
  LMSGetLastError(): string;
  LMSGetErrorString(code: string): string;
  LMSGetDiagnostic(code: string): string;
};

type ApiWindow = Window & { API?: ScormApi };
const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const findApi = (): ScormApi | null => {
  const visited = new Set<Window>();
  for (const startingWindow of [window, window.opener]) {
    let current = startingWindow;
    for (let depth = 0; current && depth < 20 && !visited.has(current); depth += 1) {
      visited.add(current);
      try {
        if ((current as ApiWindow).API) return (current as ApiWindow).API!;
        if (current === current.parent) break;
        current = current.parent;
      } catch { break; }
    }
  }
  return null;
};

export type ScormLaunch = { mode: "standalone" | "lms" | "failed"; status: string; suspendData: string; location: string; learnerId: string | null };

export class ScormSession {
  private api = findApi();
  private active = false;
  private ready = false;
  private finished = false;
  private status = "";

  private failure(operation: string, detail = "") {
    let code = "unknown";
    let message = "";
    let diagnostic = "";
    try {
      code = this.api?.LMSGetLastError() || code;
      message = this.api?.LMSGetErrorString(code) || "";
      diagnostic = this.api?.LMSGetDiagnostic(code) || "";
    } catch (error) { diagnostic = String(error); }
    console.error(`[scorm] ${operation} failed${detail ? ` (${detail})` : ""}: ${code} ${message} ${diagnostic}`.trim());
  }

  private call(operation: "LMSInitialize" | "LMSFinish" | "LMSCommit" | "LMSSetValue", value: string, element?: string): boolean {
    if (!this.api) return false;
    try {
      const result = operation === "LMSSetValue" ? this.api.LMSSetValue(element!, value) : this.api[operation](value);
      if (result === "true") return true;
      this.failure(operation, element);
    } catch (error) { this.failure(operation, `${element || ""} ${String(error)}`); }
    return false;
  }

  private get(element: string): string | null {
    if (!this.api) return null;
    try {
      const value = this.api.LMSGetValue(element);
      const error = this.api.LMSGetLastError();
      if (error === "0") return value;
      this.failure("LMSGetValue", element);
    } catch (error) { this.failure("LMSGetValue", `${element} ${String(error)}`); }
    return null;
  }

  private getOptional(element: string): string | null {
    if (!this.api) return null;
    try {
      const value = this.api.LMSGetValue(element);
      return this.api.LMSGetLastError() === "0" ? value : null;
    } catch { return null; }
  }

  // A continuing SCO document can inherit an already initialized API. A
  // failed probe is expected for a fresh session; initialization must still
  // succeed before that session can be used.
  private probe(element: string): string | null {
    if (!this.api) return null;
    try {
      const value = this.api.LMSGetValue(element);
      return this.api.LMSGetLastError() === "0" && typeof value === "string" ? value : null;
    } catch { return null; }
  }

  async launch(): Promise<ScormLaunch> {
    const packaged = document.documentElement.dataset.scormPackage === "true";
    for (let attempt = 0; !this.api && packaged && attempt < 40; attempt += 1) {
      await wait(125);
      this.api = findApi();
    }
    if (!this.api) {
      if (packaged) console.error("[scorm] LMS API unavailable for packaged course.");
      return { mode: packaged ? "failed" : "standalone", status: "", suspendData: "", location: "", learnerId: null };
    }
    let status = this.probe("cmi.core.lesson_status");
    let suspendData = this.probe("cmi.suspend_data");
    let location = this.probe("cmi.core.lesson_location");
    if (status === null || suspendData === null || location === null) {
      if (!this.call("LMSInitialize", "")) return { mode: "failed", status: "", suspendData: "", location: "", learnerId: null };
      status = this.get("cmi.core.lesson_status");
      suspendData = this.get("cmi.suspend_data");
      location = this.get("cmi.core.lesson_location");
    }
    this.active = true;
    if (status === null || suspendData === null || location === null) return { mode: "failed", status: "", suspendData: "", location: "", learnerId: null };
    const learnerId = this.getOptional("cmi.core.student_id")?.trim() || null;
    this.ready = true;
    this.status = status;
    if (["", "not attempted", "browsed"].includes(status)) {
      if (!this.call("LMSSetValue", "incomplete", "cmi.core.lesson_status") || !this.call("LMSCommit", "")) {
        this.ready = false;
        return { mode: "failed", status, suspendData, location, learnerId };
      }
      this.status = "incomplete";
    }
    return { mode: "lms", status: this.status, suspendData, location, learnerId };
  }

  save(suspendData: string, location: string, allowCompletion: boolean): boolean {
    if (!this.active || !this.ready || this.finished) return false;
    if (suspendData.length > 4096) {
      console.error(`[scorm] cmi.suspend_data is ${suspendData.length} characters; SCORM 1.2 permits 4096. Progress was not sent to the LMS.`);
      return false;
    }
    const suspendSaved = this.call("LMSSetValue", suspendData, "cmi.suspend_data");
    if (!suspendSaved) return false;
    const locationSaved = this.call("LMSSetValue", location, "cmi.core.lesson_location");
    if (!locationSaved) return false;
    const needsCompletion = allowCompletion && !["completed", "passed"].includes(this.status);
    const completionWritten = needsCompletion && this.call("LMSSetValue", "completed", "cmi.core.lesson_status");
    const committed = this.call("LMSCommit", "");
    if (committed && completionWritten) this.status = "completed";
    return committed && (!needsCompletion || completionWritten);
  }

  exit(suspendData: string | null, location: string): void {
    if (!this.active || this.finished) return;
    if (this.ready) {
      if (suspendData !== null) this.save(suspendData, location, false);
      this.call("LMSSetValue", "suspend", "cmi.core.exit");
      this.call("LMSCommit", "");
    }
    this.finished = true;
    this.call("LMSFinish", "");
  }
}
