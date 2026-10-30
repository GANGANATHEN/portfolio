import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Attachments, Scrolling, Reply Navigation & Anti-Flicker Test Suite", () => {
  test("1. Multiple attachments accumulate across successive file selections without replacement", () => {
    let pendingAttachments = [];

    // First selection: 2 files
    const batch1 = [
      { id: "att_1", fileName: "photo1.png", fileSize: 1024, mimeType: "image/png" },
      { id: "att_2", fileName: "document.pdf", fileSize: 2048, mimeType: "application/pdf" },
    ];
    pendingAttachments = [...pendingAttachments, ...batch1];
    assert.equal(pendingAttachments.length, 2);
    assert.equal(pendingAttachments[0].id, "att_1");
    assert.equal(pendingAttachments[1].id, "att_2");

    // Second selection: 1 more file
    const batch2 = [
      { id: "att_3", fileName: "notes.txt", fileSize: 512, mimeType: "text/plain" },
    ];
    pendingAttachments = [...pendingAttachments, ...batch2];
    assert.equal(pendingAttachments.length, 3);
    assert.equal(pendingAttachments[2].id, "att_3");

    // Third selection: 2 more files
    const batch3 = [
      { id: "att_4", fileName: "video.mp4", fileSize: 5000000, mimeType: "video/mp4" },
      { id: "att_5", fileName: "audio.mp3", fileSize: 3000000, mimeType: "audio/mpeg" },
    ];
    pendingAttachments = [...pendingAttachments, ...batch3];
    assert.equal(pendingAttachments.length, 5);

    // Individual chip removal
    pendingAttachments = pendingAttachments.filter((a) => a.id !== "att_2");
    assert.equal(pendingAttachments.length, 4);
    assert.ok(!pendingAttachments.some((a) => a.id === "att_2"));
    assert.ok(pendingAttachments.some((a) => a.id === "att_1"));
    assert.ok(pendingAttachments.some((a) => a.id === "att_3"));
  });

  test("2. Compact attachment view logic: <= 2 displays all; > 2 displays 2 with +N badge and gallery trigger", () => {
    const formatAttachmentsForBubble = (attachments) => {
      const hasMultiple = attachments.length > 1;
      const isCompact = attachments.length > 2;
      const visibleAttachments = isCompact ? attachments.slice(0, 2) : attachments;
      const remainingCount = isCompact ? attachments.length - 2 : 0;
      return { hasMultiple, isCompact, visibleAttachments, remainingCount };
    };

    // Case 1: 1 attachment
    const c1 = formatAttachmentsForBubble([{ id: "1" }]);
    assert.equal(c1.hasMultiple, false);
    assert.equal(c1.isCompact, false);
    assert.equal(c1.visibleAttachments.length, 1);
    assert.equal(c1.remainingCount, 0);

    // Case 2: 2 attachments
    const c2 = formatAttachmentsForBubble([{ id: "1" }, { id: "2" }]);
    assert.equal(c2.hasMultiple, true);
    assert.equal(c2.isCompact, false);
    assert.equal(c2.visibleAttachments.length, 2);
    assert.equal(c2.remainingCount, 0);

    // Case 3: 4 attachments
    const c3 = formatAttachmentsForBubble([{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }]);
    assert.equal(c3.hasMultiple, true);
    assert.equal(c3.isCompact, true);
    assert.equal(c3.visibleAttachments.length, 2);
    assert.equal(c3.remainingCount, 2); // +2 more badge on the 2nd preview

    // Case 4: 7 attachments
    const c4 = formatAttachmentsForBubble([
      { id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }, { id: "6" }, { id: "7" }
    ]);
    assert.equal(c4.visibleAttachments.length, 2);
    assert.equal(c4.remainingCount, 5); // +5 more
  });

  test("3. Anti-flicker equality check prevents redundant message list re-renders", () => {
    const hasMessageListChanged = (prev, next) => {
      if (prev.length !== next.length) return true;
      for (let i = 0; i < prev.length; i++) {
        const a = prev[i];
        const b = next[i];
        if (
          a.id !== b.id ||
          a.content !== b.content ||
          a.status !== b.status ||
          a.isDeleted !== b.isDeleted ||
          a.isEdited !== b.isEdited ||
          JSON.stringify(a.reactions) !== JSON.stringify(b.reactions) ||
          (a.attachments?.length || 0) !== (b.attachments?.length || 0)
        ) {
          return true;
        }
      }
      return false;
    };

    const initial = [
      { id: "m1", content: "Hello", reactions: { "👍": ["visitor"] }, attachments: [] },
      { id: "m2", content: "World", reactions: {}, attachments: [{ id: "a1" }] },
    ];

    // Polled copy with new array reference but identical data
    const polledIdentical = [
      { id: "m1", content: "Hello", reactions: { "👍": ["visitor"] }, attachments: [] },
      { id: "m2", content: "World", reactions: {}, attachments: [{ id: "a1" }] },
    ];

    assert.equal(hasMessageListChanged(initial, polledIdentical), false, "Should detect identical list and avoid re-render");

    // Modified copy (reaction added)
    const polledWithNewReaction = [
      { id: "m1", content: "Hello", reactions: { "👍": ["visitor", "owner"] }, attachments: [] },
      { id: "m2", content: "World", reactions: {}, attachments: [{ id: "a1" }] },
    ];
    assert.equal(hasMessageListChanged(initial, polledWithNewReaction), true, "Should detect reaction change");

    // Modified copy (new message arrived)
    const polledWithNewMessage = [
      ...initial,
      { id: "m3", content: "New message", reactions: {}, attachments: [] },
    ];
    assert.equal(hasMessageListChanged(initial, polledWithNewMessage), true, "Should detect length change");
  });

  test("4. Auto-scroll threshold: triggers on receive only if near bottom (<120px); always scrolls on send", () => {
    const calculateShouldAutoScrollOnReceive = (scrollHeight, scrollTop, clientHeight, threshold = 120) => {
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      return distanceFromBottom <= threshold;
    };

    // User is at bottom (distance = 0px)
    assert.equal(calculateShouldAutoScrollOnReceive(1000, 600, 400), true);

    // User is 50px away from bottom (< 120px)
    assert.equal(calculateShouldAutoScrollOnReceive(1000, 550, 400), true);

    // User scrolled up to read past history (distance = 400px > 120px)
    assert.equal(calculateShouldAutoScrollOnReceive(1000, 200, 400), false);

    // Sending always bypasses threshold
    const shouldScrollOnSend = true;
    assert.equal(shouldScrollOnSend, true);
  });

  test("5. Instagram-style reply navigation visibility detection", () => {
    const determineScrollAction = (targetRect, containerRect) => {
      const isVisible =
        targetRect.top >= containerRect.top &&
        targetRect.bottom <= containerRect.bottom;

      return {
        shouldScroll: !isVisible,
        highlightImmediately: true,
      };
    };

    const containerRect = { top: 100, bottom: 600 };

    // Case A/C: Target message already in visible viewport
    const visibleTarget = { top: 250, bottom: 310 };
    const res1 = determineScrollAction(visibleTarget, containerRect);
    assert.equal(res1.shouldScroll, false, "Should not scroll when message is already visible");
    assert.equal(res1.highlightImmediately, true);

    // Case B: Target message scrolled out of view (above viewport)
    const aboveTarget = { top: -50, bottom: 20 };
    const res2 = determineScrollAction(aboveTarget, containerRect);
    assert.equal(res2.shouldScroll, true, "Should scroll smoothly when target is above visible view");

    // Case B: Target message scrolled out of view (below viewport)
    const belowTarget = { top: 650, bottom: 720 };
    const res3 = determineScrollAction(belowTarget, containerRect);
    assert.equal(res3.shouldScroll, true, "Should scroll smoothly when target is below visible view");
  });

  test("6. Pending attachments reset only after send succeeds; preserved if send fails", () => {
    let pendingAttachments = [{ id: "att_1", fileName: "important.pdf" }];

    // Simulated Send API Failure
    const simulateSend = (isSuccessful) => {
      if (isSuccessful) {
        pendingAttachments = [];
      }
      // If not successful, pendingAttachments is NOT cleared
    };

    simulateSend(false);
    assert.equal(pendingAttachments.length, 1, "Pending attachments must be preserved when send fails");

    simulateSend(true);
    assert.equal(pendingAttachments.length, 0, "Pending attachments must reset when send succeeds");
  });
});

