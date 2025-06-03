const fs = require('fs');
const path = require('path');

// Read and parse .env file manually
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

// Parse environment variables
const envVars = {};
envContent.split('\n').forEach(line => {
  const trimmedLine = line.trim();
  if (trimmedLine && !trimmedLine.startsWith('#')) {
    const [key, ...valueParts] = trimmedLine.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
});

console.log('=== Langfuse Configuration Test ===');
console.log('LANGFUSE_SECRET_KEY:', envVars.LANGFUSE_SECRET_KEY ? '✓ Set' : '✗ Not set');
console.log('LANGFUSE_PUBLIC_KEY:', envVars.LANGFUSE_PUBLIC_KEY ? '✓ Set' : '✗ Not set');
console.log('LANGFUSE_HOST:', envVars.LANGFUSE_HOST || 'Not set');
console.log('LANGFUSE_ENABLED:', envVars.LANGFUSE_ENABLED || 'Not set');
console.log('LANGFUSE_FLUSH_AT:', envVars.LANGFUSE_FLUSH_AT || 'Not set');
console.log('LANGFUSE_FLUSH_INTERVAL:', envVars.LANGFUSE_FLUSH_INTERVAL || 'Not set');
console.log('LANGFUSE_REQUEST_TIMEOUT:', envVars.LANGFUSE_REQUEST_TIMEOUT || 'Not set');
console.log('LANGFUSE_SENSITIVE_KEYS:', envVars.LANGFUSE_SENSITIVE_KEYS || 'Not set');
console.log('LANGFUSE_MAX_STRING_LENGTH:', envVars.LANGFUSE_MAX_STRING_LENGTH || 'Not set');
console.log('LANGFUSE_ENABLE_DATA_MASKING:', envVars.LANGFUSE_ENABLE_DATA_MASKING || 'Not set');

console.log('\n=== Configuration Summary ===');
const hasRequiredKeys = envVars.LANGFUSE_SECRET_KEY && envVars.LANGFUSE_PUBLIC_KEY;
console.log('Required keys present:', hasRequiredKeys ? '✓ Yes' : '✗ No');
console.log('Host configured:', envVars.LANGFUSE_HOST ? '✓ Yes' : '✗ No');
console.log('Ready for Langfuse:', hasRequiredKeys && envVars.LANGFUSE_HOST ? '✓ Yes' : '✗ No');

if (hasRequiredKeys && envVars.LANGFUSE_HOST) {
  console.log('\n✅ Langfuse configuration is complete and ready to use!');
} else {
  console.log('\n❌ Langfuse configuration is incomplete. Please check your .env file.');
} 