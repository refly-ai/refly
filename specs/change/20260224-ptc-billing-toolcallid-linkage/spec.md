---
id: 20260224-ptc-billing-toolcallid-linkage
name: Ptc Billing Toolcallid Linkage
status: implemented
created: '2026-02-24'
---

## Overview

Fix the PTC (Programmatic Tool Calling) billing tracking system by establishing proper linkage between tool calls and credit usage records. Previously, tool call results and credit usage records were not correlated, making it impossible to trace billing for specific tool executions.

## Design

### Approach

Propagate `toolCallId` through the entire tool execution pipeline — from the LangChain run manager all the way to the credit usage log — so each billing record can be associated with the exact tool call that triggered it.

### Key files

- `billing.dto.ts`: Add `toolCallId` field to the billing DTO
- `billing.service.ts`: Pass `toolCallId` into credit recording
- `credit.service.ts`: Store `toolCallId` and `toolCallMeta` in usage logs
- `composio.service.ts`: Extract `toolCallId` from LangChain `runManager`
- `tool-execution.service.ts`: Extend billing support to all tool types (composio OAuth/API key, config-based, legacy SDK)
- `tool-identify.service.ts`: Add `isGlobal` flag for proper global toolset identification
- `handler-post.ts`: Pass `toolCallId` through to billing service
- `composio-post.service.ts`: Track `toolCallId` for billing correlation
- `post.interface.ts`: Add `toolCallId` to post-execution interface

## Plan

- [x] Add `toolCallId` field to `billing.dto.ts`
- [x] Update `credit.service.ts` to record `toolCallId` and `toolCallMeta`
- [x] Update `billing.service.ts` to pass `toolCallId` downstream
- [x] Extract `toolCallId` from `runManager` in `composio.service.ts`
- [x] Extend `tool-execution.service.ts` to support billing for all tool types
- [x] Add `isGlobal` flag in `tool-identify.service.ts`
- [x] Pass `toolCallId` in `handler-post.ts`
- [x] Track `toolCallId` in `composio-post.service.ts`
- [x] Add `toolCallId` to `post.interface.ts`

## Notes

Linear issue: REF-1454
