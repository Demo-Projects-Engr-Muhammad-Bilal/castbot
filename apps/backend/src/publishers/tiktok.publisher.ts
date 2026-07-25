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
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  if (process.env.NODE_ENV === "production") {
    try {
      const chromiumPath = (puppeteer as any).executablePath?.();
      if (chromiumPath && fs.existsSync(chromiumPath)) return chromiumPath;
    } catch {
      // ignore — undefined lets puppeteer.launch() resolve its own default
    }
    return undefined;
  }

  const edgePaths = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    process.env["PROGRAMFILES(X86)"] ? `${process.env["PROGRAMFILES(X86)"]}\\Microsoft\\Edge\\Application\\msedge.exe` : "",
    process.env.PROGRAMFILES ? `${process.env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe` : "",
  ].filter(Boolean);

  for (const p of edgePaths) {
    if (fs.existsSync(p)) return p;
  }

  try {
    const fallback = (puppeteer as any).executablePath?.();
    if (fallback && fs.existsSync(fallback)) return fallback;
  } catch {
    // ignore
  }

  console.warn("⚠️ [TikTok Publisher] No local Edge/Chromium found — letting Puppeteer resolve its default.");
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
    console.log("🎵 [TikTok Service] Starting TikTok Video Upload (Puppeteer Stealth)...");

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

      console.log("      🌍 [TikTok Service] Navigating to TikTok Creator Center...");
      await page.goto("https://www.tiktok.com/creator-center/upload?lang=en", { waitUntil: "domcontentloaded" });

      console.log("      📤 [TikTok Service] Injecting Video File via DOM Selector...");
      const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 30000 });
      if (fileInput) {
        await fileInput.uploadFile(filePath);
        console.log("      ✅ [TikTok Service] Video File Injected Successfully!");
      }

      console.log("      ⏳ [TikTok Service] Waiting for video processing & copyright checks (40s ceiling)...");
      await page
        .waitForFunction(
          () => {
            const buttons = Array.from(document.querySelectorAll("button, div[role='button']"));
            const postBtn = buttons.find((el) => el.textContent?.trim() === "Post");
            if (!postBtn) return false;
            const isDisabled =
              (postBtn as HTMLButtonElement).disabled === true ||
              postBtn.getAttribute("aria-disabled") === "true" ||
              postBtn.classList.contains("disabled");
            return !isDisabled;
          },
          { timeout: 40000 }
        )
        .then(() => console.log("      ✅ [TikTok Service] Post button became enabled before ceiling."))
        .catch(() => console.log("      ⏳ [TikTok Service] Processing ceiling (40s) reached, proceeding."));

      // Clear DraftEditor & Type Caption
      console.log("      ✍️ [TikTok Service] Typing Caption Metadata...");
      try {
        await page.waitForSelector(".public-DraftEditor-content", { timeout: 10000 });
        await page.click(".public-DraftEditor-content");

        // Clear existing content if any
        await page.keyboard.down("Control");
        await page.keyboard.press("A");
        await page.keyboard.up("Control");
        await page.keyboard.press("Backspace");

        await page.keyboard.type(description, { delay: 30 });
        console.log("      ✅ [TikTok Service] Caption typed successfully!");
      } catch (e: unknown) {
        console.log("      ⚠️ [TikTok Service] DraftEditor caption selector skipped or timed out.");
      }

      console.log("      🔘 [TikTok Service] Clicking Initial Post Button...");
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button, div[role='button']"));
        const postBtn = buttons.find((el) => el.textContent?.trim() === "Post");
        if (postBtn) {
          (postBtn as HTMLElement).click();
          console.log("      🔥 [TikTok Service] Initial Post Button Clicked!");
        }
      });

      // Run Popup Buster Loop for optional confirmation modals (e.g. "Continue to post?")
      console.log("      ⚔️ [TikTok Service] Running Smart Confirmation Popup Buster Loop...");
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        await page.evaluate(() => {
          // 1. Look inside dialog/modal containers first
          const modalBtns = Array.from(
            document.querySelectorAll('div[role="dialog"] button, div[role="dialog"] div[role="button"], .modal-btn, [class*="modal"] button')
          );

          let clicked = false;
          modalBtns.forEach((btn) => {
            const text = btn.textContent?.trim().toLowerCase();
            if (text && ["post", "continue", "post anyway", "allow", "got it", "confirm"].includes(text)) {
              (btn as HTMLElement).click();
              console.log(`      🔥 Clicked Modal Confirm Button: "${text}"`);
              clicked = true;
            }
          });

          // 2. Fallback check for global popup buttons if modal wrapper wasn't strictly found
          if (!clicked) {
            const allBtns = Array.from(document.querySelectorAll('button, div[role="button"]'));
            allBtns.forEach((btn) => {
              const text = btn.textContent?.trim().toLowerCase();
              if (
                text &&
                ["continue to post", "post anyway", "allow", "turn on", "confirm"].includes(text)
              ) {
                (btn as HTMLElement).click();
                console.log(`      🔥 Clicked Global Popup Button: "${text}"`);
              }
            });
          }
        });
      }

      try {
        console.log("      🌐 [TikTok Service] Waiting for network idle after post submission...");
        await page.waitForNetworkIdle({ idleTime: 2000, timeout: 30000 });
      } catch (netErr) {
        console.log("      ℹ️ Network idle wait completed or timed out gracefully.");
      }

      console.log("      ⏳ [TikTok Service] Waiting for server synchronization & publishing (35s ceiling)...");
      await page
        .waitForFunction(() => !window.location.href.includes("/upload"), { timeout: 35000 })
        .then(() => console.log("      ✅ [TikTok Service] Navigated away from upload page before ceiling."))
        .catch(() => console.log("      ⏳ [TikTok Service] Publish-sync ceiling (35s) reached, proceeding."));

      console.log("   ✅ [TikTok Service] TikTok Upload Pipeline Completed!");
    } catch (error: unknown) {
      try {
        await page.screenshot({ path: "tiktok-debug-error.png", fullPage: true });
        console.log("📸 [TikTok Service] Debug error screenshot saved as tiktok-debug-error.png");
      } catch (ssErr) {
        console.warn("⚠️ Failed to capture debug screenshot:", ssErr);
      }
      this.handleUploadError("Upload", error);
    } finally {
      await browser.close();
    }
  }
}

export default TikTokService;