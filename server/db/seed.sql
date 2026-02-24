INSERT INTO users (email, password_hash, role, name)
VALUES ('admin@panel.local', '$2a$10$IxH11VZQm7.rZJrNKa0xkO0N3hZjvN3Iv3pH0kFsGZQ8j4y5H1XBu', 'ADMIN', 'Admin');

INSERT INTO vm_plans (name, description, cpu, ram_mb, disk_gb, bandwidth_gb, price_monthly, type)
VALUES
('LXC S-1', 'Entrée de gamme', 1, 1024, 20, 1000, 4.99, 'LXC'),
('LXC S-2', 'Équilibré', 2, 2048, 40, 2000, 8.99, 'LXC'),
('LXC S-3', 'Performance', 4, 4096, 80, 3000, 14.99, 'LXC');

INSERT INTO game_plans (name, description, game, cpu, ram_mb, disk_mb, databases, backups, price_monthly,
  ptero_egg_id, ptero_allocation_id, ptero_docker_image, ptero_startup, ptero_env_json, ptero_limits_json, ptero_feature_limits_json)
VALUES
('Minecraft S', 'Pour 5-10 joueurs', 'minecraft', 200, 2048, 20480, 1, 1, 9.99,
  1, 1, 'ghcr.io/pterodactyl/yolks:java_17', 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar',
  '{"EULA":"TRUE"}', '{"memory":2048,"swap":0,"disk":20480,"io":500,"cpu":200}', '{"databases":1,"backups":1,"allocations":1}');
