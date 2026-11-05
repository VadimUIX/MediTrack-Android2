import assert from "node:assert/strict";
import test from "node:test";
import { runPreSignInSignOut, runSignOut } from "./sign-out-plan.mjs";

test("preview sign-out clears its bearer even when the request fails", async () => {
  let cleared = false;
  await runPreSignInSignOut({
    livePreview: true,
    hasBearer: true,
    requestSignOut: async () => {
      throw new Error("preview request failed");
    },
    clearToken: () => {
      cleared = true;
    },
  });
  assert.equal(cleared, true);
});

test("deployed sign-out does not clear or redirect when the server rejects", async () => {
  let cleared = false;
  let redirected = false;
  await assert.rejects(
    runSignOut({
      livePreview: false,
      hasBearer: false,
      requestSignOut: async () => {
        throw new Error("server sign-out failed");
      },
      clearToken: () => {
        cleared = true;
      },
      redirect: () => {
        redirected = true;
      },
    }),
    /server sign-out failed/,
  );
  assert.equal(cleared, false);
  assert.equal(redirected, false);
});

test("preview sign-out clears the bearer and redirects", async () => {
  let cleared = false;
  let redirected = false;
  await runSignOut({
    livePreview: true,
    hasBearer: true,
    requestSignOut: async () => {
      throw new Error("preview request failed");
    },
    clearToken: () => {
      cleared = true;
    },
    redirect: () => {
      redirected = true;
    },
  });
  assert.equal(cleared, true);
  assert.equal(redirected, true);
});

test("preview without a bearer skips the network sign-out", async () => {
  let requested = false;
  await runPreSignInSignOut({
    livePreview: true,
    hasBearer: false,
    requestSignOut: async () => {
      requested = true;
    },
    clearToken: () => undefined,
  });
  assert.equal(requested, false);
});
