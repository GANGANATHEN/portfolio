import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Chatbot & Live Chat Responsive Layout & Keyboard Awareness Suite", async (t) => {
  const unifiedModalPath = path.join(process.cwd(), "src/components/UnifiedChat/UnifiedChatModal.tsx");
  const botPath = path.join(process.cwd(), "src/components/Bot.tsx");
  const liveChatPath = path.join(process.cwd(), "src/components/LiveChat/LiveChatWidget.tsx");
  const emojiPickerPath = path.join(process.cwd(), "src/components/LiveChat/TelegramEmojiPicker.tsx");
  const viewerPath = path.join(process.cwd(), "src/components/LiveChat/AttachmentViewerModal.tsx");
  const viewportHookPath = path.join(process.cwd(), "src/components/UnifiedChat/useChatResponsiveViewport.ts");

  const unifiedModalContent = fs.readFileSync(unifiedModalPath, "utf-8");
  const botContent = fs.readFileSync(botPath, "utf-8");
  const liveChatContent = fs.readFileSync(liveChatPath, "utf-8");
  const emojiPickerContent = fs.readFileSync(emojiPickerPath, "utf-8");
  const viewerContent = fs.readFileSync(viewerPath, "utf-8");
  const viewportHookContent = fs.readFileSync(viewportHookPath, "utf-8");

  await t.test("1. Responsive hook tracks visualViewport, mobile detection, and keyboard height", async () => {
    assert.ok(viewportHookContent.includes("visualViewport"), "Must listen to window.visualViewport");
    assert.ok(viewportHookContent.includes("isKeyboardOpen"), "Must expose isKeyboardOpen flag");
    assert.ok(viewportHookContent.includes("keyboardHeight"), "Must calculate keyboardHeight");
    assert.ok(viewportHookContent.includes("safe-area") || viewportHookContent.includes("offsetTop"), "Must track offsetTop or safe areas");
    assert.ok(viewportHookContent.includes("window.innerWidth < 640"), "Must classify < 640px as mobile viewports");
  });

  await t.test("2. UnifiedChatModal applies dynamic viewport height, keyboard offset, and safe-area insets", async () => {
    assert.ok(unifiedModalContent.includes("useChatResponsiveViewport"), "UnifiedChatModal must use responsive viewport hook");
    assert.ok(unifiedModalContent.includes("safe-area-inset-top"), "Must respect safe-area-inset-top for notched phones");
    assert.ok(unifiedModalContent.includes("safe-area-inset-bottom"), "Must respect safe-area-inset-bottom for bottom bar / home indicator");
    assert.ok(!unifiedModalContent.includes("w-screen h-screen"), "Must not rely on rigid w-screen h-screen in fullscreen");
    assert.ok(unifiedModalContent.includes("keyboardHeight"), "Must elevate modal bottom when keyboard is open");
  });

  await t.test("3. Composer inputs in both Bot and LiveChat have min-w-0 to prevent Send button blowout", async () => {
    // Bot.tsx input must contain flex-1 min-w-0
    assert.ok(botContent.includes('className="flex-1 min-w-0'), "Chatbot composer input must include min-w-0");

    // LiveChat input must contain flex-1 min-w-0
    assert.ok(liveChatContent.includes('className="flex-1 min-w-0'), "LiveChat composer input must include min-w-0");

    // Send buttons must have shrink-0
    assert.ok(botContent.includes("shrink-0 flex items-center gap-1.5 cursor-pointer shadow-md"), "Bot Send button must have shrink-0");
    assert.ok(liveChatContent.includes("shrink-0 cursor-pointer shadow-md"), "LiveChat Send button must have shrink-0");
  });

  await t.test("4. Message bubbles have [overflow-wrap:anywhere] and break-words to wrap long strings", async () => {
    assert.ok(botContent.includes("[overflow-wrap:anywhere] break-words min-w-0"), "Bot message bubbles must support overflow-wrap: anywhere and min-w-0");
    assert.ok(liveChatContent.includes("[overflow-wrap:anywhere] break-words min-w-0"), "LiveChat message bubbles must support overflow-wrap: anywhere and min-w-0");
  });

  await t.test("5. Lenis smooth-scroll prevention applied to both wheel and touch on all message lists", async () => {
    // Bot message section
    const botSection = botContent.slice(botContent.indexOf("<section"), botContent.indexOf("</section>"));
    assert.ok(botSection.includes("data-lenis-prevent"), "Bot scroll area must have data-lenis-prevent");
    assert.ok(botSection.includes("data-lenis-prevent-touch"), "Bot scroll area must have data-lenis-prevent-touch");
    assert.ok(botSection.includes("overscroll-contain"), "Bot scroll area must have overscroll-contain");

    // LiveChat message section
    const liveChatSection = liveChatContent.slice(liveChatContent.indexOf("<section"), liveChatContent.indexOf("</section>"));
    assert.ok(liveChatSection.includes("data-lenis-prevent"), "LiveChat scroll area must have data-lenis-prevent");
    assert.ok(liveChatSection.includes("data-lenis-prevent-touch"), "LiveChat scroll area must have data-lenis-prevent-touch");
    assert.ok(liveChatSection.includes("overscroll-contain"), "LiveChat scroll area must have overscroll-contain");
  });

  await t.test("6. Fullscreen toggle preserves child DOM nodes without unmounting or resetting chat state", async () => {
    // Both Chatbot and LiveChat are mounted simultaneously in UnifiedChatModal
    assert.ok(unifiedModalContent.includes("<Chatbot isEmbedded isFullscreen={isFullscreen} />"), "Chatbot must remain mounted in UnifiedChatModal");
    assert.ok(unifiedModalContent.includes("<LiveChatWidget"), "LiveChatWidget must remain mounted in UnifiedChatModal");
    assert.ok(unifiedModalContent.includes('activeTab === "chatbot" ? "flex-1 w-full h-full flex flex-col min-h-0 min-w-0" : "hidden"'), "Chatbot tab uses hidden class to prevent state loss");
    assert.ok(unifiedModalContent.includes('activeTab === "livechat" ? "flex-1 w-full h-full flex flex-col min-h-0 min-w-0" : "hidden"'), "LiveChat tab uses hidden class to prevent state loss");
  });

  await t.test("7. Emoji picker and Attachment Viewer are constrained to narrow viewports", async () => {
    assert.ok(emojiPickerContent.includes("w-[calc(100vw-2rem)] max-w-xs sm:w-80"), "Emoji picker must be constrained on mobile viewports");
    assert.ok(emojiPickerContent.includes("data-lenis-prevent-touch"), "Emoji picker grid must prevent Lenis touch interception");
    assert.ok(viewerContent.includes("safe-area-inset-top"), "Attachment viewer modal must respect safe area insets");
  });
});
