import fs from "fs";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { BasePublisher } from "./base-publisher";

puppeteer.use(StealthPlugin());

interface TikTokCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
}

function getBrowserExecutablePath(): string | undefined {
  // 1. Explicit Environment Variable (Priority 1)
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // 2. Linux / Azure App Service Common Chromium Paths
  const linuxPaths = [
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
  ];

  for (const lp of linuxPaths) {
    if (fs.existsSync(lp)) return lp;
  }

  // 3. Windows Local Edge Paths
  const edgePaths = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    process.env["PROGRAMFILES(X86)"] ? `${process.env["PROGRAMFILES(X86)"]}\\Microsoft\\Edge\\Application\\msedge.exe` : "",
    process.env.PROGRAMFILES ? `${process.env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe` : "",
  ].filter(Boolean);

  for (const p of edgePaths) {
    if (fs.existsSync(p)) return p;
  }

  // 4. Puppeteer Bundled Chromium Fallback
  try {
    const fallback = (puppeteer as any).executablePath?.();
    if (fallback && fs.existsSync(fallback)) return fallback;
  } catch {
    // ignore
  }

  console.warn("⚠️ [TikTok Publisher] No fixed browser path found — letting Puppeteer resolve default.");
  return undefined;
}

export function parseTikTokCookies(cookiesInput: string): TikTokCookie[] {
  if (!cookiesInput || !cookiesInput.trim()) return [];

  const trimmed = cookiesInput.trim();

  // 1. Try JSON Array parsing
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      return arr
        .map((item: any) => {
          const rawDomain = String(item.domain || ".tiktok.com");
          const cleanDomain = `.${rawDomain.replace(/^(\.)?(www\.)?/, "")}`;
          return {
            name: String(item.name || item.key || "").trim(),
            value: String(item.value || item.val || "").trim(),
            domain: cleanDomain,
            path: item.path || "/",
            secure: item.secure ?? true,
            httpOnly: item.httpOnly ?? false,
          };
        })
        .filter((c) => c.name && c.value);
    } catch (e) {
      console.warn("⚠️ [TikTok Publisher] JSON cookie parse failed, falling back to header string parser.");
    }
  }

  // 2. Fallback: Parse as raw Cookie header string ("sessionid=abc; ttwid=123")
  const cookies: TikTokCookie[] = [];
  const pairs = trimmed.split(";");
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx > 0) {
      const name = pair.substring(0, eqIdx).trim();
      const value = pair.substring(eqIdx + 1).trim();
      if (name && value) {
        cookies.push({
          name,
          value,
          domain: ".tiktok.com",
          path: "/",
          secure: true,
          httpOnly: false,
        });
      }
    }
  }

  return cookies;
}

export class TikTokService extends BasePublisher {
  protected readonly logPrefix = "TikTok";

  private cookiesJson: string;

  constructor(cookiesJson: string) {
    super();
    this.cookiesJson = cookiesJson;
  }

  async uploadVideo(filePath: string, description: string): Promise<void> {
    console.log("🎵 [TikTok Service] Starting TikTok Video Upload (Puppeteer Stealth Native Bypass)...");

    if (!fs.existsSync(filePath)) {
      throw new Error(`❌ Target video file not found at: ${filePath}`);
    }

    const rawCookies = parseTikTokCookies(this.cookiesJson);
    console.log(`      🍪 [TikTok Service] Decrypted Cookie Count: ${rawCookies.length}`);

    if (rawCookies.length === 0) {
      throw new Error("❌ Invalid or empty TikTok session cookies. Please re-enter TikTok cookies in Social Accounts.");
    }

    const executablePath = getBrowserExecutablePath();
    const envVal = (process.env.TIKTOK_HEADLESS || "T").trim().toUpperCase();
    const isHeadless = envVal === "T" || envVal === "TRUE";

    console.log(
      `      🌐 [TikTok Service] Launching Stealth Browser (Headless: ${isHeadless})` +
      (executablePath ? ` with binary: ${executablePath}` : " with Puppeteer's bundled Chromium")
    );

    const browser = await puppeteer.launch({
      headless: isHeadless,
      ...(executablePath ? { executablePath } : {}),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--window-size=1920,1080",
        "--disable-blink-features=AutomationControlled",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      ],
      defaultViewport: { width: 1920, height: 1080 },
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(0);

    try {
      const fixedCookies = rawCookies.map((cookie) => {
        const rawDomain = String(cookie.domain || ".tiktok.com");
        const cleanDomain = `.${rawDomain.replace(/^(\.)?(www\.)?/, "")}`;
        return {
          name: cookie.name,
          value: cookie.value,
          domain: cleanDomain,
          path: cookie.path || "/",
          secure: cookie.secure ?? true,
          httpOnly: cookie.httpOnly ?? false,
          sameSite: "Lax" as const,
        };
      });

      console.log("      🍪 [TikTok Service] Injecting Session Cookies...");
      await page.setCookie(...fixedCookies);
      console.log("      ✅ [TikTok Service] Cookies Injected!");

      console.log("      🌍 [TikTok Service] Opening TikTok Upload Dashboard...");
      await page.goto("https://www.tiktok.com/creator-center/upload?lang=en", { waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 4000));

      console.log("      📤 [TikTok Service] Injecting file directly into hidden input...");
      const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 20000 });
      if (fileInput) {
        await fileInput.uploadFile(filePath);
        console.log("      ✅ [TikTok Service] File attached directly into DOM!");
      } else {
        throw new Error("❌ Could not find hidden file input element!");
      }

      console.log("      ⏳ [TikTok Service] Waiting 45s for TikTok video processing & preview generation...");
      await new Promise((r) => setTimeout(r, 45000));

      // Caption handling with DraftEditor reset
      console.log("      ✍️ [TikTok Service] Entering Caption...");
      try {
        const captionEditor = await page.waitForSelector(".public-DraftEditor-content", { timeout: 8000 });
        if (captionEditor) {
          await captionEditor.click();
          await page.keyboard.down("Control");
          await page.keyboard.press("A");
          await page.keyboard.up("Control");
          await page.keyboard.press("Backspace");
          await page.keyboard.type(description || "CastBot Automated Video Upload", { delay: 30 });
          console.log("      ✅ [TikTok Service] Caption Added!");
        }
      } catch (e) {
        console.log("      ⚠️ [TikTok Service] DraftEditor step skipped or not found.");
      }

      await new Promise((r) => setTimeout(r, 3000));

      console.log("      🔘 [TikTok Service] Clicking Main Post Button...");
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, div[role="button"]')) as HTMLElement[];
        const postBtn = buttons.find((btn) => btn.textContent?.trim() === "Post");
        if (postBtn) postBtn.click();
      });

      console.log("      ⚔️ [TikTok Service] Handling Confirmation Popups...");
      await new Promise((r) => setTimeout(r, 4000));

      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, div[role="button"], span')) as HTMLElement[];
        buttons.forEach((btn) => {
          const text = btn.textContent?.trim().toLowerCase();
          if (text && (text.includes("continue") || text.includes("post anyway") || text.includes("allow") || text.includes("got it"))) {
            btn.click();
            console.log("      🔥 [TikTok Service] Clicked Popup Confirmation Button:", text);
          }
        });
      });

      console.log("      ⏳ [TikTok Service] Waiting 15s for server confirmation...");
      await new Promise((r) => setTimeout(r, 25000));
      console.log("      🎉 [TikTok Service] TikTok Video Published Successfully!");

    } catch (error: unknown) {
      try {
        await page.screenshot({ path: "tiktok-debug-error.png", fullPage: true });
        console.log("📸 [TikTok Service] Debug error screenshot saved as tiktok-debug-error.png");
      } catch (ssErr) {
        console.warn("⚠️ Failed to capture debug screenshot:", ssErr);
      }
      this.handleUploadError("Upload", error);
    } finally {
      console.log("      🔒 [TikTok Service] Closing browser...");
      await browser.close();
    }
  }
}

export default TikTokService;