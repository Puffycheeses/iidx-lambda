const lz77Decompress = (data: Buffer, backref?: number): void => {
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
};

const lz77Compress = (data: Buffer, backref?: number): void => {
  const RING_LENGTH = 0x1000;
  const LOOSE_COMPRESS_THRESHOLD = 1024 * 512;
  const FLAG_COPY = 1;
  const FLAG_BACKREF = 0;

  let readPos = 0;
  let left = data.length;
  let eof = false;
  let bytesWritten = 0;
  const ringLength = backref || RING_LENGTH;
  const locations: Record<number, Set<number>> = {};
  const starts: Record<string, Set<number>> = {}; // We .toString() the buffer to get key.
  let lastStart: [number, number, number] = [0, 0, 0];

  function ringWriteStartsOnly(byteData: Buffer): void {
    for (const byte of byteData) {
      lastStart = [lastStart[1], lastStart[2], byte];
      if (bytesWritten >= 2) {
        starts[lastStart.toString()].add(bytesWritten - 2);
      }

      bytesWritten += 1;
    }
  }

  function ringWriteBoth(byteData: Buffer): void {
    for (const byte of byteData) {
      lastStart = [lastStart[1], lastStart[2], byte];
      if (bytesWritten >= 2) {
        if (starts && starts[lastStart.toString()]) {
          starts[lastStart.toString()].add(bytesWritten - 2);
        } else {
          starts[lastStart.toString()] = new Set<number>().add(bytesWritten - 2);
        }
      }

      if (locations && locations[byte]) {
        locations[byte].add(bytesWritten);
      } else {
        locations[byte] = new Set<number>().add(bytesWritten);
      }

      bytesWritten += 1;
    }
  }

  // We can safely ignore this warning since we assign directly bellow
  // eslint-disable-next-line @typescript-eslint/ban-types
  let ringWrite: Function;
  if (data.length > LOOSE_COMPRESS_THRESHOLD) {
    ringWrite = ringWriteStartsOnly;
  } else {
    ringWrite = ringWriteBoth;
  }

  function* compressBytes(): Generator<Buffer> {
    while (!eof) {
      if (left === 0) {
        eof = true;
        yield Buffer.alloc(3, 0x00);
      } else {
        let flags = 0x0;
        let flagPos = -1;
        // Idk what to name this Python examples use self. everywhere meaning vars get "duplicated".
        const smallData = Buffer.alloc(8);

        smallData.forEach(() => {
          flagPos += 1;

          if (left === 0) {
            flags |= FLAG_BACKREF << flagPos;
            smallData.fill(0x00, flagPos, flagPos + 1);
            eof = true;
          } else if (left < 3 || bytesWritten < 3) {
            flags |= FLAG_COPY << flagPos;
            const chunk = data.slice(readPos, readPos + 1);
            ringWrite(chunk);

            readPos += 1;
            left -= 1;
          }

          const backrefAmount = Math.min(left, 18);

          const earliest = Math.max(0, bytesWritten - (ringLength - 1));
          let index = data.slice(readPos, readPos + 3);
          const updatedBackrefLocations: Set<number> = starts[index.toString()]
            ? new Set(
              [...starts[index.toString()]].filter(
                (absolutePos) => absolutePos >= earliest,
              ),
            )
            : new Set();
          starts[index.toString()] = updatedBackrefLocations;
          let possibleBackrefLocations = [...updatedBackrefLocations];

          if (!possibleBackrefLocations) {
            flags |= FLAG_COPY << flagPos;

            const chunk = data.slice(readPos, readPos + 1);
            ringWrite(chunk);

            readPos += 1;
            left -= 1;
          }

          const startWriteSize = bytesWritten;
          ringWrite(index);
          let copyAmount = 3;

          while (copyAmount < backrefAmount) {
            index = data.slice(readPos + copyAmount, readPos + copyAmount + 3);
            let shadowLocations = starts[index.toString()];
            let newBackrefLocations = [...possibleBackrefLocations].filter(
              (absolutePos) => shadowLocations.has(absolutePos + copyAmount),
            );

            if (newBackrefLocations.length > 0) {
              ringWrite(index);
              copyAmount += 3;
              possibleBackrefLocations = newBackrefLocations;
            } else {
              while (copyAmount < backrefAmount) {
                shadowLocations = locations[data[readPos + copyAmount]];
                newBackrefLocations = [...possibleBackrefLocations].filter(
                  (absolutePos) => shadowLocations.has(absolutePos + copyAmount),
                );

                if (!newBackrefLocations) {
                  return;
                }

                ringWrite(data.slice(readPos + copyAmount, readPos + copyAmount + 1));
                copyAmount += 1;
                possibleBackrefLocations = newBackrefLocations;
              }
            }
          }

          const absolutePos = possibleBackrefLocations[0];
          const backrefPos = startWriteSize - absolutePos;

          const lo = (copyAmount - 3) & 0xF || ((backrefPos & 0xF) << 4);
          const hi = (backrefPos >> 4) & 0xFF;
          flags |= FLAG_BACKREF << flagPos;
          data.fill(hi, flagPos);
          data.fill(lo, flagPos + 1);
          readPos += copyAmount;
          left -= copyAmount;
        });

        yield Buffer.alloc((data.length + 1), Buffer.from([flags, ...data]));
      }
    }
  }
};
