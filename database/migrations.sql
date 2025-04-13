-- Middlewares table stores middleware definitions
CREATE TABLE IF NOT EXISTS middlewares (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Resources table stores Pangolin resources
CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY,
    host TEXT NOT NULL,
    service_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    site_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Resource_middlewares table stores the relationship between resources and middlewares
CREATE TABLE IF NOT EXISTS resource_middlewares (
    resource_id TEXT NOT NULL,
    middleware_id TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (resource_id, middleware_id),
    FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
    FOREIGN KEY (middleware_id) REFERENCES middlewares(id) ON DELETE CASCADE
);

-- Insert default middlewares
INSERT OR IGNORE INTO middlewares (id, name, type, config) VALUES 
('authelia', 'Authelia', 'forwardAuth', '{"address":"http://authelia:9091/api/verify?rd=https://auth.yourdomain.com","trustForwardHeader":true,"authResponseHeaders":["Remote-User","Remote-Groups","Remote-Name","Remote-Email"]}'),
('authentik', 'Authentik', 'forwardAuth', '{"address":"http://authentik:9000/outpost.goauthentik.io/auth/traefik","trustForwardHeader":true,"authResponseHeaders":["X-authentik-username","X-authentik-groups","X-authentik-email","X-authentik-name","X-authentik-uid"]}'),
('basic-auth', 'Basic Auth', 'basicAuth', '{"users":["admin:$apr1$H6uskkkW$IgXLP6ewTrSuBkTrqE8wj/"]}');