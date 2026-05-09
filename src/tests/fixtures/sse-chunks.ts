/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-streaming-sse — Task 1.2: Mock SSE fixtures for adapter tests.
 *
 * Three scenarios:
 *   - happy-5-chunks: 5 valid OpenAI-style data chunks + [DONE]
 *   - abort-mid-stream: stream that can be cancelled by AbortController
 *   - server-error-mid-stream: HTTP 500 response with error body
 */

export type SseScenario = "happy-5-chunks" | "abort-mid-stream" | "server-error-mid-stream";

type FetchLike = (url: string, opts?: RequestInit) => Promise<Response>;

function sseChunk(index: number): string {
  const json = JSON.stringify({
    choices: [{ delta: { content: `token-${index}` } }],
  });
  return `data: ${json}\n\n`;
}

function encodeChunk(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function makeHappyStream(): ReadableStream<Uint8Array> {
  const chunks = [1, 2, 3, 4, 5].map(sseChunk);
  chunks.push("data: [DONE]\n\n");
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encodeChunk(chunks[index++]!));
      } else {
        controller.close();
      }
    },
  });
}

function makeAbortableStream(signal?: AbortSignal): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (signal?.aborted) {
        controller.close();
        return;
      }
      const text = sseChunk(index + 1);
      controller.enqueue(encodeChunk(text));
      index++;
    },
    cancel() {
      // Intentionally empty — clean cancellation, no error thrown
    },
  });
}

export function mockSseFetch(scenario: SseScenario): FetchLike {
  return async (_url: string, opts?: RequestInit): Promise<Response> => {
    switch (scenario) {
      case "happy-5-chunks":
        return new Response(makeHappyStream(), {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });

      case "abort-mid-stream": {
        const signal = opts?.signal ?? undefined;
        return new Response(makeAbortableStream(signal), {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }

      case "server-error-mid-stream":
        return new Response("Internal Server Error (simulated at chunk 3)", {
          status: 500,
          headers: { "content-type": "text/plain" },
        });
    }
  };
}
