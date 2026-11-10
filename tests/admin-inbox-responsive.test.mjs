import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Admin Inbox Mobile & Tablet Responsive Chat Window Suite", async (t) => {
  const adminInboxPath = path.join(process.cwd(), "src/app/admin/inbox/page.tsx");
  const globalsCssPath = path.join(process.cwd(), "src/app/globals.css");

  const adminInboxContent = fs.readFileSync(adminInboxPath, "utf-8");
  const globalsCssContent = fs.readFileSync(globalsCssPath, "utf-8");

  await t.test("1. Tracks visualViewport height & offsetTop and pins fixed shell to prevent disappearing on mobile keyboard open", async () => {
    assert.ok(adminInboxContent.includes("window.visualViewport"), "Must inspect window.visualViewport");
    assert.ok(adminInboxContent.includes("vv.offsetTop"), "Must track visualViewport.offsetTop");
    assert.ok(adminInboxContent.includes('addEventListener("resize", updateViewport)'), "Must subscribe to visualViewport resize");
    assert.ok(adminInboxContent.includes('addEventListener("scroll", updateViewport)'), "Must subscribe to visualViewport scroll");
    assert.ok(adminInboxContent.includes("fixed inset-0 h-dvh max-h-dvh w-full"), "Main shell must use fixed inset-0 and 100dvh");
    assert.ok(adminInboxContent.includes('bottom: "auto"'), "Must clear bottom constraint when explicit visualHeight is active");
    assert.ok(adminInboxContent.includes("overscroll-none"), "Root shell must contain overscroll-none to prevent document bounce");
  });

  await t.test("2. Chat Panel (<section>) & Message Stream enforce flex min-h-0 / min-w-0 and Lenis touch isolation", async () => {
    assert.ok(
      adminInboxContent.includes("flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col bg-[#0e1621]"),
      "Chat panel section must enforce min-h-0 min-w-0 overflow-hidden"
    );
    assert.ok(
      adminInboxContent.includes('data-lenis-prevent-touch\n                className="flex-1 min-h-0 min-w-0 overscroll-contain'),
      "Message container must enforce min-h-0, min-w-0, overscroll-contain, and data-lenis-prevent-touch"
    );
    assert.ok(
      adminInboxContent.includes("[overflow-wrap:anywhere] break-words min-w-0"),
      "Message bubbles must wrap long unspaced strings without breaking layout"
    );
    assert.ok(
      adminInboxContent.includes('<span className="whitespace-pre-wrap">{m.content}</span>'),
      "Message bubbles must preserve multiline formatting cleanly"
    );
  });

  await t.test("3. Active Chat Header stays compact and overflow-proof on narrow mobile & tablet screens", async () => {
    assert.ok(adminInboxContent.includes("inbox-keyboard-compact-header"), "Chat header must include compact keyboard class");
    assert.ok(
      adminInboxContent.includes("text-xs sm:text-sm font-semibold text-white truncate min-w-0 leading-tight"),
      "Visitor name heading must truncate cleanly without wrapping"
    );
    assert.ok(adminInboxContent.includes("w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9"), "Avatar must compact cleanly on mobile/tablet");
    assert.ok(adminInboxContent.includes("setShowMobileDetailsModal(true)"), "Header must provide Visitor Info drawer button below xl breakpoint");
  });

  await t.test("4. Composer uses multiline auto-resizing textarea, shrink-0 controls, and safe-area alignment", async () => {
    assert.ok(adminInboxContent.includes("ref={replyTextareaRef}"), "Composer must use multiline textarea ref");
    assert.ok(adminInboxContent.includes("flex-1 min-w-0 bg-[#0e1621] rounded-xl"), "Composer textarea must shrink cleanly with min-w-0");
    assert.ok(adminInboxContent.includes("max-h-28 overflow-y-auto"), "Composer textarea must cap growth and scroll internally");
    assert.ok(
      adminInboxContent.includes("p-2 sm:p-3 border-t border-white/10 bg-[#17212b] space-y-1.5 sm:space-y-2 relative shrink-0 min-w-0"),
      "Composer footer must enforce shrink-0 and min-w-0"
    );
    assert.ok(adminInboxContent.includes('title="Attach file"'), "Attachment control must remain preserved");
    assert.ok(adminInboxContent.includes('title="Insert emoji"'), "Emoji picker control must remain preserved");
    assert.ok(adminInboxContent.includes('title="Send reply"'), "Send button must remain preserved");
  });

  await t.test("5. Tablet layout optimizes sidebar width and provides Visitor Details slide-over drawer", async () => {
    assert.ok(
      adminInboxContent.includes("w-full md:w-72 lg:w-88 border-r border-white/10"),
      "Sidebar must use md:w-72 on tablet portrait while preserving lg:w-88 desktop width"
    );
    assert.ok(
      adminInboxContent.includes("xl:hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex justify-end"),
      "Mobile/tablet Visitor Details must open cleanly in a slide-over drawer"
    );
    assert.ok(
      adminInboxContent.includes("hidden xl:flex w-72 lg:w-80 border-l border-white/10"),
      "Desktop 3-panel inline Visitor Details sidebar must remain unchanged at xl:"
    );
  });

  await t.test("6. Globals CSS defines compact short-viewport fallback rule for mobile & tablet landscape keyboards", async () => {
    assert.ok(
      globalsCssContent.includes("@media (max-width: 1279px) and (max-height: 540px)") &&
        globalsCssContent.includes(".inbox-keyboard-compact-header"),
      "Globals CSS must compact inbox header when short keyboard viewport triggers"
    );
  });
});
