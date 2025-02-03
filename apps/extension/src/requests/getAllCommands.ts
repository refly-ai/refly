import type { HandlerRequest, HandlerResponse } from '@refly/common-types';

const handler = async (
  req: HandlerRequest<null>,
): Promise<HandlerResponse<chrome.commands.Command[]>> => {
  console.log(req?.body);

  try {
    const commands = (await chrome.commands.getAll()) || [];
    return {
      success: true,
      data: commands,
    };
  } catch (_err) {
    return {
      success: false,
    };
  }
};

export default handler;
