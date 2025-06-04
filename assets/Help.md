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

```bash
docker-compose logs traefik | grep -i "acme\|certificate\|error"
```


#reference: Traefik
https://www.spad.uk/posts/practical-configuration-of-traefik-as-a-reverse-proxy-for-docker-updated-for-2023/
#Middleware:
https://forum.hhf.technology/t/installing-and-setting-up-pangolin-and-middleware-manager/2255
https://github.com/hhftechnology/middleware-manager/tree/main

#mcpauth
https://github.com/oidebrett/mcpauth
