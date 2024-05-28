import { Router } from 'itty-router';
import { AwsClient } from 'aws4fetch';
import jwt from '@tsndr/cloudflare-worker-jwt';

// declare let AWS_ACCESS_KEY: string;
// declare let AWS_SECRET_KEY: string;
// declare let S3_ENDPOINT: string;
// declare let S3_BUCKET: string;

// https://developers.cloudflare.com/workers/reference/apis/environment-variables/#secrets

// now let's create a router (note the lack of "new")
const router = Router();

// GET collection index
router.post('/htmlUpload', async (request, env) => {
	// Check authorization header for jwt token
	const authorization = request.headers.get('Authorization');
	if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
		return new Response('Authorization failed', { status: 401 });
	}
	const token = authorization.substring(7);
	const isValid = await jwt.verify(token, env.JWT_SECRET);
	if (!isValid) {
		return new Response('Invalid token', { status: 401 });
	}

	const formData = await request.formData();
	const file = formData.get('file');
	const data = await file.arrayBuffer();
	const hash = await sha256(new TextEncoder().encode(formData.get('url')));

	// Upload HTML file
	const objectKey = `html-upload/${hash}.html`;
	const aws = new AwsClient({ service: 's3', accessKeyId: env.AWS_ACCESS_KEY, secretAccessKey: env.AWS_SECRET_KEY });
	const uploadUrl = `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${objectKey}`;
	console.log('uploadUrl:', uploadUrl);

	const res = await aws.fetch(uploadUrl, {
		body: data,
		method: 'PUT',
		headers: {
			'Content-Type': 'application/html',
		},
	});
	const resText = await res.text();
	console.log(resText);

	return Response.json({ storageKey: objectKey }, { status: 200 });
});

router.post('/resourceUpload', async (request, env) => {
	// Check authorization header for jwt token
	const authorization = request.headers.get('Authorization');
	if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
		return new Response('Authorization failed', { status: 401 });
	}
	const token = authorization.substring(7);
	const isValid = await jwt.verify(token, env.JWT_SECRET);
	if (!isValid) {
		return new Response('Invalid token', { status: 401 });
	}

	const formData = await request.formData();
	const file = formData.get('file');
	const data = await file.arrayBuffer();
	const hash = await sha256(new TextEncoder().encode(formData.get('url')));

	// Upload HTML file
	const objectKey = `html-upload/${hash}.html`;
	const aws = new AwsClient({ service: 's3', accessKeyId: env.AWS_ACCESS_KEY, secretAccessKey: env.AWS_SECRET_KEY });
	const uploadUrl = `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${objectKey}`;
	console.log('uploadUrl:', uploadUrl);

	const res = await aws.fetch(uploadUrl, {
		body: data,
		method: 'PUT',
		headers: {
			'Content-Type': 'application/html',
		},
	});
	const resText = await res.text();
	console.log(resText);

	return Response.json({ storageKey: objectKey }, { status: 200 });
});

// 404 for everything else
router.all('*', () => new Response('Not Found.', { status: 404 }));

export default router;

async function sha256(data: ArrayBuffer) {
	const digest = await crypto.subtle.digest('SHA-256', data);
	const array = Array.from(new Uint8Array(digest));
	return array.map((b) => b.toString(16).padStart(2, '0')).join('');
}
