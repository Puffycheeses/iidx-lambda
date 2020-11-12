/* eslint-disable no-bitwise */
import { createHash } from 'crypto';

interface rc4cryptInput {
  data: Buffer;
  key: Buffer;
}

const SHARED_SECRET = Buffer.from(
  '\x69\xD7\x46\x27\xD9\x85\xEE\x21\x87\x16\x15\x70\xD0\x8D\x93\xB1\x24\x55\x03\x5B\x6D\xF0\xD8\x20\x5D\xF5',
  'ascii',
);

const rc4crypt = (args: rc4cryptInput): any => {
  const S: number[] = Array.from(Array(256).keys());
  let j = 0;
  const out: number[] = [];
  let i: number;

  // KSA Phase
  for (i = 0; i < 256; i += 1) {
    j = (j + S[i] + args.key[i % args.key.length]) & 0xff;
    const tmp = S[i];
    S[i] = S[j];
    S[j] = tmp;
  }

  // PRGA Phase
  i = 0;
  j = 0;

  Array.prototype.slice.call(args.data, 0).forEach((char) => {
    i = (i + 1) & 0xff;
    j = (j + S[i]) & 0xff;
    const tmp = S[i];
    S[i] = S[j];
    S[j] = tmp;

    out.push(char ^ S[(S[i] + S[j]) & 0xff]);
  });

  return out;
};

interface decryptInput {
  encryptionKey?: string;
  data: Buffer;
}

const decrypt = (args: decryptInput): Buffer => {
  if (!args.data) {
    throw Error('No data passed');
  }

  if (args.encryptionKey) {
    const [version, first, second] = args.encryptionKey.split('-');
    const parsedKey = Buffer.concat([
      Buffer.from(first + second, 'hex'),
      SHARED_SECRET,
    ]);

    const key = createHash('md5').update(parsedKey).digest();
    return rc4crypt({ data: args.data, key });
  }
  return args.data;
};
interface decompressInput {
  compression?: string;
  data: Buffer;
}

const decompress = (args: decompressInput) => {
  if (!args.data) {
    throw Error('No data passed');
  }

  if (args.compression) {
    if (args.compression === 'lz77') {
      return args.data;
    }
    throw Error(`Unknown compression type ${args.compression}`);
  } else {
    return args.data;
  }
};

interface DecodeInput {
  compression?: string;
  encryption?: string;
  data: Buffer;
}

export const decode = (args: DecodeInput): Buffer => {
  const decryptData = decrypt({
    encryptionKey: args.encryption,
    data: args.data,
  });
  return decompress({ data: decryptData });
};
