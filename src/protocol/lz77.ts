export const lz77Decompress = (data: Buffer, backref?: number): Generator<Buffer> => {
  const RING_LENGTH = 0x1000;
  const FLAG_COPY = 1;
  const FLAG_BACKREF = 0;

  let eof = false;
  let readPos = 0;
  let left = data.length;
  let flags = 1;
  const writePos = 0;
  let pendingCopyAmount = 0;
  let pendingCopyPos = 0;
  let pendingCopyMax = 0;
  const ringLength = backref || RING_LENGTH;
  const ring: Buffer = Buffer.alloc(ringLength, 0x00);

  const ringWrite = (byteData: Buffer): void => {
    while (true) {
      let amount = byteData.length;
      if (amount === 0) {
        return;
      }
      if (amount > ringLength - writePos) {
        amount = ringLength - writePos;
      }

      ring.fill(byteData.slice(0, amount), writePos);
    }
  };

  function* ringRead(copyPos: number, copyLen: number): Generator<Buffer> {
    let amount;

    while (copyLen > 0) {
      if (copyPos + copyLen > ringLength) {
        amount = ringLength - copyPos;
      } else {
        amount = copyLen;
      }

      const ret = ring.slice(copyPos, (copyPos + amount));
      ringWrite(ret);

      yield ret;

      copyPos = (copyPos + amount) % ringLength;
      copyLen -= amount;
    }
  }

  function* readBackref(): Generator<Buffer> {
    if (left === 0) {
      eof = true;
      return;
    }
    if (left === 1) {
      throw new Error('Unexpected EOF mid-backref');
    }

    const hi = data[readPos];
    const lo = data[readPos + 1];
    readPos += 2;
    left -= 2;

    let copyLen = lo & 0xF;
    let copyPos = (hi << 4) | (lo >> 4);

    if (copyPos > 0) {
      copyLen += 3;
      if (copyLen > copyPos) {
        pendingCopyAmount = copyLen - copyPos;
        pendingCopyPos = writePos;
        pendingCopyMax = copyPos;

        copyLen = copyPos;
      }

      copyPos = writePos - copyPos;
      while (copyPos < 0) {
        copyPos += ringLength;
      }
      copyPos %= ringLength;
      yield* ringRead(copyPos, copyLen);
    } else {
      eof = true;
    }
  }

  function* decompressBytes(): Generator<Buffer> {
    let amount;
    while (!eof) {
      if (pendingCopyAmount > 0) {
        amount = Math.min(pendingCopyAmount, pendingCopyMax);
        yield* ringRead(pendingCopyPos, amount);

        pendingCopyAmount -= amount;
        pendingCopyMax = amount;
      } else if (flags === 1) {
        if (left === 0) {
          return;
        }
        flags = 0x100 | data[readPos];
        readPos += 1;
        left -= 1;
      }

      const flag = flags & 1;
      flags >>= 1;

      if (flag === FLAG_COPY) {
        amount = 1;
        while (flags !== 1 && (flags & 1) === FLAG_COPY) {
          flags >>= 1;
          amount += 1;
        }

        const b = data.slice(readPos, readPos + amount);
        ringWrite(b);
        yield b;

        readPos += amount;
        left -= amount;
      } else if (flag === FLAG_BACKREF) {
        yield* readBackref();
      } else {
        throw new Error('Logic error!');
      }
    }
  }

  return decompressBytes();
};
