-- Delete existing users first to avoid conflicts
DELETE FROM "refly"."users" WHERE email = 'test@example.com';

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
  "has_beta_access"
) VALUES (
  'u-test123',
  'test',
  'test',
  'test@example.com',
  NOW(),
  '$argon2id$v=19$m=65536,t=3,p=4$GhY9EAq88W0nPOqqVrMq0Q$/KGzePjSRHgw22DpXKu9ZH1+/Jb/SodCm/fVdttU79U',
  NOW(),
  NOW(),
  't'
);