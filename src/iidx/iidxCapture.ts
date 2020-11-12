import { APIGatewayEvent, Context } from 'aws-lambda';
import { Segment } from 'aws-xray-sdk-core';
import { decode } from './protocol/protocol';

export const handler = async (
  event: APIGatewayEvent,
  context: Context,
): Promise<void> => {
  const segment = new Segment('hello.handler');
  try {
    if (event.headers['X-Compress'] !== 'none') {
      throw Error('Compression Not Implemented');
    }

    // This doesnt implement the XML step? maybe thats why its broke?
    // https://github.com/DragonMinded/bemaniutils/blob/7fcca97ae46ed344c9552fc5f4728eba5b8a3695/bemani/protocol/protocol.py#L179
    const decodeBody = decode({
      data: (event.body as unknown) as Buffer,
      encryption: event.headers['X-Eamuse-Info'],
      compression: event.headers['X-Compress'],
    });

    console.log(decodeBody);

    return;

    // Yeah we know we cant reach this but its good
    // practice to keep error handling in all our functions!
    // eslint-disable-next-line no-unreachable
  } catch (err) {
    segment.addError(err);
    throw new Error(err);
  } finally {
    segment.close();
  }
};

// INIT BODY
