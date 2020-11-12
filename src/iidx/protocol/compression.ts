interface decompressInput {
  compression?: string;
  data: Buffer;
}

export const decompress = (args: decompressInput): Buffer => {
  if (!args.data) {
    throw Error('No data passed');
  }

  if (args.compression) {
    if (args.compression === 'lz77') {
      console.warn('Compression not implemented');
      return args.data;
    }
    if (args.compression === 'none') {
      console.log('Received a non compressed packet');
      return args.data;
    }
    throw Error(`Unknown compression type ${args.compression}`);
  } else {
    throw Error(`Received no compression type ${args.compression}`);
  }
};
