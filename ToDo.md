Gerbil patch
1. In docker-compose.yml we have commented the code "--reportBandwidthTo=http://pangolin:3002/api/v1/gerbil/receive-bandwidth" 
2. This is temporary fix for "gerbil                | INFO: 2025/06/01 01:06:07 Failed to report peer bandwidth: API returned non-OK status: 403 Forbidden"
3. Permanet solution will be 
    - Fork Gerbil
    - Patch the reportPeerBandwidth() function to send headers like:
    ```go
    req.Header.Set("P-Access-Token-Id", "gerbil")
    req.Header.Set("P-Access-Token", "supersecret123")
    ```
    - Rebuild
    ```bash
    docker build -t yourname/gerbil:custom .
    docker push yourname/gerbil:custom
    ```
    - Update the image
    ```bash
    image: yourname/gerbil:custom
    ```

