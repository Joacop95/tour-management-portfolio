import { expect, test } from "@playwright/test"

import {
  canApplyAccessRefresh,
  getAccessRefreshDisposition,
} from "../lib/auth/current-user-access-refresh"

test("allows the first authenticated refresh to establish its user", () => {
  expect(canApplyAccessRefresh({
    expectedUserId: null,
    activeSessionUserId: "user-a",
    refreshedUserId: "user-a",
  })).toBe(true)
})

test("allows an unauthenticated refresh when no user was established", () => {
  expect(canApplyAccessRefresh({
    expectedUserId: null,
    activeSessionUserId: null,
    refreshedUserId: null,
  })).toBe(true)
})

test("keeps a refresh for the established active user", () => {
  expect(canApplyAccessRefresh({
    expectedUserId: "user-a",
    activeSessionUserId: "user-a",
    refreshedUserId: "user-a",
  })).toBe(true)
})

test("rejects a stale first result after the active session changes", () => {
  expect(canApplyAccessRefresh({
    expectedUserId: null,
    activeSessionUserId: "user-b",
    refreshedUserId: "user-a",
  })).toBe(false)
})

test("rejects a different account when a user was already established", () => {
  expect(canApplyAccessRefresh({
    expectedUserId: "user-a",
    activeSessionUserId: "user-b",
    refreshedUserId: "user-b",
  })).toBe(false)
})

test("rejects an old result after logout", () => {
  expect(canApplyAccessRefresh({
    expectedUserId: "user-a",
    activeSessionUserId: null,
    refreshedUserId: "user-a",
  })).toBe(false)
})

test("returns but does not apply a valid first result superseded by sign-in refresh", () => {
  expect(getAccessRefreshDisposition({
    requestId: 1,
    latestRequestId: 2,
    expectedUserId: null,
    activeSessionUserId: "user-a",
    refreshedUserId: "user-a",
  })).toBe("return-only")
})

test("rejects a superseded result from a different active account", () => {
  expect(getAccessRefreshDisposition({
    requestId: 1,
    latestRequestId: 2,
    expectedUserId: null,
    activeSessionUserId: "user-b",
    refreshedUserId: "user-a",
  })).toBe("reject")
})
