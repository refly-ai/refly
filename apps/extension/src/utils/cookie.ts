import { UID_COOKIE } from '@refly/utils/cookie';
import { getClientOrigin } from '@refly/utils/url';
import { browser } from 'wxt/browser';

export async function getCookie() {
  try {
    const res = await browser.cookies?.get({
      name: UID_COOKIE,
      url: getClientOrigin(),
    });

    if (!res?.value) {
      throw new Error('user not auth');
    }

    return res.value;
  } catch (err) {
    console.log('err', err);
  }
}
