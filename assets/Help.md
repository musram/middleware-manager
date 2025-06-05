 curl -c cookies.txt -v -H "Accept: application/json" http://localhost:3002/api/v1/

 Get the CSRF
 ``` bash
 curl -c cookies.txt -b cookies.txt -v http://localhost:3002/api/v1/csrf-token
 ```

Pass CSRF Token in Next Request:
Once you have the token (say it's csrf_token_value), you need to include it in the headers of the next request:
 ```bash
 curl -c cookies.txt -b cookies.txt -X POST -H "X-CSRF-Token: csrf_token_value" -v http://localhost:3002/api/v1/sessions
```



Check the netwrok
```bash
docker inspect traefik | grep -A 5 "Networks"
```

Look for acme , certificate errors

```bash
docker-compose logs traefik | grep -i "acme\|certificate\|error"
```

To check correctly serving the Let's Encrypt cert:

```bash
openssl s_client -connect mcp.api.deepalign.ai:443 -servername mcp.api.deepalign.ai
```

1. Check Traefik Dashboard
```bash
curl -I http://mcp.api.deepalign.ai:8080/dashboard/
```

2. Check Traefik’s HTTP to HTTPS Redirect
```bash
curl -I http://mcp.api.deepalign.ai
```

3. Check HTTPS with ACME Certificate
```bash
curl -v https://mcp.api.deepalign.ai --resolve mcp.api.deepalign.ai:443:<your_host_ip>
```

4.  Test Pangolin Next.js App (non-API routes)
```bash
curl -I https://mcp.api.deepalign.ai/
```
5. Test Pangolin API Endpoint
```bash
curl -X GET https://mcp.api.deepalign.ai/api/v1/status
```
6. Test ForwardAuth Middleware (MCP Auth)
```bash
curl -I -H "Cookie: session=abc123" https://mcp.api.deepalign.ai/dashboard
```
7. Check Middleware Manager Health
```bash
curl http://localhost:3456/health
```
8.  Traefik reverse proxies it (not in your current config), us
```bash
curl http://mcp.api.deepalign.ai:3456/health
```
9. Test Pangolin Admin Login (basic auth)
```bash
curl -u admin@example.com:Password123! http://localhost:3001/api/v1/resources
```
10. Check if Certs are Being Issued
```bash
curl https://mcp.api.deepalign.ai/.well-known/acme-challenge/test
```




#reference: Traefik
https://www.spad.uk/posts/practical-configuration-of-traefik-as-a-reverse-proxy-for-docker-updated-for-2023/
#Middleware:
https://forum.hhf.technology/t/installing-and-setting-up-pangolin-and-middleware-manager/2255
https://github.com/hhftechnology/middleware-manager/tree/main

#mcpauth
https://github.com/oidebrett/mcpauth
