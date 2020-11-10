import { Segment } from 'aws-xray-sdk-core';
import { APIGatewayEvent, Context } from 'aws-lambda';

interface APIGatewayJSONResponse {
  statusCode: number;
  body: string;
}

interface BodyObject {
  event: APIGatewayEvent;
  context: Context;
  message: string;
}

export const handler = async (
  event: APIGatewayEvent,
  context: Context,
): Promise<APIGatewayJSONResponse> => {
  const segment = new Segment('hello.handler');
  try {
    const body: BodyObject = { event, context, message: 'Hello World!' };

    return {
      statusCode: 200,
      body: JSON.stringify(body),
    };

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
