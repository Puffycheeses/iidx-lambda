/* eslint-disable no-bitwise */
import { createHash } from 'crypto';

export const SHARED_SECRET = Buffer.from(
  '\x69\xD7\x46\x27\xD9\x85\xEE\x21\x87\x16\x15\x70\xD0\x8D\x93\xB1\x24\x55\x03\x5B\x6D\xF0\xD8\x20\x5D\xF5',
  'ascii',
);

interface rc4cryptInput {
  data: Buffer;
  key: Buffer;
}

interface decryptInput {
  encryptionKey?: string;
  data: Buffer;
}

const rc4crypt = (args: rc4cryptInput): Buffer => {
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

  return Buffer.from(out);
};

/** @stub */
type Node = any;

export const decrypt = (args: decryptInput): Node => {
  if (!args.data) {
    throw Error('No data passed');
  }

  if (args.encryptionKey) {
    const [, first, second] = args.encryptionKey.split('-');
    const parsedKey = Buffer.concat([
      Buffer.from(first + second, 'hex'),
      SHARED_SECRET,
    ]);

    const key = createHash('md5').update(parsedKey).digest();
    return rc4crypt({ data: args.data, key });
  }
  throw Error('No encryption key provided');
};
