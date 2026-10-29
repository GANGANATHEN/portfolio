import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseClientMetadata } from "../src/lib/commands/metadata.ts";
import {
  createCommand,
  getPublicCommands,
  getAllCommandsForAdmin,
  setCommandVisibility,
  deleteCommand,
  getCommandStats,
} from "../src/lib/commands/db.ts";

describe("Commands System: Metadata, Privacy, & Administration Suite", () => {
  it("1. Metadata parser safely detects deviceType, OS, browser, and IP without invasive fingerprinting", () => {
    // Simulated mobile iOS Safari request
    const mockMobileReq = {
      headers: {
        get: (h) => {
          if (h === "user-agent")
            return "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
          if (h === "x-forwarded-for") return "203.0.113.195, 10.0.0.1";
          return null;
        },
      },
    };
    const metaMobile = parseClientMetadata(mockMobileReq);
    assert.equal(metaMobile.deviceType, "mobile");
    assert.equal(metaMobile.osFamily, "iOS");
    assert.equal(metaMobile.browserFamily, "Safari");
    assert.equal(metaMobile.ip, "203.0.113.195");
    assert.ok(metaMobile.submittedAt);

    // Simulated desktop Linux Chrome request
    const mockDesktopReq = {
      headers: {
        get: (h) => {
          if (h === "user-agent")
            return "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
          if (h === "x-real-ip") return "198.51.100.42";
          return null;
        },
      },
    };
    const metaDesktop = parseClientMetadata(mockDesktopReq);
    assert.equal(metaDesktop.deviceType, "desktop");
    assert.equal(metaDesktop.osFamily, "Linux");
    assert.equal(metaDesktop.browserFamily, "Chrome");
    assert.equal(metaDesktop.ip, "198.51.100.42");
  });

  it("2. Creating command records stores metadata, but getPublicCommands STRICTLY strips private metadata", async () => {
    const testMeta = {
      ip: "192.0.2.1",
      userAgent: "TestBrowser/1.0",
      deviceType: "desktop",
      osFamily: "macOS",
      browserFamily: "Firefox",
      submittedAt: new Date().toISOString(),
    };

    const created = await createCommand(
      {
        author_name: "Test Engineer",
        command: "git stash push -m 'wip-feature'",
        title: "Stash WIP Changes",
        category: "Git",
        description: "Quickly stash uncommitted changes",
      },
      testMeta
    );

    assert.ok(created.id);
    assert.equal(created.command, "git stash push -m 'wip-feature'");
    assert.deepEqual(created.metadata, testMeta, "Internal record must retain metadata");

    // Retrieve public commands
    const publicList = await getPublicCommands();
    const found = publicList.find((c) => c.id === created.id);
    assert.ok(found, "Newly created command must be visible in public commands");
    assert.equal(found.command, "git stash push -m 'wip-feature'");
    assert.equal(found.author_name, "Test Engineer");
    assert.equal(found.title, "Stash WIP Changes");

    // STRICT PRIVACY CHECK: metadata, is_hidden, is_deleted must NEVER exist in public object
    assert.equal(found.metadata, undefined, "Public command object must NEVER leak metadata");
    assert.equal(found.is_hidden, undefined, "Public command object must not include is_hidden");
    assert.equal(found.is_deleted, undefined, "Public command object must not include is_deleted");
  });

  it("3. Admin can retrieve all commands with full moderation metadata and accurate stats", async () => {
    const adminList = await getAllCommandsForAdmin();
    assert.ok(Array.isArray(adminList));
    assert.ok(adminList.length > 0);

    const first = adminList[0];
    assert.ok(first.id);
    assert.ok(first.command);
    assert.ok("is_hidden" in first);
    assert.ok("is_deleted" in first);

    const stats = await getCommandStats();
    assert.equal(typeof stats.total, "number");
    assert.equal(typeof stats.visible, "number");
    assert.equal(typeof stats.hidden, "number");
    assert.equal(typeof stats.deleted, "number");
    assert.equal(stats.total, stats.visible + stats.hidden + stats.deleted);
  });

  it("4. Hiding a command immediately removes it from public view while keeping it in admin list", async () => {
    const created = await createCommand({
      author_name: "Moderated Dev",
      command: "rm -rf /test/temporary/dir",
      category: "Linux",
    });

    // Verify it is public first
    let publicList = await getPublicCommands();
    assert.ok(publicList.some((c) => c.id === created.id));

    // Admin hides it
    const hideOk = await setCommandVisibility(created.id, true);
    assert.equal(hideOk, true);

    // Verify it disappeared from public view
    publicList = await getPublicCommands();
    assert.equal(publicList.some((c) => c.id === created.id), false, "Hidden command must not appear in public list");

    // Verify it remains visible in admin list with is_hidden === true
    const adminList = await getAllCommandsForAdmin();
    const adminFound = adminList.find((c) => c.id === created.id);
    assert.ok(adminFound);
    assert.equal(adminFound.is_hidden, true);

    // Admin restores it
    const restoreOk = await setCommandVisibility(created.id, false);
    assert.equal(restoreOk, true);

    // Verify it returned to public view
    publicList = await getPublicCommands();
    assert.ok(publicList.some((c) => c.id === created.id), "Restored command must reappear in public list");
  });

  it("5. Soft deleting a command removes it from public listing and marks it deleted in admin stats", async () => {
    const created = await createCommand({
      author_name: "Temporary Contributor",
      command: "docker container prune -f",
      category: "Docker",
    });

    const deleteOk = await deleteCommand(created.id);
    assert.equal(deleteOk, true);

    // Must be gone from public list
    const publicList = await getPublicCommands();
    assert.equal(publicList.some((c) => c.id === created.id), false, "Deleted command must not appear in public list");

    // Must be marked is_deleted in admin list
    const adminList = await getAllCommandsForAdmin();
    const adminFound = adminList.find((c) => c.id === created.id);
    assert.ok(adminFound);
    assert.equal(adminFound.is_deleted, true);
  });
});

