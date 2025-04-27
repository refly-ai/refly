export async function streamToBuffer(
  stream: NodeJS.ReadableStream | null | undefined,
): Promise<Buffer> {
  // Return empty buffer if stream is null or undefined
  if (!stream) {
    return Buffer.alloc(0);
  }

  const buffers = [];

  for await (const data of stream) {
    buffers.push(data);
  }

  return Buffer.concat(buffers);
}

export async function streamToString(
  stream: NodeJS.ReadableStream | null | undefined,
): Promise<string> {
  return (await streamToBuffer(stream)).toString();
}
