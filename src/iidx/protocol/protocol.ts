import { unpack } from 'python-struct';
import { decompress } from './compression';
import { decrypt } from './encyption';

interface DecodeInput {
  compression?: string;
  encryption?: string;
  data: Buffer;
}

export const decode = (args: DecodeInput): Buffer => {
  console.log(`
    Received decode request
    compression: [${args.compression}]
    encryption: [${args.encryption}]
  `);

  const decryptData = decrypt({
    encryptionKey: args.encryption,
    data: args.data,
  });
  const decompressData = decompress({
    data: decryptData,
    compression: args.compression,
  });
  return unpack('>L', Buffer.from(decompressData));
};
