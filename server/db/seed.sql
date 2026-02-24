INSERT INTO users (email, password, name, role)
VALUES
  ('admin@panel.local', '$2a$10$IxpTqQqQ.VbmfjGA5Y5IUOYEjgpi10LjwDfMGm5AXiOap6mB59ihq', 'Admin', 'ADMIN'),
  ('demo@panel.local', '$2a$10$ZnxdhPDca0FvGx3Ujg6l..Qmm0usoMyan4ESpDej4x3Degt57ZbhO', 'Demo', 'USER')
ON CONFLICT (email) DO NOTHING;
