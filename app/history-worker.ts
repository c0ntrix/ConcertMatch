import { readHistoryFiles } from "../lib/history-files";
addEventListener("message", async (event: MessageEvent<File[]>) => {
  try {
    const data = await readHistoryFiles(event.data, (progress) =>
      postMessage({ progress }),
    );
    postMessage({ data });
  } catch (error) {
    postMessage({
      error:
        error instanceof Error
          ? error.message
          : "Der Import hat nicht geklappt.",
    });
  }
});
