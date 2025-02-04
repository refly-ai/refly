-- Delete automated test users first to avoid conflicts
DELETE FROM "refly"."users" WHERE uid LIKE 'u-at-%';
DELETE FROM "refly"."accounts" WHERE uid LIKE 'u-at-%';

-- Insert test user with correct password hash
-- Password: testPassword123
INSERT INTO "refly"."users" (
  "uid", 
  "name", 
  "nickname", 
  "email", 
  "email_verified", 
  "password",
  "created_at", 
  "updated_at", 
  "has_beta_access",
  "onboarding",
  "preferences"
) VALUES (
  'u-at-1000',
  'alice',
  'alice',
  'alice@example.com',
  NOW(),
  '$argon2id$v=19$m=65536,t=3,p=4$GhY9EAq88W0nPOqqVrMq0Q$/KGzePjSRHgw22DpXKu9ZH1+/Jb/SodCm/fVdttU79U',
  NOW(),
  NOW(),
  't',
  '{}',
  '{}'
), (
  'u-at-1001',
  'bob',
  'bob',
  'bob@example.com',
  NOW(),
  '$argon2id$v=19$m=65536,t=3,p=4$GhY9EAq88W0nPOqqVrMq0Q$/KGzePjSRHgw22DpXKu9ZH1+/Jb/SodCm/fVdttU79U',
  NOW(),
  NOW(),
  't',
  '{"settings":"skipped","tour":"skipped"}',
  '{}'
);