// Shared streaming response reader.
// Used by both course creation and message sending to avoid duplicating
// the ReadableStream reader/decoder loop.

export async function readStream(
  response: Response,
  onChunk: (fullText: string) => void
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No reader");

  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fullText += decoder.decode(value);
    onChunk(fullText);
  }

  return fullText;
}
